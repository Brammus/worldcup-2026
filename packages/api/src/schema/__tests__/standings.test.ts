import { describe, expect, it } from "bun:test";
import {
  type StandingMatch,
  allocateThirds,
  compareStandings,
  computeStandings,
  parseEligibleGroups,
} from "../standings";

const names: Record<string, string> = { a: "Alpha", b: "Beta", c: "Gamma", d: "Delta" };

// Round-robin between a, b, c (3 teams, 3 matches)
function roundRobin(
  ab: [number, number],
  ac: [number, number],
  bc: [number, number],
): StandingMatch[] {
  return [
    { homeTeamId: "a", awayTeamId: "b", homeScore: ab[0], awayScore: ab[1] },
    { homeTeamId: "a", awayTeamId: "c", homeScore: ac[0], awayScore: ac[1] },
    { homeTeamId: "b", awayTeamId: "c", homeScore: bc[0], awayScore: bc[1] },
  ];
}

describe("computeStandings", () => {
  it("ranks by points first", () => {
    // a wins both, b beats c → a 6pts, b 3pts, c 0pts
    const table = computeStandings(roundRobin([1, 0], [1, 0], [1, 0]), names);
    expect(table.map((s) => s.teamId)).toEqual(["a", "b", "c"]);
    expect(table[0]?.points).toBe(6);
    expect(table[1]?.points).toBe(3);
    expect(table[2]?.points).toBe(0);
  });

  it("awards a point to each side on a draw", () => {
    const table = computeStandings(roundRobin([1, 1], [2, 2], [0, 0]), names);
    for (const s of table) expect(s.points).toBe(2);
  });

  it("breaks ties on goal difference before goals scored", () => {
    // a beats c 5-0, b beats c 1-0, a vs b draw 0-0
    // a: 4pts GD+5, b: 4pts GD+1, c: 0pts. a above b on GD.
    const table = computeStandings(roundRobin([0, 0], [5, 0], [1, 0]), names);
    expect(table.map((s) => s.teamId)).toEqual(["a", "b", "c"]);
    expect(table[0]?.goalDiff).toBe(5);
    expect(table[1]?.goalDiff).toBe(1);
  });

  it("breaks remaining ties on goals scored", () => {
    // a and b identical points & GD, a scored more
    // a beats c 3-1 (GD+2), b beats c 2-0 (GD+2), a vs b 1-1
    const table = computeStandings(roundRobin([1, 1], [3, 1], [2, 0]), names);
    expect(table[0]?.teamId).toBe("a");
    expect(table[1]?.teamId).toBe("b");
  });

  it("ignores matches without both teams assigned", () => {
    const table = computeStandings(
      [{ homeTeamId: "a", awayTeamId: null, homeScore: 3, awayScore: 0 }],
      names,
    );
    expect(table).toHaveLength(0);
  });
});

describe("compareStandings", () => {
  it("is consistent with the sort order", () => {
    const high = {
      teamId: "x",
      name: "X",
      played: 3,
      points: 9,
      goalsFor: 5,
      goalsAgainst: 0,
      goalDiff: 5,
    };
    const low = {
      teamId: "y",
      name: "Y",
      played: 3,
      points: 3,
      goalsFor: 5,
      goalsAgainst: 4,
      goalDiff: 1,
    };
    expect(compareStandings(high, low)).toBeLessThan(0);
  });
});

describe("parseEligibleGroups", () => {
  it("extracts the group letters", () => {
    expect(parseEligibleGroups("Best 3rd (A/B/H/K/L)")).toEqual(["A", "B", "H", "K", "L"]);
  });

  it("returns empty for a label without parens", () => {
    expect(parseEligibleGroups("1st Group A")).toEqual([]);
  });
});

describe("allocateThirds", () => {
  const slots = [
    { id: "s1", eligible: ["A", "B", "H", "K", "L"] },
    { id: "s2", eligible: ["A", "B", "C", "D", "F"] },
    { id: "s3", eligible: ["C", "D", "F", "G", "H"] },
    { id: "s4", eligible: ["C", "E", "F", "H", "I"] },
    { id: "s5", eligible: ["E", "H", "I", "J", "K"] },
    { id: "s6", eligible: ["B", "E", "F", "I", "J"] },
    { id: "s7", eligible: ["E", "F", "G", "I", "J"] },
    { id: "s8", eligible: ["D", "E", "I", "J", "L"] },
  ];

  it("assigns each slot a distinct eligible group", () => {
    const qualified = ["A", "C", "D", "E", "F", "H", "I", "J"];
    const result = allocateThirds(slots, qualified);
    expect(result).not.toBeNull();
    const assigned = Object.values(result ?? {});
    // every slot filled, all distinct, all from the qualified set
    expect(assigned).toHaveLength(8);
    expect(new Set(assigned).size).toBe(8);
    for (const g of assigned) expect(qualified).toContain(g);
    // each assignment respects the slot's eligibility list
    for (const slot of slots) {
      const group = result?.[slot.id] ?? "";
      expect(slot.eligible).toContain(group);
    }
  });

  it("is deterministic across runs", () => {
    const qualified = ["A", "C", "D", "E", "F", "H", "I", "J"];
    expect(allocateThirds(slots, qualified)).toEqual(allocateThirds(slots, qualified));
  });

  it("returns null when there are not enough qualifying groups", () => {
    expect(allocateThirds(slots, ["A", "B"])).toBeNull();
  });
});
