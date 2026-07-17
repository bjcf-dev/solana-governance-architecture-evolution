# Design: PR5 — Frontend Unit & Component Tests

## Technical Approach

Three-tier test pyramid using vitest + testing-library: pure units with zero mocks, hooks with mocked RPC/Program chain, components with RTL render + mocked providers. All new infra under `app/src/test/`. Zero production code changes.

## Architecture Decisions

### Test file location

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `__tests__/` dir per module | Extra nesting, harder to locate | ❌ |
| Co-located `*.test.ts(x)` next to source | Vitest default, obvious mapping | ✅ |

### Vitest globals

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `globals: true` | `describe`/`it`/`expect` without import — vitest convention | ✅ |
| Explicit imports | Verbose, no benefit in project without non-vitest test runner | ❌ |

### Module-level mock in setup vs per-test

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `vi.mock("wallets")` in `setup.ts` | Runs once before all tests — wallet adapters never instantiate in jsdom | ✅ |
| Per-test mock | Repetitive, easy to miss | ❌ |

### Program mock approach

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Factory building chained `.methods.X.accounts().instruction()` | Tight fixture per version path | ✅ |
| Real Program constructor | Requires real IDL + runtime, fragile in jsdom | ❌ |

## Data Flow

```
vitest
  ├── setup.ts
  │   ├── @testing-library/jest-dom matchers
  │   ├── vi.mock("@solana/wallet-adapter-wallets") ← module-level, blocks real adapters
  │   └── vi.mock("@solana/wallet-adapter-react-ui") ← module-level, WalletMultiButton stub
  │
  ├── mocks/
  │   ├── factories.ts    ← createMockWallet(), createMockConnection(), createMockProgram()
  │   └── ...
  │
  ├── test-utils.tsx
  │   ├── customRender()   ← wraps children with test AppContext (mocked version, program, connection)
  │   └── renderHookWithProviders()  ← wraps renderHook() with same test providers
  │
  ├── utils/*.test.ts      ← pure, no mocks needed (except localStorage for history)
  ├── hooks/*.test.tsx     ← usePolls: mock getAccountInfo → returns null or encoded data
  │                              useVote: mock program.methods chain, mock wallet.sendTransaction
  ├── components/*.test.tsx ← render via customRender, mock useWallet at module level in each file
  └── context/*.test.tsx   ← AppContext: vi.mock("@solana/wallet-adapter-react") for controlled wallet
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/vite.config.ts` | Modify | Add `test` block (environment, setupFiles, globals, coverage) |
| `app/src/test/setup.ts` | Create | jest-dom imports, `vi.mock("@solana/wallet-adapter-wallets")`, `vi.mock("@solana/wallet-adapter-react-ui")` |
| `app/src/test/mocks/factories.ts` | Create | `createMockWallet()`, `createMockConnection()`, `createMockProgram()` |
| `app/src/test/test-utils.tsx` | Create | `customRender()` wrapping providers |
| `app/src/utils/merkle.test.ts` | Create | 6 describe blocks per function |
| `app/src/utils/pda.test.ts` | Create | 5 describe blocks per function |
| `app/src/utils/history.test.ts` | Create | 4 describe blocks + error handling |
| `app/src/config/versions.test.ts` | Create | 3 describe blocks |
| `app/src/hooks/usePolls.test.tsx` | Create | 4 describe blocks |
| `app/src/hooks/useVote.test.tsx` | Create | 6 describe blocks |
| `app/src/components/Header.test.tsx` | Create | 3 describe blocks |
| `app/src/components/PollCard.test.tsx` | Create | 8 describe blocks |
| `app/src/components/PollList.test.tsx` | Create | 3 describe blocks |
| `app/src/context/AppContext.test.tsx` | Create | 2 describe blocks |

## Interfaces / Contracts

### vite.config.ts — test block shape

```ts
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  include: ["src/**/*.test.{ts,tsx}"],
  coverage: {
    provider: "v8",
    include: ["src/utils/**", "src/hooks/**", "src/components/**", "src/context/**"],
    thresholds: {
      "src/utils/": { branches: 80, functions: 80, lines: 80 },
      "src/hooks/": { branches: 65, functions: 70, lines: 70 },
      "src/components/": { branches: 65, functions: 70, lines: 70 },
     },
   },
 },
```

### Mock factory signatures

```ts
// factories.ts
createMockWallet(overrides?: Partial<Wallet>): {
  publicKey: PublicKey; signTransaction: fn; sendTransaction: fn => Promise<string>;
}
createMockConnection(accounts?: Map<string, AccountInfo>): {
  getAccountInfo: fn => Promise<AccountInfo | null>;
  getTokenAccountsByOwner: fn => Promise<{ value: { pubkey: PublicKey }[] }>;
  confirmTransaction: fn => Promise<void>;
}
createMockProgram(options: { version: VersionId; wallet: Wallet }): {
  methods: { vote: chain, withdrawTokens: chain, closePoll: chain };
  coder: { accounts: { decode: fn } };
}
```

### customRender signature

```ts
// test-utils.tsx
interface TestProviderOptions {
  version?: VersionId;
  wallet?: ReturnType<typeof createMockWallet>;
  connection?: ReturnType<typeof createMockConnection>;
}
customRender(ui: ReactElement, options?: TestProviderOptions): RenderResult
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — utils | merkle, pda, history, versions | Pure function calls, no mocks. `vi.stubGlobal("localStorage", ...)` for history. |
| Integration — hooks | usePolls, useVote | Mock connection.getAccountInfo + program.methods chain. Assert state transitions. |
| Component — UI | Header, PollCard, PollList, AppContext | RTL `render` + `userEvent`. `vi.mock` useWallet per file. `customRender` wraps providers. |

## Migration / Rollout

No migration required. All new files, zero production code changes. Rollback: revert `vite.config.ts`, delete `src/test/`.

## Open Questions

- `@solana/web3.js` v1 PublicKey: does it instantiate correctly in jsdom without a DOM canvas dependency? (Only needed if pure derivation tests fail — fallback: mock PublicKey static methods.)
- coverage thresholds on hooks/components: may need adjustment after first run if the 50-iteration loop in usePolls makes branch coverage tight. Set to `65/70/70` initial guard; raise after brooming.
