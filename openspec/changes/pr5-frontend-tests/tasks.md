# Tasks: PR5 — Frontend Unit & Component Tests

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

| Estimated changed lines | ~700 (additions only, no deletions) |
|-------------------------|--------------------------------------|
| Suggested split | PR 1: Infra + version/pda tests (~195) → PR 2: merkle/history + hooks (~280) → PR 3: components + context (~230) |

## Phase 1: Test Infrastructure

- [x] 1.1 `app/vite.config.ts` — ADD test block: jsdom, globals, setupFiles, coverage thresholds
- [x] 1.2 `app/src/test/setup.tsx` — CREATE: jest-dom imports, `vi.mock("@solana/wallet-adapter-wallets")`, `vi.mock("@solana/wallet-adapter-react-ui")`
- [x] 1.3 `app/src/test/mocks/factories.ts` — CREATE: `createMockWallet()`, `createMockConnection()`, `createMockProgram()`
- [x] 1.4 `app/src/test/test-utils.tsx` — CREATE: `customRender()`, `renderHookWithProviders()`, `TestProviderOptions` type

## Phase 2: Pure Utility Tests

- [x] 2.1 `app/src/config/versions.test.ts` — CREATE: 3 describe blocks (getVersion, PROGRAM_IDS match, CLUSTER_URL validation)
- [x] 2.2 `app/src/utils/pda.test.ts` — CREATE: 5 describe blocks (derivePollPda, deriveCandidatePda, deriveVoteRecordPda, deriveEscrowPda, u64ToBytes)
- [x] 2.3 `app/src/utils/merkle.test.ts` — CREATE: 6 describe blocks (buildTree padding/determinism, getProof valid/unknown, verifyProof valid/tampered leaf/tampered root)
- [x] 2.4 `app/src/utils/history.test.ts` — CREATE: 4 describe blocks (saveVote+getHistory, updateStatus, clearHistory, error handling corrupt/quota)

## Phase 3: Hook Tests

- [x] 3.1 `app/src/hooks/usePolls.test.tsx` — CREATE: 4 describe blocks (loading, empty, decode + candidates, no fetch when program null)
- [x] 3.2 `app/src/hooks/useVote.test.tsx` — CREATE: 6 describe blocks (disconnected, V1 instruction, V2 token, V3 merkle, withdraw non-V2, closePoll)

## Phase 4: Component & Context Tests

- [x] 4.1 `app/src/components/Header.test.tsx` — CREATE: 3 describe blocks (render, version select, connection prompt)
- [x] 4.2 `app/src/components/PollCard.test.tsx` — CREATE: 8 describe blocks (metadata, status badge, candidates, vote button, token input, withdraw, loading, messages)
- [x] 4.3 `app/src/components/PollList.test.tsx` — CREATE: 3 describe blocks (loading, empty, renders cards)
- [x] 4.4 `app/src/context/AppContext.test.tsx` — CREATE: 2 describe blocks (provides state, throws outside)
