# Slice 05 — Scoreboard

## Goal

A leaderboard showing all users ranked by total points, and a per-user page showing every pick they made with outcomes.

## API

```graphql
type Query {
  leaderboard: [LeaderboardEntry!]!
  userPicks(userId: ID!): [Pick!]!
}

type LeaderboardEntry {
  rank: Int!
  user: User!
  totalPoints: Int!
  correctPicks: Int!
  totalPicks: Int!
}
```

**Implementation notes:**
- `leaderboard` is a single DB query: join picks → match_results, sum points grouped by user, order by total desc
- Rank handles ties (same points = same rank)
- `userPicks` is public — anyone can view anyone's picks

## UI

### `/scoreboard` — leaderboard page

- Table: Rank | Username | Points | Correct / Total picks
- Highlight the logged-in user's row
- Each username links to their picks page

### `/user/:username` — user picks page

- Header: username + total points
- Matches grouped by round, showing:
  - Match (team vs team)
  - User's pick (or "–" if no pick)
  - Outcome (✓ +2pts / ✓ +3pts / ✗ / pending)
- Summary stats at top: X correct out of Y picks, Z points total

## Tests to write (TDD order)

**API:**
1. `leaderboard` returns users ordered by total points descending
2. `leaderboard` handles ties — same rank assigned to equal-point users
3. `leaderboard` includes users with 0 points
4. `LeaderboardEntry.correctPicks` counts only picks where `points > 0`
5. `userPicks` returns picks for the specified user, not the current user
6. `userPicks` is accessible without authentication

**UI:**
1. Leaderboard table renders rank, username, and points for each entry
2. Logged-in user's row has a distinct visual style
3. Username links navigate to `/user/:username`
4. User picks page groups picks by round
5. Pending picks (no result yet) show no outcome indicator
