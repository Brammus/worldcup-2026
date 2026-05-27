type Team = { id: string; name: string; group: string } | null;
type Pick = { pickedTeamId: string } | null;

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
        <span className="vs">vs</span>
        {pickBtn(match.awayTeamLabel, awayId)}
      </div>
    </div>
  );
}
