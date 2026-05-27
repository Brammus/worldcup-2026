# Slice 01 — Schema & Seed

## Goal

Full DB schema in place and all 104 World Cup 2026 matches + 48 teams seeded. No UI. Verified via tests and a GraphQL query.

## DB Schema

### `teams`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | e.g. "Brazil" |
| group | text | "A"–"L" |

### `matches`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| round | text | `group` / `r32` / `r16` / `qf` / `sf` / `final` / `third_place` |
| matchday | int | 1/2/3 for group stage, null for knockout |
| home_team_id | uuid FK → teams | null for knockout until teams are known |
| away_team_id | uuid FK → teams | null for knockout until teams are known |
| home_team_label | text | e.g. "Winner Group A" — shown when team_id is null |
| away_team_label | text | |
| venue | text | |
| starts_at | timestamptz | kickoff time |

### `users`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| username | text UNIQUE | |
| password_hash | text | bcrypt |
| is_admin | boolean | default false, set directly in DB |
| created_at | timestamptz | |

### `picks`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → users | |
| match_id | uuid FK → matches | |
| picked_team_id | uuid FK → teams | |
| created_at | timestamptz | |
| UNIQUE (user_id, match_id) | | one pick per user per match |

### `match_results`
| column | type | notes |
|--------|------|-------|
| match_id | uuid PK FK → matches | |
| winner_team_id | uuid FK → teams | null = draw |
| home_score | int | |
| away_score | int | |
| recorded_at | timestamptz | |

## Seed Data

- All 48 teams with correct group assignments (A–L)
- All 72 group stage matches with teams, venue, `starts_at`
- All 32 knockout matches with `home_team_label`/`away_team_label` placeholders (team IDs null until group results are in)

## GraphQL additions

```graphql
type Query {
  matches(round: String, group: String): [Match!]!
  teams: [Team!]!
}

type Match {
  id: ID!
  round: String!
  matchday: Int
  homeTeam: Team
  awayTeam: Team
  homeTeamLabel: String!
  awayTeamLabel: String!
  venue: String!
  startsAt: String!
}
```

## Tests to write (TDD order)

1. Seed script runs without errors against test DB
2. `Query.teams` returns 48 teams
3. `Query.matches` returns 72 group stage matches when `round: "group"`
4. `Query.matches` returns 104 total matches
5. Every group has exactly 4 teams
6. Every group stage match has both team IDs populated
