import { useState } from "react";
import { useMutation, useQuery } from "urql";
import { MatchesQuery, MeQuery, SetResultMutation } from "../graphql/operations";

type MatchResult = { homeScore: number; awayScore: number; winnerTeamId: string | null } | null;

type MatchData = {
  id: string;
  round: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeTeam: { id: string } | null;
  awayTeam: { id: string } | null;
  startsAt: string;
  isLocked: boolean;
  myPick: null;
  result: MatchResult;
};

type MeData = {
  me: { id: string; username: string; isAdmin: boolean } | null;
};

function MatchResultForm({
  match,
  onDone,
}: {
  match: MatchData;
  onDone: () => void;
}) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [winner, setWinner] = useState<"home" | "away" | "draw">("home");
  const [, setResult] = useMutation(SetResultMutation);
  const [error, setError] = useState<string | null>(null);

  const isGroup = match.round === "group";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hs = Number.parseInt(homeScore, 10);
    const as = Number.parseInt(awayScore, 10);
    if (Number.isNaN(hs) || Number.isNaN(as)) {
      setError("Scores must be numbers");
      return;
    }
    let winnerId: string | null = null;
    if (winner === "home") winnerId = match.homeTeam?.id ?? null;
    else if (winner === "away") winnerId = match.awayTeam?.id ?? null;

    const res = await setResult({
      matchId: match.id,
      winnerId,
      homeScore: hs,
      awayScore: as,
    });
    if (res.error) {
      setError(res.error.message);
    } else {
      onDone();
    }
  }

  return (
    <form className="result-form" onSubmit={handleSubmit}>
      <input
        type="number"
        aria-label="Home score"
        value={homeScore}
        onChange={(e) => setHomeScore(e.target.value)}
        min={0}
      />
      <span>–</span>
      <input
        type="number"
        aria-label="Away score"
        value={awayScore}
        onChange={(e) => setAwayScore(e.target.value)}
        min={0}
      />
      <select
        aria-label="Winner"
        value={winner}
        onChange={(e) => setWinner(e.target.value as "home" | "away" | "draw")}
      >
        <option value="home">{match.homeTeamLabel}</option>
        <option value="away">{match.awayTeamLabel}</option>
        {isGroup && <option value="draw">Draw</option>}
      </select>
      <button type="submit">Submit</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

export function AdminPage() {
  const [meResult] = useQuery<MeData>({ query: MeQuery });
  const [matchesResult, reexecute] = useQuery<{ matches: MatchData[] }>({
    query: MatchesQuery,
    requestPolicy: "cache-and-network",
  });

  const me = meResult.data?.me;

  if (meResult.fetching) return <div>Loading…</div>;
  if (!me?.isAdmin) return <div>Access denied</div>;

  const pending = (matchesResult.data?.matches ?? []).filter((m) => !m.result);

  return (
    <div className="admin-page">
      <h1>Admin — Set Results</h1>
      {pending.length === 0 ? (
        <p>All results recorded.</p>
      ) : (
        <ul className="pending-matches">
          {pending.map((match) => (
            <li key={match.id} className="pending-match">
              <span className="match-label">
                {match.homeTeamLabel} vs {match.awayTeamLabel}
              </span>
              <MatchResultForm
                match={match}
                onDone={() => reexecute({ requestPolicy: "network-only" })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
