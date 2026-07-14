# Proposal: Governance dApp Visual Design

## Intent

Establish the visual identity for the Solana governance dApp — a stakeholder-facing HTML/CSS design deck and interactive prototype covering landing page and dashboard. Pure design work: no contract logic, no frontend implementation.

## Scope

### In Scope
- Stakeholder deck: ~6 HTML/CSS slides communicating product vision for DAO members and investors
- Interactive prototype: Landing (hero, features, CTA) + Dashboard (active/closed polls)
- Style system: dark theme, purple/black/neon Solana-native palette
- Wallet visualization: mocked disconnect → connect flow

### Out of Scope
- Production frontend implementation
- Smart contract changes
- Responsive breakpoints beyond desktop-first
- Final production CSS

## Capabilities

### New Capabilities
- `governance-design-deck`: Visual deck for stakeholders — product vision, style direction, UX mockups
- `governance-prototype-landing`: Landing page HTML prototype (hero, features, CTA)
- `governance-prototype-dashboard`: Dashboard HTML prototype (poll list, active/closed state)

### Modified Capabilities
None — no existing specs to modify.

## Approach

Iterative visual design via `open-design-bridge`:
1. Generate HTML/CSS stakeholder deck via OD MCP
2. Review and iterate with user feedback
3. Generate interactive prototype from approved deck direction
4. Wireframe wallet connect states (disconnected → connected)
5. Finalize both artifacts in Engram + OD project

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/governance-dapp-design/` | New | Proposal + design artifacts |
| `openspec/specs/governance-*` | New | Specs from design output |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OD daemon unavailable | Low | Fallback: hand-coded HTML/CSS |
| Design misses Solana native feel | Medium | Early deck review rounds |

## Rollback Plan

No production code deployed. Designs are versioned artifacts — Engram history retains previous versions. No rollback needed.

## Dependencies

- Open Design daemon (port 7456)
- `open-design-bridge` MCP tools

## Success Criteria

- [ ] Stakeholder deck approved (6+ slides, Solana-native look)
- [ ] Landing page prototype renders wallet connect mock
- [ ] Dashboard shows active vs closed poll states
- [ ] Design direction documented for implementation phase
