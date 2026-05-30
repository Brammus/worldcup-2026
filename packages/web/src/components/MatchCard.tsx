import { useState } from "react";
import { useQuery } from "urql";
import { Link } from "wouter";
import { MatchPicksQuery } from "../graphql/operations";

type Team = { id: string; name: string; group: string } | null;
type Pick = { pickedTeamId: string | null; points?: number | null } | null;
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
  onPick: (matchId: string, teamId: string | null) => void;
  onUsernameClick?: (userId: string, username: string) => void;
  currentUser?: { id: string; username: string } | null;
};

type MatchPickRow = {
  user: { id: string; username: string };
  pickedTeam: { id: string; name: string; group: string } | null;
};

export function MatchCard({ match, onPick, onUsernameClick, currentUser }: Props) {
  const [expanded, setExpanded] = useState(false);

  const homeId = match.homeTeam?.id ?? null;
  const awayId = match.awayTeam?.id ?? null;
  const noTeams = !homeId || !awayId;
  const hasPick = match.myPick != null;
  const pickedId = match.myPick?.pickedTeamId ?? null;
  const pickedDraw = hasPick && pickedId === null;
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
    const isDraw = teamId === null;
    const isPicked = isDraw ? pickedDraw : pickedId === teamId;
    const disabled = match.isLocked || (!isDraw && noTeams);
    return (
      <button
        type="button"
        className={`pick-btn${isDraw ? " pick-btn-draw" : ""}${isPicked ? " picked" : ""}`}
        data-team-id={teamId ?? undefined}
        disabled={disabled}
        onClick={() => onPick(match.id, teamId)}
      >
        {label}
        {match.isLocked && isDraw && " 🔒"}
      </button>
    );
  }

  return (
    <div className="match-card">
      <div className="match-meta">
        <span>{kickoff}</span>
        <button
          type="button"
          className={`toggle-picks-btn${expanded ? " expanded" : ""}`}
          onClick={() => setExpanded((prev) => !prev)}
        >
          Picks
          <svg
            className="chevron-icon"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="match-teams">
        {pickBtn(match.homeTeamLabel, homeId)}
        {result ? (
          <span className="score">
            {result.homeScore} – {result.awayScore}
          </span>
        ) : match.round === "group" ? (
          pickBtn("Draw", null)
        ) : (
          <span className="vs">vs</span>
        )}
        {pickBtn(match.awayTeamLabel, awayId)}
      </div>
      {result && hasPick && (
        <span className="pick-result">
          {points !== null && points > 0 ? `✅ +${points}` : "❌"}
        </span>
      )}
      <div className={`match-picks-list${expanded ? " expanded" : ""}`}>
        <div className="match-picks-inner">
          {!match.isLocked ? (
            hasPick && currentUser ? (
              <div className="match-pick-row">
                <span className="pick-avatar">{currentUser.username[0]?.toUpperCase()}</span>
                <button
                  type="button"
                  className="username-link"
                  onClick={() => onUsernameClick?.(currentUser.id, currentUser.username)}
                >
                  {currentUser.username}
                </button>
                <span className="pick-team-badge">
                  {pickedId === homeId
                    ? (match.homeTeam?.name ?? match.homeTeamLabel)
                    : pickedId === awayId
                      ? (match.awayTeam?.name ?? match.awayTeamLabel)
                      : "Draw"}
                </span>
                <Link href={`/user/${currentUser.id}`} className="pick-profile-link">
                  ↗
                </Link>
              </div>
            ) : (
              <div className="no-picks">No picks yet</div>
            )
          ) : picksResult.fetching ? (
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
                <span className="pick-team-badge">{mp.pickedTeam?.name ?? "Draw"}</span>
                <Link href={`/user/${mp.user.id}`} className="pick-profile-link">
                  ↗
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
