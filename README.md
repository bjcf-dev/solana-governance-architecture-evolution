# Solana Governance Voting DApp

A Solana-native governance voting application built with Anchor (Rust program) and React/TypeScript frontend. The app supports three protocol versions from the same unified UI:

| Version | Protocol | Features |
|---------|----------|----------|
| **V1** | Account-based | Simple one-vote-per-wallet polling |
| **V2** | Token-gated | Voting power scales with token stake, escrow support |
| **V3** | Merkle-tree | Anonymous voting with nullifier proofs, scalable to large electorates |

Each version lives in its own architecture branch and is deployed independently. The frontend connects to all three via a version selector.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Vite + React + TS)  — feat/unified-frontend       │
│  ├── VersionSelector → V1 / V2 / V3                          │
│  ├── usePolls / useVote hooks                                │
│  └── Wallet adapter (Phantom, Solflare, Backpack)            │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   V1 (account)      V2 (token)       V3 (merkle)
   architecture/     architecture/     architecture/
   v1-account-based v2-token-gated  v3-merkle-scaling
```

## Prerequisites

- **Rust** 1.96+ and `cargo-build-sbf` (Solana BPF toolchain)
- **Solana CLI** 2.1.0 via Anza release:
  ```bash
  sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  ```
- **Node** 18+ and Yarn
- A Solana wallet (Phantom / Solflare / Backpack) with devnet SOL

## Quick Start

### 1. Build the program

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
NO_DNA=1 anchor build
```

### 2. Deploy to devnet

```bash
NO_DNA=1 anchor deploy --provider.cluster devnet
# or
solana program deploy target/deploy/voting.so --url devnet \
  --program-id target/deploy/voting-keypair.json
```

The deployed V1 program ID on devnet: `3ZymoFt5iejQYVLnxvpU4pd3ekexHXkcrBiypRvqarU3`

### 3. Seed test data

```bash
cd app
npx tsx scripts/seed-devnet.ts
```

This creates a poll with 3 candidates on devnet for manual testing.

### 4. Run the frontend

```bash
cd app
yarn install
yarn dev
```

Open http://localhost:5173 — select V1 from the version dropdown, connect your wallet, and vote.

## E2E Flow (with screenshots)

### Step 1 — Landing page (wallet disconnected)

![Landing page — disconnected](./docs/screenshots/01-landing.png)

The hero explains the protocol and prompts wallet connection.

### Step 2 — Connect wallet

![Wallet connect modal](./docs/screenshots/02-wallet-modal.png)

Use the WalletMultiButton (dark-themed) to connect Phantom/Solflare.

### Step 3 — Poll list (connected)

![Poll list — connected](./docs/screenshots/03-poll-list.png)

Shows active polls fetched from the deployed program via `usePolls`.

### Step 4 — Vote

![Voting flow](./docs/screenshots/04-vote.png)

Select a candidate and submit. The transaction is signed via the wallet.

### Step 5 — Confirmation

![Transaction confirmation](./docs/screenshots/05-confirmation.png)

The vote is recorded on-chain; results update in real time.

## Testing

```bash
# Frontend (Vitest)
cd app && npx vitest run

# Program (LiteSVM)
NO_DNA=1 cargo test
```

## Project Structure

```
programs/voting/         Anchor program (V1 account-based)
app/                     Frontend (React + TS)
  src/config/            Version config + embedded IDLs
  src/hooks/             usePolls, useVote
  src/components/        Header, PollList, PollCard, LandingPage
  scripts/               seed-devnet.ts
openspec/                SDD artifacts
```

## Notes

- `CLUSTER_URL` in `versions.ts` is hardcoded to devnet; switch to mainnet by changing one line.
- Each protocol version is independently upgradeable — the frontend routes by `programId`.
