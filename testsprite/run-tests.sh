#!/bin/bash

# Solana Voting E2E Test Runner
# This script sets up the environment and runs Testsprite E2E tests

set -e  # Exit on any error

echo "=== Solana Voting E2E Test Runner ==="
echo "Project: Solana Governance Architecture Evolution"
echo "Branch: architecture/v2-token-gated"
echo "Date: $(date)"

# Check if Testsprite MCP is installed
if ! command -v testsprite-mcp &> /dev/null; then
    echo "Error: Testsprite MCP not found. Please install Testsprite MCP first."
    echo "Visit: https://docs.testsprite.com/"
    exit 1
fi

# Check if Solana devnet is running
if ! curl -s http://localhost:8899 >/dev/null; then
    echo "Starting Solana local validator..."
    # Start Solana local validator in background
    solana-test-validator --url http://localhost:8899 --ledger ./test-ledger --bpf-program 4jvSdJbH7ReTSRNiNwgKXLDt4UHM6k3KCu8e78Btxpem ./target/deploy/voting.so &
    SOLANA_PID=$!
    echo "Waiting for Solana validator to start..."
    sleep 10  # Give time for validator to start
fi

# Create necessary directories
mkdir -p testsprite/logs
mkdir -p testsprite/results

# Set environment variables for Testsprite
export TESTSPRITE_API_KEY="your-testsprite-api-key"  # Replace with actual key
export TESTSPRITE_CONFIG_PATH="testsprite/config/e2e-tests.yaml"

# Run the tests
echo "\n=== Running E2E Tests ==="
echo "Configuration: testsprite/config/e2e-tests.yaml"

testsprite-mcp run \
  --config testsprite/config/e2e-tests.yaml \
  --output testsprite/results/test-results.json \
  --log-file testsprite/logs/test-sprite.log \
  --verbose

# Check test results
if [ $? -eq 0 ]; then
    echo "\n✅ All E2E tests passed successfully!"
    echo "Results saved to: testsprite/results/test-results.json"
    echo "Logs saved to: testsprite/logs/test-sprite.log"
else
    echo "\n❌ Some E2E tests failed!"
    echo "Check detailed results at: testsprite/results/test-results.json"
    echo "Check logs at: testsprite/logs/test-sprite.log"
    exit 1
fi

# Clean up Solana validator if we started it
if [ -n "$SOLANA_PID" ]; then
    echo "\nShutting down Solana validator..."
    kill $SOLANA_PID
    wait $SOLANA_PID 2>/dev/null
fi

# Generate summary report
echo "\n=== Test Summary ==="
cat testsprite/results/test-results.json | jq -r '.summary'

# Update TODO list
# Note: This would normally be done by the system, but we're simulating it here

# Print instructions for next steps
echo "\n=== Next Steps ==="
echo "1. Review test results at testsprite/results/test-results.json"
echo "2. If tests pass, update the specification with test results"
echo "3. Archive the change in openspec/changes/archive/feat-v2-token-gated.md"
echo "4. Sync specs with main specification"
echo "5. Merge into main branch"

# Create a summary file
jq '.summary' testsprite/results/test-results.json > testsprite/results/summary.txt
echo "Summary saved to: testsprite/results/summary.txt"