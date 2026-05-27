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
};

export function MatchCard({ match, onPick }: Props) {
  const homeId = match.homeTeam?.id ?? null;
  const awayId = match.awayTeam?.id ?? null;
  const noTeams = !homeId || !awayId;
  const pickedId = match.myPick?.pickedTeamId ?? null;
  const result = match.result ?? null;
  const points = match.myPick?.points ?? null;

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
        <span className="pick-result">{points !== null && points > 0 ? `✓ +${points}` : "✗"}</span>
      )}
    </div>
  );
}
