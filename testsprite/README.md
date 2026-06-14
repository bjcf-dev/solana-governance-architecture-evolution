# Solana Voting E2E Test Suite

This test suite implements the required E2E (End-to-End) test scenarios for the Solana Governance Architecture Evolution (V2 Token-Gated) using Testsprite.

## Overview

This test suite validates the core functionality of the token-gated voting system with three critical scenarios:

1. **A1: Complete Voting Cycle** - Validates the full lifecycle from poll initialization to token withdrawal
2. **A2: Concurrent Voting (Race Condition)** - Tests simultaneous voting transactions to ensure no race conditions
3. **A3: Economic Invariance** - Verifies that the sum of candidate votes always equals the total tokens locked

## Prerequisites

Before running these tests, ensure you have:

1. **Testsprite CLI** installed
   ```bash
   npm install -g testsprite
   ```

2. **Solana CLI** installed
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

3. **Solana Local Validator** running on port 8899
   ```bash
   solana-test-validator --url http://localhost:8899 --ledger ./test-ledger --bpf-program ./target/deploy/voting.so
   ```

4. **TestSprite API Key** - Obtain from https://testsprite.com

5. **Updated Program ID and Account Addresses** - Replace placeholder values in `config/e2e-tests.yaml`

## Configuration

The test configuration is defined in `config/e2e-tests.yaml` with the following key sections:

- **Environment**: Solana endpoint, timeout, and retry settings
- **Scenarios**: Three test scenarios (A1, A2, A3) with detailed steps
- **Integration**: Solana-specific configuration for RPC calls
- **Metadata**: Project information and versioning

> **Important**: You must replace the placeholder values in the configuration file:
> - `VOTING_PROGRAM_ID`
> - `GOVERNANCE_MINT`
> - `VOTER_1_PUBLIC_KEY`, `VOTER_2_PUBLIC_KEY`, etc.
> - `POLL_PDA_ADDRESS`, `CANDIDATE_A_PDA_ADDRESS`, etc.

## Running the Tests

1. Start the Solana local validator:
   ```bash
   solana-test-validator --url http://localhost:8899 --ledger ./test-ledger --bpf-program ./target/deploy/voting.so
   ```

2. Run the test suite:
   ```bash
   ./run-tests.sh
   ```

3. View the results:
   - Detailed results: `results/test-results.json`
   - Summary: `results/summary.txt`
   - Logs: `logs/test-sprite.log`

## Test Scenarios Details

### A1: Complete Voting Cycle

Validates the complete lifecycle:
- Poll initialization
- Candidate registration
- Voter voting with token escrow
- Clock advancement beyond voting end
- Token withdrawal
- Final state validation

### A2: Concurrent Voting (Race Condition)

Tests simultaneous voting transactions:
- Two voters vote at the same time
- Validates that both transactions are processed correctly
- Confirms no race conditions in state updates
- Verifies total tokens locked and candidate votes are correctly accumulated

### A3: Economic Invariance

Verifies the economic invariant:
- Multiple voters vote for multiple candidates
- Confirms that `sum(candidate_votes) == total_tokens_locked`
- Validates individual voter escrow balances
- Ensures the system maintains economic integrity under complex voting patterns

## Expected Results

All tests should pass with:
- 100% success rate for all steps
- No assertion failures
- All PDA accounts properly created and destroyed
- Token balances correctly maintained
- Economic invariance maintained

## Troubleshooting

### Common Issues

**"Connection refused" error**:
- Ensure the Solana local validator is running on port 8899
- Check with: `curl http://localhost:8899`

**"Invalid account" errors**:
- Verify all PDA addresses in the configuration file are correct
- Ensure the program is deployed to the correct address

**"Insufficient tokens" errors**:
- Ensure voters have sufficient tokens in their token accounts
- Use `solana airdrop` to fund test accounts if needed

**Testsprite API key errors**:
- Set the TESTSPRITE_API_KEY environment variable
- Obtain a valid key from https://testsprite.com

## Integration with CI/CD

For CI/CD integration, add this to your GitHub Actions workflow:

```yaml
- name: Run E2E Tests
  run: |
    # Start Solana validator
    solana-test-validator --url http://localhost:8899 --ledger ./test-ledger --bpf-program ./target/deploy/voting.so &
    sleep 10
    
    # Run Testsprite
    chmod +x testsprite/run-tests.sh
    ./testsprite/run-tests.sh
    
    # Check results
    if [ ! -f testsprite/results/test-results.json ]; then
      echo "Test results not found!"
      exit 1
    fi
    
    # Fail if any tests failed
    jq '.summary.failed > 0' testsprite/results/test-results.json && exit 1 || exit 0
```

## Next Steps

After successful test execution:

1. Archive the change in `openspec/changes/archive/feat-v2-token-gated.md`
2. Sync specs with main specification using `openspec-sync-specs`
3. Update the project documentation with test results
4. Merge into main branch

> **Note**: This test suite is designed to work with the specific implementation in `programs/voting/src/lib.rs` and the specification in `openspec/changes/feat-v2-token-gated.md`. Any changes to the implementation may require updates to these tests.