import { useQuery } from "urql";
import { Link } from "wouter";
import { LeaderboardQuery, MeQuery } from "../graphql/operations";

type LeaderboardEntry = {
  rank: number;
  user: { id: string; username: string };
  totalPoints: number;
  correctPicks: number;
  totalPicks: number;
};

type MeData = {
  me: { id: string; username: string; isAdmin: boolean } | null;
};

export function ScoreboardPage() {
  const [leaderboardResult] = useQuery<{ leaderboard: LeaderboardEntry[] }>({
    query: LeaderboardQuery,
  });

  const [meResult] = useQuery<MeData>({ query: MeQuery });

  const entries = leaderboardResult.data?.leaderboard ?? [];
  const me = meResult.data?.me ?? null;

  if (leaderboardResult.fetching && entries.length === 0) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="scoreboard-page">
      <h1>Scoreboard</h1>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Points</th>
            <th>Correct / Total</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.user.id} className={entry.user.id === me?.id ? "my-row" : undefined}>
              <td>{entry.rank}</td>
              <td>
                <Link href={`/user/${entry.user.id}`}>{entry.user.username}</Link>
              </td>
              <td>{entry.totalPoints}</td>
              <td>
                {entry.correctPicks} / {entry.totalPicks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
