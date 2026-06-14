// This use means importing anchor_lang and anchor_spl to this module (lib.rs).
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

// Program ID — unique address of this program on the blockchain.
declare_id!("4jvSdJbH7ReTSRNiNwgKXLDt4UHM6k3KCu8e78Btxpem");


// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod voting {
    use super::*;

    // ── 1. Initialize Poll ──────────────────────────────────────────────────
    // Creates the main poll PDA with configuration (timers, name, description).
    pub fn init_poll(
        ctx: Context<InitPoll>,
        _poll_id: u64,
        start_time: u64,
        end_time: u64,
        poll_name: String,
        description: String,
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll_account;
        poll.poll_name = poll_name;
        poll.description = description;
        poll.voting_start = start_time;
        poll.voting_end = end_time;
        poll.option_index = 0;
        poll.total_tokens_locked = 0;
        Ok(())
    }

    // ── 2. Initialize Candidate ─────────────────────────────────────────────
    // Registers a new candidate inside an existing poll.
    pub fn initialize_candidate(
        ctx: Context<InitializeCandidate>,
        candidate_name: String,
        _poll_id: u64,
    ) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate_account;
        let poll = &mut ctx.accounts.poll_account;
        candidate.candidate_name = candidate_name;
        candidate.candidate_votes = 0;
        poll.option_index += 1;
        Ok(())
    }

    // ── 3. Vote (Token-Gated with Escrow) ───────────────────────────────────
    // Locks `amount` SPL tokens in an EscrowVault PDA and records the vote.
    // Flow:
    //   1. Anchor inits VoteRecord + EscrowVault (parallel via constraints)
    //   2. Validate amount > 0 and user has sufficient balance
    //   3. Validate voting window (start < now <= end)
    //   4. CPI transfer: user ATA → EscrowVault
    //   5. Update cumulative totals
    pub fn vote(
        ctx: Context<Vote>,
        _poll_id: u64,
        _candidate: String,
        amount: u64,
    ) -> Result<()> {
        // ── Validation: token amount ──
        require!(amount > 0, ErrorCode::InsufficientTokens);
        require!(
            ctx.accounts.user_token_account.amount >= amount,
            ErrorCode::InsufficientTokens
        );

        // ── Validation: voting window ──
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        require!(
            current_time > ctx.accounts.poll_account.voting_start,
            ErrorCode::VotingNotStarted
        );
        require!(
            current_time <= ctx.accounts.poll_account.voting_end,
            ErrorCode::VotingEnded
        );

        // ── CPI: Transfer tokens from voter ATA → EscrowVault ──
        let cpi_transfer = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                cpi_transfer,
            ),
            amount,
        )?;

        // ── Update state: VoteRecord ──
        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.poll_account = ctx.accounts.poll_account.key();
        vote_record.voter = ctx.accounts.user.key();
        vote_record.candidate_name = _candidate;
        vote_record.tokens_deposited = amount;
        vote_record.has_voted = true;
        vote_record.timestamp = clock.unix_timestamp;

        // ── Update state: cumulative totals ──
        ctx.accounts.candidate_account.candidate_votes = ctx
            .accounts
            .candidate_account
            .candidate_votes
            .checked_add(amount)
            .ok_or(ErrorCode::InsufficientTokens)?;

        let poll = &mut ctx.accounts.poll_account;
        poll.total_tokens_locked = poll
            .total_tokens_locked
            .checked_add(amount)
            .ok_or(ErrorCode::InsufficientTokens)?;

        Ok(())
    }

    // ── 4. Withdraw Tokens (Post-Voting Phase) ──────────────────────────────
    // Returns 100% of locked tokens to the voter and destroys VoteRecord + EscrowVault.
    // Only allowed after voting_end has passed.
    // Flow:
    //   1. Validate current_time > voting_end
    //   2. CPI transfer: EscrowVault → user ATA (return tokens)
    //   3. CPI close_account: destroy EscrowVault TokenAccount (lamports → user)
    //   4. Anchor close: destroy VoteRecord (lamports → user, via close = user constraint)
    pub fn withdraw_tokens(ctx: Context<Withdraw>, _poll_id: u64) -> Result<()> {
        // ── Validation: voting must have ended ──
        let current_time = Clock::get()?.unix_timestamp as u64;
        require!(
            current_time > ctx.accounts.poll_account.voting_end,
            ErrorCode::WithdrawNotAllowed
        );

        let amount = ctx.accounts.vote_record.tokens_deposited;

        // ── Derive EscrowVault PDA signer seeds ──
        let poll_key = ctx.accounts.poll_account.key();
        let user_key = ctx.accounts.user.key();
        let escrow_seeds = &[
            b"escrow".as_ref(),
            poll_key.as_ref(),
            user_key.as_ref(),
            &[ctx.bumps.escrow_vault],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        // ── CPI: Transfer tokens back from EscrowVault → user ATA ──
        let cpi_return = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.escrow_vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                cpi_return,
                signer_seeds,
            ),
            amount,
        )?;

        // ── CPI: Close EscrowVault TokenAccount (lamports → user) ──
        let cpi_close = CloseAccount {
            account: ctx.accounts.escrow_vault.to_account_info(),
            destination: ctx.accounts.user.to_account_info(),
            authority: ctx.accounts.escrow_vault.to_account_info(),
        };
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_close,
            signer_seeds,
        ))?;

        // Note: VoteRecord is closed automatically by Anchor via `close = user` constraint.

        Ok(())
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT VALIDATION STRUCTS (Security Guards)
// ─────────────────────────────────────────────────────────────────────────────

