import { useCallback, useEffect, useState } from "react";
import type { VersionId } from "../config/versions";
import { getVersion } from "../config/versions";
import { useApp } from "../context/AppContext";
import { derivePollPda, deriveCandidatePda } from "../utils/pda";

export interface Poll {
  pollId: number;
  name: string;
  description: string;
  start: number;
  end: number;
  closed: boolean;
  approved?: boolean;
  totalWeight?: number;
  merkleRoot?: number[];
  candidateNames: string[];
}

export interface Candidate {
  name: string;
  votes: number;
}

const MAX_POLLS = 50;

export function usePolls(versionId?: VersionId) {
  const { version: ctxVersion, programs, connection } = useApp();
  const version = versionId ?? ctxVersion;
  const program = programs[version];

  const [polls, setPolls] = useState<Poll[]>([]);
  const [candidates, setCandidates] = useState<Map<number, Candidate[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    const config = getVersion(version);
    const pollList: Poll[] = [];
    const candMap = new Map<number, Candidate[]>();

    try {
      for (let id = 1; id <= MAX_POLLS; id++) {
        const [pollPda] = derivePollPda(config.programId, id);
        const accountInfo = await connection.getAccountInfo(pollPda);
        if (!accountInfo) continue;

        const decoded = program.coder.accounts.decode("PollAccount", accountInfo.data) as Record<string, unknown>;

        const pollName = String(decoded.pollName ?? "");
        const description = String(decoded.description ?? "");
        const start = Number(decoded.votingStart ?? 0);
        const end = Number(decoded.votingEnd ?? 0);
        const closed = Boolean(decoded.closed);

        const poll: Poll = {
          pollId: id,
          name: pollName,
          description,
          start,
          end,
          closed,
          candidateNames: [],
        };

        if (typeof decoded.candidates === "string") {
          poll.candidateNames = decoded.candidates.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        if (typeof decoded.approved === "boolean") poll.approved = decoded.approved;
        if (decoded.totalWeight != null) poll.totalWeight = Number(decoded.totalWeight);
        if (decoded.merkleRoot) poll.merkleRoot = decoded.merkleRoot as number[];

        pollList.push(poll);

        // Fetch candidates by deriving PDAs from stored names
        const cands: Candidate[] = [];
        for (const name of poll.candidateNames) {
          const [candPda] = deriveCandidatePda(config, id, name);
          const info = await connection.getAccountInfo(candPda);
          if (!info) continue;
          const cd = program.coder.accounts.decode("CandidateAccount", info.data) as { candidateName: string; candidateVotes: bigint };
          cands.push({ name: cd.candidateName, votes: Number(cd.candidateVotes) });
        }
        if (cands.length > 0) candMap.set(id, cands);
      }
    } finally {
      setPolls(pollList);
      setCandidates(candMap);
      setLoading(false);
    }
  }, [program, connection, version]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { polls, candidates, loading, refresh: fetch };
}
