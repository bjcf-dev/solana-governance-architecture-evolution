use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::instruction::Instruction,
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    solana_sha256_hasher::hashv,
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};
use voting::{accounts, instruction};

// ── Helpers ─────────────────────────────────────────────────────────────────

fn compute_leaf(voter: &Pubkey, candidate: &str, amount: u64) -> [u8; 32] {
    hashv(&[voter.as_ref(), candidate.as_bytes(), &amount.to_le_bytes()]).to_bytes()
}

/// Returns (levels, root). levels[0] = leaves, levels[1] = parent hashes, etc.
fn build_merkle_tree(leaves: &[[u8; 32]]) -> (Vec<Vec<[u8; 32]>>, [u8; 32]) {
    let mut levels = vec![leaves.to_vec()];
    while levels.last().unwrap().len() > 1 {
        let prev = levels.last().unwrap();
        let mut next = Vec::with_capacity((prev.len() + 1) / 2);
        for chunk in prev.chunks(2) {
            let h = if chunk.len() == 2 {
                hashv(&[&chunk[0], &chunk[1]]).to_bytes()
            } else {
                chunk[0]
            };
            next.push(h);
        }
        levels.push(next);
    }
    let root = levels.last().unwrap()[0];
    (levels, root)
}

fn get_proof(levels: &[Vec<[u8; 32]>], leaf_index: usize) -> Vec<[u8; 32]> {
    let mut proof = Vec::new();
    let mut idx = leaf_index;
    for level in levels {
        if level.len() == 1 {
            break;
        }
        let sibling_idx = if idx % 2 == 0 { idx + 1 } else { idx - 1 };
        // ponytail: odd level, last node has no sibling — skip
        if sibling_idx < level.len() {
            proof.push(level[sibling_idx]);
        }
        idx /= 2;
    }
    proof
}

fn setup_poll(
    svm: &mut LiteSVM,
    admin: &Keypair,
    poll_id: u64,
    merkle_root: [u8; 32],
    poll_pda: Pubkey,
) {
    let program_id = voting::id();
    let ix = Instruction::new_with_bytes(
        program_id,
        &instruction::InitPoll {
            _poll_id: poll_id,
            start_time: 10,
            end_time: 2_000_000_000,
            poll_name: "V3 Merkle".to_string(),
            description: "Merkle tree voting".to_string(),
            merkle_root,
        }
        .data(),
        accounts::InitPoll {
            user: admin.pubkey(),
            poll_account: poll_pda,
            system_program: anchor_lang::solana_program::system_program::id(),
        }
        .to_account_metas(None),
    );
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&admin.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[admin]).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn setup_candidate(
    svm: &mut LiteSVM,
    admin: &Keypair,
    poll_id: u64,
    candidate_name: &str,
    poll_pda: Pubkey,
    candidate_pda: Pubkey,
) {
    let program_id = voting::id();
    let ix = Instruction::new_with_bytes(
        program_id,
        &instruction::InitializeCandidate {
            candidate_name: candidate_name.to_string(),
            _poll_id: poll_id,
        }
        .data(),
        accounts::InitializeCandidate {
            user: admin.pubkey(),
            poll_account: poll_pda,
            candidate_account: candidate_pda,
            system_program: anchor_lang::solana_program::system_program::id(),
        }
        .to_account_metas(None),
    );
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&admin.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[admin]).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn submit_vote(
    svm: &mut LiteSVM,
    voter: &Keypair,
    poll_id: u64,
    candidate_name: &str,
    amount: u64,
    proof: Vec<[u8; 32]>,
    leaf_index: u64,
    poll_pda: Pubkey,
    candidate_pda: Pubkey,
) -> Result<(), String> {
    let program_id = voting::id();
    let ix = Instruction::new_with_bytes(
        program_id,
        &instruction::Vote {
            _poll_id: poll_id,
            candidate_name: candidate_name.to_string(),
            amount,
            proof,
            leaf_index,
        }
        .data(),
        accounts::Vote {
            user: voter.pubkey(),
            poll_account: poll_pda,
            candidate_account: candidate_pda,
            system_program: anchor_lang::solana_program::system_program::id(),
        }
        .to_account_metas(None),
    );
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&voter.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[voter]).unwrap();
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{:?}", e))
}

