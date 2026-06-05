// This use means importing anchor_lang and anchor_spl to this module (lib.rs).
// We can see this as bringing the universal toolkit into our office so we can build the security infrastructure.
use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Token, Mint};

// It's the program's ID. Every time we run the `anchor build` command,
// a unique ID is generated. Think of this as the unique physical address of our building on the blockchain.
declare_id!("4jvSdJbH7ReTSRNiNwgKXLDt4UHM6k3KCu8e78Btxpem");


// This macro defines the main business logic of the voting program.
// Once the Security Guards (Validation Structs) let the user pass, this module acts as the "Clerk/Operator" 
// that modifies the files inside the office cabinets (Accounts).
#[program]
pub mod voting {
    use super::*;

    // 1. This function is responsible for initializing a new voting session. 
    // It creates the main poll "cabinet" file with its configuration like timers and names.
    pub fn init_poll(ctx: Context<InitPoll>, _poll_id: u64, start_time: u64, end_time: u64, poll_name: String, description: String) -> Result<()> {
        let poll = &mut ctx.accounts.poll_account;
        poll.poll_name = poll_name;
        poll.description = description;
        poll.voting_start = start_time;
        poll.voting_end = end_time;
        poll.option_index = 0;
        Ok(())
    }

    // 2. This function initializes a candidate folder inside the poll ecosystem.
    pub fn initialize_candidate(
        ctx: Context<InitializeCandidate>,  
        candidate_name: String,
        _poll_id: u64, 
    ) -> Result<()> {
        let candidate = &mut ctx.accounts.candidate_account;
        let poll = &mut ctx.accounts.poll_account;
        candidate.candidate_name = candidate_name; // Save the candidate name to the candidate account cabinet
        candidate.candidate_votes = 0; // Initialize the candidate's votes to 0
        poll.option_index += 1; // Increment the options counter inside the main poll file
        Ok(())
    }

    // 3. This function executes the action of casting a vote.
    // It reads the security badge (tokens) and increments the votes for the candidate.
    pub fn vote(ctx: Context<Vote>, _poll_id: u64, _candidate: String) -> Result<()> {
        let candidate_account = &mut ctx.accounts.candidate_account;

        // Internal business logic check: Clock verification (Time constraints)
        let current_time = Clock::get()?.unix_timestamp as u64;
        if current_time > (ctx.accounts.poll_account.voting_end as u64) {
            return Err(ErrorCode::VotingEnded.into());
        }
        if current_time <= (ctx.accounts.poll_account.voting_start as u64) {
            return Err(ErrorCode::VotingNotStarted.into());
        }

        // Extract how many tokens the voter holds in their wallet to determine their voting power/weight.
        let vote_weight: u64 = ctx.accounts.user_token_account.amount;

        // Anti-spam mechanism: If the voter does not hold any tokens, the clerk kicks them out.
        require!(vote_weight > 0, ErrorCode::NoTokensOwned);

        // The clerk writes down in the "Signature Book" that this user has officially exercised their right.
        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.has_voted = true;

        // Add the exact number of tokens as a weight to the candidate's total vote file counter.
        candidate_account.candidate_votes += vote_weight;

        Ok(())
    }
}


// SECURITY GUARD #1: This validation struct acts like a guard checking credentials before creating a poll.
#[derive(Accounts)]
// The instruction macro allows us to pass parameters to the guard, which we can use for dynamic checks (like matching the poll_id).
#[instruction(poll_id: u64)]
pub struct InitPoll<'info> {
    // The guard checks if the user is physically present and signing the paperwork.
    #[account(mut)]
    pub user: Signer<'info>,

    // The guard checks if we can rent a new space in the building (init) paid by the user,
    // creating a unique address using the poll_id as a serial number (seed).
    #[account(init, 
        payer = user, 
        space = 8 + PollAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), &poll_id.to_le_bytes()[..]], 
        bump 
    )]
    pub poll_account: Account<'info, PollAccount>,

    // External dependency: The system architect required to handle account creation.
    pub system_program: Program<'info, System>,
}


