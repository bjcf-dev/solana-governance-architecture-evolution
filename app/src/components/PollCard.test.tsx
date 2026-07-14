import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render, fireEvent } from "@testing-library/react";
import { PollCard } from "./PollCard";
import type { Poll, Candidate } from "../hooks/usePolls";

// ── Module-level mocks ────────────────────────────────────────────────────
// Hoisted references keep mock functions controllable across beforeEach.

const { mockVoteActions } = vi.hoisted(() => ({
  mockVoteActions: {
    vote: vi.fn().mockResolvedValue("mock-sig-vote"),
    withdraw: vi.fn().mockResolvedValue("mock-sig-withdraw"),
    closePoll: vi.fn().mockResolvedValue("mock-sig-close"),
  },
}));

vi.mock("../hooks/useVote", () => ({
  useVote: vi.fn(() => mockVoteActions),
}));

// ── Test data ─────────────────────────────────────────────────────────────

const ALICE: Candidate = { name: "Alice", votes: 10 };
const BOB: Candidate = { name: "Bob", votes: 5 };
const CANDIDATES = [ALICE, BOB];

const now = Math.floor(Date.now() / 1000);
const ACTIVE_POLL: Poll = {
  pollId: 1,
  name: "Governance Vote #1",
  description: "Choose the next protocol upgrade",
  start: now - 86400,  // started yesterday
  end: now + 86400,    // ends tomorrow
  closed: false,
  candidateNames: ["Alice", "Bob"],
};

const CLOSED_POLL: Poll = {
  ...ACTIVE_POLL,
  pollId: 2,
  name: "Closed Proposal",
  start: now - 172800,
  end: now - 86400,
  closed: true,
};

const ENDED_POLL: Poll = {
  ...ACTIVE_POLL,
  pollId: 3,
  name: "Expired Proposal",
  start: now - 172800,
  end: now - 86400,
  closed: false,
};

// ── Suite ─────────────────────────────────────────────────────────────────