fn read_candidate_votes(svm: &LiteSVM, candidate_pda: &Pubkey) -> u64 {
    let account_data = svm.get_account(candidate_pda).unwrap().data;
    let mut data_slice: &[u8] = &account_data;
    // CandidateAccount: 8 anchor discriminator + [max_len(32)] string (4 len + bytes) + u64
    // Skip 8 discriminator + 4 string length prefix, read bytes, skip string content, read u64
    let candidate =
        voting::CandidateAccount::try_deserialize(&mut data_slice).unwrap();
    candidate.candidate_votes
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[test]
fn test_happy_path_single_vote() {
    let program_id = voting::id();
    let admin = Keypair::new();
    let voter = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/voting.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&admin.pubkey(), 2_000_000_000).unwrap();
    svm.airdrop(&voter.pubkey(), 1_000_000_000).unwrap();

    let clock = anchor_lang::solana_program::clock::Clock {
        slot: 1,
        unix_timestamp: 50,
        ..Default::default()
    };
    svm.set_sysvar(&clock);

    let poll_id: u64 = 1;
    let candidate = "Alice".to_string();

    let (poll_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes()],
        &program_id,
    );
    let (candidate_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes(), candidate.as_bytes()],
        &program_id,
    );

    // Build Merkle tree: 1 voter
    let leaf = compute_leaf(&voter.pubkey(), &candidate, 100);
    let (_levels, root) = build_merkle_tree(&[leaf]);
    // With 1 leaf, proof is empty (leaf is the root)
    let proof: Vec<[u8; 32]> = vec![];

    setup_poll(&mut svm, &admin, poll_id, root, poll_pda);
    setup_candidate(&mut svm, &admin, poll_id, &candidate, poll_pda, candidate_pda);

    submit_vote(
        &mut svm,
        &voter,
        poll_id,
        &candidate,
        100,
        proof,
        0,
        poll_pda,
        candidate_pda,
    )
    .unwrap();

    assert_eq!(read_candidate_votes(&svm, &candidate_pda), 100);
}

#[test]
fn test_double_vote_rejected() {
    let program_id = voting::id();
    let admin = Keypair::new();
    let voter = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/voting.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&admin.pubkey(), 2_000_000_000).unwrap();
    svm.airdrop(&voter.pubkey(), 1_000_000_000).unwrap();

    let clock = anchor_lang::solana_program::clock::Clock {
        slot: 1,
        unix_timestamp: 50,
        ..Default::default()
    };
    svm.set_sysvar(&clock);

    let poll_id: u64 = 1;
    let candidate = "Alice".to_string();

    let (poll_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes()],
        &program_id,
    );
    let (candidate_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes(), candidate.as_bytes()],
        &program_id,
    );

    // 2 voters in tree, we'll use voter at index 0 twice
    let leaves = [
        compute_leaf(&voter.pubkey(), &candidate, 100),
        compute_leaf(&Keypair::new().pubkey(), &candidate, 200),
    ];
    let (levels, root) = build_merkle_tree(&leaves);
    let proof = get_proof(&levels, 0);

    setup_poll(&mut svm, &admin, poll_id, root, poll_pda);
    setup_candidate(&mut svm, &admin, poll_id, &candidate, poll_pda, candidate_pda);

    // First vote succeeds
    submit_vote(
        &mut svm,
        &voter,
        poll_id,
        &candidate,
        100,
        proof.clone(),
        0,
        poll_pda,
        candidate_pda,
    )
    .unwrap();

    // Advance blockhash so LiteSVM doesn't reject as duplicate
    svm.expire_blockhash();

    // Second vote with same leaf_index fails
    let err = submit_vote(
        &mut svm,
        &voter,
        poll_id,
        &candidate,
        100,
        proof.clone(),
        0,
        poll_pda,
        candidate_pda,
    )
    .unwrap_err();
    assert!(
        err.contains("AlreadyVoted"),
        "Expected AlreadyVoted error, got: {err}"
    );

    assert_eq!(read_candidate_votes(&svm, &candidate_pda), 100);
}

