use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;

declare_id!("e956D3re1SUEx68mDUdzxujGBhfoXZBEBC75HKigEod");

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────────

#[event]
pub struct VoteCast {
    pub voter: Pubkey,
    pub leaf_index: u64,
    pub candidate_name: String,
    pub amount: u64,
}

#[event]
pub struct PollClosed {
    pub id: u64,
    pub total_votes: u64,
}


// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod voting {
    use super::*;

    // ── 1. Init Poll ──────────────────────────────────────────────────────────
    pub fn init_poll(
        ctx: Context<InitPoll>,
        _poll_id: u64,
        start_time: u64,
        end_time: u64,
        poll_name: String,
        description: String,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll_account;
        poll.poll_name = poll_name;
        poll.description = description;
        poll.voting_start = start_time;
        poll.voting_end = end_time;
        poll.option_index = 0;
        poll.merkle_root = merkle_root;
        // nullifier_bitmask starts empty — first vote resizes it
        Ok(())
    }

    // ── 2. Init Candidate ────────────────────────────────────────────────────
    pub fn initialize_candidate(
        ctx: Context<InitializeCandidate>,
        candidate_name: String,
        _poll_id: u64,
    ) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate_account;
        let poll = &mut ctx.accounts.poll_account;
        candidate.candidate_name = candidate_name.clone();
        candidate.candidate_votes = 0;
        poll.option_index += 1;
        Ok(())
    }

    // ── 3. Vote (Merkle-Proof) ───────────────────────────────────────────────
    /// Verifies that `leaf` is in the Merkle tree via `proof`,
    /// ensures the voter hasn't voted before (nullifier bitmask),
    /// and increments the candidate's vote count.
    /// No VoteRecord is created — this is the scalability win.
    pub fn vote(
        ctx: Context<Vote>,
        _poll_id: u64,
        candidate_name: String,
        amount: u64,
        proof: Vec<[u8; 32]>,
        leaf_index: u64,
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll_account;

        // ponytail: time checks stay, same as V2
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        require!(
            current_time >= poll.voting_start,
            ErrorCode::VotingNotStarted
        );
        require!(
            current_time <= poll.voting_end,
            ErrorCode::VotingEnded
        );
        require!(!poll.closed, ErrorCode::PollClosed);

        // Compute leaf = hash(voter, candidate, amount)
        let leaf = hashv(&[
            ctx.accounts.user.key().as_ref(),
            candidate_name.as_bytes(),
            &amount.to_le_bytes(),
        ]);

        // Verify Merkle proof
        require!(
            verify_merkle_proof(&poll.merkle_root, &leaf.to_bytes(), &proof, leaf_index),
            ErrorCode::InvalidMerkleProof
        );

        // Check & mark nullifier bitmask
        let byte_pos = (leaf_index / 8) as usize;
        let bit_pos = (leaf_index % 8) as u8;
        if byte_pos >= poll.nullifier_bitmask.len() {
            // ponytail: grow bitmask on first use
            let needed = byte_pos + 1;
            poll.nullifier_bitmask.resize(needed, 0);
        }
        require!(
            poll.nullifier_bitmask[byte_pos] & (1 << bit_pos) == 0,
            ErrorCode::AlreadyVoted
        );
        poll.nullifier_bitmask[byte_pos] |= 1 << bit_pos;

        // Increment candidate
        let candidate = &mut ctx.accounts.candidate_account;
        candidate.candidate_votes = candidate
            .candidate_votes
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(VoteCast {
            voter: ctx.accounts.user.key(),
            leaf_index,
            candidate_name,
            amount,
        });

        Ok(())
    }

    // ── 4. Close Poll ────────────────────────────────────────────────────────
    pub fn close_poll(ctx: Context<ClosePoll>, _poll_id: u64) -> Result<()> {
        let poll = &mut ctx.accounts.poll_account;
        require!(!poll.closed, ErrorCode::PollAlreadyClosed);

        poll.closed = true;

        emit!(PollClosed {
            id: _poll_id,
            total_votes: poll.option_index,
        });
        Ok(())
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// MERKLE PROOF VERIFICATION (inline — no library needed)
// ─────────────────────────────────────────────────────────────────────────────

/// Verifies that `leaf` is in a Merkle tree with the given `root`,
/// using a proof of sibling hashes and the leaf's position index.
/// ponytail: inline hash chain, no dependency.
fn verify_merkle_proof(
    root: &[u8; 32],
    leaf: &[u8; 32],
    proof: &[[u8; 32]],
    mut index: u64,
) -> bool {
    let mut current = *leaf;
    for sibling in proof {
        let pair = if index & 1 == 0 {
            [&current[..], &sibling[..]]
        } else {
            [&sibling[..], &current[..]]
        };
        current = hashv(&pair).to_bytes();
        index >>= 1;
    }
    &current == root
}


// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitPoll<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + PollAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), &poll_id.to_le_bytes()[..]],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(candidate_name: String, _poll_id: u64)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>,
    #[account(
        init,
        payer = user,
        space = 8 + CandidateAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..], candidate_name.as_bytes()],
        bump,
    )]
    pub candidate_account: Account<'info, CandidateAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_poll_id: u64, candidate_name: String, amount: u64, proof: Vec<[u8; 32]>, leaf_index: u64)]
pub struct Vote<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>,
    #[account(
        mut,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..], candidate_name.as_bytes()],
        bump,
    )]
    pub candidate_account: Account<'info, CandidateAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_poll_id: u64)]
pub struct ClosePoll<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>,
}


// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT STATE
// ─────────────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct PollAccount {
    #[max_len(32)]
    pub poll_name: String,
    #[max_len(280)]
    pub description: String,
    pub voting_start: u64,
    pub voting_end: u64,
    pub option_index: u64,
    pub merkle_root: [u8; 32],
    #[max_len(128)]
    pub nullifier_bitmask: Vec<u8>,
    pub closed: bool,
}

#[account]
#[derive(InitSpace)]
pub struct CandidateAccount {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
}


// ─────────────────────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Voting has not started yet.")]
    VotingNotStarted,
    #[msg("Voting has ended.")]
    VotingEnded,
    #[msg("This poll is closed.")]
    PollClosed,
    #[msg("Invalid Merkle proof.")]
    InvalidMerkleProof,
    #[msg("This voter has already cast a vote for this poll.")]
    AlreadyVoted,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("This poll has already been closed.")]
    PollAlreadyClosed,
}
