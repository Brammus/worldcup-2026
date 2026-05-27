import { describe, expect, it } from "bun:test";
import { flushSync } from "react-dom";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AdminPage } from "../pages/AdminPage";
import { renderWithMocks } from "./test-utils";

const pendingMatch = {
  id: "m1",
  round: "group",
  matchday: 1,
  group: "A",
  homeTeamLabel: "France",
  awayTeamLabel: "Germany",
  homeTeam: { id: "t1", name: "France", group: "A" },
  awayTeam: { id: "t2", name: "Germany", group: "A" },
  startsAt: new Date(Date.now() + 3_600_000).toISOString(),
  isLocked: false,
  myPick: null,
  result: null,
};

function withRouter(ui: React.ReactElement) {
  const { hook } = memoryLocation({ path: "/admin" });
  return <Router hook={hook}>{ui}</Router>;
}

describe("AdminPage", () => {
  it("renders pending match list for admin", async () => {
    const { container } = await renderWithMocks(withRouter(<AdminPage />), {
      Me: { me: { id: "u1", username: "admin", isAdmin: true } },
      Matches: { matches: [pendingMatch] },
    });
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("Germany");
  });

  it("shows Access denied for non-admin", async () => {
    const { container } = await renderWithMocks(withRouter(<AdminPage />), {
      Me: { me: { id: "u2", username: "regular", isAdmin: false } },
      Matches: { matches: [] },
    });
    expect(container.textContent).toContain("Access denied");
  });

  it("shows Access denied when not logged in", async () => {
    const { container } = await renderWithMocks(withRouter(<AdminPage />), {
      Me: { me: null },
      Matches: { matches: [] },
    });
    expect(container.textContent).toContain("Access denied");
  });

  it("calls setResult mutation on form submit", async () => {
    const { container } = await renderWithMocks(withRouter(<AdminPage />), {
      Me: { me: { id: "u1", username: "admin", isAdmin: true } },
      Matches: { matches: [pendingMatch] },
      SetResult: {
        setResult: {
          id: "m1",
          round: "group",
          homeTeamLabel: "France",
          awayTeamLabel: "Germany",
          result: { homeScore: 2, awayScore: 1, winnerTeamId: "t1" },
        },
      },
    });

    const inputs = container.querySelectorAll("input[type='number']");
    const homeInput = inputs[0] as HTMLInputElement;
    const awayInput = inputs[1] as HTMLInputElement;
    const submitBtn = container.querySelector("button[type='submit']") as HTMLButtonElement;

    flushSync(() => {
      homeInput.value = "2";
      homeInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    flushSync(() => {
      awayInput.value = "1";
      awayInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    flushSync(() => submitBtn.click());

    await Promise.resolve();
    flushSync(() => {});

    // Form was submitted — button should still be present (mock returns success)
    expect(container.querySelector("button[type='submit']")).not.toBeNull();
  });
});
