# Slice 03 — Picks

## Goal

Logged-in users can browse all matches, pick a winner, and change their pick any time before kickoff. Picks lock automatically once `startsAt` passes.

## API

```graphql
type Mutation {
  setPick(matchId: ID!, teamId: ID!): Pick!
}

type Query {
  matches(round: String, group: String): [Match!]!  # already exists, extended below
  myPicks: [Pick!]!
}

type Pick {
  id: ID!
  match: Match!
  pickedTeam: Team!
}

# Match extended:
type Match {
  # ... existing fields ...
  result: MatchResult          # null until recorded
  myPick: Pick                 # null if current user hasn't picked
  isLocked: Boolean!           # true when startsAt is in the past
}
```

**Implementation notes:**
- `setPick` requires auth; throws if match is locked (`startsAt < now()`)
- `setPick` upserts — creates or replaces existing pick for that match
- `Match.isLocked` and `Match.myPick` are resolved per-request based on current user & current time

## UI

### `/` — Home / match browser

- Tab or section per round: Group Stage | Round of 32 | Round of 16 | Quarters | Semis | Final
- Group stage further divided by group (A–L)
- Each match card shows:
  - Team names (or labels for TBD knockout matches)
  - Kickoff date & time
  - Two pick buttons (one per team)
  - Active pick highlighted; locked picks show a padlock
- Knockout matches with no teams yet show "TBD vs TBD" and disabled pick buttons

### Pick button behaviour
- Clicking a team button calls `setPick`
- Optimistic UI — button highlights immediately
- If match is locked, buttons are disabled and show lock icon

## Tests to write (TDD order)

**API:**
1. `setPick` stores a pick for the current user
2. `setPick` upserts — calling twice on the same match replaces the first pick
3. `setPick` throws when match is locked
4. `setPick` throws when called unauthenticated
5. `myPicks` returns only the current user's picks
6. `Match.isLocked` is `true` when `startsAt` is in the past
7. `Match.myPick` returns the pick for the current user, null for others

**UI:**
1. Match card renders team names and pick buttons
2. Clicking a pick button calls `setPick` with correct args
3. Already-picked team button appears selected
4. Pick buttons are disabled when `isLocked` is true
5. TBD knockout match renders labels and disabled buttons
