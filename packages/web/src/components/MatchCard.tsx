import { useState } from "react";
import { useQuery } from "urql";
import { MatchPicksQuery } from "../graphql/operations";

type Team = { id: string; name: string; group: string } | null;
type Pick = { pickedTeamId: string; points?: number | null } | null;
type MatchResult = { homeScore: number; awayScore: number; winnerTeamId: string | null } | null;

type Match = {
  id: string;
  round: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeTeam: Team;
  awayTeam: Team;
  startsAt: string;
  isLocked: boolean;
  myPick: Pick;
  result?: MatchResult;
};

type Props = {
  match: Match;
  onPick: (matchId: string, teamId: string) => void;
  onUsernameClick?: (userId: string, username: string) => void;
};

type MatchPickRow = {
  user: { id: string; username: string };
  pickedTeam: { id: string; name: string; group: string };
};

export function MatchCard({ match, onPick, onUsernameClick }: Props) {
  const [expanded, setExpanded] = useState(false);

  const homeId = match.homeTeam?.id ?? null;
  const awayId = match.awayTeam?.id ?? null;
  const noTeams = !homeId || !awayId;
  const pickedId = match.myPick?.pickedTeamId ?? null;
  const result = match.result ?? null;
  const points = match.myPick?.points ?? null;

  const [picksResult] = useQuery<{ matchPicks: MatchPickRow[] }>({
    query: MatchPicksQuery,
    variables: { matchId: match.id },
    pause: !expanded,
  });

  const kickoff = new Date(match.startsAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function pickBtn(label: string, teamId: string | null) {
    const isPicked = pickedId === teamId;
    const disabled = match.isLocked || noTeams;
    return (
      <button
        type="button"
        className={`pick-btn${isPicked ? " picked" : ""}`}
        data-team-id={teamId ?? undefined}
        disabled={disabled}
        onClick={() => teamId && onPick(match.id, teamId)}
      >
        {label}
        {match.isLocked && " 🔒"}
      </button>
    );
  }

  return (
    <div className="match-card">
      <div className="match-meta">{kickoff}</div>
      <div className="match-teams">
        {pickBtn(match.homeTeamLabel, homeId)}
        {result ? (
          <span className="score">
            {result.homeScore} – {result.awayScore}
          </span>
        ) : (
          <span className="vs">vs</span>
        )}
        {pickBtn(match.awayTeamLabel, awayId)}
      </div>
      {result && pickedId && (
        <span className="pick-result">
          {points !== null && points > 0 ? `✅ +${points}` : "❌"}
        </span>
      )}
      <button
        type="button"
        className={`toggle-picks-btn${expanded ? " expanded" : ""}`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="toggle-picks-label">👥 Picks</span>
        <span className="toggle-picks-chevron">▾</span>
      </button>
      <div className={`match-picks-list${expanded ? " expanded" : ""}`}>
        <div className="match-picks-inner">
          {picksResult.fetching ? (
            <div className="picks-loading">Loading…</div>
          ) : (picksResult.data?.matchPicks ?? []).length === 0 ? (
            <div className="no-picks">No picks yet</div>
          ) : (
            (picksResult.data?.matchPicks ?? []).map((mp) => (
              <div key={mp.user.id} className="match-pick-row">
                <span className="pick-avatar">{mp.user.username[0]?.toUpperCase()}</span>
                <button
                  type="button"
                  className="username-link"
                  onClick={() => onUsernameClick?.(mp.user.id, mp.user.username)}
                >
                  {mp.user.username}
                </button>
                <span className="pick-team-badge">{mp.pickedTeam.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
