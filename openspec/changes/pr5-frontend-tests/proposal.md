# Proposal: PR5 — Frontend Unit & Component Tests

## Intent

Vitest + testing-library installed, zero test files exist. Frontend has no regression protection for utils, hooks, or components across version switches.

## Scope

### In Scope
- 10 test files: utils (4), hooks (2), components (3), context (1)
- vitest config + setup + mock factories
- Coverage > 80% on `src/utils/`

### Out of Scope
- E2E, integration vs real devnet, Rust tests, visual snapshots

## Capabilities

### New Capabilities
- `frontend-test-suite`: vitest infrastructure + test suite covering all 11 source files in utils/, hooks/, components/, context/

### Modified Capabilities
None — no spec behavior changes

## Approach

Three-layer pyramid. Pure units first (zero mocks), then hooks (mocked RPC), then components (RTL render + interaction).

1. **vitest config**: add `test` block to `vite.config.ts` (`environment: "jsdom"`, setupFiles, globals)
2. **Mock layer**: `src/test/setup.ts` + `src/test/mocks/` — wallet/connection/program factories
3. **Unit tests**: merkle, pda, history, versions — highest ROI, no mocks
4. **Hook tests**: usePolls (mock getAccountInfo), useVote (mock program.methods chain)
5. **Component tests**: Header, PollCard, PollList, AppContext — render + user actions

## Test Breakdown

| File | Tests | Key Cases | Mocks |
|------|-------|-----------|-------|
| `merkle.test.ts` | 7 | empty/single/3→4 leaves, proof, verify pass/fail | None |
| `pda.test.ts` | 8 | poll/candidate/vote/escrow per version, null returns | PublicKey only |
| `history.test.ts` | 6 | CRUD, corrupt data, missing key | None |
| `versions.test.ts` | 3 | getVersion, invalid, structure | None |
| `usePolls.test.ts` | 4 | fetch, empty, loading, refresh | getAccountInfo, coder |
| `useVote.test.ts` | 6 | vote(v1/v2/v3), withdraw(v2), close, wallet err | program, wallet, connection |
| `Header.test.tsx` | 3 | title, version selector, connected banner | useWallet, useApp |
| `PollCard.test.tsx` | 5 | status badge, vote, loading, error/success | useVote |
| `PollList.test.tsx` | 3 | loading, empty, renders cards | usePolls |
| `AppContext.test.tsx` | 2 | version state, throws outside provider | useWallet |

## Affected Areas

| Area | Impact |
|------|--------|
| `vite.config.ts` | Modified — add test block |
| `src/test/setup.ts` | New |
| `src/test/mocks/` | New — 3 factory files |
| `src/**/*.test.ts*` | New — 10 files |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Program constructor fragile to mock | Medium | Mock `.methods.` chain, skip constructor |
| `wallet-adapter-wallets` instantiates real adapters | Low | Module-level mock in setup |
| IDL JSON imports in test env | Low | Vitest inherits vite resolver |
| usePolls 50-iteration loop slow | Low | Mock getAccountInfo returning null early |

## Rollback Plan

Revert `vite.config.ts`, delete `src/test/`. Zero production code changes.

## Dependencies

vitest 2.1.0, jsdom 25.0.0, @testing-library/react 16.1.0 (all installed)

## Success Criteria

- [ ] `pnpm test` passes, all tests green
- [ ] Coverage > 80% on `src/utils/` (`vitest run --coverage`)
- [ ] Every pure function covers happy + error paths
- [ ] Every component renders loading, empty, and populated states
- [ ] Every hook tests success + wallet-disconnected paths
