// This is a program for a simple voting system on the Solana blockchain using the Anchor framework.
// The program allows users to initialize a voting session and cast their votes. The program's ID is defined at the top, and the main logic for initializing the voting session is handled in the `initialize` function.
use anchor_lang::prelude::*;

// Declare the program ID for the voting program. 
// This is a unique identifier for the program on the Solana blockchain. 
// And it is used to ensure that the program is correctly identified when it is called by clients or other programs.
declare_id!("DYDWxZMnCNYMKHAbhrQreo69kzCNpUrksAKNKyLDyPHY");

// This module/macro contains the logic for initializing the voting session.
// It is defined in a separate file for better organization. 
#[program]
// Now this mod`voting` contains the main functions that can be called by users of the program.
// In this case, it includes the `initPoll` function, which is responsible for setting up a new voting session.
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


    // This function is responsible for casting a vote for a candidate in the voting session.
    pub fn vote(ctx: Context<Vote>, _poll_id: u64, _candidate: String) -> Result<()> {
        let candidate_account = &mut ctx.accounts.candidate_account;

        // Check if the voting period is active
        let current_time = Clock::get()?.unix_timestamp as u64;
        if current_time > (ctx.accounts.poll_account.voting_end as u64) {
            return Err(ErrorCode::VotingEnded.into());
        }
        if current_time <= (ctx.accounts.poll_account.voting_start as u64) {
            return Err(ErrorCode::VotingNotStarted.into());
        }

        candidate_account.candidate_votes += 1; // Increment the vote count for the candidate

        ctx.accounts.vote_record.has_voted = true; // Mark the voter as having voted


        Ok(())
    }
}

// account number 1
#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitPoll<'info> {
    // This is the account of the user who is initializing the poll. 
    // The `mut` keyword indicates that this account will be modified (e.g., to pay for the transaction).
    #[account(mut)]
    pub user: Signer<'info>,

    // This account is the one that will hold the state of the voting session. 
    // It is initialized and allocated space for the data defined in the `VotingSession` struct.
    // seeds and bump represents pda (program derived address) which is a way to create deterministic addresses for accounts on the Solana blockchain.
    #[account(init, 
        payer = user, 
        space = 8 + PollAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()], // This seeds is used to create a unique address for the voting session account based on a combination of a static string and the user's public key.
        bump // The `bump` is a value used in conjunction with the seeds to ensure that the generated address is valid and does not collide with existing accounts on the blockchain.
    )]
    // This allocated account will store the details of the voting session, such as the poll name, description, voting start and end times, and the option index.
    pub poll_account: Account<'info, PollAccount>,
    // This is a system program account that is required for creating new accounts on the Solana blockchain.
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

    #[account(init, 
        payer = user, 
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"voter".as_ref(), _poll_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

// account number 4
// This macro defines the structure of the accounts (data) 
// that are required for the `initialize` function.
#[account]
// InitSpace is a macro that allocates space for the account data on the blockchain.
#[derive(InitSpace)]
// This struct represents the state of a voting session. It includes the name of the poll, a description, the start and end times for voting, and an index for the options available in the poll.
pub struct PollAccount {
    // This max_len is to define the maximun lenght for: 
    #[max_len(32)]
    pub poll_name: String,
    // the description of the poll, voting start and end times, and the option index that represents the choices available in the poll.
    #[max_len(280)]
    pub description: String,
    pub voting_start: u64,
    pub voting_end: u64,
    pub option_index: u64,
}

// account number 5
#[account]
#[derive(InitSpace)]

// This struct represents a candidate in the voting session.
// It includes the candidate's name and the number of votes they have received.
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
    // This error code is returned when a user tries to vote outside of the active voting period
    #[msg("Voting has not started yet.")]
    VotingNotStarted,
    #[msg("Voting has ended.")]
    VotingEnded,
    #[msg("Voting period is inactive.")]
    VotingPeriodInactive,
}