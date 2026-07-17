# Standard Operating Procedure — Mainnet Deployment

## Prerequisites

### 1. Security Audit
- [ ] Program V1 (account-based) must pass Solana security audit
- [ ] Token escape routes reviewed
- [ ] Account validation verified (all signers checked, no missing constraints)
- [ ] Re-entrancy and overflow checks
- [ ] CPI guard verification
- [ ] Consider: Solana Foundation audit program or third-party (Neodyme, OtterSec, Sec3)

### 2. Program ID Generation
- [ ] Generate new keypair with meaningful name: `solana-keygen new --outfile mainnet-keypair.json -n "solana-governance-mainnet"`
- [ ] Or use vanity generator for human-readable address
- [ ] Update `declare_id!` in `programs/voting/src/lib.rs`
- [ ] Update `Anchor.toml` [programs.mainnet] section
- [ ] Update `app/src/config/versions.ts` with new program ID
- [ ] Update `app/src/config/idl/v1.json` address field
- [ ] DO NOT commit keypair to git

### 3. Deployer Wallet
- [ ] Create dedicated deployer wallet (NOT personal wallet)
- [ ] Fund with ~1.3 SOL for rent exemption
- [ ] Transfer SOL from exchange or existing wallet
- [ ] Verify balance: `solana balance --url mainnet-beta`

### 4. SOL Funding
- [ ] No airdrop on mainnet — SOL must come from real sources
- [ ] Options: purchase on exchange, transfer from existing wallet, grant program
- [ ] Account for transaction fees (~0.000005 SOL per tx)
- [ ] Budget for rent: ~1.3 SOL per account (program + polls + candidates)

### 5. Frontend Hosting
- [ ] Choose hosting: Vercel, Netlify, IPFS, or custom domain
- [ ] Configure environment variables for mainnet
- [ ] Set `CLUSTER_URL` to `https://api.mainnet-beta.solana.com`
- [ ] Update program ID in frontend config
- [ ] SSL certificate if custom domain
- [ ] CDN configuration for global access

### 6. CI/CD Pipeline
- [ ] GitHub Actions workflow for reproducible builds
- [ ] Build artifact verification (hash comparison)
- [ ] Automated testing before deploy
- [ ] Deploy signing with hardware wallet or multisig
- [ ] Rollback procedure documented

### 7. Multi-sig Upgrade Authority
- [ ] Set up Squads multisig (squads.so)
- [ ] Or use other multisig solution (Realms, etc.)
- [ ] Program upgrade authority transferred to multisig
- [ ] Key holders identified and verified
- [ ] Signing threshold configured (e.g., 2-of-3)
- [ ] Test upgrade procedure on devnet first

## Pre-Deploy Checklist

### Code Cleanup
- [ ] Remove demo-polls fallback (currently in `app/src/hooks/usePolls.ts`)
- [ ] Remove devnet-specific comments
- [ ] Verify MAX_POLLS is appropriate (currently 50, may need adjustment)
- [ ] Remove any `console.log` debug statements
- [ ] Clean up any development-only code

### Testing
- [ ] All frontend tests pass: `yarn test`
- [ ] Rust tests pass: `anchor test`
- [ ] Manual E2E testing on devnet with real wallet
- [ ] Load testing with multiple concurrent users
- [ ] Error handling verified (network failures, account not found, etc.)

### Documentation
- [ ] README.md updated with mainnet instructions
- [ ] API documentation complete
- [ ] User guide written
- [ ] Troubleshooting guide created

## Deploy Procedure

### Step 1: Build Program
```bash
cd programs/voting
anchor build --provider.cluster mainnet-beta
```

### Step 2: Verify Build
```bash
# Compare hash with expected
sha256sum target/deploy/voting.so
```

### Step 3: Deploy Program
```bash
solana program deploy \
  --url mainnet-beta \
  --program-id target/deploy/voting-keypair.json \
  target/deploy/voting.so
```

### Step 4: Verify Deployment
```bash
solana program show <PROGRAM_ID> --url mainnet-beta
```

### Step 5: Transfer Upgrade Authority
```bash
solana program set-upgrade-authority \
  <PROGRAM_ID> \
  --upgrade-authority <DEPLOY_KEYPAIR> \
  --new-upgrade-authority <MULTISIG_ADDRESS> \
  --url mainnet-beta
```

### Step 6: Deploy Frontend
```bash
# Build for production
cd app
yarn build

# Deploy to hosting provider
# Vercel: vercel --prod
# Netlify: netlify deploy --prod
# IPFS: ipfs add -r dist/
```

### Step 7: Verify Frontend
- [ ] Check all pages load correctly
- [ ] Verify wallet connection works
- [ ] Test poll creation (if applicable)
- [ ] Test voting flow
- [ ] Verify transaction confirmations

## Post-Deploy Monitoring

### Immediate (first 24 hours)
- [ ] Monitor program logs for errors
- [ ] Check frontend analytics for user activity
- [ ] Verify transaction success rates
- [ ] Monitor RPC response times

### Ongoing
- [ ] Set up alerts for program errors
- [ ] Monitor account rentExemption balances
- [ ] Track user growth and engagement
- [ ] Regular security audits (quarterly recommended)

## Rollback Procedure

### If program has critical bug:
1. Deploy fixed version to new program ID
2. Update frontend to point to new program
3. Migrate data if possible (or start fresh)
4. Communicate to users

### If frontend has issues:
1. Revert to previous deployment
2. Or deploy hotfix to current hosting

## Devnet vs Mainnet Differences

| Aspect | Devnet | Mainnet |
|--------|--------|---------|
| SOL | Free airdrop | Real SOL required |
| Program ID | `3ZymoFt5...` | New meaningful ID |
| Demo data | `demo-polls.ts` enabled | REMOVE fallback |
| RPC | Rate-limited | Production RPC |
| Upgrade Authority | Personal key | Multisig required |
| Hosting | Local/preview | Production hosting |

## Notes

- **Demo Data**: The `demo-polls.ts` fallback is for devnet preview only. Remove before mainnet deploy.
- **MAX_POLLS**: Currently 50. If mainnet RPC rate-limits, implement `getProgramAccounts` instead of loop.
- **Program ID**: The current devnet ID is random. Mainnet should use intentionally generated ID.
- **Security**: Account-based programs require thorough audit before mainnet.
