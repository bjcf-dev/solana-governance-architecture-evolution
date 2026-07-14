import { useState } from "react";
import type { VersionId } from "../config/versions";
import { getVersion } from "../config/versions";
import type { Poll, Candidate } from "../hooks/usePolls";
import { useVote } from "../hooks/useVote";

interface PollCardProps {
  poll: Poll;
  candidates: Candidate[];
  version: VersionId;
}

export function PollCard({ poll, candidates, version }: PollCardProps) {
  const { vote, withdraw, closePoll } = useVote(version);
  const [amount, setAmount] = useState("1");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const config = getVersion(version);
  const now = Math.floor(Date.now() / 1000);
  const isActive = now >= poll.start && now <= poll.end && !poll.closed;

  async function handleVote(candidate: string) {
    setLoading(`vote-${candidate}`);
    setError(null);
    setSuccess(null);
    try {
      const sig = await vote({
        pollId: poll.pollId,
        candidate,
        amount: config.features.tokenGating ? Number(amount) : undefined,
      });
      setSuccess(`Voted! ${sig.slice(0, 16)}...`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleWithdraw() {
    setLoading("withdraw");
    setError(null);
    setSuccess(null);
    try {
      const sig = await withdraw(poll.pollId);
      setSuccess(`Withdrawn! ${sig.slice(0, 16)}...`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdraw failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleClose() {
    setLoading("close");
    setError(null);
    setSuccess(null);
    try {
      const sig = await closePoll(poll.pollId);
      setSuccess(`Closed! ${sig.slice(0, 16)}...`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{poll.name}</h3>
          <p className="text-sm text-gray-600">{poll.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          poll.closed ? "bg-red-100 text-red-700" :
          isActive ? "bg-green-100 text-green-700" :
          "bg-gray-100 text-gray-600"
        }`}>
          {poll.closed ? "Closed" : isActive ? "Active" : "Ended"}
        </span>
      </div>

      <p className="mt-1 text-xs text-gray-400">
        {new Date(poll.start * 1000).toLocaleDateString()} — {new Date(poll.end * 1000).toLocaleDateString()}
      </p>

      {candidates.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {candidates.map((c) => (
            <li key={c.name} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
              <span>{c.name}: <strong>{c.votes}</strong></span>
              {isActive && !poll.closed && (
                <div className="flex items-center gap-2">
                  {config.features.tokenGating && (
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-16 rounded border px-2 py-1 text-xs"
                      placeholder="Amount"
                    />
                  )}
                  <button
                    onClick={() => handleVote(c.name)}
                    disabled={loading === `vote-${c.name}`}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading === `vote-${c.name}` ? "..." : "Vote"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        {config.features.escrow && !isActive && poll.closed && (
          <button
            onClick={handleWithdraw}
            disabled={loading === "withdraw"}
            className="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading === "withdraw" ? "..." : "Withdraw"}
          </button>
        )}
        <button
          onClick={handleClose}
          disabled={loading === "close"}
          className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          {loading === "close" ? "..." : "Close Poll"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-2 text-xs text-green-600">{success}</p>}
    </div>
  );
}
