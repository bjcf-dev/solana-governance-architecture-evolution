use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{
            instruction::Instruction,
            system_instruction,
            program_pack::Pack,
            clock::Clock,
        },
        InstructionData,
        ToAccountMetas,
        AccountDeserialize,
    },
    anchor_spl::token::spl_token,
    litesvm::LiteSVM,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_keypair::Keypair,
    solana_transaction::versioned::VersionedTransaction,
};
use voting::{accounts, instruction, PollAccount, CandidateAccount, VoteRecord};

// ============================================================================
// HELPERS
// ============================================================================

fn setup_svm() -> (LiteSVM, Keypair) {
    let payer = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/voting.so");
    svm.add_program(voting::id(), bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    (svm, payer)
}

fn set_clock(svm: &mut LiteSVM, unix_timestamp: i64) {
    svm.set_sysvar::<Clock>(&Clock {
        slot: 1,
        unix_timestamp,
        ..Default::default()
    });
}

// ── Token helpers ───────────────────────────────────────────────────────────

fn create_mint(svm: &mut LiteSVM, payer: &Keypair, mint_kp: &Keypair) {
    let ix_create = system_instruction::create_account(
        &payer.pubkey(), &mint_kp.pubkey(),
        10_000_000,
        spl_token::state::Mint::LEN as u64,
        &spl_token::ID,
    );
    let ix_init = spl_token::instruction::initialize_mint(
        &spl_token::ID, &mint_kp.pubkey(), &payer.pubkey(), None, 6,
    ).unwrap();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix_create, ix_init], Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer, mint_kp]).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn create_token_account(
    svm: &mut LiteSVM, payer: &Keypair, token_kp: &Keypair,
    mint: &Pubkey, owner: &Pubkey,
) {
    let ix_create = system_instruction::create_account(
        &payer.pubkey(), &token_kp.pubkey(),
        10_000_000,
        spl_token::state::Account::LEN as u64,
        &spl_token::ID,
    );
    let ix_init = spl_token::instruction::initialize_account(
        &spl_token::ID, &token_kp.pubkey(), mint, owner,
    ).unwrap();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix_create, ix_init], Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer, token_kp]).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn mint_to(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey, dest: &Pubkey, amount: u64) {
    let ix = spl_token::instruction::mint_to(
        &spl_token::ID, mint, dest, &payer.pubkey(), &[], amount,
    ).unwrap();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn setup_voter(
    svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey,
    voter_kp: &Keypair, token_kp: &Keypair, balance: u64,
) {
    svm.airdrop(&voter_kp.pubkey(), 3_000_000_000).unwrap();
    create_token_account(svm, payer, token_kp, mint, &voter_kp.pubkey());
    if balance > 0 {
        mint_to(svm, payer, mint, &token_kp.pubkey(), balance);
    }
}

// ── PDA derivations ────────────────────────────────────────────────────────

fn poll_pda(poll_id: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"poll", &poll_id.to_le_bytes()], &voting::id()).0
}
fn candidate_pda(poll_id: u64, name: &str) -> Pubkey {
    Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes(), name.as_bytes()], &voting::id(),
    ).0
}
fn vote_record_pda(poll: &Pubkey, user: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"voted", poll.as_ref(), user.as_ref()], &voting::id()).0
}
fn escrow_pda(poll: &Pubkey, user: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"escrow", poll.as_ref(), user.as_ref()], &voting::id()).0
}

// ── Instruction builders ────────────────────────────────────────────────────

fn init_poll_ix(payer: &Pubkey, poll_id: u64, start: u64, end: u64) -> Instruction {
    Instruction::new_with_bytes(
        voting::id(),
        &instruction::InitPoll {
            _poll_id: poll_id, start_time: start, end_time: end,
            poll_name: "Test".to_string(), description: "T".to_string(),
        }.data(),
        accounts::InitPoll {
            user: *payer,
            poll_account: poll_pda(poll_id),
            system_program: anchor_lang::solana_program::system_program::id(),
        }.to_account_metas(None),
    )
}

