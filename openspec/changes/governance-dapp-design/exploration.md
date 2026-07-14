## Exploration: Frontend Unit & Component Tests (PR5)

### Current State
Frontend is a Vite 6 + React 18 + TypeScript 5.7 app at `app/` on branch `feat/unified-frontend`. Dependencies include vitest 2.1.0, @testing-library/react 16.1.0, @testing-library/jest-dom 6.6.3, and jsdom 25.0.0 — all installed and configured in `app/package.json` scripts (`test` and `test:watch`). **Zero test files exist**. The `vite.config.ts` has no `test` section. No setup file exists. The app has a clean separation: pure utility functions (merkle, pda, history), React hooks with Solana RPC coupling (usePolls, useVote), context providers (AppContext, WalletProvider), and presentational components (Header, PollCard, PollList).

### Affected Areas
- `app/vite.config.ts` — needs `test` section with `environment: "jsdom"`, `setupFiles`, `globals: true`
- `app/src/test/setup.ts` — new file, imports `@testing-library/jest-dom`
- `app/src/utils/merkle.ts` — pure functions, highest test-value-per-mock ratio
- `app/src/utils/pda.ts` — pure functions, seed derivation variant logic
- `app/src/utils/history.ts` — localStorage CRUD, edge cases
- `app/src/config/versions.ts` — config constants, getVersion validation
- `app/src/hooks/usePolls.ts` — poll fetching loop, PDA derivation, account decoding
- `app/src/hooks/useVote.ts` — vote/withdraw/close, V1/V2/V3 branching, wallet integration
- `app/src/components/Header.tsx` — version selector, wallet button, connection banner
- `app/src/components/PollCard.tsx` — voting UI, action buttons, loading/error/success states
- `app/src/components/PollList.tsx` — loading/empty states, poll rendering
- `app/src/context/AppContext.tsx` — provider logic (minimal test surface, integration-leaning)

### Approaches

1. **Test pyramid: pure units → hooks → components** — recommended
   - Pros: Fastest feedback (pure tests need zero mocks), highest coverage-per-line, catches bugs at root
   - Cons: Hook tests still need Solana module mocks; component tests need provider wrappers
   - Effort: Medium

2. **Component-first with integration tests** — skip pure unit tests, focus on rendering
   - Pros: Covers user-facing behavior directly
   - Cons: Slow, fragile (Solana mock churn), misses edge cases in merkle/pda/history logic
   - Effort: High

### Recommendation
Approach 1: Pure unit tests first (merkle, pda, history, versions — zero mocks, immediate value), then hooks (mock @solana modules and wallet adapter), then components (wrap in test providers). This gives the best ROI: 4 files tested with zero dependencies, then build up complexity incrementally.

### Mock Strategy

**What to mock globally** (vitest setup or mocks directory):
- `@solana/wallet-adapter-react` — `useWallet()` returning `{ publicKey: PublicKey, signTransaction: fn, sendTransaction: fn, connected: boolean }` with controllable test values
- `@solana/web3.js` — `Connection`, `PublicKey`, `Transaction` (keep `PublicKey` real for PDA derivations to work, mock `Connection.getAccountInfo` and `Connection.confirmTransaction`)
- `@anchor-lang/core` — `Program` constructor and `program.methods` chain

**What NOT to mock** (use real implementations):
- `@noble/hashes/sha256` — real hashing for merkle tests (pure, no side effects)
- IDL JSON imports — static data, import as-is
- `@solana/web3.js` `PublicKey` — needed for real PDA derivations in `pda.ts` tests
- `localStorage` — use fake storage or vitest's jsdom built-in (it supports localStorage natively)

### Vitest Setup Needed

1. **vite.config.ts** — add `test` block:
   - `environment: "jsdom"` for component rendering
   - `setupFiles: ["./src/test/setup.ts"]` for jest-dom matchers
   - `globals: true` for describe/it/expect
   - `css: true` for Tailwind class assertions in components (optional, can skip)

2. **`src/test/setup.ts`** — `import "@testing-library/jest-dom"` (extends expect with `.toBeInTheDocument()` etc.)

3. **`src/test/mocks/`** directory with mock factories for wallet, connection, program

### Test Categorization Per File

