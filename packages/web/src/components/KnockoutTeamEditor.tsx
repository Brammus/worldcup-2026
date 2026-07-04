import { useState } from "react";
import { useMutation, useQuery } from "urql";
import {
  MatchesQuery,
  SetMatchKickoffMutation,
  SetMatchTeamsMutation,
  TeamsQuery,
} from "../graphql/operations";

// Convert an ISO timestamp to the "YYYY-MM-DDTHH:mm" value a datetime-local
// input expects, in the browser's local timezone.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Team = { id: string; name: string; group: string };

type KnockoutMatch = {
  id: string;
  round: string;
  startsAt: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeTeam: { id: string } | null;
  awayTeam: { id: string } | null;
};

const ROUND_LABELS: Record<string, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  third_place: "Third place",
  final: "Final",
};

const ROUND_ORDER = ["r32", "r16", "qf", "sf", "third_place", "final"];

// R32 and R16 are already set correctly, so the editor only exposes the rounds
// that are still being decided.
const EDITABLE_ROUNDS = ["qf", "sf", "third_place", "final"];

export function KnockoutTeamEditor() {
  const [teamsResult] = useQuery<{ teams: Team[] }>({ query: TeamsQuery });
  const [matchesResult, refetch] = useQuery<{ matches: KnockoutMatch[] }>({
    query: MatchesQuery,
    requestPolicy: "cache-and-network",
  });
  const [, setMatchTeams] = useMutation(SetMatchTeamsMutation);
  const [, setMatchKickoff] = useMutation(SetMatchKickoffMutation);
  const [savedId, setSavedId] = useState<string | null>(null);

  function flashSaved(id: string) {
    setSavedId(id);
    refetch({ requestPolicy: "network-only" });
    setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1500);
  }

  const teams = [...(teamsResult.data?.teams ?? [])].sort(
    (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
  );

  const matches = [...(matchesResult.data?.matches ?? [])]
    .filter((m) => EDITABLE_ROUNDS.includes(m.round))
    .sort(
      (a, b) =>
        ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round) ||
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  async function handleChange(match: KnockoutMatch, side: "home" | "away", teamId: string) {
    const homeTeamId = side === "home" ? teamId || null : (match.homeTeam?.id ?? null);
    const awayTeamId = side === "away" ? teamId || null : (match.awayTeam?.id ?? null);
    const res = await setMatchTeams({ matchId: match.id, homeTeamId, awayTeamId });
    if (!res.error) flashSaved(match.id);
  }

  async function handleKickoff(match: KnockoutMatch, localValue: string) {
    if (!localValue) return;
    const startsAt = new Date(localValue).toISOString();
    const res = await setMatchKickoff({ matchId: match.id, startsAt });
    if (!res.error) flashSaved(match.id);
  }

  function teamSelect(match: KnockoutMatch, side: "home" | "away") {
    const current = (side === "home" ? match.homeTeam?.id : match.awayTeam?.id) ?? "";
    const label = side === "home" ? match.homeTeamLabel : match.awayTeamLabel;
    return (
      <select
        className="kt-select"
        value={current}
        aria-label={`${ROUND_LABELS[match.round]} ${side} team`}
        onChange={(e) => handleChange(match, side, e.target.value)}
      >
        <option value="">— {label} —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.group})
          </option>
        ))}
      </select>
    );
  }

  // Group matches by round for display
  const byRound = ROUND_ORDER.map((round) => ({
    round,
    matches: matches.filter((m) => m.round === round),
  })).filter((g) => g.matches.length > 0);

  return (
    <div className="kt-editor">
      <div className="kt-editor-header">
        <h2>Knockout bracket teams</h2>
        <span className="kt-editor-sub">
          Set the teams for each knockout match. Changes save instantly.
        </span>
      </div>
      {byRound.map((group) => (
        <div key={group.round} className="kt-round">
          <h3 className="kt-round-title">{ROUND_LABELS[group.round] ?? group.round}</h3>
          {group.matches.map((match) => (
            <div key={match.id} className="kt-match">
              <input
                type="datetime-local"
                className="kt-kickoff-input"
                aria-label={`${ROUND_LABELS[match.round]} kickoff`}
                value={toLocalInput(match.startsAt)}
                onChange={(e) => handleKickoff(match, e.target.value)}
              />
              <div className="kt-row">
                {teamSelect(match, "home")}
                <span className="kt-vs">vs</span>
                {teamSelect(match, "away")}
                {savedId === match.id && <span className="kt-saved">✓</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