fn init_candidate_ix(payer: &Pubkey, poll_id: u64, name: &str) -> Instruction {
    Instruction::new_with_bytes(
        voting::id(),
        &instruction::InitializeCandidate {
            candidate_name: name.to_string(), _poll_id: poll_id,
        }.data(),
        accounts::InitializeCandidate {
            user: *payer,
            poll_account: poll_pda(poll_id),
            candidate_account: candidate_pda(poll_id, name),
            system_program: anchor_lang::solana_program::system_program::id(),
        }.to_account_metas(None),
    )
}

fn vote_ix(
    user: &Pubkey, poll_id: u64, candidate: &str,
    user_token: &Pubkey, gov_mint: &Pubkey, amount: u64,
) -> Instruction {
    let poll = poll_pda(poll_id);
    Instruction::new_with_bytes(
        voting::id(),
        &instruction::Vote {
            _poll_id: poll_id,
            _candidate: candidate.to_string(),
            amount,
        }.data(),
        accounts::Vote {
            user: *user,
            poll_account: poll,
            candidate_account: candidate_pda(poll_id, candidate),
            vote_record: vote_record_pda(&poll, user),
            user_token_account: *user_token,
            governance_token_mint: *gov_mint,
            escrow_vault: escrow_pda(&poll, user),
            token_program: spl_token::ID,
            system_program: anchor_lang::solana_program::system_program::id(),
        }.to_account_metas(None),
    )
}

fn withdraw_ix(user: &Pubkey, poll_id: u64, user_token: &Pubkey) -> Instruction {
    let poll = poll_pda(poll_id);
    Instruction::new_with_bytes(
        voting::id(),
        &instruction::WithdrawTokens { _poll_id: poll_id }.data(),
        accounts::Withdraw {
            user: *user,
            poll_account: poll,
            vote_record: vote_record_pda(&poll, user),
            escrow_vault: escrow_pda(&poll, user),
            user_token_account: *user_token,
            token_program: spl_token::ID,
        }.to_account_metas(None),
    )
}

// ── Send helpers ────────────────────────────────────────────────────────────

fn send(svm: &mut LiteSVM, ixs: Vec<Instruction>, signers: &[&Keypair]) {
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&signers[0].pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn try_send(svm: &mut LiteSVM, ixs: Vec<Instruction>, signers: &[&Keypair]) -> bool {
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&signers[0].pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx).is_ok()
}

// ── State readers ───────────────────────────────────────────────────────────

fn read_poll(svm: &LiteSVM, poll_id: u64) -> PollAccount {
    PollAccount::try_deserialize(&mut &svm.get_account(&poll_pda(poll_id)).unwrap().data[..]).unwrap()
}
fn read_candidate(svm: &LiteSVM, poll_id: u64, name: &str) -> CandidateAccount {
    CandidateAccount::try_deserialize(&mut &svm.get_account(&candidate_pda(poll_id, name)).unwrap().data[..]).unwrap()
}
fn read_vote_record(svm: &LiteSVM, poll_id: u64, user: &Pubkey) -> VoteRecord {
    let p = poll_pda(poll_id);
    VoteRecord::try_deserialize(&mut &svm.get_account(&vote_record_pda(&p, user)).unwrap().data[..]).unwrap()
}
fn token_balance(svm: &LiteSVM, tk: &Pubkey) -> u64 {
    spl_token::state::Account::unpack(&svm.get_account(tk).unwrap().data).unwrap().amount
}
fn exists(svm: &LiteSVM, pk: &Pubkey) -> bool {
    svm.get_account(pk).is_some()
}


// ============================================================================
// A ─ HAPPY PATH
// ============================================================================

#[test]
fn test_secure_voting_flow() {
    let (mut svm, payer) = setup_svm();
    set_clock(&mut svm, 50);

    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 150);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Rustacian"),
        vote_ix(&payer.pubkey(), 1, "Rustacian", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]);

    assert_eq!(read_poll(&svm, 1).total_tokens_locked, 150);
    assert_eq!(read_candidate(&svm, 1, "Rustacian").candidate_votes, 150);
    let vr = read_vote_record(&svm, 1, &payer.pubkey());
    assert_eq!(vr.tokens_deposited, 150);
    assert!(vr.has_voted);
}