| File | Layer | What to Test | Key Edge Cases | Mock Needs |
|------|-------|-------------|----------------|------------|
| `utils/merkle.ts` | Pure unit | `buildTree` (empty, 1 leaf, 3 leaves→padding, 4 leaves), `getProof` (valid index, leaf not found), `verifyProof` (valid, tampered sibling, wrong root, wrong index) | Zero-length leaf array, single leaf, large leaf count near memory ceiling | None |
| `utils/pda.ts` | Pure unit | `derivePollPda` (v1/v2/v3 same), `deriveCandidatePda` (v1 vs v2/v3 seed format), `deriveVoteRecordPda` (v1, v2, v3→null), `deriveEscrowPda` (v2, v1→null, v3→null) | Maximum pollId (bigint), special chars in candidate name | `@solana/web3.js` PublicKey (use real) |
| `utils/history.ts` | Pure unit + localStorage | `saveVote` appends, `getHistory` newest-first, `updateStatus` matches by (pollId, txSig, `clearHistory`) | Corrupt JSON in localStorage, quota exceeded (catch block), matching against wrong pollId | None (jsdom localStorage) |
| `config/versions.ts` | Config unit | `getVersion` (v1/v2/v3, invalid ID throws), `VERSIONS` length and structure, `PROGRAM_IDS` key match, `CLUSTER_URL` string | Missing version ID throws error | None |
| `hooks/usePolls.ts` | Hook | Returns loading=true initially, fetches polls + candidates, empty polls, loop terminates at MAX_POLLS, handles missing accounts (continue), refresh re-fetches | No program (null case), all PDAs return null, only some polls have candidates, decoded field edge cases (null `merkleRoot`, missing `candidates`) | WalletAdapter, Connection.getAccountInfo (multiple calls), Program.coder.accounts.decode |
| `hooks/useVote.ts` | Hook | `vote` v1 minimal accounts, `vote` v2 with token lookup + escrow, `vote` v3 with merkle proof generation, `withdraw` v2 only, `withdraw` throws on v1/v3, `closePoll`, wallet not connected error | V2 with no token accounts (throws), V3 generates proof on-the-fly when not provided, `amount` handling across versions | WalletAdapter (publicKey, signTransaction, sendTransaction), Connection (getTokenAccountsByOwner, confirmTransaction), Program.methods chain |
| `components/Header.tsx` | Component | Renders title, version selector with 3 options, wallet button renders, connection status banner shows when disconnected, banner hidden when connected | useWallet().connected = false vs true | WalletAdapter mock + render wrapper |
| `components/PollCard.tsx` | Component | Renders poll name/description/dates, status badge (active/closed/ended), vote button per candidate, token amount input (V2 only), withdraw button (V2 closed only), close button, loading state disables correct button, error message display, success message display, empty candidates list | isActive boundary (now === start, now === end), all actions in flight simultaneously, error then success transition | useVote mock + Poll/Candidate fixtures |
| `components/PollList.tsx` | Component | Loading state renders text, empty state shows version text, renders PollCards for each poll, passes candidates map correctly | polls=[] with version switching | usePolls mock + useApp mock |
| `context/AppContext.tsx` | Integration-light | Provider creates connection + programs, version state management, program null when no wallet, `useApp` throws outside provider | Wallet publicKey changes (programs memoized), version switching validity | Wallet adapter + minimal (integration classification) |

### Risk Areas

1. **usePolls `for` loop up to 50 iterations** — Each iteration does 2 RPC calls (poll account + candidate accounts). Tests must stub `getAccountInfo` to return `null` for most IDs to keep test runtime sane. Even with mocks, a full 50-iteration run could be slow.
2. **useVote V3 merkle proof generation** — The hook builds a Merkle tree on-the-fly using `sha256` from `@noble/hashes`. This is real crypto and fast, but mocking `sha256` would make proofs non-verifiable. Better to use real sha256 and accept the dependency.
3. **`@anchor-lang/core` Program constructor** — `new Program(IDL, ...)` expects a full Anchor IDL + provider object. Unit-mocking this is fragile if the Anchor API changes. Better to mock at the `program.methods.vote(...)` chain level (4-5 levels of chained method calls).
4. **@solana/wallet-adapter-react-ui WalletMultiButton** — This is a third-party UI component wrapping the wallet modal. It may render a `<w3m-button>` or similar shadow DOM. Tests should verify it renders (`{children}` or `data-testid`) rather than inspecting internals.
5. **IDL JSON imports** — vitest should handle JSON imports with `module: "ESNext"` + `moduleResolution: "bundler"` but confirm in setup.
6. **`WalletProvider.tsx`** — Instantiates real wallet adapters (`PhantomWalletAdapter`, etc.) which may try to connect to browser extensions during import. Tests importing this file directly may fail in jsdom. Solution: mock these at the module boundary.

### Coverage Estimate

| Layer | Files | Test Files | Test Lines (approx) | Mock Complexity |
|-------|-------|-----------|---------------------|-----------------|
| Pure utils | 3 | 3 | 250 | None |
| Config | 1 | 1 | 40 | None |
| Hooks | 2 | 2 | 250 | Medium (Solana module mocks) |
| Components | 3 | 2 | 250 | Medium (provider wrappers) |
| Context | 2 | 1 | 60 | Low (integration-light) |
| Setup/config | — | 2 files | 20 | — |
| **Total** | **11 src files** | **~7 test files** | **~870** | — |
