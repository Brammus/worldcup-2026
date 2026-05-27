import { describe, expect, it, mock } from "bun:test";
import { flushSync } from "react-dom";
import { UserSummaryModal } from "../components/UserSummaryModal";
import { renderWithMocks } from "./test-utils";

const groupPicksData = [
  {
    id: "p1",
    matchId: "m1",
    pickedTeamId: "t1",
    points: 2,
    match: {
      id: "m1",
      round: "group",
      group: "A",
      homeTeamLabel: "France",
      awayTeamLabel: "Germany",
      result: { homeScore: 2, awayScore: 0, winnerTeamId: "t1" },
    },
    pickedTeam: { id: "t1", name: "France", group: "A" },
  },
  {
    id: "p2",
    matchId: "m2",
    pickedTeamId: "t1",
    points: null,
    match: {
      id: "m2",
      round: "group",
      group: "A",
      homeTeamLabel: "France",
      awayTeamLabel: "USA",
      result: null,
    },
    pickedTeam: { id: "t1", name: "France", group: "A" },
  },
  {
    id: "p3",
    matchId: "m3",
    pickedTeamId: "t3",
    points: null,
    match: {
      id: "m3",
      round: "group",
      group: "B",
      homeTeamLabel: "Brazil",
      awayTeamLabel: "Argentina",
      result: null,
    },
    pickedTeam: { id: "t3", name: "Brazil", group: "B" },
  },
];

describe("UserSummaryModal", () => {
  it("renders username in the modal title", async () => {
    const { container } = await renderWithMocks(
      <UserSummaryModal userId="u1" username="alice" onClose={mock()} />,
      { UserPicks: { userPicks: groupPicksData } },
    );

    expect(container.textContent).toContain("alice");
    expect(container.textContent).toContain("predictions");
  });

  it("renders group grid with 12 groups", async () => {
    const { container } = await renderWithMocks(
      <UserSummaryModal userId="u1" username="alice" onClose={mock()} />,
      { UserPicks: { userPicks: groupPicksData } },
    );

    const groupCards = container.querySelectorAll(".group-card");
    expect(groupCards.length).toBe(12);
  });

  it("shows most-picked team for group with picks", async () => {
    const { container } = await renderWithMocks(
      <UserSummaryModal userId="u1" username="alice" onClose={mock()} />,
      { UserPicks: { userPicks: groupPicksData } },
    );

    // Group A: France picked twice
    const groupCards = Array.from(container.querySelectorAll(".group-card"));
    const groupACard = groupCards.find((c) => c.textContent?.includes("Group A"));
    expect(groupACard?.textContent).toContain("France");

    // Group B: Brazil picked once
    const groupBCard = groupCards.find((c) => c.textContent?.includes("Group B"));
    expect(groupBCard?.textContent).toContain("Brazil");
  });

  it("shows dash for groups with no picks", async () => {
    const { container } = await renderWithMocks(
      <UserSummaryModal userId="u1" username="alice" onClose={mock()} />,
      { UserPicks: { userPicks: groupPicksData } },
    );

    // Group C has no picks
    const groupCards = Array.from(container.querySelectorAll(".group-card"));
    const groupCCard = groupCards.find((c) => c.textContent?.includes("Group C"));
    expect(groupCCard?.querySelector(".group-pick")?.textContent).toBe("–");
  });

  it("calls onClose when overlay is clicked", async () => {
    const onClose = mock();
    const { container } = await renderWithMocks(
      <UserSummaryModal userId="u1" username="alice" onClose={onClose} />,
      { UserPicks: { userPicks: [] } },
    );

    const overlay = container.querySelector(".modal-overlay") as HTMLElement;
    expect(overlay).not.toBeNull();
    flushSync(() => overlay.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = mock();
    const { container } = await renderWithMocks(
      <UserSummaryModal userId="u1" username="alice" onClose={onClose} />,
      { UserPicks: { userPicks: [] } },
    );

    const closeBtn = container.querySelector(".modal-header button") as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    flushSync(() => closeBtn.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
