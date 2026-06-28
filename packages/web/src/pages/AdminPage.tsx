import { useState } from "react";
import { useMutation, useQuery } from "urql";
import { KnockoutTeamEditor } from "../components/KnockoutTeamEditor";
import { NavBar } from "../components/NavBar";
import { MatchesQuery, MeQuery, SetResultMutation } from "../graphql/operations";

type MatchResult = { homeScore: number; awayScore: number; winnerTeamId: string | null } | null;

type MatchData = {
  id: string;
  round: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  startsAt: string;
  isLocked: boolean;
  myPick: null;
  result: MatchResult;
};

type MeData = {
  me: { id: string; username: string; isAdmin: boolean } | null;
};

export type Outcome = "home" | "away" | "draw" | null;

/**
 * Derive the match outcome purely from the entered scores.
 * - Returns `null` until both scores are filled in with valid numbers.
 * - A higher score wins; a level group match is a draw; a level knockout match
 *   is decided by the `tiebreak` selection (penalties).
 */
export function deriveOutcome(
  homeScore: string,
  awayScore: string,
  isGroup: boolean,
  tiebreak: "home" | "away",
): { bothFilled: boolean; isLevel: boolean; outcome: Outcome } {
  const hs = homeScore === "" ? Number.NaN : Number.parseInt(homeScore, 10);
  const as = awayScore === "" ? Number.NaN : Number.parseInt(awayScore, 10);
  const bothFilled = !Number.isNaN(hs) && !Number.isNaN(as);
  const isLevel = bothFilled && hs === as;
  let outcome: Outcome = null;
  if (bothFilled) {
    if (hs > as) outcome = "home";
    else if (as > hs) outcome = "away";
    else outcome = isGroup ? "draw" : tiebreak;
  }
  return { bothFilled, isLevel, outcome };
}

function MatchResultForm({
  match,
  onDone,
}: {
  match: MatchData;
  onDone: () => void;
}) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  // For knockout matches that end level, the admin picks who advanced (penalties).
  const [tiebreak, setTiebreak] = useState<"home" | "away">("home");
  const [{ fetching }, setResult] = useMutation(SetResultMutation);
  const [error, setError] = useState<string | null>(null);

  const isGroup = match.round === "group";
  const homeName = match.homeTeam?.name ?? match.homeTeamLabel;
  const awayName = match.awayTeam?.name ?? match.awayTeamLabel;

  const { bothFilled, isLevel, outcome } = deriveOutcome(homeScore, awayScore, isGroup, tiebreak);

  const outcomeLabel =
    outcome === "home"
      ? `${homeName} win`
      : outcome === "away"
        ? `${awayName} win`
        : outcome === "draw"
          ? "Draw"
          : null;

  const canSubmit = bothFilled && !fetching;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bothFilled) return;
    let winnerId: string | null = null;
    if (outcome === "home") winnerId = match.homeTeam?.id ?? null;
    else if (outcome === "away") winnerId = match.awayTeam?.id ?? null;

    const res = await setResult({
      matchId: match.id,
      winnerId,
      homeScore: Number.parseInt(homeScore, 10),
      awayScore: Number.parseInt(awayScore, 10),
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
            {homeName}
            <input
              className="score-input"
              type="number"
              placeholder="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              min={0}
              disabled={fetching}
            />
          </label>
        </div>
        <span className="score-sep">–</span>
        <div className="score-field">
          <label className="score-label">
            {awayName}
            <input
              className="score-input"
              type="number"
              placeholder="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              min={0}
              disabled={fetching}
            />
          </label>
        </div>
      </div>
      <div className="result-bottom-row">
        <div className="winner-field">
          {isLevel && !isGroup ? (
            <label className="winner-label">
              Advances (penalties)
              <select
                className="winner-select"
                value={tiebreak}
                onChange={(e) => setTiebreak(e.target.value as "home" | "away")}
                disabled={fetching}
              >
                <option value="home">{homeName}</option>
                <option value="away">{awayName}</option>
              </select>
            </label>
          ) : (
            <span className={`result-outcome ${outcome ? `result-outcome-${outcome}` : ""}`}>
              {outcomeLabel ?? "Enter score"}
            </span>
          )}
        </div>
        <button type="submit" className="result-submit-btn" disabled={!canSubmit}>
          {fetching ? "Saving…" : "Save result"}
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

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const me = meResult.data?.me;

  if (meResult.fetching) return <div>Loading…</div>;
  if (!me?.isAdmin) return <div>Access denied</div>;

  // Play a brief "saved" animation on the card, then refetch — which drops the
  // now-resolved match from the pending list.
  function handleSaved(id: string) {
    setSavedIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      reexecute({ requestPolicy: "network-only" });
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 650);
  }

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
            <div
              key={match.id}
              className={`admin-match-card${savedIds.has(match.id) ? " admin-match-card-saved" : ""}`}
            >
              {savedIds.has(match.id) && <div className="admin-saved-overlay">✓ Saved</div>}
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
                {match.homeTeam?.name ?? match.homeTeamLabel}
                <span className="admin-vs">vs</span>
                {match.awayTeam?.name ?? match.awayTeamLabel}
              </div>
              <MatchResultForm match={match} onDone={() => handleSaved(match.id)} />
            </div>
          ))}
        </div>
      )}
      <KnockoutTeamEditor />
    </div>
  );
}