#[test]
fn test_complete_voting_cycle() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 200);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 100),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);

    set_clock(&mut svm, 50);
    send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]);

    let esc = escrow_pda(&poll_pda(1), &payer.pubkey());
    assert_eq!(token_balance(&svm, &esc), 150);
    assert_eq!(token_balance(&svm, &tk.pubkey()), 50);

    set_clock(&mut svm, 200);
    send(&mut svm, vec![
        withdraw_ix(&payer.pubkey(), 1, &tk.pubkey()),
    ], &[&payer]);

    assert!(!exists(&svm, &vote_record_pda(&poll_pda(1), &payer.pubkey())));
    assert!(!exists(&svm, &esc));
    assert_eq!(token_balance(&svm, &tk.pubkey()), 200);
}


// ============================================================================
// B ─ TIME VALIDATION
// ============================================================================

#[test]
fn test_vote_before_voting_start() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 150);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);

    set_clock(&mut svm, 5);
    assert!(!try_send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]));
}

#[test]
fn test_vote_after_voting_end() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 150);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 100),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);

    set_clock(&mut svm, 200);
    assert!(!try_send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]));
}

#[test]
fn test_withdraw_before_voting_end() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 150);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);

    set_clock(&mut svm, 50);
    send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]);

    assert!(!try_send(&mut svm, vec![
        withdraw_ix(&payer.pubkey(), 1, &tk.pubkey()),
    ], &[&payer]));
}


// ============================================================================
// C ─ TOKEN GATING
// ============================================================================

#[test]
fn test_vote_without_tokens() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    // no mint_to → balance = 0

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);

    set_clock(&mut svm, 50);
    assert!(!try_send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]));
}

#[test]
fn test_vote_with_wrong_mint() {
    let (mut svm, payer) = setup_svm();
    let wrong_mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &wrong_mk);
    create_token_account(&mut svm, &payer, &tk, &wrong_mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &wrong_mk.pubkey(), &tk.pubkey(), 150);

    // governance mint is a DIFFERENT mint
    let gov_mk = Keypair::new();
    create_mint(&mut svm, &payer, &gov_mk);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);

    set_clock(&mut svm, 50);
    assert!(!try_send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &gov_mk.pubkey(), 150),
    ], &[&payer]));
}


// ============================================================================
// D ─ DOUBLE VOTE
// ============================================================================

#[test]
fn test_double_vote_rejected() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 300);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    // first vote — ok
    send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]);

    // second vote — rejected
    assert!(!try_send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]));
}


// ============================================================================
// E ─ ESCROW & CUSTODY
// ============================================================================

#[test]
fn test_tokens_locked_in_escrow_during_voting() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 200);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]);

    let esc = escrow_pda(&poll_pda(1), &payer.pubkey());
    assert_eq!(token_balance(&svm, &esc), 150);
    assert_eq!(token_balance(&svm, &tk.pubkey()), 50);
}

#[test]
fn test_escrow_accounts_destroyed_after_withdraw() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 200);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 100),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]);

    set_clock(&mut svm, 200);
    send(&mut svm, vec![
        withdraw_ix(&payer.pubkey(), 1, &tk.pubkey()),
    ], &[&payer]);

    let p = poll_pda(1);
    assert!(!exists(&svm, &vote_record_pda(&p, &payer.pubkey())));
    assert!(!exists(&svm, &escrow_pda(&p, &payer.pubkey())));
    assert_eq!(token_balance(&svm, &tk.pubkey()), 200);
}


// ============================================================================
// F ─ WEIGHTS & COUNTS
// ============================================================================

#[test]
fn test_multiple_voters_accumulate_tokens() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);

    let v1 = Keypair::new(); let t1 = Keypair::new();
    let v2 = Keypair::new(); let t2 = Keypair::new();
    setup_voter(&mut svm, &payer, &mk.pubkey(), &v1, &t1, 100);
    setup_voter(&mut svm, &payer, &mk.pubkey(), &v2, &t2, 50);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    send(&mut svm, vec![
        vote_ix(&v1.pubkey(), 1, "Alice", &t1.pubkey(), &mk.pubkey(), 100),
    ], &[&v1]);
    send(&mut svm, vec![
        vote_ix(&v2.pubkey(), 1, "Alice", &t2.pubkey(), &mk.pubkey(), 50),
    ], &[&v2]);

    assert_eq!(read_poll(&svm, 1).total_tokens_locked, 150);
    assert_eq!(read_candidate(&svm, 1, "Alice").candidate_votes, 150);
}

