import { useState } from "react";
import { useMutation, useQuery } from "urql";
import { MatchCard } from "../components/MatchCard";
import { NavBar } from "../components/NavBar";
import { UserSummaryModal } from "../components/UserSummaryModal";
import { MatchesQuery, MeQuery, SetPickMutation } from "../graphql/operations";

const ROUNDS = [
  { value: "group", label: "Group Stage ⚽" },
  { value: "r32", label: "Round of 32" },
  { value: "r16", label: "Round of 16" },
  { value: "qf", label: "Quarters 🔥" },
  { value: "sf", label: "Semis 🔥" },
  { value: "final", label: "Final 🏆" },
];

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

type MatchData = {
  id: string;
  round: string;
  matchday: number | null;
  group: string | null;
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeTeam: { id: string; name: string; group: string } | null;
  awayTeam: { id: string; name: string; group: string } | null;
  startsAt: string;
  isLocked: boolean;
  myPick: { pickedTeamId: string | null } | null;
};

type MeData = {
  me: { id: string; username: string; isAdmin: boolean } | null;
};

export function HomePage() {
  const [activeRound, setActiveRound] = useState("r16");
  const [activeGroup, setActiveGroup] = useState<string | null>("A");
  const [summaryUser, setSummaryUser] = useState<{ userId: string; username: string } | null>(null);

  const variables =
    activeRound === "group"
      ? activeGroup
        ? { round: "group", group: activeGroup }
        : { round: "group" }
      : { round: activeRound };

  const [result, reexecute] = useQuery<{ matches: MatchData[] }>({
    query: MatchesQuery,
    variables,
    requestPolicy: "cache-and-network",
  });

  const [meResult] = useQuery<MeData>({ query: MeQuery });

  const [, setPick] = useMutation(SetPickMutation);

  async function handlePick(matchId: string, teamId: string | null) {
    await setPick({ matchId, teamId });
    reexecute({ requestPolicy: "network-only" });
  }

  const matches = [...(result.data?.matches ?? [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const me = meResult.data?.me ?? null;

  return (
    <div className="home-page">
      <NavBar currentUser={me} />

      <nav className="round-tabs">
        {ROUNDS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`tab${activeRound === r.value ? " active" : ""}`}
            onClick={() => setActiveRound(r.value)}
          >
            {r.label}
          </button>
        ))}
      </nav>

      {activeRound === "group" && (
        <nav className="group-tabs">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={`tab${activeGroup === g ? " active" : ""}`}
              onClick={() => setActiveGroup(activeGroup === g ? null : g)}
            >
              Group {g}
            </button>
          ))}
        </nav>
      )}

      {result.fetching && matches.length === 0 ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="match-list">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPick={handlePick}
              currentUser={me}
              onUsernameClick={(userId, username) => setSummaryUser({ userId, username })}
            />
          ))}
        </div>
      )}
      {summaryUser && (
        <UserSummaryModal
          userId={summaryUser.userId}
          username={summaryUser.username}
          onClose={() => setSummaryUser(null)}
        />
      )}
    </div>
  );
}
