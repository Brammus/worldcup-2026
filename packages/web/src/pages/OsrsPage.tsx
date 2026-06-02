import { useMutation, useQuery } from "urql";
import { NavBar } from "../components/NavBar";
import { MeQuery, OsrsTeamsQuery, PickOsrsTeamMutation } from "../graphql/operations";

type OsrsPlayer = {
  id: string;
  name: string;
  isCaptain: boolean;
  streamUrl: string | null;
};

type OsrsTeam = {
  id: string;
  name: string;
  color: string;
  pickCount: number;
  players: OsrsPlayer[];
};

type OsrsTeamsData = {
  osrsTeams: OsrsTeam[];
  myOsrsTeamPick: { id: string } | null;
};

type MeData = {
  me: { id: string; username: string; isAdmin: boolean } | null;
};

export function OsrsPage() {
  const [teamsResult, refetchTeams] = useQuery<OsrsTeamsData>({ query: OsrsTeamsQuery });
  const [meResult] = useQuery<MeData>({ query: MeQuery });
  const [, pickTeam] = useMutation(PickOsrsTeamMutation);

  const teams = teamsResult.data?.osrsTeams ?? [];
  const myPickId = teamsResult.data?.myOsrsTeamPick?.id ?? null;
  const me = meResult.data?.me ?? null;

  const handlePick = async (teamId: string) => {
    await pickTeam({ teamId });
    refetchTeams({ requestPolicy: "network-only" });
  };

  if (teamsResult.fetching && teams.length === 0) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="osrs-page">
      <NavBar currentUser={me} />
      <div className="osrs-header">
        <h1>🎮 OSRS Team Pick</h1>
        <p className="osrs-subtitle">
          Pick the OldSchool RuneScape team you think will win the streamer competition. You can
          change your pick at any time.
        </p>
        {!me && <p className="osrs-login-notice">Log in to pick a team.</p>}
      </div>
      <div className="osrs-teams-grid">
        {teams.map((team) => {
          const isPicked = team.id === myPickId;
          return (
            <div
              key={team.id}
              className={`osrs-team-card${isPicked ? " osrs-team-card--picked" : ""}`}
            >
              <div className="osrs-team-header" style={{ backgroundColor: team.color }}>
                <span className="osrs-team-name">{team.name}</span>
                <span className="osrs-pick-count">
                  {team.pickCount} {team.pickCount === 1 ? "pick" : "picks"}
                </span>
              </div>
              <div className="osrs-team-body">
                <ul className="osrs-players-list">
                  {team.players.map((player) => (
                    <li key={player.id} className="osrs-player-row">
                      <span className="osrs-player-name">{player.name}</span>
                      {player.isCaptain && <span className="osrs-captain-badge">Captain</span>}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`osrs-pick-btn${isPicked ? " osrs-pick-btn--picked" : ""}`}
                  style={isPicked ? { backgroundColor: team.color, borderColor: team.color } : {}}
                  disabled={!me}
                  onClick={() => handlePick(team.id)}
                  title={!me ? "Log in to pick a team" : undefined}
                >
                  {isPicked ? "Your pick ✓" : "Pick this team"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
