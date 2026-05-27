# Feature Slices Overview

Each slice is a vertical cut — schema + API + UI — delivered end-to-end before moving to the next.
Every slice is committed & pushed when done. All work is TDD (red → green → refactor).

## Slices

| # | Name | Description |
|---|------|-------------|
| 01 | [Schema & Seed](./01-schema-and-seed.md) | DB schema, all 104 matches & 48 teams seeded |
| 02 | [Auth](./02-auth.md) | Register, login, logout — username/password only |
| 03 | [Picks](./03-picks.md) | Browse matches, pick a winner, change pick before kickoff |
| 04 | [Results & Scoring](./04-results-and-scoring.md) | Record match results, score picks automatically |
| 05 | [Scoreboard](./05-scoreboard.md) | Leaderboard + per-user pick history |

## Tournament facts (for reference)

- **48 teams**, 12 groups of 4
- **Group stage** (72 matches): top 2 per group + best 8 third-place = 32 teams advance
- **Knockout**: Round of 32 → Round of 16 → Quarterfinals → Semifinals → Final (32 matches)
- **Total**: 104 matches
- Matches run June 11 – July 19, 2026

## Scoring model

- Correct winner pick = **2 points**
- Knockout stage correct pick = **3 points** (higher stakes)
- No points for wrong pick; no partial credit

## Picking rules

- Users can pick (or change pick) any time **before kickoff**
- Picks lock automatically once `startsAt` passes
- Knockout matches only become pickable once both teams are known (populated when group results are entered)
