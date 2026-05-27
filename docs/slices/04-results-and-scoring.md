# Slice 04 — Results & Scoring

## Goal

Match results can be recorded (by the app owner). Picks are scored automatically. Knockout match slots are filled in as group results come in.

## Scoring rules

| Situation | Points |
|-----------|--------|
| Correct pick, group stage | +2 |
| Correct pick, knockout round | +3 |
| Wrong pick | 0 |
| No pick made | 0 |

## API

```graphql
type Mutation {
  setResult(matchId: ID!, winnerId: ID, homeScore: Int!, awayScore: Int!): Match!
  # winnerId null = draw (only valid in group stage)
}

type Match {
  # ... existing fields ...
  result: MatchResult
}

type MatchResult {
  winner: Team          # null = draw
  homeScore: Int!
  awayScore: Int!
}

type Pick {
  # ... existing fields ...
  points: Int           # null until result recorded; 0 or 2/3 after
}
```

**Implementation notes:**
- `setResult` requires the current user to have `is_admin = true` (boolean column on `users`, set directly in DB — no UI to manage it)
- After recording a result, resolve which knockout match slots unlock: update `home_team_id`/`away_team_id` on the appropriate downstream match based on the bracket structure
- `Pick.points` is a resolver: if no result → null; if result and correct team → 2 or 3 based on round; else 0

## Bracket propagation

When a group stage match result is recorded, check if all 3 group matches for that group are done. If yes, determine 1st/2nd/3rd for the group and populate the corresponding Round of 32 slots.

When a knockout match result is recorded, immediately populate the team into the next round's match slot.

Store the bracket wiring as a static map in code (not in DB) — it doesn't change.

## UI additions

### Match card (extension of slice 03)
- Shows score once result is recorded (e.g. "3 – 1")
- Pick shows ✓ and points earned, or ✗ if wrong

### `/admin` — simple result entry page
- Only accessible when logged in as the admin user
- List of matches without results yet
- Click a match → form to enter score & winner
- Submit calls `setResult`

## Tests to write (TDD order)

**API:**
1. `setResult` records result on the match
2. `setResult` throws when called by non-admin
3. `Pick.points` is null before result is recorded
4. `Pick.points` is 2 for a correct group stage pick
5. `Pick.points` is 3 for a correct knockout pick
6. `Pick.points` is 0 for a wrong pick
7. After final group match result, Round of 32 slots are populated with correct teams
8. After a knockout result, next round slot is populated with the winner

**UI:**
1. Match card shows score when result is present
2. Correct pick shows points earned
3. Wrong pick shows ✗
4. Admin page lists matches without results
5. Submitting result form calls `setResult`
6. Admin page is not accessible to non-admin users