describe("PollCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default resolved values cleared by clearAllMocks
    mockVoteActions.vote.mockResolvedValue("mock-sig-vote");
    mockVoteActions.withdraw.mockResolvedValue("mock-sig-withdraw");
    mockVoteActions.closePoll.mockResolvedValue("mock-sig-close");
  });

  function renderCard(
    poll: Poll = ACTIVE_POLL,
    candidates: Candidate[] = CANDIDATES,
    version = "v2" as const,
  ) {
    return render(<PollCard poll={poll} candidates={candidates} version={version} />);
  }

  // ── Basic rendering ───────────────────────────────────────────────────

  it("renders poll name and description", () => {
    renderCard();
    expect(screen.getByText("Governance Vote #1")).toBeInTheDocument();
    expect(screen.getByText("Choose the next protocol upgrade")).toBeInTheDocument();
  });

  it("shows date range", () => {
    renderCard();
    // Uses toLocaleDateString — check that both dates appear in the rendered text
    const start = new Date(ACTIVE_POLL.start * 1000).toLocaleDateString();
    const end = new Date(ACTIVE_POLL.end * 1000).toLocaleDateString();
    expect(screen.getByText(`${start} — ${end}`)).toBeInTheDocument();
  });

  // ── Status badges ─────────────────────────────────────────────────────

  it("shows 'Active' badge for in-progress polls", () => {
    renderCard();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows 'Closed' badge for closed polls", () => {
    renderCard(CLOSED_POLL);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("shows 'Ended' badge for past polls", () => {
    renderCard(ENDED_POLL);
    expect(screen.getByText("Ended")).toBeInTheDocument();
  });

  // ── Candidate list ────────────────────────────────────────────────────

  it("renders candidate names with vote counts", () => {
    renderCard();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  // ── Vote button ───────────────────────────────────────────────────────

  it("shows vote buttons for active polls", () => {
    renderCard();
    const voteButtons = screen.getAllByText("Vote");
    expect(voteButtons).toHaveLength(2); // one per candidate
  });

  it("hides vote buttons for closed polls", () => {
    renderCard(CLOSED_POLL);
    expect(screen.queryByText("Vote")).not.toBeInTheDocument();
  });

  it("hides vote buttons for ended polls", () => {
    renderCard(ENDED_POLL);
    expect(screen.queryByText("Vote")).not.toBeInTheDocument();
  });

  it("calls vote when vote button is clicked", () => {
    renderCard();
    const voteButtons = screen.getAllByText("Vote");
    fireEvent.click(voteButtons[0]);
    expect(mockVoteActions.vote).toHaveBeenCalledWith({
      pollId: 1,
      candidate: "Alice",
      amount: 1, // default for V2 with tokenGating
    });
  });

  // ── Token amount input ────────────────────────────────────────────────

  it("shows token amount input for V2 polls (tokenGating)", () => {
    renderCard(ACTIVE_POLL, CANDIDATES, "v2");
    // There should be at least one number input for the token amount
    const inputs = screen.getAllByPlaceholderText("Amount");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it("hides token amount input for V1 polls (no tokenGating)", () => {
    renderCard(ACTIVE_POLL, CANDIDATES, "v1");
    expect(screen.queryByPlaceholderText("Amount")).not.toBeInTheDocument();
  });

  it("hides token amount input for V3 polls (no tokenGating)", () => {
    renderCard(ACTIVE_POLL, CANDIDATES, "v3");
    expect(screen.queryByPlaceholderText("Amount")).not.toBeInTheDocument();
  });

  // ── Withdraw button ──────────────────────────────────────────────────

  it("shows withdraw button for V2 closed polls (escrow feature)", () => {
    renderCard(CLOSED_POLL, CANDIDATES, "v2");
    expect(screen.getByText("Withdraw")).toBeInTheDocument();
  });

  it("hides withdraw button for V2 active polls", () => {
    renderCard(ACTIVE_POLL, CANDIDATES, "v2");
    expect(screen.queryByText("Withdraw")).not.toBeInTheDocument();
  });

  it("hides withdraw button for V1 closed polls (no escrow)", () => {
    renderCard(CLOSED_POLL, CANDIDATES, "v1");
    expect(screen.queryByText("Withdraw")).not.toBeInTheDocument();
  });

  it("calls withdraw when withdraw button clicked", () => {
    renderCard(CLOSED_POLL, CANDIDATES, "v2");
    fireEvent.click(screen.getByText("Withdraw"));
    expect(mockVoteActions.withdraw).toHaveBeenCalledWith(2);
  });

  // ── Close Poll button ────────────────────────────────────────────────

  it("shows close poll button", () => {
    renderCard();
    expect(screen.getByText("Close Poll")).toBeInTheDocument();
  });

  it("close poll button calls closePoll", () => {
    renderCard();
    fireEvent.click(screen.getByText("Close Poll"));
    expect(mockVoteActions.closePoll).toHaveBeenCalledWith(1);
  });

  // ── Loading state ────────────────────────────────────────────────────

  it("shows '...' on vote button when voting", () => {
    // Override vote to set loading mid-call — render with a poll that will trigger loading
    mockVoteActions.vote.mockImplementation(() => new Promise(() => {})); // never resolves
    renderCard();
    fireEvent.click(screen.getAllByText("Vote")[0]);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────

  it("displays error message on vote failure", async () => {
    mockVoteActions.vote.mockRejectedValue(new Error("Insufficient tokens"));
    renderCard();
    fireEvent.click(screen.getAllByText("Vote")[0]);
    expect(await screen.findByText("Insufficient tokens")).toBeInTheDocument();
  });

  it("displays generic error when vote rejects with non-Error", async () => {
    mockVoteActions.vote.mockRejectedValue("oops");
    renderCard();
    fireEvent.click(screen.getAllByText("Vote")[0]);
    expect(await screen.findByText("Vote failed")).toBeInTheDocument();
  });

  // ── Success state ────────────────────────────────────────────────────

  it("displays success message on vote", async () => {
    renderCard();
    fireEvent.click(screen.getAllByText("Vote")[0]);
    expect(await screen.findByText(/Voted!/)).toBeInTheDocument();
  });

  it("displays success message on withdraw", async () => {
    renderCard(CLOSED_POLL, CANDIDATES, "v2");
    fireEvent.click(screen.getByText("Withdraw"));
    expect(await screen.findByText(/Withdrawn!/)).toBeInTheDocument();
  });

  it("displays success message on close", async () => {
    renderCard();
    fireEvent.click(screen.getByText("Close Poll"));
    expect(await screen.findByText(/Closed!/)).toBeInTheDocument();
  });

  // ── Error cleared on new action ──────────────────────────────────────

  it("clears error when voting after an error", async () => {
    mockVoteActions.vote.mockRejectedValueOnce(new Error("First fail"));
    mockVoteActions.vote.mockResolvedValueOnce("mock-sig-retry");

    renderCard();
    const buttons = screen.getAllByText("Vote");

    // First click — fails
    fireEvent.click(buttons[0]);
    expect(await screen.findByText("First fail")).toBeInTheDocument();

    // Second click — succeeds, error should be cleared
    fireEvent.click(buttons[0]);
    expect(await screen.findByText(/Voted!/)).toBeInTheDocument();
    expect(screen.queryByText("First fail")).not.toBeInTheDocument();
  });
});
