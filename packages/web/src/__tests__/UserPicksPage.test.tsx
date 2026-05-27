import { describe, expect, it } from "bun:test";
import { Route, Router, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { UserPicksPage } from "../pages/UserPicksPage";
import { renderWithMocks } from "./test-utils";

function withRouter(path = "/user/u1") {
  const { hook } = memoryLocation({ path });
  return (
    <Router hook={hook}>
      <Switch>
        <Route path="/user/:userId" component={UserPicksPage} />
      </Switch>
    </Router>
  );
}

const picksData = [
  {
    id: "p1",
    matchId: "m1",
    pickedTeamId: "t1",
    points: 2,
    match: {
      id: "m1",
      round: "group",
      homeTeamLabel: "France",
      awayTeamLabel: "Germany",
      result: { homeScore: 2, awayScore: 0, winnerTeamId: "t1" },
    },
    pickedTeam: { id: "t1", name: "France", group: "A" },
  },
  {
    id: "p2",
    matchId: "m2",
    pickedTeamId: "t2",
    points: 0,
    match: {
      id: "m2",
      round: "group",
      homeTeamLabel: "Spain",
      awayTeamLabel: "Portugal",
      result: { homeScore: 0, awayScore: 1, winnerTeamId: "t3" },
    },
    pickedTeam: { id: "t2", name: "Spain", group: "B" },
  },
  {
    id: "p3",
    matchId: "m3",
    pickedTeamId: "t4",
    points: null,
    match: {
      id: "m3",
      round: "r32",
      homeTeamLabel: "Brazil",
      awayTeamLabel: "Argentina",
      result: null,
    },
    pickedTeam: { id: "t4", name: "Brazil", group: "C" },
  },
];

describe("UserPicksPage", () => {
  it("renders picks with match labels", async () => {
    const { container } = await renderWithMocks(withRouter(), {
      UserPicks: { userPicks: picksData },
    });

    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("Germany");
    expect(container.textContent).toContain("Brazil");
    expect(container.textContent).toContain("Argentina");
  });

  it("shows pending text for picks without a result", async () => {
    const { container } = await renderWithMocks(withRouter(), {
      UserPicks: { userPicks: picksData },
    });

    const pendingEl = container.querySelector(".pending");
    expect(pendingEl).not.toBeNull();
    expect(pendingEl?.textContent).toContain("pending");
  });

  it("shows correct indicator for correct picks", async () => {
    const { container } = await renderWithMocks(withRouter(), {
      UserPicks: { userPicks: picksData },
    });

    const correctEl = container.querySelector(".correct");
    expect(correctEl).not.toBeNull();
    // Should contain a checkmark or +2
    expect(correctEl?.textContent).toMatch(/✓|\+2/);
  });

  it("shows wrong indicator for incorrect picks", async () => {
    const { container } = await renderWithMocks(withRouter(), {
      UserPicks: { userPicks: picksData },
    });

    const wrongEl = container.querySelector(".wrong");
    expect(wrongEl).not.toBeNull();
  });

  it("renders summary with correct/total/points", async () => {
    const { container } = await renderWithMocks(withRouter(), {
      UserPicks: { userPicks: picksData },
    });

    const summary = container.querySelector(".summary");
    expect(summary).not.toBeNull();
    // 1 correct, 3 picks, 2 points
    expect(summary?.textContent).toContain("1");
    expect(summary?.textContent).toContain("3");
    expect(summary?.textContent).toContain("2");
  });
});
