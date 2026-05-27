import { useState } from "react";
import { useQuery } from "urql";
import { Link } from "wouter";
import { NavBar } from "../components/NavBar";
import { UserSummaryModal } from "../components/UserSummaryModal";
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
  const [summaryUser, setSummaryUser] = useState<{ userId: string; username: string } | null>(null);

  const [leaderboardResult] = useQuery<{ leaderboard: LeaderboardEntry[] }>({
    query: LeaderboardQuery,
  });

  const [meResult] = useQuery<MeData>({ query: MeQuery });

  const entries = leaderboardResult.data?.leaderboard ?? [];
  const me = meResult.data?.me ?? null;

  if (leaderboardResult.fetching && entries.length === 0) {
    return <div className="loading">Loading…</div>;
  }

  const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <div className="scoreboard-page">
      <NavBar currentUser={me} />
      <div className="scoreboard-header">
        <h1>🏆 Scoreboard</h1>
        <span className="scoreboard-count">{entries.length} players</span>
      </div>
      <div className="leaderboard">
        {entries.map((entry) => {
          const isMe = entry.user.id === me?.id;
          const medal = MEDALS[entry.rank];
          return (
            <div key={entry.user.id} className={`leaderboard-row${isMe ? " is-me" : ""}`}>
              <span className="lb-rank">{medal ?? entry.rank}</span>
              <span className="lb-avatar">{entry.user.username[0]?.toUpperCase()}</span>
              <button
                type="button"
                className="lb-username"
                onClick={() =>
                  setSummaryUser({ userId: entry.user.id, username: entry.user.username })
                }
              >
                {entry.user.username}
                {isMe && <span className="lb-you">you</span>}
              </button>
              <span className="lb-correct">
                {entry.correctPicks}/{entry.totalPicks}
              </span>
              <span className="lb-points">{entry.totalPoints} pts</span>
              <Link href={`/user/${entry.user.id}`} className="lb-profile-link">
                ↗
              </Link>
            </div>
          );
        })}
      </div>
      {summaryUser && (
        <UserSummaryModal
          userId={summaryUser.userId}
          username={summaryUser.username}
          onClose={() => setSummaryUser(null)}
        />
      )}
    </div>
  );
}
