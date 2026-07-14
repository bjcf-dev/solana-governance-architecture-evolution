# Design: Governance dApp Visual Design

## Technical Approach

Translate the approved Solana-native design deck into a CSS token system and interactive HTML/CSS prototype that validates the look-and-feel before production implementation. The prototype simulates wallet states (disconnected → connected), navigation (Landing → Dashboard), and poll lifecycle (active → closed) without backend contracts. All design tokens are extracted as CSS custom properties for direct handoff to React component styling.

## Architecture Decisions

### Decision: Dark theme with CSS custom properties

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Tailwind config extension | Ties design tokens to build system, harder to drop into standalone prototype | CSS custom properties on `:root` — prototype uses raw CSS, production can consume same tokens via Tailwind's `theme.extend.colors` |
| Inline utility classes | Fast to prototype but no token extraction | Token variables (`--purple`, `--neon-green`) in `prototype.css` mapped 1:1 to deck palette |

**Rationale**: The deck already defines the tokens in CSS. Extracting them as `:root` variables requires zero transformation and produces a file (`tokens.css`) that production can `@apply` or reference.

### Decision: HTML/CSS interactive prototype, no framework

| Option | Tradeoff | Decision |
|--------|----------|----------|
| React prototype | Closer to production but heavier iteration cycle, bundler needed | Vanilla HTML + CSS + JS — instant iteration, no build step, same DOM structure as React components |
| Figma prototype | Not code-reviewable, no CSS extraction | HTML prototype IS the deliverable — developer can inspect and copy |

**Rationale**: The proposal calls for a design validation artifact, not production code. Vanilla HTML keeps review cycles under 1 second (save → refresh).

### Decision: Single-threaded "app" navigation (no router)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Hash-based SPA routing | More realistic but adds JS complexity | CSS `display: none/block` toggling between Landing and Dashboard sections |
| Separate HTML pages | Loses interactive wallet state across pages | Single `index.html` — wallet state is a JS var carried across views |

**Rationale**: The prototype has 2 views and 2 wallet states (4 permutations). A single HTML file with state toggles is the minimal representation. Production will use React Router.

## Data Flow

```
User Action           JS State Change            DOM Update
───────────           ───────────────            ──────────
Click "Connect"   →   walletState = "connected"  →  Hero CTA → wallet badge
                                            →  Dashboard section visible
Click "Disconnect" →  walletState = "disconnected" →  Wallet badge → CTA button
                                            →  Dashboard hidden, Landing visible
Click "View Poll"  →  view = "dashboard"       →  Landing hidden, Dashboard visible
Click "Back"       →  view = "landing"         →  Dashboard hidden, Landing visible
```

```
                ┌──────────────┐
                │  App State   │
                │  ┌────────┐  │
                │  │ wallet │  │  disconnected / connected
                │  │ view   │  │  landing / dashboard
                │  └────────┘  │
                └──────┬───────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │  Hero    │ │Features  │ │Dashboard │
   │ (CTA/badge)│ │(4 cards) │ │(poll list)│
   └──────────┘ └──────────┘ └──────────┘
```

## Visual Design Tokens

```
--purple:        #9945FF    (primary, buttons, links)
--purple-dark:   #7A2FE0    (hover states)
--purple-glow:   rgba(153,69,255,0.3)  (shadows, focus rings)
--black:         #0D0E14    (page background)
--black-2:       #14151E    (card backgrounds)
--black-3:       #1C1D2A    (hover/active card states)
--neon-green:    #00FF9D    (active indicator, success)
--cyan:          #00D4FF    (secondary accent, info)
--white:         #F0F0F5    (text primary)
--gray:          #8888A0    (text secondary, metadata)
--card-bg:       rgba(20,21,30,0.8)   (glass card)
--glass-border:  rgba(153,69,255,0.15) (card borders)
```

| Token | Value | Usage |
|-------|-------|-------|
| Font family primary | `Inter` | Body, headings |
| Font family mono | `JetBrains Mono` | Addresses, code, timestamps |
| Font weight light | 300 | Subtitles |
| Font weight base | 400 | Body text |
| Font weight semibold | 600 | Card headings |
| Font weight bold | 700 | Page titles |
| Border radius | 0.5rem–1rem | Cards, buttons |
| Glass blur | 8px–12px | Card backdrops |

## Page Layouts

