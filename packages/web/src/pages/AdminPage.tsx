import { useState } from "react";
import { useMutation, useQuery } from "urql";
import { NavBar } from "../components/NavBar";
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
      <div className="result-score-row">
        <div className="score-field">
          <label className="score-label">
            {match.homeTeamLabel}
            <input
              className="score-input"
              type="number"
              placeholder="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              min={0}
            />
          </label>
        </div>
        <span className="score-sep">–</span>
        <div className="score-field">
          <label className="score-label">
            {match.awayTeamLabel}
            <input
              className="score-input"
              type="number"
              placeholder="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              min={0}
            />
          </label>
        </div>
      </div>
      <div className="result-bottom-row">
        <div className="winner-field">
          <label className="winner-label">
            Winner
            <select
              className="winner-select"
              value={winner}
              onChange={(e) => setWinner(e.target.value as "home" | "away" | "draw")}
            >
              <option value="home">{match.homeTeamLabel}</option>
              <option value="away">{match.awayTeamLabel}</option>
              {isGroup && <option value="draw">Draw</option>}
            </select>
          </label>
        </div>
        <button type="submit" className="result-submit-btn">
          Save result
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
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

  const pending = (matchesResult.data?.matches ?? [])
    .filter((m) => !m.result)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const ROUND_LABELS: Record<string, string> = {
    group: "Group Stage",
    r32: "R32",
    r16: "R16",
    qf: "QF",
    sf: "SF",
    final: "Final",
    third_place: "3rd Place",
  };

  return (
    <div className="admin-page">
      <NavBar currentUser={me} />
      <div className="admin-header">
        <h1>🛠 Admin</h1>
        <span className="admin-subtitle">Record match results</span>
      </div>
      {pending.length === 0 ? (
        <div className="admin-all-done">✅ All results recorded.</div>
      ) : (
        <div className="admin-match-list">
          {pending.map((match) => (
            <div key={match.id} className="admin-match-card">
              <div className="admin-match-header">
                <span className="admin-round-badge">
                  {ROUND_LABELS[match.round] ?? match.round}
                </span>
                <span className="admin-match-time">
                  {new Date(match.startsAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="admin-match-teams">
                {match.homeTeamLabel}
                <span className="admin-vs">vs</span>
                {match.awayTeamLabel}
              </div>
              <MatchResultForm
                match={match}
                onDone={() => reexecute({ requestPolicy: "network-only" })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
