import { describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import { MatchCard } from "../components/MatchCard";
import { render } from "./test-utils";

const baseMatch = {
  id: "match-1",
  round: "group",
  homeTeamLabel: "France",
  awayTeamLabel: "Germany",
  homeTeam: { id: "team-1", name: "France", group: "A" },
  awayTeam: { id: "team-2", name: "Germany", group: "A" },
  startsAt: new Date(Date.now() + 3_600_000).toISOString(),
  isLocked: false,
  myPick: null,
};

describe("MatchCard", () => {
  it("renders team names", () => {
    const { container } = render(createElement(MatchCard, { match: baseMatch, onPick: mock() }));
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("Germany");
  });

  it("renders two pick buttons", () => {
    const { container } = render(createElement(MatchCard, { match: baseMatch, onPick: mock() }));
    const buttons = container.querySelectorAll("button[data-team-id]");
    expect(buttons.length).toBe(2);
  });

  it("highlights the already-picked team button", () => {
    const match = { ...baseMatch, myPick: { pickedTeamId: "team-1" } };
    const { container } = render(createElement(MatchCard, { match, onPick: mock() }));
    const picked = container.querySelector("button[data-team-id='team-1']");
    expect(picked?.className).toContain("picked");
  });

  it("disables buttons when match is locked", () => {
    const match = { ...baseMatch, isLocked: true };
    const { container } = render(createElement(MatchCard, { match, onPick: mock() }));
    const buttons = container.querySelectorAll("button[data-team-id]");
    for (const btn of buttons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("renders TBD labels and disabled buttons when no teams assigned", () => {
    const match = {
      ...baseMatch,
      homeTeam: null,
      awayTeam: null,
      homeTeamLabel: "TBD",
      awayTeamLabel: "TBD",
      isLocked: false,
    };
    const { container } = render(createElement(MatchCard, { match, onPick: mock() }));
    expect(container.textContent).toContain("TBD");
    const buttons = container.querySelectorAll("button[data-team-id]");
    for (const btn of buttons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