### Landing (hero)
```
┌──────────────────────────────────────────────┐
│  [Logo]                    [Connect Wallet]   │  ← Header 
│                                               │
│          ✦ Solana Governance DApp             │
│     Participate in on-chain governance.       │
│     Propose, vote, and shape the protocol.    │
│                                               │
│           [Connect Wallet →]                   │  ← CTA button
│                                               │
│  🔮 Trust     🧭 Navigation   ⚡ Native   🛡️ Wallet │  ← Features
│                                               │
│           ← → navigate                        │
└──────────────────────────────────────────────┘
```

### Dashboard (connected state)
```
┌──────────────────────────────────────────────┐
│  [Logo]          ● 7v9y...3kD1   [Disconnect] │  ← Wallet badge
│                                               │
│  Active Polls ─────────────────────────────── │
│  ● Treasury Allocation Q3          12h left   │  ← Active
│  ● Validator Incentives             3d left   │
│                                               │
│  Closed Polls ─────────────────────────────── │
│  ○ Protocol Upgrade v2              Closed    │  ← Closed
│  ○ Fee Structure Change             Closed    │
│                                               │
│  [View All →]                                 │
└──────────────────────────────────────────────┘
```

## States

| State | Visual | Wallet |
|-------|--------|--------|
| **Loading** | Skeleton cards with pulse animation, no text | — |
| **Empty** (disconnected) | Hero CTA visible, Dashboard hidden | Disconnected |
| **Empty** (connected, no polls) | Dashboard with "No polls yet" message | Connected badge |
| **Error** | Red toast/banner: "Failed to load polls" | Keeps current state |
| **Disconnected** | Large "Connect Wallet" CTA in hero, navigation disabled | — |
| **Connected** | Wallet badge, Dashboard accessible, polls visible | Address truncated + SOL balance |

## Interactive Prototype Spec

The `prototype/index.html` file MUST include:

1. **Landing view** — hero with gradient title, subtitle, 4 feature cards (Trust, Navigation, Native Feel, Wallet Confidence), CTA button
2. **Dashboard view** — active polls (green dot, time remaining), closed polls (gray dot), wallet badge in header
3. **Wallet state toggle** — single JS variable `walletConnected` toggles between:
   - Disconnected: hero CTA shows "Connect Wallet", dashboard hidden
   - Connected: header shows wallet badge (truncated address + mock SOL balance), dashboard visible
4. **Navigation** — simple view switching (Landing ↔ Dashboard) via button clicks
5. **CSS transitions** — smooth fade/slide between landing and dashboard
6. **Responsive** — desktop-first, usable down to 768px (proposal constraint)

### Mock data

```js
const mockPolls = [
  { id: 1, title: "Treasury Allocation Q3", status: "active", timeLeft: "12h" },
  { id: 2, title: "Validator Incentives", status: "active", timeLeft: "3d" },
  { id: 3, title: "Protocol Upgrade v2", status: "closed" },
  { id: 4, title: "Fee Structure Change", status: "closed" },
];
const mockWallet = { address: "7v9y...3kD1", balance: "2,450 SOL" };
```

### Visual hierarchy (z-index)

| Layer | Content |
|-------|---------|
| z-0 | Background gradient orbs |
| z-1 | Cards, text, buttons |
| z-10 | Navigation dots |
| z-100 | Toast/error overlays |

## Implementation Notes

The prototype maps to existing React components as follows:

| Prototype Element | React Component | File |
|-------------------|----------------|------|
| Header (logo, wallet) | `Header` | `app/src/components/Header.tsx` |
| Version selector | `VersionSelector` (inline in Header) | `app/src/components/Header.tsx` |
| Wallet button | `WalletMultiButton` | `@solana/wallet-adapter-react-ui` |
| Poll card | `PollCard` | `app/src/components/PollCard.tsx` |
| Poll list | `PollList` | `app/src/components/PollList.tsx` |
| Landing hero + features | *New component needed* | — |
| Wallet connection state | `useWallet().connected` | `@solana/wallet-adapter-react` |

### Migration path to production

| Design Token | Tailwind Mapping |
|-------------|------------------|
| `--purple` | `colors.purple.500` or custom `colors.solana.500` |
| `--black` | `colors.gray.950` or custom `colors.solana.900` |
| `--neon-green` | `colors.emerald.400` or custom `colors.solana.green` |
| `--cyan` | `colors.cyan.400` or custom `colors.solana.cyan` |
| Glass cards | `backdrop-blur-lg bg-white/5 border border-white/10` |

### Net-new production components (future SDD change)

- `LandingPage` — hero section with CTA, feature grid
- `WalletBadge` — truncated address + balance display
- `StateMessage` — reusable loading/empty/error display

## Open Questions

- None — design direction is approved via the stakeholder deck. Prototype will validate edge cases.
