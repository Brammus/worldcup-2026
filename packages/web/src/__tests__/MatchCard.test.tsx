import { describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { MatchCard } from "../components/MatchCard";
import { render, renderWithMocks } from "./test-utils";

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

  it("shows score when result is present", () => {
    const match = {
      ...baseMatch,
      result: { homeScore: 2, awayScore: 1, winnerTeamId: "team-1" },
    };
    const { container } = render(createElement(MatchCard, { match, onPick: mock() }));
    expect(container.querySelector(".score")?.textContent).toContain("2");
    expect(container.querySelector(".score")?.textContent).toContain("1");
  });

  it("shows ✅ and points for correct pick when result is present", () => {
    const match = {
      ...baseMatch,
      myPick: { pickedTeamId: "team-1", points: 2 },
      result: { homeScore: 2, awayScore: 1, winnerTeamId: "team-1" },
    };
    const { container } = render(createElement(MatchCard, { match, onPick: mock() }));
    expect(container.querySelector(".pick-result")?.textContent).toContain("✅");
    expect(container.querySelector(".pick-result")?.textContent).toContain("+2");
  });

  it("shows ❌ for wrong pick when result is present", () => {
    const match = {
      ...baseMatch,
      myPick: { pickedTeamId: "team-2", points: 0 },
      result: { homeScore: 2, awayScore: 1, winnerTeamId: "team-1" },
    };
    const { container } = render(createElement(MatchCard, { match, onPick: mock() }));
    expect(container.querySelector(".pick-result")?.textContent).toContain("❌");
  });

  it("renders expand toggle button", () => {
    const { container } = render(createElement(MatchCard, { match: baseMatch, onPick: mock() }));
    const toggleBtn = container.querySelector(".toggle-picks-btn");
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn?.textContent).toContain("See picks");
  });

  it("shows picks section when expanded", async () => {
    const { hook } = memoryLocation({ path: "/" });
    const wrapper = (
      <Router hook={hook}>
        <MatchCard match={baseMatch} onPick={mock()} />
      </Router>
    );
    const { container } = await renderWithMocks(wrapper, {
      MatchPicks: {
        matchPicks: [
          {
            user: { id: "u1", username: "alice" },
            pickedTeam: { id: "t1", name: "France", group: "A" },
          },
        ],
      },
    });
    const toggleBtn = container.querySelector(".toggle-picks-btn") as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    const { flushSync } = await import("react-dom");
    flushSync(() => toggleBtn.click());
    expect(container.querySelector(".match-picks-list")).not.toBeNull();
  });
});
