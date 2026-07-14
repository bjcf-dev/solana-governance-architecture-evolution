import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import { PollList } from "./PollList";
import type { Poll, Candidate } from "../hooks/usePolls";

// ── Module-level mocks ────────────────────────────────────────────────────

vi.mock("../context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("../hooks/usePolls", () => ({
  usePolls: vi.fn(),
}));

// Mock PollCard so we can verify it receives the right props without
// testing the inner card implementation here.
vi.mock("./PollCard", () => ({
  PollCard: vi.fn(() => <div data-testid="poll-card">Mock PollCard</div>),
}));

import { useApp } from "../context/AppContext";
import { usePolls } from "../hooks/usePolls";
import { PollCard } from "./PollCard";

// ── Test data ─────────────────────────────────────────────────────────────

const POLL_1: Poll = {
  pollId: 1,
  name: "Poll One",
  description: "First poll",
  start: 1000,
  end: 2000,
  closed: false,
  candidateNames: ["Alice"],
};

const POLL_2: Poll = {
  pollId: 2,
  name: "Poll Two",
  description: "Second poll",
  start: 3000,
  end: 4000,
  closed: true,
  candidateNames: ["Bob"],
};

const CANDIDATES_1: Candidate[] = [{ name: "Alice", votes: 10 }];
const CANDIDATES_2: Candidate[] = [{ name: "Bob", votes: 5 }];

// ── Suite ─────────────────────────────────────────────────────────────────

describe("PollList", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApp).mockReturnValue({
      version: "v2",
      setVersion: vi.fn(),
    } as never);
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it("shows loading message when loading is true", () => {
    vi.mocked(usePolls).mockReturnValue({
      polls: [],
      candidates: new Map(),
      loading: true,
      refresh: vi.fn(),
    });

    render(<PollList />);
    expect(screen.getByText("Loading polls…")).toBeInTheDocument();
  });

  it("does not show empty message when loading", () => {
    vi.mocked(usePolls).mockReturnValue({
      polls: [],
      candidates: new Map(),
      loading: true,
      refresh: vi.fn(),
    });

    render(<PollList />);
    expect(screen.queryByText(/No polls yet/)).not.toBeInTheDocument();
  });

  // ── Empty state ────────────────────────────────────────────────────────

  it("shows empty message with version when polls array is empty and not loading", () => {
    vi.mocked(usePolls).mockReturnValue({
      polls: [],
      candidates: new Map(),
      loading: false,
      refresh: vi.fn(),
    });

    render(<PollList />);
    expect(screen.getByText("No polls yet for V2.")).toBeInTheDocument();
  });

  it("uses version from context in empty message", () => {
    vi.mocked(useApp).mockReturnValue({
      version: "v1",
      setVersion: vi.fn(),
    } as never);

    vi.mocked(usePolls).mockReturnValue({
      polls: [],
      candidates: new Map(),
      loading: false,
      refresh: vi.fn(),
    });

    render(<PollList />);
    expect(screen.getByText("No polls yet for V1.")).toBeInTheDocument();
  });

  // ── Poll cards rendering ───────────────────────────────────────────────

  it("renders a PollCard for each poll", () => {
    const candidates = new Map<number, Candidate[]>();
    candidates.set(1, CANDIDATES_1);
    candidates.set(2, CANDIDATES_2);

    vi.mocked(usePolls).mockReturnValue({
      polls: [POLL_1, POLL_2],
      candidates,
      loading: false,
      refresh: vi.fn(),
    });

    render(<PollList />);
    const cards = screen.getAllByTestId("poll-card");
    expect(cards).toHaveLength(2);
  });

  it("passes correct poll, candidates, and version to PollCard", () => {
    const candidates = new Map<number, Candidate[]>();
    candidates.set(1, CANDIDATES_1);

    vi.mocked(usePolls).mockReturnValue({
      polls: [POLL_1],
      candidates,
      loading: false,
      refresh: vi.fn(),
    });

    render(<PollList />);
    expect(PollCard).toHaveBeenCalledTimes(1);
    expect(PollCard).toHaveBeenCalledWith(
      expect.objectContaining({
        poll: POLL_1,
        candidates: CANDIDATES_1,
        version: "v2",
      }),
      expect.anything(), // ref
    );
  });

  it("passes empty array as candidates when poll has no candidates in map", () => {
    const candidates = new Map<number, Candidate[]>(); // empty map

    vi.mocked(usePolls).mockReturnValue({
      polls: [POLL_1],
      candidates,
      loading: false,
      refresh: vi.fn(),
    });

    render(<PollList />);
    expect(PollCard).toHaveBeenCalledWith(
      expect.objectContaining({
        poll: POLL_1,
        candidates: [],
        version: "v2",
      }),
      expect.anything(),
    );
  });
});
