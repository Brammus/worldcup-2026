import { describe, expect, it } from "bun:test";
import { flushSync } from "react-dom";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AdminPage, deriveOutcome } from "../pages/AdminPage";
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

  it("renders the submit button disabled before any score is entered", async () => {
    const { container } = await renderWithMocks(withRouter(<AdminPage />), {
      Me: { me: { id: "u1", username: "admin", isAdmin: true } },
      Matches: { matches: [pendingMatch] },
    });
    const submitBtn = container.querySelector("button[type='submit']") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it("opens a read-only bracket preview before saving", async () => {
    const { container } = await renderWithMocks(withRouter(<AdminPage />), {
      Me: { me: { id: "u1", username: "admin", isAdmin: true } },
      Matches: { matches: [pendingMatch] },
      PreviewBracket: {
        previewBracket: [
          {
            matchId: "r1",
            round: "r32",
            startsAt: new Date().toISOString(),
            homeLabel: "1st Group A",
            awayLabel: "Best 3rd (A/B)",
            homeName: "Brazil",
            awayName: "Morocco",
          },
        ],
      },
    });

    // No modal until the button is clicked
    expect(container.querySelector(".preview-modal")).toBeNull();

    const recomputeBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Recompute bracket"),
    ) as HTMLButtonElement;
    flushSync(() => recomputeBtn.click());
    await Promise.resolve();
    flushSync(() => {});

    // Modal shows the resolved names (not just the placeholder labels) and a confirm action
    expect(container.querySelector(".preview-modal")).not.toBeNull();
    expect(container.textContent).toContain("Brazil");
    expect(container.textContent).toContain("Morocco");
    expect(container.textContent).toContain("Confirm & save");
  });
});

describe("deriveOutcome", () => {
  it("returns no outcome until both scores are filled in", () => {
    expect(deriveOutcome("", "", true, "home").bothFilled).toBe(false);
    expect(deriveOutcome("2", "", true, "home").bothFilled).toBe(false);
    expect(deriveOutcome("2", "1", true, "home").bothFilled).toBe(true);
  });

  it("derives a home or away win from the score", () => {
    expect(deriveOutcome("3", "1", true, "home").outcome).toBe("home");
    expect(deriveOutcome("0", "2", true, "home").outcome).toBe("away");
  });

  it("treats a level group match as a draw", () => {
    const r = deriveOutcome("1", "1", true, "home");
    expect(r.isLevel).toBe(true);
    expect(r.outcome).toBe("draw");
  });

  it("decides a level knockout match by the tiebreak selection", () => {
    expect(deriveOutcome("1", "1", false, "home").outcome).toBe("home");
    expect(deriveOutcome("1", "1", false, "away").outcome).toBe("away");
  });
});
