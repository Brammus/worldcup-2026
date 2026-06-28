// Pure, DB-free helpers for computing group standings and allocating the
// "best third-placed" teams to their Round-of-32 slots. Kept side-effect free
// so they can be unit-tested and reused by both the live propagation and the
// read-only bracket-preview script.

export type StandingMatch = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
};

export type Standing = {
  teamId: string;
  name: string;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
};

/**
 * Order two standings by FIFA group-stage rules:
 * points → goal difference → goals scored → name (stable, deterministic).
 */
export function compareStandings(a: Standing, b: Standing): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.name.localeCompare(b.name);
}

/**
 * Compute a group table from its played matches. Win = 3 pts, draw = 1.
 * Outcome is derived from the scores (group matches cannot go to penalties),
 * so a level score is always a draw.
 */
export function computeStandings(
  matches: StandingMatch[],
  names: Record<string, string>,
): Standing[] {
  const table: Record<string, Standing> = {};
  const ensure = (id: string): Standing => {
    let s = table[id];
    if (!s) {
      s = {
        teamId: id,
        name: names[id] ?? "",
        played: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
      };
      table[id] = s;
    }
    return s;
  };

  for (const m of matches) {
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const home = ensure(m.homeTeamId);
    const away = ensure(m.awayTeamId);
    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) home.points += 3;
    else if (m.awayScore > m.homeScore) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  const standings = Object.values(table);
  for (const s of standings) s.goalDiff = s.goalsFor - s.goalsAgainst;
  return standings.sort(compareStandings);
}

/** Parse the eligible group letters out of a "Best 3rd (A/B/H/K/L)" label. */
export function parseEligibleGroups(label: string): string[] {
  const match = label.match(/\(([^)]+)\)/);
  if (!match?.[1]) return [];
  return match[1]
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type ThirdSlot = { id: string; eligible: string[] };

/**
 * Assign the qualifying third-place groups to the "Best 3rd" slots so that
 * every slot receives a distinct group that appears in its eligible list.
 *
 * Slots should be passed in a stable order (e.g. by kickoff time) and the
 * search tries groups alphabetically, so the result is deterministic. Returns
 * `null` when no complete, eligibility-respecting assignment exists (e.g. not
 * all groups are finished yet).
 */
export function allocateThirds(
  slots: ThirdSlot[],
  qualifiedGroups: string[],
): Record<string, string> | null {
  const qualified = new Set(qualifiedGroups);
  const assignment: Record<string, string> = {};
  const used = new Set<string>();

  function solve(i: number): boolean {
    if (i === slots.length) return true;
    const slot = slots[i];
    if (!slot) return false;
    const options = slot.eligible.filter((g) => qualified.has(g) && !used.has(g)).sort();
    for (const group of options) {
      assignment[slot.id] = group;
      used.add(group);
      if (solve(i + 1)) return true;
      used.delete(group);
      delete assignment[slot.id];
    }
    return false;
  }

  return solve(0) ? assignment : null;
}
