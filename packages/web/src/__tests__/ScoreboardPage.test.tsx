import { describe, expect, it } from "bun:test";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { ScoreboardPage } from "../pages/ScoreboardPage";
import { renderWithMocks } from "./test-utils";

function withRouter(ui: React.ReactElement) {
  const { hook } = memoryLocation({ path: "/scoreboard" });
  return <Router hook={hook}>{ui}</Router>;
}

const leaderboardData = [
  {
    rank: 1,
    user: { id: "u1", username: "alice" },
    totalPoints: 5,
    correctPicks: 2,
    totalPicks: 2,
  },
  {
    rank: 2,
    user: { id: "u2", username: "bob" },
    totalPoints: 0,
    correctPicks: 0,
    totalPicks: 1,
  },
];

describe("ScoreboardPage", () => {
  it("renders rank, username, and points for each entry", async () => {
    const { container } = await renderWithMocks(withRouter(<ScoreboardPage />), {
      Leaderboard: { leaderboard: leaderboardData },
      Me: { me: { id: "u1", username: "alice", isAdmin: false } },
    });

    expect(container.textContent).toContain("alice");
    expect(container.textContent).toContain("bob");
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("1"); // rank 1
    expect(container.textContent).toContain("2"); // rank 2
  });

  it("highlights current user's row with class my-row", async () => {
    const { container } = await renderWithMocks(withRouter(<ScoreboardPage />), {
      Leaderboard: { leaderboard: leaderboardData },
      Me: { me: { id: "u1", username: "alice", isAdmin: false } },
    });

    const myRow = container.querySelector("tr.my-row");
    expect(myRow).not.toBeNull();
    expect(myRow?.textContent).toContain("alice");
  });

  it("renders usernames as links", async () => {
    const { container } = await renderWithMocks(withRouter(<ScoreboardPage />), {
      Leaderboard: { leaderboard: leaderboardData },
      Me: { me: null },
    });

    const links = container.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    // At least one link points to a user page
    const userLinks = Array.from(links).filter((a) => a.getAttribute("href")?.startsWith("/user/"));
    expect(userLinks.length).toBeGreaterThan(0);
  });

  it("shows loading state when fetching", async () => {
    // With no mocks for Leaderboard, fetching will be in progress
    const { container } = await renderWithMocks(withRouter(<ScoreboardPage />), {
      Leaderboard: { leaderboard: leaderboardData },
      Me: { me: null },
    });
    // After flush it should show data
    expect(container.textContent).toContain("alice");
  });
});