// SECURITY GUARD #2: This validation struct ensures the candidate is initialized legally inside the correct poll.
#[derive(Accounts)]
// The instruction macro allows us to pass parameters to the guard, which we can use for dynamic checks (like matching the poll_id).
#[instruction(candidate_name: String, _poll_id: u64)]
pub struct InitializeCandidate<'info> {
    
    // Checks that the person adding the candidate signs the transaction.
    #[account(mut)]
    pub user: Signer<'info>,

    // Verifies that the poll cabinet we are trying to target actually exists and its serial number (seed) matches.
    #[account(mut, 
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]], 
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    // Creates a new folder for the candidate, linked dynamically to the poll_id and the candidate_name.
    #[account(init,
        payer = user,
        space = 8 + CandidateAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..], candidate_name.as_bytes()],
        bump
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    pub system_program: Program<'info, System>,
}


// SECURITY GUARD #3: The most complex guard. It checks the voter's identity, token ownership, token legitimacy, and double-voting prevention.
#[derive(Accounts)]
// The instruction macro allows us to pass parameters to the guard, which we can use for dynamic checks (like matching the poll_id and candidate).
#[instruction(_poll_id: u64, _candidate: String)] 
pub struct Vote<'info> {

    // Ensures the voter is signing the action.
    #[account(mut)]
    pub user: Signer<'info>,

    // Locates and validates the targeted poll file via its PDA seeds.
    #[account(mut, 
        seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..]],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    // Locates and validates the targeted candidate file via its PDA seeds.
    #[account(mut, 
    seeds = [b"poll".as_ref(), &_poll_id.to_le_bytes()[..], _candidate.as_bytes()],
    bump
)]
pub candidate_account: Account<'info, CandidateAccount>,

    // Anti-double-voting shield: Tries to initialize a VoteRecord PDA for this specific user and poll.
    // If the account already exists, Solana rejects the transaction automatically.
    #[account(init,
        payer = user,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"voted", poll_account.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    // Guard Checks: 
    // 1. Ensures the passport/token vault presented belongs to the user signing.
    // 2. Ensures the tokens inside the vault are the official currency (Mint) approved by the DAO.
    #[account(
        constraint = user_token_account.owner == user.key() @ ErrorCode::NotTokenOwner, 
        constraint = user_token_account.mint == governance_token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    // The official template/blueprint of the currency. Used to double-check that the user isn't showing fake tokens.
    #[account()]
    pub governance_token_mint: Account<'info, Mint>,
    
    // The External Token Program (The accountant system that manages SPL token vaults).
    pub token_program: Program<'info, Token>,
    
    // The System Program needed for basic memory allocation.
    pub system_program: Program<'info, System>,
}


// CABINET FILE #1: This struct defines the data layout for a Poll session.
// It is NOT a validator; it's a blueprint of the file stored inside the blockchain cabinet.
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


// CABINET FILE #2: This struct defines the data layout for a Candidate.
// It acts as the index card containing the name and the accumulated voting power.
#[account]
#[derive(InitSpace)]
pub struct CandidateAccount {
    #[max_len(32)]
    pub candidate_name: String,
    pub candidate_votes: u64,
}


// CABINET FILE #3: This struct defines the data layout for a Vote Record.
// It acts as a "Signature Book" to write down who has already voted, preventing double voting.
#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub has_voted: bool,
}


// The Alarm System: Defines custom error codes. 
// If a Security Guard or the Clerk stops an execution, they pull one of these levers to broadcast the error message.
#[error_code]
pub enum ErrorCode {
    #[msg("Voting has not started yet.")]
    VotingNotStarted,
    #[msg("Voting has ended.")]
    VotingEnded,
    #[msg("Voting period is inactive.")]
    VotingPeriodInactive,
    #[msg("The wallet does not own the presented token account")] 
    NotTokenOwner,
    #[msg("The presented token does not belong to the official governance currency..")] 
    InvalidMint,
    #[msg("You do not have enough tokens to cast a vote..")] 
    NoTokensOwned,
}