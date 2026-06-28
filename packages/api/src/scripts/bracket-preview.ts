// Read-only bracket preview.
//
// Connects to DATABASE_URL and prints the fully-resolved Round-of-32 bracket
// (group standings, the best-third ranking, and every R32 matchup with real
// team names) computed from the results currently in the database. It writes
// NOTHING — safe to point at production to validate before running the
// `recomputeBracket` mutation.
//
//   DATABASE_URL=postgres://… bun run src/scripts/bracket-preview.ts

import { asc } from "drizzle-orm";
import { db } from "../db/client";
import { matchResults, matches, teams } from "../db/schema";
import {
  type Standing,
  type StandingMatch,
  allocateThirds,
  compareStandings,
  computeStandings,
  parseEligibleGroups,
} from "../schema/standings";

async function main() {
  const allTeams = await db.select().from(teams);
  const teamName: Record<string, string> = {};
  for (const t of allTeams) teamName[t.id] = t.name;

  const allMatches = await db.select().from(matches).orderBy(asc(matches.startsAt));
  const allResults = await db.select().from(matchResults);
  const resultByMatch: Record<string, (typeof allResults)[number]> = {};
  for (const r of allResults) resultByMatch[r.matchId] = r;

  // ── Group standings ─────────────────────────────────────────────────────
  const groupMatches = allMatches.filter((m) => m.round === "group");
  const letters = [
    ...new Set(groupMatches.map((m) => m.groupLetter).filter((l): l is string => Boolean(l))),
  ].sort();

  const standingsByGroup: Record<string, Standing[]> = {};
  const incompleteGroups: string[] = [];

  for (const letter of letters) {
    if (!letter) continue;
    const ms = groupMatches.filter((m) => m.groupLetter === letter);
    const rows: StandingMatch[] = [];
    let complete = true;
    for (const m of ms) {
      const r = resultByMatch[m.id];
      if (!r) {
        complete = false;
        break;
      }
      rows.push({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      });
    }
    if (!complete) {
      incompleteGroups.push(letter);
      continue;
    }
    standingsByGroup[letter] = computeStandings(rows, teamName);
  }

  console.log("\n=== GROUP STANDINGS ===");
  for (const letter of letters) {
    const table = standingsByGroup[letter];
    console.log(`\nGroup ${letter}${table ? "" : "  (INCOMPLETE — not all results in)"}`);
    if (!table) continue;
    table.forEach((s, i) => {
      const pos = ["🥇", "🥈", "🥉", "  "][i] ?? "  ";
      console.log(
        `  ${pos} ${s.name.padEnd(18)} P${s.played} ${s.points}pts  GD ${s.goalDiff >= 0 ? "+" : ""}${s.goalDiff}  GF ${s.goalsFor}`,
      );
    });
  }

  // ── Best third-placed ranking ───────────────────────────────────────────
  const thirds: (Standing & { group: string })[] = [];
  for (const letter of letters) {
    const third = standingsByGroup[letter]?.[2];
    if (third) thirds.push({ ...third, group: letter });
  }
  const rankedThirds = [...thirds].sort(compareStandings);
  const qualified = rankedThirds.slice(0, 8);

  console.log("\n=== THIRD-PLACE RANKING (best 8 qualify) ===");
  rankedThirds.forEach((t, i) => {
    const mark = i < 8 ? "✅" : "❌";
    console.log(
      `  ${mark} #${i + 1} Group ${t.group}: ${t.name.padEnd(18)} ${t.points}pts  GD ${t.goalDiff >= 0 ? "+" : ""}${t.goalDiff}  GF ${t.goalsFor}`,
    );
  });

  // ── Best-3rd slot allocation ────────────────────────────────────────────
  const r32 = allMatches.filter((m) => m.round === "r32");
  const slots = r32
    .map((m) => {
      const side = m.homeTeamLabel.startsWith("Best 3rd")
        ? ("home" as const)
        : m.awayTeamLabel.startsWith("Best 3rd")
          ? ("away" as const)
          : null;
      if (!side) return null;
      const label = side === "home" ? m.homeTeamLabel : m.awayTeamLabel;
      return { id: m.id, side, eligible: parseEligibleGroups(label) };
    })
    .filter((s): s is { id: string; side: "home" | "away"; eligible: string[] } => s !== null);

  const groupToTeam: Record<string, string> = {};
  for (const t of qualified) groupToTeam[t.group] = t.teamId;
  const thirdAllocation = allocateThirds(
    slots.map((s) => ({ id: s.id, eligible: s.eligible })),
    qualified.map((t) => t.group),
  );

  // ── Resolve each R32 matchup ──────────────────────────────────────────────
  const resolveLabel = (matchId: string, side: "home" | "away", label: string): string => {
    const m = r32.find((x) => x.id === matchId);
    const storedId = side === "home" ? m?.homeTeamId : m?.awayTeamId;
    if (storedId) return `${teamName[storedId]} (stored)`;

    const first = label.match(/^1st Group ([A-L])$/);
    if (first?.[1]) {
      const t = standingsByGroup[first[1]]?.[0];
      return t ? t.name : `${label} (group unfinished)`;
    }
    const second = label.match(/^2nd Group ([A-L])$/);
    if (second?.[1]) {
      const t = standingsByGroup[second[1]]?.[1];
      return t ? t.name : `${label} (group unfinished)`;
    }
    if (label.startsWith("Best 3rd")) {
      const group = thirdAllocation?.[matchId];
      const teamId = group ? groupToTeam[group] : undefined;
      return teamId ? `${teamName[teamId]} (3rd ${group})` : `${label} (unresolved)`;
    }
    return label;
  };

  console.log("\n=== RESOLVED ROUND OF 32 ===");
  for (const m of r32) {
    const home = resolveLabel(m.id, "home", m.homeTeamLabel);
    const away = resolveLabel(m.id, "away", m.awayTeamLabel);
    const when = m.startsAt.toISOString().slice(0, 16).replace("T", " ");
    console.log(`  ${when}  ${home.padEnd(26)} vs ${away}`);
  }

  if (incompleteGroups.length > 0) {
    console.log(
      `\n⚠️  Groups not finished: ${incompleteGroups.join(", ")} — 1st/2nd/3rd for these are unresolved.`,
    );
  }
  console.log("\n(read-only preview — nothing was written)\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
