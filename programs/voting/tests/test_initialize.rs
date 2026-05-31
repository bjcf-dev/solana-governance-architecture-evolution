use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::instruction::Instruction, 
        InstructionData, 
        ToAccountMetas
    },
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

    let clock = anchor_lang::solana_program::clock::Clock {
        slot: 1,
        unix_timestamp: 50, // Forzamos el reloj al segundo 50 (mayor que start_time de 10)
        ..Default::default()
    };
    svm.set_sysvar::<anchor_lang::solana_program::clock::Clock>(&clock);


    let poll_id: u64 = 1;
    let candidate_name = "Rustacian".to_string();

    let (poll_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes()[..]],
        &program_id,
    );

    let (candidate_pda, _) = Pubkey::find_program_address(
        &[&poll_id.to_le_bytes()[..], candidate_name.as_bytes()],
        &program_id,
    );

    let (vote_record_pda, _) = Pubkey::find_program_address(
        &[b"voter", &poll_id.to_le_bytes()[..], payer.pubkey().as_ref()],
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
            poll_name: "Gobernanza V1".to_string(),
            description: "Test de votacion".to_string(),
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
            vote_record: vote_record_pda,
            system_program: anchor_lang::solana_program::system_program::id(),
        }.to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    
    let msg = Message::new_with_blockhash(
        &[init_poll_instruction, init_candidate_instruction, vote_instruction], 
        Some(&payer.pubkey()), 
        &blockhash
    );
    
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();

    let res = svm.send_transaction(tx);
    

    res.unwrap();
}