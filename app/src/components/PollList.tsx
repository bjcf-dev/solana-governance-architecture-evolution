import { useApp } from "../context/AppContext";
import { usePolls } from "../hooks/usePolls";
import { PollCard } from "./PollCard";

export function PollList() {
  const { version } = useApp();
  const { polls, candidates, loading } = usePolls();

  if (loading) return <p className="text-gray-500">Loading polls…</p>;
  if (polls.length === 0) return <p className="text-gray-500">No polls yet for {version.toUpperCase()}.</p>;

  return (
    <div className="space-y-3">
      {polls.map((poll) => (
        <PollCard
          key={poll.pollId}
          poll={poll}
          candidates={candidates.get(poll.pollId) ?? []}
          version={version}
        />
      ))}
    </div>
  );
}
