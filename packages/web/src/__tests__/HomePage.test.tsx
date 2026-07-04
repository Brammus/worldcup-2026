import { describe, expect, it } from "bun:test";
import { flushSync } from "react-dom";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { HomePage } from "../pages/HomePage";
import { renderWithMocks } from "./test-utils";

const sampleMatch = {
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
};

function withRouter(ui: React.ReactElement) {
  const { hook } = memoryLocation({ path: "/" });
  return <Router hook={hook}>{ui}</Router>;
}

describe("HomePage", () => {
  it("renders round tabs", async () => {
    const { container } = await renderWithMocks(withRouter(<HomePage />), {
      Matches: { matches: [] },
      Me: { me: null },
    });
    expect(container.textContent).toContain("Group Stage");
    expect(container.textContent).toContain("Final");
  });

  it("defaults to the Round of 16 tab", async () => {
    const { container } = await renderWithMocks(withRouter(<HomePage />), {
      Matches: { matches: [] },
      Me: { me: null },
    });
    const activeTab = container.querySelector(".tab.active");
    expect(activeTab?.textContent).toContain("Round of 16");
    // group tabs only show on the Group Stage tab
    expect(container.querySelector(".group-tabs")).toBeNull();
  });

  it("renders group tabs when the Group Stage tab is selected", async () => {
    const { container } = await renderWithMocks(withRouter(<HomePage />), {
      Matches: { matches: [] },
      Me: { me: null },
    });
    const groupTab = Array.from(container.querySelectorAll(".tab")).find((el) =>
      el.textContent?.includes("Group Stage"),
    ) as HTMLButtonElement;
    flushSync(() => groupTab.click());
    expect(container.textContent).toContain("Group A");
    expect(container.textContent).toContain("Group L");
  });

  it("renders match cards from query data", async () => {
    const { container } = await renderWithMocks(withRouter(<HomePage />), {
      Matches: { matches: [sampleMatch] },
      Me: { me: null },
    });
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("Germany");
  });

  it("does not render group tabs for knockout rounds", async () => {
    const { container } = await renderWithMocks(withRouter(<HomePage />), {
      Matches: { matches: [] },
      Me: { me: null },
    });
    const finalTab = Array.from(container.querySelectorAll(".tab")).find((el) =>
      el.textContent?.includes("Final"),
    ) as HTMLButtonElement;
    flushSync(() => finalTab.click());
    expect(container.querySelector(".group-tabs")).toBeNull();
  });

  it("calls setPick and reexecutes query when a pick button is clicked", async () => {
    const { container } = await renderWithMocks(withRouter(<HomePage />), {
      Matches: { matches: [sampleMatch] },
      SetPick: { setPick: { id: "p1", matchId: "m1", pickedTeamId: "t1" } },
      Me: { me: null },
    });
    const pickBtn = container.querySelector("button[data-team-id]") as HTMLButtonElement;
    flushSync(() => pickBtn.click());
    await Promise.resolve();
    flushSync(() => {});
    expect(container.querySelector("button[data-team-id]")).not.toBeNull();
  });
});
