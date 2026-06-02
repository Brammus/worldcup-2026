import { useEffect, useState } from "react";
import { useMutation, useQuery } from "urql";
import { NavBar } from "../components/NavBar";
import { MeQuery, OsrsTeamsQuery, RankOsrsTeamsMutation } from "../graphql/operations";

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
  myOsrsRanking: { rank: number; team: { id: string } }[];
};

type MeData = {
  me: { id: string; username: string; isAdmin: boolean } | null;
};

// draft: teamId -> rank (1-6), or undefined if not yet ranked
type DraftState = Record<string, number | undefined>;

export function OsrsPage() {
  const [teamsResult, refetchTeams] = useQuery<OsrsTeamsData>({ query: OsrsTeamsQuery });
  const [meResult] = useQuery<MeData>({ query: MeQuery });
  const [, rankTeams] = useMutation(RankOsrsTeamsMutation);
  const [saving, setSaving] = useState(false);

  const teams = teamsResult.data?.osrsTeams ?? [];
  const myRanking = teamsResult.data?.myOsrsRanking ?? [];
  const me = meResult.data?.me ?? null;

  const [draft, setDraft] = useState<DraftState>({});

  // Stable primitive key — only changes when ranking content actually changes
  const rankingKey = myRanking
    .map((r) => `${r.team.id}:${r.rank}`)
    .sort()
    .join("|");

  // Sync draft when rankingKey changes (avoids infinite loop from array reference churn)
  useEffect(() => {
    const next: DraftState = {};
    for (const part of rankingKey ? rankingKey.split("|") : []) {
      const idx = part.lastIndexOf(":");
      if (idx > 0) next[part.slice(0, idx)] = Number(part.slice(idx + 1));
    }
    setDraft(next);
  }, [rankingKey]);

  const handleRankButton = (teamId: string, rank: number) => {
    setDraft((prev) => {
      const next = { ...prev };
      // Unassign any other team that currently has this rank
      for (const id of Object.keys(next)) {
        if (next[id] === rank) {
          next[id] = undefined;
        }
      }
      // If this team already had this rank, toggle it off; otherwise assign
      if (prev[teamId] === rank) {
        next[teamId] = undefined;
      } else {
        next[teamId] = rank;
      }
      return next;
    });
  };

  const draftComplete = teams.length === 6 && teams.every((t) => draft[t.id] !== undefined);

  const handleSave = async () => {
    if (!draftComplete) return;
    setSaving(true);
    const rankings = teams.map((t) => ({ teamId: t.id, rank: draft[t.id] as number }));
    await rankTeams({ rankings });
    refetchTeams({ requestPolicy: "network-only" });
    setSaving(false);
  };

  // Saved ranking summary: sorted by rank
  const savedSummary = [...myRanking].sort((a, b) => a.rank - b.rank);
  const hasSavedRanking = savedSummary.length === 6;

  // Map team id -> name for summary
  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  if (teamsResult.fetching && teams.length === 0) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="osrs-page">
      <NavBar currentUser={me} />
      <div className="osrs-header">
        <h1>🎮 OSRS Team Ranking</h1>
        <p className="osrs-subtitle">
          Rank all 6 OldSchool RuneScape teams from 1st to 6th place. You can update your ranking at
          any time.
        </p>
        {!me && <p className="osrs-login-notice">Log in to rank teams.</p>}
      </div>

      {hasSavedRanking && (
        <div className="osrs-ranking-summary">
          <span className="osrs-ranking-summary-label">Your ranking:</span>
          {savedSummary.map((entry) => (
            <span key={entry.rank} className="osrs-ranking-summary-entry">
              <span className="osrs-ranking-summary-pos">{entry.rank}.</span>
              {teamNameMap.get(entry.team.id) ?? entry.team.id}
            </span>
          ))}
        </div>
      )}

      <div className="osrs-teams-grid">
        {teams.map((team) => {
          const assignedRank = draft[team.id];
          return (
            <div
              key={team.id}
              className={`osrs-team-card${assignedRank !== undefined ? " osrs-team-card--ranked" : ""}`}
            >
              <div className="osrs-team-header" style={{ backgroundColor: team.color }}>
                <span className="osrs-team-name">{team.name}</span>
                <span className="osrs-pick-count">
                  {team.pickCount} {team.pickCount === 1 ? "#1 pick" : "#1 picks"}
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
                {me ? (
                  <div className="osrs-rank-buttons">
                    {[1, 2, 3, 4, 5, 6].map((rank) => (
                      <button
                        key={rank}
                        type="button"
                        className={`osrs-rank-btn${assignedRank === rank ? " osrs-rank-btn--active" : ""}`}
                        style={
                          assignedRank === rank
                            ? { backgroundColor: team.color, borderColor: team.color }
                            : {}
                        }
                        onClick={() => handleRankButton(team.id, rank)}
                        aria-label={`Rank ${team.name} ${rank}`}
                      >
                        {rank}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="osrs-rank-disabled">Log in to rank teams</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {me && (
        <div className="osrs-save-row">
          <button
            type="button"
            className="osrs-save-btn"
            disabled={!draftComplete || saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save ranking"}
          </button>
          {!draftComplete && <span className="osrs-save-hint">Rank all 6 teams to save</span>}
        </div>
      )}
    </div>
  );
}
