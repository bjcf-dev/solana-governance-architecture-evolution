use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{
            instruction::Instruction, 
            system_instruction,
            program_pack::Pack,
        }, 
        InstructionData, 
        ToAccountMetas
    },
    anchor_spl::token::spl_token,
    litesvm::LiteSVM,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_keypair::Keypair,
    solana_transaction::versioned::VersionedTransaction,
};
use voting::{accounts, instruction};

#[test]
fn test_secure_voting_flow() {
    let program_id = voting::id();
    let payer = Keypair::new();
    let mut svm = LiteSVM::new();

    let bytes = include_bytes!("../../../target/deploy/voting.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 2_000_000_000).unwrap();

    // We force the clock to the 50th second (greater than start_time of 10)
    let clock = anchor_lang::solana_program::clock::Clock {
        slot: 1,
        unix_timestamp: 50, 
        ..Default::default()
    };
    svm.set_sysvar::<anchor_lang::solana_program::clock::Clock>(&clock);

    let poll_id: u64 = 1;
    let candidate_name = "Rustacian".to_string();

    // ------------------------------------------------------------------------
    // TOKEN (MOCK) ENVIRONMENT CONFIGURATION
    // ------------------------------------------------------------------------
    let mint_keypair = Keypair::new();
    let mint_pubkey = mint_keypair.pubkey();

    let user_token_keypair = Keypair::new();
    let user_token_pubkey = user_token_keypair.pubkey();

    // 1. Create and Initialize the Governance Mint
    let create_mint_ix = system_instruction::create_account(
        &payer.pubkey(),
        &mint_pubkey,
        10_000_000, // Lamports for rent exemption
        spl_token::state::Mint::LEN as u64,
        &spl_token::ID,
    );
    let init_mint_ix = spl_token::instruction::initialize_mint(
        &spl_token::ID,
        &mint_pubkey,
        &payer.pubkey(),
        None,
        6,
    ).unwrap();

    // 2. Create and Initialize the Voter's Token Account
    let create_token_ix = system_instruction::create_account(
        &payer.pubkey(),
        &user_token_pubkey,
        10_000_000,
        spl_token::state::Account::LEN as u64,
        &spl_token::ID,
    );
    let init_token_ix = spl_token::instruction::initialize_account(
        &spl_token::ID,
        &user_token_pubkey,
        &mint_pubkey,
        &payer.pubkey(),
    ).unwrap();

    // 3. Deposit 150 Tokens into the user's account (This will be their voting weight)
    // Creating an explicitly typed empty slice completely satisfies rust-analyzer's type inference
    let signer_pubkeys: &[&Pubkey] = &[];

    let mint_to_ix = spl_token::instruction::mint_to(
        &spl_token::ID,
        &mint_pubkey,
        &user_token_pubkey,
        &payer.pubkey(),
        signer_pubkeys,
        150, 
    ).unwrap();

    // ------------------------------------------------------------------------
    // PDA CONFIGURATION FOR THE VOTING PROGRAM
    // ------------------------------------------------------------------------
    let (poll_pda, _) = Pubkey::find_program_address(
        [b"poll".as_ref(), &poll_id.to_le_bytes()[..]].as_slice(),
        &program_id,
    );

    let (candidate_pda, _) = Pubkey::find_program_address(
        [b"poll".as_ref(), &poll_id.to_le_bytes()[..], candidate_name.as_bytes()].as_slice(),
        &program_id,
    );

    let (vote_record_pda, _) = Pubkey::find_program_address(
        [b"voted".as_ref(), poll_pda.as_ref(), payer.pubkey().as_ref()].as_slice(),
        &program_id,
    );

    let start_time: u64 = 10;
    let end_time: u64 = 2000000000;
    
    let init_poll_instruction = Instruction::new_with_bytes(
        program_id,
        &instruction::InitPoll {
            _poll_id: poll_id,
            start_time,
            end_time,
            poll_name: "Gobernanza V2".to_string(),
            description: "Test de votacion Token-Gated".to_string(),
        }.data(),
        accounts::InitPoll {
            user: payer.pubkey(),
            poll_account: poll_pda,
            system_program: anchor_lang::solana_program::system_program::id(),
        }.to_account_metas(None),
    );

    let init_candidate_instruction = Instruction::new_with_bytes(
        program_id,
        &instruction::InitializeCandidate {
            candidate_name: candidate_name.clone(),
            _poll_id: poll_id,
        }.data(),
        accounts::InitializeCandidate {
            user: payer.pubkey(),
            poll_account: poll_pda,
            candidate_account: candidate_pda,
            system_program: anchor_lang::solana_program::system_program::id(),
        }.to_account_metas(None),
    );

    // Voting Instructions adapted to V2 with token gating
    let vote_instruction = Instruction::new_with_bytes(
        program_id,
        &instruction::Vote {
            _poll_id: poll_id,
            _candidate: candidate_name,
        }.data(),
        accounts::Vote {
            user: payer.pubkey(),
            poll_account: poll_pda,
            candidate_account: candidate_pda,
            vote_record: vote_record_pda,              // NEW PDA: Anti-double-voting shield account
            user_token_account: user_token_pubkey,      // NEW ACCOUNT: The voter's token account
            governance_token_mint: mint_pubkey,         // NEW ACCOUNT: The governance token mint account, used to verify the voter's token holdings
            token_program: spl_token::ID,               // NEW ACCOUNT: The SPL Token program, needed to interact with token accounts
            system_program: anchor_lang::solana_program::system_program::id(),
        }.to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    
    // We combined everything into a single, orderly, sequential flow.
    let msg = Message::new_with_blockhash(
        &vec![
            create_mint_ix,
            init_mint_ix,
            create_token_ix,
            init_token_ix,
            mint_to_ix,
            init_poll_instruction,
            init_candidate_instruction,
            vote_instruction,
        ],
        Some(&payer.pubkey()),
        &blockhash
    );
    
    // We signed with the payer and the keys to the newly created accounts.
    // VersionedTransaction::try_new expects a slice of concrete Keypair references.
    let signers: Vec<&Keypair> = vec![&payer, &mint_keypair, &user_token_keypair];
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();

    let res = svm.send_transaction(tx);
    res.unwrap();
}