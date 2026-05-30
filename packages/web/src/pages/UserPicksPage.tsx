import { useQuery } from "urql";
import { useParams } from "wouter";
import { NavBar } from "../components/NavBar";
import { MeQuery, UserPicksQuery } from "../graphql/operations";

type MeData = {
  me: { id: string; username: string; isAdmin: boolean } | null;
};

type PickMatch = {
  id: string;
  round: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  result: { homeScore: number; awayScore: number; winnerTeamId: string | null } | null;
};

type Pick = {
  id: string;
  matchId: string;
  pickedTeamId: string | null;
  points: number | null;
  match: PickMatch;
  pickedTeam: { id: string; name: string; group: string } | null;
};

function PickOutcome({ pick }: { pick: Pick }) {
  if (!pick.match.result) {
    return <span className="pending">⏳ pending</span>;
  }
  if (pick.points != null && pick.points > 0) {
    return <span className="correct">✅ +{pick.points}</span>;
  }
  return <span className="wrong">❌</span>;
}

const ROUND_LABELS: Record<string, string> = {
  group: "Group Stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarterfinals",
  sf: "Semifinals",
  final: "Final",
  third_place: "Third Place",
};

const ROUND_ORDER = ["group", "r32", "r16", "qf", "sf", "final", "third_place"];

export function UserPicksPage() {
  const { userId } = useParams<{ userId: string }>();

  const [result] = useQuery<{ userPicks: Pick[] }>({
    query: UserPicksQuery,
    variables: { userId },
    pause: !userId,
  });

  const [meResult] = useQuery<MeData>({ query: MeQuery });
  const me = meResult.data?.me ?? null;

  const userPicks = result.data?.userPicks ?? [];

  const totalPoints = userPicks.reduce((sum, p) => sum + (p.points ?? 0), 0);
  const correctPicks = userPicks.filter((p) => p.points != null && p.points > 0).length;
  const totalPicks = userPicks.length;
  const isMe = me?.id === userId;

  // Group picks by round, preserving order
  const byRound = new Map<string, Pick[]>();
  for (const pick of userPicks) {
    const round = pick.match.round;
    if (!byRound.has(round)) byRound.set(round, []);
    (byRound.get(round) as Pick[]).push(pick);
  }
  const sortedRounds = ROUND_ORDER.filter((r) => byRound.has(r));

  if (result.fetching && userPicks.length === 0) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="user-picks-page">
      <NavBar currentUser={me} />
      <div className="picks-page-header">
        <h1>{isMe ? "🎯 Your picks" : "🎯 Picks"}</h1>
        <div className="picks-stats">
          <span className="picks-stat">
            <strong>{totalPoints}</strong> pts
          </span>
          <span className="picks-stat-divider" />
          <span className="picks-stat">
            <strong>{correctPicks}</strong> correct
          </span>
          <span className="picks-stat-divider" />
          <span className="picks-stat">
            <strong>{totalPicks}</strong> total
          </span>
        </div>
      </div>
      {sortedRounds.length === 0 ? (
        <div className="picks-empty">No picks yet.</div>
      ) : (
        sortedRounds.map((round) => (
          <div key={round} className="round-section">
            <h2 className="round-heading">{ROUND_LABELS[round] ?? round}</h2>
            <div className="picks-list">
              {(byRound.get(round) as Pick[]).map((pick) => (
                <div key={pick.id} className="pick-row">
                  <span className="pick-match-label">
                    {pick.match.homeTeamLabel}
                    <span className="pick-vs">vs</span>
                    {pick.match.awayTeamLabel}
                  </span>
                  <span className="pick-chosen">{pick.pickedTeam?.name ?? "Draw"}</span>
                  <PickOutcome pick={pick} />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