#[test]
fn test_weight_calculation_off_chain() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);

    // Voter 1: 750 tokens → votes for Alice
    let v1 = Keypair::new(); let t1 = Keypair::new();
    setup_voter(&mut svm, &payer, &mk.pubkey(), &v1, &t1, 750);

    // Voter 2: 250 tokens → votes for Bob (different candidate)
    let v2 = Keypair::new(); let t2 = Keypair::new();
    setup_voter(&mut svm, &payer, &mk.pubkey(), &v2, &t2, 250);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
        init_candidate_ix(&payer.pubkey(), 1, "Bob"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    send(&mut svm, vec![
        vote_ix(&v1.pubkey(), 1, "Alice", &t1.pubkey(), &mk.pubkey(), 750),
    ], &[&v1]);
    send(&mut svm, vec![
        vote_ix(&v2.pubkey(), 1, "Bob", &t2.pubkey(), &mk.pubkey(), 250),
    ], &[&v2]);

    let poll = read_poll(&svm, 1);
    let cand_alice = read_candidate(&svm, 1, "Alice");

    // Off-chain weight: (candidate_votes * 10_000) / total_tokens_locked
    // Alice: (750 * 10_000) / 1_000 = 7_500 → 75.00%
    let weight = (cand_alice.candidate_votes * 10_000) / poll.total_tokens_locked;
    assert!(weight <= 10_000);
    assert_eq!(weight, 7_500);
}

#[test]
fn test_vote_with_zero_tokens_fails() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 150);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    assert!(!try_send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 0),
    ], &[&payer]));
}

#[test]
fn test_withdraw_authority_gating() {
    let (mut svm, payer) = setup_svm();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 5_000_000_000).unwrap();

    let mk = Keypair::new(); let tk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);
    create_token_account(&mut svm, &payer, &tk, &mk.pubkey(), &payer.pubkey());
    mint_to(&mut svm, &payer, &mk.pubkey(), &tk.pubkey(), 200);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 100),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    send(&mut svm, vec![
        vote_ix(&payer.pubkey(), 1, "Alice", &tk.pubkey(), &mk.pubkey(), 150),
    ], &[&payer]);

    set_clock(&mut svm, 200);

    // Attacker tries to withdraw payer's tokens
    assert!(!try_send(&mut svm, vec![
        withdraw_ix(&attacker.pubkey(), 1, &tk.pubkey()),
    ], &[&attacker]));
}


// ============================================================================
// G ─ MULTIPLE CANDIDATES
// ============================================================================

#[test]
fn test_multiple_candidates_vote_distribution() {
    let (mut svm, payer) = setup_svm();
    let mk = Keypair::new();
    create_mint(&mut svm, &payer, &mk);

    let v1 = Keypair::new(); let t1 = Keypair::new();
    let v2 = Keypair::new(); let t2 = Keypair::new();
    setup_voter(&mut svm, &payer, &mk.pubkey(), &v1, &t1, 100);
    setup_voter(&mut svm, &payer, &mk.pubkey(), &v2, &t2, 50);

    send(&mut svm, vec![
        init_poll_ix(&payer.pubkey(), 1, 10, 2_000_000_000),
        init_candidate_ix(&payer.pubkey(), 1, "Alice"),
        init_candidate_ix(&payer.pubkey(), 1, "Bob"),
    ], &[&payer]);
    set_clock(&mut svm, 50);

    send(&mut svm, vec![
        vote_ix(&v1.pubkey(), 1, "Alice", &t1.pubkey(), &mk.pubkey(), 100),
    ], &[&v1]);
    send(&mut svm, vec![
        vote_ix(&v2.pubkey(), 1, "Bob", &t2.pubkey(), &mk.pubkey(), 50),
    ], &[&v2]);

    assert_eq!(read_candidate(&svm, 1, "Alice").candidate_votes, 100);
    assert_eq!(read_candidate(&svm, 1, "Bob").candidate_votes, 50);
    assert_eq!(read_poll(&svm, 1).total_tokens_locked, 150);
}


// ============================================================================
// TEST ID
// ============================================================================

#[test]
fn test_id() {
    assert_eq!(voting::id().to_string(), "4jvSdJbH7ReTSRNiNwgKXLDt4UHM6k3KCu8e78Btxpem");
}