#[test]
fn test_invalid_proof_rejected() {
    let program_id = voting::id();
    let admin = Keypair::new();
    let voter = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/voting.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&admin.pubkey(), 2_000_000_000).unwrap();
    svm.airdrop(&voter.pubkey(), 1_000_000_000).unwrap();

    let clock = anchor_lang::solana_program::clock::Clock {
        slot: 1,
        unix_timestamp: 50,
        ..Default::default()
    };
    svm.set_sysvar(&clock);

    let poll_id: u64 = 1;
    let candidate = "Alice".to_string();

    let (poll_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes()],
        &program_id,
    );
    let (candidate_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes(), candidate.as_bytes()],
        &program_id,
    );

    // Build tree with 2 voters
    let leaves = [
        compute_leaf(&Keypair::new().pubkey(), &candidate, 100),
        compute_leaf(&Keypair::new().pubkey(), &candidate, 200),
    ];
    let (_levels, root) = build_merkle_tree(&leaves);

    setup_poll(&mut svm, &admin, poll_id, root, poll_pda);
    setup_candidate(&mut svm, &admin, poll_id, &candidate, poll_pda, candidate_pda);

    // Submit with a garbage proof
    let bad_proof = vec![[42u8; 32]; 2]; // completely fake siblings
    let err = submit_vote(
        &mut svm,
        &voter,
        poll_id,
        &candidate,
        100,
        bad_proof,
        0,
        poll_pda,
        candidate_pda,
    )
    .unwrap_err();
    assert!(
        err.contains("InvalidMerkleProof"),
        "Expected InvalidMerkleProof error, got: {err}"
    );

    assert_eq!(read_candidate_votes(&svm, &candidate_pda), 0);
}

#[test]
fn test_multi_voter_accumulates() {
    let program_id = voting::id();
    let admin = Keypair::new();
    let voter0 = Keypair::new();
    let voter1 = Keypair::new();
    let voter2 = Keypair::new();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/voting.so");
    svm.add_program(program_id, bytes).unwrap();
    let dummy = Keypair::new();
    for kp in [&admin, &voter0, &voter1, &voter2, &dummy] {
        svm.airdrop(&kp.pubkey(), 1_000_000_000).unwrap();
    }

    let clock = anchor_lang::solana_program::clock::Clock {
        slot: 1,
        unix_timestamp: 50,
        ..Default::default()
    };
    svm.set_sysvar(&clock);

    let poll_id: u64 = 1;
    let candidate = "Alice".to_string();

    let (poll_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes()],
        &program_id,
    );
    let (candidate_pda, _) = Pubkey::find_program_address(
        &[b"poll", &poll_id.to_le_bytes(), candidate.as_bytes()],
        &program_id,
    );

    // 4 voters (power of 2 — avoids odd-tree proof issues)
    let amounts = [100u64, 200, 150, 300];
    let voters = [&voter0, &voter1, &voter2, &dummy];
    let leaves: Vec<[u8; 32]> = voters
        .iter()
        .enumerate()
        .map(|(i, v)| compute_leaf(&v.pubkey(), &candidate, amounts[i]))
        .collect();
    let (levels, root) = build_merkle_tree(&leaves);

    setup_poll(&mut svm, &admin, poll_id, root, poll_pda);
    setup_candidate(&mut svm, &admin, poll_id, &candidate, poll_pda, candidate_pda);

    for (i, v) in voters[..3].iter().enumerate() {
        let proof = get_proof(&levels, i);
        submit_vote(
            &mut svm,
            v,
            poll_id,
            &candidate,
            amounts[i],
            proof,
            i as u64,
            poll_pda,
            candidate_pda,
        )
        .unwrap_or_else(|e| panic!("voter {i} vote failed: {e}"));
        // ponytail: advance blockhash so LiteSVM accepts next tx
        svm.expire_blockhash();
    }

    let expected_total: u64 = amounts[..3].iter().sum();
    assert_eq!(
        read_candidate_votes(&svm, &candidate_pda),
        expected_total,
        "all votes should accumulate"
    );
}
