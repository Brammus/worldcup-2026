import { useQuery } from "urql";
import { UserPicksQuery } from "../graphql/operations";

type PickMatch = {
  id: string;
  round: string;
  group: string | null;
  homeTeamLabel: string;
  awayTeamLabel: string;
  result: { homeScore: number; awayScore: number; winnerTeamId: string | null } | null;
};

type UserPick = {
  id: string;
  matchId: string;
  pickedTeamId: string | null;
  points: number | null;
  match: PickMatch;
  pickedTeam: { id: string; name: string; group: string } | null;
};

const ALL_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function computeGroupPredictions(picks: UserPick[]): Map<string, string> {
  const groupPicks = picks.filter(
    (p) => p.match.round === "group" && p.match.group != null && p.pickedTeam != null,
  );

  // For each group, count picks per team
  const groupTeamCounts = new Map<string, Map<string, { name: string; count: number }>>();

  for (const pick of groupPicks) {
    const group = pick.match.group as string;
    if (!groupTeamCounts.has(group)) {
      groupTeamCounts.set(group, new Map());
    }
    const teamCounts = groupTeamCounts.get(group) as Map<string, { name: string; count: number }>;
    const teamId = pick.pickedTeamId;
    if (!teamId || !pick.pickedTeam) continue;
    const existing = teamCounts.get(teamId);
    if (existing) {
      existing.count += 1;
    } else {
      teamCounts.set(teamId, { name: pick.pickedTeam.name, count: 1 });
    }
  }

  const result = new Map<string, string>();
  for (const group of ALL_GROUPS) {
    const teamCounts = groupTeamCounts.get(group);
    if (!teamCounts || teamCounts.size === 0) {
      result.set(group, "–");
      continue;
    }
    // Find team with most picks
    let maxCount = 0;
    for (const { count } of teamCounts.values()) {
      if (count > maxCount) maxCount = count;
    }
    const topTeams = [...teamCounts.values()].filter(({ count }) => count === maxCount);
    result.set(group, topTeams.map((t) => t.name).join(" / "));
  }

  return result;
}

type Props = {
  userId: string;
  username: string;
  onClose: () => void;
};

export function UserSummaryModal({ userId, username, onClose }: Props) {
  const [picksResult] = useQuery<{ userPicks: UserPick[] }>({
    query: UserPicksQuery,
    variables: { userId },
  });

  const picks = picksResult.data?.userPicks ?? [];
  const predictions = computeGroupPredictions(picks);

  const fetching = picksResult.fetching;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      tabIndex={-1}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>🎯 {username}'s predictions</h2>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        {fetching ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            <div className="modal-section-label">⚽ World Cup — group picks</div>
            <div className="group-grid">
              {ALL_GROUPS.map((letter) => (
                <div key={letter} className="group-card">
                  <div className="group-label">Group {letter}</div>
                  {predictions.get(letter) === "–" ? (
                    <div className="group-pick group-pick-empty">–</div>
                  ) : (
                    <div className="group-pick">{predictions.get(letter)}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
