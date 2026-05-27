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
  pickedTeamId: string;
  points: number | null;
  match: PickMatch;
  pickedTeam: { id: string; name: string; group: string };
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

  // Group picks by round
  const byRound = new Map<string, Pick[]>();
  for (const pick of userPicks) {
    const round = pick.match.round;
    const bucket = byRound.get(round) ?? [];
    if (!byRound.has(round)) byRound.set(round, bucket);
    bucket.push(pick);
  }

  if (result.fetching && userPicks.length === 0) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="user-picks-page">
      <NavBar currentUser={me} />
      <h1>🎯 Picks</h1>
      <div className="summary">
        {correctPicks} correct / {totalPicks} picks / {totalPoints} points
      </div>
      {Array.from(byRound.entries()).map(([round, roundPicks]) => (
        <div key={round} className="round-section">
          <h2>{round}</h2>
          <ul>
            {roundPicks.map((pick) => (
              <li key={pick.id}>
                <span className="match-label">
                  {pick.match.homeTeamLabel} vs {pick.match.awayTeamLabel}
                </span>
                <span className="picked-team">{pick.pickedTeam.name}</span>
                <PickOutcome pick={pick} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
