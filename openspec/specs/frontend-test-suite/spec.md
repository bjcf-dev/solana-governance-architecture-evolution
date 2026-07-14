# Frontend Test Suite Specification

## Purpose

Vitest + testing-library covering `app/src/` utils, hooks, components, and context. Regression protection across V1/V2/V3 version switches.

## Requirements

### Setup Infrastructure

The test setup MUST use jsdom environment with jest-dom matchers. Mock factories go in `app/src/test/mocks/`. `@solana/wallet-adapter-wallets` MUST be mocked at module level (real Phantom/Solflare adapters cause import errors in jsdom).

### Utils — versions.ts

| Scenario | Given | When | Then |
|----------|-------|------|------|
| getVersion returns correct config | Valid id ("v1", "v2", "v3") | `getVersion(id)` | Returns matching programId + features |
| getVersion throws for unknown | Invalid id ("v4") | `getVersion(id)` | Throws "Unknown version" |
| VERSIONS has correct structure | Export | Inspect | 3 entries, correct shape per version |
| PROGRAM_IDS matches VERSIONS | Both exports | Compare | Each matches corresponding programId base58 |
| CLUSTER_URL is valid URL | Export | Parse | Parseable non-empty URL string |

### Utils — pda.ts

| Scenario | Given | When | Then |
|----------|-------|------|------|
| derivePollPda deterministic | programId + pollId | Call | Returns `[PublicKey, bump]`, same inputs = same output |
| deriveCandidatePda v1 vs v2/v3 | Same pollId + name | Derive for v1 and v2 | Different PDAs |
| deriveVoteRecordPda for v3 | v3 config | Call | Returns null |
| deriveVoteRecordPda for v1/v2 | v1 or v2 config | Call | Returns `[PublicKey, bump]` |
| deriveEscrowPda for v1/v3 | v1 or v3 config | Call | Returns null |
| deriveEscrowPda for v2 | v2 config | Call | Returns `[PublicKey, bump]` |
| u64ToBytes LE encoding | Any BigInt value | Call | 8-byte little-endian Uint8Array |

### Utils — merkle.ts

| Scenario | Given | When | Then |
|----------|-------|------|------|
| buildTree single leaf | 1 leaf hash | `buildTree(leaves)` | Root = sha256(leaf + zero pad) |
| buildTree pads to power of 2 | 3 leaves | `buildTree(leaves)` | Layer 0 has 4 entries |
| buildTree deterministic | Same input twice | Compare roots | Identical |
| getProof valid leaf | Tree + known leaf | `getProof(tree, leaf)` | `{ proof, leafIndex }` with siblings |
| getProof unknown leaf | Unknown leaf | `getProof(tree, leaf)` | Throws |
| verifyProof valid | Valid proof + root | `verifyProof(...)` | Returns true |
| verifyProof tampered leaf | Tampered leaf | `verifyProof(...)` | Returns false |
| verifyProof tampered root | Tampered root | `verifyProof(...)` | Returns false |

### Utils — history.ts

| Scenario | Given | When | Then |
|----------|-------|------|------|
| saveVote appends | Empty localStorage | `saveVote(r1)` then `saveVote(r2)` | Both records stored |
| getHistory newest-first | 2 records, different timestamps | `getHistory()` | Most recent first |
| updateStatus matches | Record with status "voted" | `updateStatus(pollId, txSig, "withdrawn")` | Matching record updated, others unchanged |
| clearHistory removes all | Stored records | `clearHistory()` | `getHistory()` returns [] |
| readAll handles corrupt | Missing key or corrupt JSON | Internal readAll | Returns [] (no throw) |
| writeAll handles quota | QuotaExceededError | Any write | Silently handled (no throw) |

### Hooks — usePolls (mocked connection + program)

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Loading states | Mocked program | Hook mounts | loading=true, then false after fetch |
| Empty polls | getAccountInfo returns null | Fetch completes | polls = [] |
| Decodes poll data | Valid PollAccount data | Fetch completes | poll has decoded name, description, start, end, closed |
| Decodes candidate data | Valid CandidateAccount data | Fetch completes | candidates map has name + votes |
| No fetch when program null | program = null | Hook mounts | getAccountInfo NOT called, loading stays false |

### Hooks — useVote (mocked wallet + program)

| Scenario | Given | When | Then |
|----------|-------|------|------|
| throws when disconnected | No publicKey/signTx | `vote(...)` | Throws "Wallet not connected" |
| V1 builds instruction | Wallet + v1 | `vote({ pollId, candidate })` | Instruction includes systemProgram |
| V2 adds token + escrow | Wallet + v2 | `vote({ pollId, candidate, amount })` | Instruction includes tokenAccount, escrowVault |
| V3 includes merkle proof | Wallet + v3 | `vote({ pollId, candidate })` | Method called with proof + leafIndex |
| withdraw throws for non-V2 | v1 or v3 | `withdraw(pollId)` | Throws "Withdraw only available for V2" |
| closePoll sends + confirms | Connected wallet | `closePoll(pollId)` | Transaction sent and confirmed |

### Components — PollCard

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Renders metadata | Poll with name/desc/dates | Render | Name, description, date range visible |
| Status badge | closed=true / active / ended | Render | Badge shows "Closed" / "Active" / "Ended" |
| Candidate list | Candidates array | Render | Each name + vote count displayed |
| Vote button | Active poll | Render | Vote buttons visible |
| Vote button hidden | Closed/ended poll | Render | Vote buttons absent |
| Token amount input | tokenGating=true + active | Render | Number input present |
| Withdraw button | V2 + closed (escrow=true) | Render | Withdraw button visible |
| Loading state | loading="vote-X" | Render | Button shows "..." and disabled |
| Error message | Error state set | Render | Red error text visible |
| Success message | Success state set | Render | Green success text visible |

### Components — Header

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Renders title | - | Render | "Solana Governance" visible |
| Version selector | - | Render | `<select>` with v1/v2/v3 options |
| Changing version | Dropdown change | Select new option | `setVersion` called with value |
| Connection prompt | Wallet disconnected | Render | "Connect your wallet" visible |
| Hides prompt | Wallet connected | Render | Connection prompt absent |

### Components — PollList

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Loading state | loading=true | Render | "Loading polls…" visible |
| Empty state | polls=[], loading=false | Render | "No polls yet" visible |
| Renders cards | 2 polls with candidates | Render | 2 PollCard components with correct props |

### Context — AppContext

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Provides state | Wrapped in provider | `useApp()` | Returns version, setVersion, connection, program, programs |
| Throws outside | NOT wrapped | `useApp()` | Error thrown |
