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
  group: string | null;
  startsAt: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeTeam: { id: string; name: string; group: string } | null;
  awayTeam: { id: string; name: string; group: string } | null;
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

function matchLabel(match: PickMatch): string {
  if (match.round === "group" && match.group) {
    return `Group ${match.group}`;
  }
  return ROUND_LABELS[match.round] ?? match.round;
}

function kickoffLabel(startsAt: string): string {
  return new Date(startsAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  // Order picks chronologically by kickoff time (earliest first)
  const sortedPicks = [...userPicks].sort(
    (a, b) => new Date(a.match.startsAt).getTime() - new Date(b.match.startsAt).getTime(),
  );

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
      {sortedPicks.length === 0 ? (
        <div className="picks-empty">No picks yet.</div>
      ) : (
        <div className="picks-list">
          {sortedPicks.map((pick) => (
            <div key={pick.id} className="pick-row">
              <span className="pick-group-tag">{matchLabel(pick.match)}</span>
              <span className="pick-kickoff">{kickoffLabel(pick.match.startsAt)}</span>
              <span className="pick-match-label">
                {pick.match.homeTeam?.name ?? pick.match.homeTeamLabel}
                <span className="pick-vs">vs</span>
                {pick.match.awayTeam?.name ?? pick.match.awayTeamLabel}
              </span>
              <span className="pick-chosen">{pick.pickedTeam?.name ?? "Draw"}</span>
              <PickOutcome pick={pick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