// ── InitPoll ────────────────────────────────────────────────────────────────
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
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    pub system_program: Program<'info, System>,
}


// ── InitializeCandidate ─────────────────────────────────────────────────────
#[derive(Accounts)]
#[instruction(candidate_name: String, _poll_id: u64)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(
        init,
        payer = user,
        space = 8 + CandidateAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..], candidate_name.as_bytes()],
        bump
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    pub system_program: Program<'info, System>,
}


// ── Vote (Token-Gated with Escrow) ──────────────────────────────────────────
#[derive(Accounts)]
#[instruction(_poll_id: u64, _candidate: String, amount: u64)]
pub struct Vote<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    // Poll PDA — located via seeds
    #[account(
        mut,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    // Candidate PDA — located via seeds with candidate name
    #[account(
        mut,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..], _candidate.as_bytes()],
        bump
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    // VoteRecord PDA — anti-double-vote shield (init fails if already exists)
    #[account(
        init,
        payer = user,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"voted", poll_account.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    // Voter's token account (source of tokens, written by CPI transfer)
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ ErrorCode::NotTokenOwner,
        constraint = user_token_account.mint == governance_token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    // Governance token mint — reference for validation
    pub governance_token_mint: Account<'info, Mint>,

    // EscrowVault — SPL TokenAccount PDA that custodies locked tokens
    // Seeds: ["escrow", poll_account, user]
    // Authority: itself (the PDA signs via signer seeds in CPI)
    #[account(
        init,
        payer = user,
        token::mint = governance_token_mint,
        token::authority = escrow_vault,
        seeds = [b"escrow", poll_account.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


// ── Withdraw (Post-Voting Token Recovery) ───────────────────────────────────
#[derive(Accounts)]
#[instruction(_poll_id: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    // Poll PDA — read-only, needed for voting_end validation
    #[account(
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    // VoteRecord PDA — will be closed, lamports returned to user
    #[account(
        mut,
        close = user,
        seeds = [b"voted", poll_account.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    // EscrowVault TokenAccount — tokens returned to voter, then closed
    #[account(
        mut,
        seeds = [b"escrow", poll_account.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    // Voter's token account — receives returned tokens
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ ErrorCode::NotTokenOwner,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}


// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT STATE STRUCTS (Cabinet Files)
// ─────────────────────────────────────────────────────────────────────────────

// ── PollAccount ─────────────────────────────────────────────────────────────
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
    pub total_tokens_locked: u64,
}


// ── CandidateAccount ────────────────────────────────────────────────────────
#[account]
#[derive(InitSpace)]
pub struct CandidateAccount {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
}


// ── VoteRecord ──────────────────────────────────────────────────────────────
#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub poll_account: Pubkey,
    pub voter: Pubkey,
    #[max_len(32)]
    pub candidate_name: String,
    pub tokens_deposited: u64,
    pub has_voted: bool,
    pub timestamp: i64,
}


// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Voting has not started yet.")]
    VotingNotStarted,
    #[msg("Voting has ended.")]
    VotingEnded,
    #[msg("Voting period is inactive.")]
    VotingPeriodInactive,
    #[msg("The wallet does not own the presented token account.")]
    NotTokenOwner,
    #[msg("The presented token does not belong to the official governance currency.")]
    InvalidMint,
    #[msg("Insufficient tokens to cast a vote.")]
    InsufficientTokens,
    #[msg("Withdrawal is not allowed before voting has ended.")]
    WithdrawNotAllowed,
}
