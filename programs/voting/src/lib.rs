use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Token, Mint};

declare_id!("DYDWxZMnCNYMKHAbhrQreo69kzCNpUrksAKNKyLDyPHY");

#[program]
pub mod voting {
    use super::*;

    // This function is responsible for initializing a new voting session. 
    // what it do is takes a context as an argument, 
    // which contains the accounts and data needed to set up the voting session.
    pub fn init_poll(ctx: Context<InitPoll>, _poll_id: u64, start_time: u64, end_time: u64, poll_name: String, description: String) -> Result<()> {
        let poll = &mut ctx.accounts.poll_account;
        poll.poll_name = poll_name;
        poll.description = description;
        poll.voting_start = start_time;
        poll.voting_end = end_time;
        poll.option_index = 0;
        Ok(())
    }

    // This function is responsible for initializing a candidate in the voting session.
    pub fn initialize_candidate(
        ctx: Context<InitializeCandidate>,  //  ctx is the context that contains the accounts and data needed to set up the candidate.
        candidate_name: String,
        _poll_id: u64, 
    ) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate_account;
        let poll = &mut ctx.accounts.poll_account;
        candidate.candidate_name = candidate_name; // save the candidate name to the candidate account
        candidate.candidate_votes = 0; // initialize the candidate's votes to 0
        poll.option_index += 1; // increment 1 to the counter of the options in the poll account
        Ok(())
    }

    // fn vote is responsible for casting a vote for a candidate in the voting session.
    pub fn vote(ctx: Context<Vote>, _poll_id: u64, _candidate: String) -> Result<()> {
        let candidate_account= &mut ctx.accounts.candidate_account;

        // Check if the voting period is active
        let current_time = Clock::get()?.unix_timestamp as u64;
        if current_time > (ctx.accounts.poll_account.voting_end as u64) {
            return Err(ErrorCode::VotingEnded.into());
        }
        if current_time <= (ctx.accounts.poll_account.voting_start as u64) {
            return Err(ErrorCode::VotingNotStarted.into());
        }

        // first we extract how many tokens the voter holds in their wallet.
        let vote_weight: u64 = ctx.accounts.user_token_account.amount;

        // anti-spam mechanism_ if the voter does not hold any tokens, they cannot vote.
        require!(vote_weight > 0, ErrorCode::NoTokensOwned);

        // now we add the exact number of tokens as a weight to the candidate's vote count.
        candidate_account.candidate_votes += vote_weight;


        //candidate_account.candidate_votes += 1; // Increment the vote count for the candidate

        //ctx.accounts.vote_record.has_voted = true; // Mark the voter as having voted


        Ok(())
    }
}




// account number 1
#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitPoll<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(init, 
        payer = user, 
        space = 8 + PollAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()], // This seeds is used to create a unique address for the voting session account based on a combination of a static string and the user's public key.
        bump // The `bump` is a value used in conjunction with the seeds to ensure that the generated address is valid and does not collide with existing accounts on the blockchain.
    )]

    pub poll_account: Account<'info, PollAccount>,

    pub system_program: Program<'info, System>,
}

// account number 2
#[derive(Accounts)]
#[instruction(candidate_name: String, _poll_id: u64)]
pub struct InitializeCandidate<'info> {
    
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, 
        seeds = [b"poll".as_ref(), _poll_id.to_le_bytes().as_ref()], // This seeds is used to create a unique address for the candidate account based on a combination of a static string, the user's public key, the poll ID, and the candidate's name.
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(init, 
        payer = user, 
        space = 8 + CandidateAccount::INIT_SPACE,
        seeds = [_poll_id.to_le_bytes().as_ref(), candidate_name.as_ref()], // This seeds is used to create a unique address for the candidate account based on a combination of a static string, the poll ID, and the candidate's name.
        bump
    )]

    pub candidate_account: Account<'info, CandidateAccount>,
    pub system_program: Program<'info, System>,
}

// account number 3
#[derive(Accounts)]
#[instruction(_poll_id: u64, _candidate: String)] 

pub struct Vote<'info> {

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, 
        seeds = [b"poll".as_ref(), _poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(
        mut, 
        seeds = [_poll_id.to_le_bytes().as_ref(), _candidate.as_ref()],
        bump
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    #[account(
        constraint = user_token_account.owner == user.key() @ ErrorCode::NotTokenOwner, 
        constraint = user_token_account.mint == governance_token_mint.key() @ ErrorCode::InvalidMint,
    )]

    // adding a new account to keep track of whether a user has voted or not.
    pub user_token_account: Account<'info, TokenAccount>,

    // adding the governance token mint account to the context of the `vote` function.
    // This account is used to verify that the voter holds the required governance tokens
    // to participate in the voting process.
    #[account()]
    pub governance_token_mint: Account<'info, Mint>,
    // adding the token program to the context of the `vote` function.
    // This allows the program to interact with the SPL Token program, 
    // which is necessary for checking token balances and transferring tokens if needed.
    
    pub token_program: Program<'info, Token>,
    // adding the system program to the context of the `vote` function,
    // which is necessary for creating new accounts (like the vote record account)
    // and handling other system-level operations on the Solana blockchain.
    pub system_program: Program<'info, System>,
}

// account number 4
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
}

// account number 5
#[account]
#[derive(InitSpace)]

pub struct CandidateAccount {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
}

// account number 6
#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub has_voted: bool,
}

// This module/Macro defines custom error codes for the voting program.
#[error_code]
pub enum ErrorCode {
    #[msg("Voting has not started yet.")]
    VotingNotStarted,
    #[msg("Voting has ended.")]
    VotingEnded,
    #[msg("Voting period is inactive.")]
    VotingPeriodInactive,
    #[msg("The wallet does not own the presented token account")] // ◄— New msg error
    NotTokenOwner,
    #[msg("The presented token does not belong to the official governance currency..")] // ◄— NUEVA
    InvalidMint,
    #[msg("You do not have enough tokens to cast a vote..")] // ◄— New msg error
    NoTokensOwned,
}

