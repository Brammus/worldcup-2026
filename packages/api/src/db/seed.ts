import type { DB } from "./client";
import {
  matchResults,
  matches,
  osrsPlayers,
  osrsTeamPicks,
  osrsTeams,
  picks,
  teams,
} from "./schema";

// EDT = UTC-4
const t = (iso: string) => new Date(iso);

const TEAM_DATA = [
  // Group A
  { name: "Mexico", groupLetter: "A" },
  { name: "South Africa", groupLetter: "A" },
  { name: "South Korea", groupLetter: "A" },
  { name: "Czechia", groupLetter: "A" },
  // Group B
  { name: "Canada", groupLetter: "B" },
  { name: "Switzerland", groupLetter: "B" },
  { name: "Bosnia-Herzegovina", groupLetter: "B" },
  { name: "Qatar", groupLetter: "B" },
  // Group C
  { name: "Brazil", groupLetter: "C" },
  { name: "Morocco", groupLetter: "C" },
  { name: "Scotland", groupLetter: "C" },
  { name: "Haiti", groupLetter: "C" },
  // Group D
  { name: "United States", groupLetter: "D" },
  { name: "Türkiye", groupLetter: "D" },
  { name: "Paraguay", groupLetter: "D" },
  { name: "Australia", groupLetter: "D" },
  // Group E
  { name: "Netherlands", groupLetter: "E" },
  { name: "Sweden", groupLetter: "E" },
  { name: "Japan", groupLetter: "E" },
  { name: "Tunisia", groupLetter: "E" },
  // Group F
  { name: "Germany", groupLetter: "F" },
  { name: "Ecuador", groupLetter: "F" },
  { name: "Ivory Coast", groupLetter: "F" },
  { name: "Curaçao", groupLetter: "F" },
  // Group G
  { name: "Spain", groupLetter: "G" },
  { name: "Uruguay", groupLetter: "G" },
  { name: "Saudi Arabia", groupLetter: "G" },
  { name: "Cape Verde", groupLetter: "G" },
  // Group H
  { name: "Belgium", groupLetter: "H" },
  { name: "Iran", groupLetter: "H" },
  { name: "Egypt", groupLetter: "H" },
  { name: "New Zealand", groupLetter: "H" },
  // Group I
  { name: "France", groupLetter: "I" },
  { name: "Senegal", groupLetter: "I" },
  { name: "Norway", groupLetter: "I" },
  { name: "Iraq", groupLetter: "I" },
  // Group J
  { name: "Argentina", groupLetter: "J" },
  { name: "Algeria", groupLetter: "J" },
  { name: "Austria", groupLetter: "J" },
  { name: "Jordan", groupLetter: "J" },
  // Group K
  { name: "England", groupLetter: "K" },
  { name: "Croatia", groupLetter: "K" },
  { name: "Ghana", groupLetter: "K" },
  { name: "Panama", groupLetter: "K" },
  // Group L
  { name: "Portugal", groupLetter: "L" },
  { name: "Colombia", groupLetter: "L" },
  { name: "DR Congo", groupLetter: "L" },
  { name: "Uzbekistan", groupLetter: "L" },
];

type GroupMatch = {
  matchday: number;
  groupLetter: string;
  home: string;
  away: string;
  venue: string;
  startsAt: Date;
};

const GROUP_MATCHES: GroupMatch[] = [
  // ── Group A ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "A",
    home: "Mexico",
    away: "South Africa",
    venue: "Estadio Azteca, Mexico City",
    startsAt: t("2026-06-11T19:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "A",
    home: "South Korea",
    away: "Czechia",
    venue: "Estadio Akron, Guadalajara",
    startsAt: t("2026-06-12T02:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "A",
    home: "Czechia",
    away: "South Africa",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-06-18T16:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "A",
    home: "Mexico",
    away: "South Korea",
    venue: "Estadio Akron, Guadalajara",
    startsAt: t("2026-06-19T01:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "A",
    home: "Czechia",
    away: "Mexico",
    venue: "Estadio Banorte, Mexico City",
    startsAt: t("2026-06-25T01:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "A",
    home: "South Korea",
    away: "South Africa",
    venue: "Estadio BBVA, Monterrey",
    startsAt: t("2026-06-25T01:00:00Z"),
  },

  // ── Group B ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "B",
    home: "Canada",
    away: "Bosnia-Herzegovina",
    venue: "BMO Field, Toronto",
    startsAt: t("2026-06-12T19:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "B",
    home: "Qatar",
    away: "Switzerland",
    venue: "Levi's Stadium, Santa Clara",
    startsAt: t("2026-06-13T19:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "B",
    home: "Switzerland",
    away: "Bosnia-Herzegovina",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-06-18T19:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "B",
    home: "Canada",
    away: "Qatar",
    venue: "BC Place, Vancouver",
    startsAt: t("2026-06-18T22:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "B",
    home: "Bosnia-Herzegovina",
    away: "Qatar",
    venue: "Lumen Field, Seattle",
    startsAt: t("2026-06-24T19:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "B",
    home: "Switzerland",
    away: "Canada",
    venue: "BC Place, Vancouver",
    startsAt: t("2026-06-24T19:00:00Z"),
  },

  // ── Group C ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "C",
    home: "Brazil",
    away: "Morocco",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-06-13T22:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "C",
    home: "Haiti",
    away: "Scotland",
    venue: "Gillette Stadium, Boston",
    startsAt: t("2026-06-14T01:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "C",
    home: "Scotland",
    away: "Morocco",
    venue: "Gillette Stadium, Boston",
    startsAt: t("2026-06-19T22:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "C",
    home: "Brazil",
    away: "Haiti",
    venue: "Lincoln Financial Field, Philadelphia",
    startsAt: t("2026-06-20T00:30:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "C",
    home: "Morocco",
    away: "Haiti",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-06-24T22:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "C",
    home: "Brazil",
    away: "Scotland",
    venue: "Hard Rock Stadium, Miami",
    startsAt: t("2026-06-24T22:00:00Z"),
  },

  // ── Group D ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "D",
    home: "United States",
    away: "Paraguay",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-06-13T01:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "D",
    home: "Australia",
    away: "Türkiye",
    venue: "BC Place, Vancouver",
    startsAt: t("2026-06-14T04:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "D",
    home: "United States",
    away: "Australia",
    venue: "Lumen Field, Seattle",
    startsAt: t("2026-06-19T19:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "D",
    home: "Türkiye",
    away: "Paraguay",
    venue: "Levi's Stadium, Santa Clara",
    startsAt: t("2026-06-20T03:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "D",
    home: "Paraguay",
    away: "Australia",
    venue: "Levi's Stadium, Santa Clara",
    startsAt: t("2026-06-26T02:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "D",
    home: "Türkiye",
    away: "United States",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-06-26T02:00:00Z"),
  },

  // ── Group E ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "E",
    home: "Netherlands",
    away: "Japan",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-06-14T20:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "E",
    home: "Sweden",
    away: "Tunisia",
    venue: "Estadio BBVA, Monterrey",
    startsAt: t("2026-06-15T02:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "E",
    home: "Netherlands",
    away: "Sweden",
    venue: "NRG Stadium, Houston",
    startsAt: t("2026-06-20T17:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "E",
    home: "Tunisia",
    away: "Japan",
    venue: "Estadio BBVA, Monterrey",
    startsAt: t("2026-06-21T04:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "E",
    home: "Japan",
    away: "Sweden",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-06-25T23:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "E",
    home: "Tunisia",
    away: "Netherlands",
    venue: "GEHA Field, Kansas City",
    startsAt: t("2026-06-25T23:00:00Z"),
  },

  // ── Group F ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "F",
    home: "Germany",
    away: "Curaçao",
    venue: "NRG Stadium, Houston",
    startsAt: t("2026-06-14T17:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "F",
    home: "Ivory Coast",
    away: "Ecuador",
    venue: "Lincoln Financial Field, Philadelphia",
    startsAt: t("2026-06-14T23:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "F",
    home: "Germany",
    away: "Ivory Coast",
    venue: "BMO Field, Toronto",
    startsAt: t("2026-06-20T20:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "F",
    home: "Ecuador",
    away: "Curaçao",
    venue: "GEHA Field, Kansas City",
    startsAt: t("2026-06-21T00:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "F",
    home: "Curaçao",
    away: "Ivory Coast",
    venue: "Lincoln Financial Field, Philadelphia",
    startsAt: t("2026-06-25T20:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "F",
    home: "Ecuador",
    away: "Germany",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-06-25T20:00:00Z"),
  },

  // ── Group G ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "G",
    home: "Spain",
    away: "Cape Verde",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-06-15T16:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "G",
    home: "Saudi Arabia",
    away: "Uruguay",
    venue: "Hard Rock Stadium, Miami",
    startsAt: t("2026-06-15T22:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "G",
    home: "Spain",
    away: "Saudi Arabia",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-06-21T16:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "G",
    home: "Uruguay",
    away: "Cape Verde",
    venue: "Hard Rock Stadium, Miami",
    startsAt: t("2026-06-21T22:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "G",
    home: "Cape Verde",
    away: "Saudi Arabia",
    venue: "NRG Stadium, Houston",
    startsAt: t("2026-06-27T00:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "G",
    home: "Uruguay",
    away: "Spain",
    venue: "Estadio Akron, Guadalajara",
    startsAt: t("2026-06-27T00:00:00Z"),
  },

  // ── Group H ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "H",
    home: "Belgium",
    away: "Egypt",
    venue: "Lumen Field, Seattle",
    startsAt: t("2026-06-15T19:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "H",
    home: "Iran",
    away: "New Zealand",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-06-16T01:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "H",
    home: "Belgium",
    away: "Iran",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-06-21T19:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "H",
    home: "Egypt",
    away: "New Zealand",
    venue: "BC Place, Vancouver",
    startsAt: t("2026-06-22T01:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "H",
    home: "Iran",
    away: "Egypt",
    venue: "Lumen Field, Seattle",
    startsAt: t("2026-06-27T03:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "H",
    home: "Belgium",
    away: "New Zealand",
    venue: "BC Place, Vancouver",
    startsAt: t("2026-06-27T03:00:00Z"),
  },

  // ── Group I ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "I",
    home: "France",
    away: "Senegal",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-06-16T19:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "I",
    home: "Iraq",
    away: "Norway",
    venue: "Gillette Stadium, Boston",
    startsAt: t("2026-06-16T22:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "I",
    home: "France",
    away: "Iraq",
    venue: "Lincoln Financial Field, Philadelphia",
    startsAt: t("2026-06-22T21:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "I",
    home: "Senegal",
    away: "Norway",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-06-23T00:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "I",
    home: "Norway",
    away: "France",
    venue: "Gillette Stadium, Boston",
    startsAt: t("2026-06-26T19:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "I",
    home: "Iraq",
    away: "Senegal",
    venue: "BMO Field, Toronto",
    startsAt: t("2026-06-26T19:00:00Z"),
  },

  // ── Group J ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "J",
    home: "Argentina",
    away: "Algeria",
    venue: "GEHA Field, Kansas City",
    startsAt: t("2026-06-17T01:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "J",
    home: "Austria",
    away: "Jordan",
    venue: "Levi's Stadium, Santa Clara",
    startsAt: t("2026-06-17T04:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "J",
    home: "Argentina",
    away: "Austria",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-06-22T17:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "J",
    home: "Algeria",
    away: "Jordan",
    venue: "Levi's Stadium, Santa Clara",
    startsAt: t("2026-06-23T03:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "J",
    home: "Algeria",
    away: "Austria",
    venue: "GEHA Field, Kansas City",
    startsAt: t("2026-06-28T02:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "J",
    home: "Jordan",
    away: "Argentina",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-06-28T02:00:00Z"),
  },

  // ── Group K ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "K",
    home: "England",
    away: "Croatia",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-06-17T20:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "K",
    home: "Ghana",
    away: "Panama",
    venue: "BMO Field, Toronto",
    startsAt: t("2026-06-17T23:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "K",
    home: "England",
    away: "Ghana",
    venue: "Gillette Stadium, Boston",
    startsAt: t("2026-06-23T20:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "K",
    home: "Croatia",
    away: "Panama",
    venue: "BMO Field, Toronto",
    startsAt: t("2026-06-23T23:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "K",
    home: "Ghana",
    away: "Croatia",
    venue: "Lincoln Financial Field, Philadelphia",
    startsAt: t("2026-06-27T21:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "K",
    home: "Panama",
    away: "England",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-06-27T21:00:00Z"),
  },

  // ── Group L ──────────────────────────────────────────────────────────────
  {
    matchday: 1,
    groupLetter: "L",
    home: "Portugal",
    away: "DR Congo",
    venue: "NRG Stadium, Houston",
    startsAt: t("2026-06-17T17:00:00Z"),
  },
  {
    matchday: 1,
    groupLetter: "L",
    home: "Colombia",
    away: "Uzbekistan",
    venue: "Estadio Banorte, Mexico City",
    startsAt: t("2026-06-18T02:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "L",
    home: "Portugal",
    away: "Uzbekistan",
    venue: "NRG Stadium, Houston",
    startsAt: t("2026-06-23T17:00:00Z"),
  },
  {
    matchday: 2,
    groupLetter: "L",
    home: "Colombia",
    away: "DR Congo",
    venue: "Estadio Akron, Guadalajara",
    startsAt: t("2026-06-24T02:00:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "L",
    home: "Colombia",
    away: "Portugal",
    venue: "Hard Rock Stadium, Miami",
    startsAt: t("2026-06-27T23:30:00Z"),
  },
  {
    matchday: 3,
    groupLetter: "L",
    home: "Uzbekistan",
    away: "DR Congo",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-06-27T23:30:00Z"),
  },
];

type KnockoutMatch = {
  round: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
  venue: string;
  startsAt: Date;
};

const KNOCKOUT_MATCHES: KnockoutMatch[] = [
  // ── Round of 32 ──────────────────────────────────────────────────────────
  {
    round: "r32",
    homeTeamLabel: "2nd Group A",
    awayTeamLabel: "2nd Group B",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-06-28T19:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group G",
    awayTeamLabel: "Best 3rd (A/B/H/K/L)",
    venue: "Lumen Field, Seattle",
    startsAt: t("2026-06-29T00:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group C",
    awayTeamLabel: "2nd Group F",
    venue: "NRG Stadium, Houston",
    startsAt: t("2026-06-29T17:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group E",
    awayTeamLabel: "Best 3rd (A/B/C/D/F)",
    venue: "Gillette Stadium, Boston",
    startsAt: t("2026-06-29T20:30:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group F",
    awayTeamLabel: "2nd Group C",
    venue: "Estadio BBVA, Monterrey",
    startsAt: t("2026-06-30T01:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "2nd Group E",
    awayTeamLabel: "2nd Group I",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-06-30T17:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group I",
    awayTeamLabel: "Best 3rd (C/D/F/G/H)",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-06-30T21:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group A",
    awayTeamLabel: "Best 3rd (C/E/F/H/I)",
    venue: "Estadio Banorte, Mexico City",
    startsAt: t("2026-07-01T01:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group L",
    awayTeamLabel: "Best 3rd (E/H/I/J/K)",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-07-01T16:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group D",
    awayTeamLabel: "Best 3rd (B/E/F/I/J)",
    venue: "Levi's Stadium, Santa Clara",
    startsAt: t("2026-07-02T00:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group H",
    awayTeamLabel: "2nd Group J",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-07-02T19:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "2nd Group K",
    awayTeamLabel: "2nd Group L",
    venue: "BMO Field, Toronto",
    startsAt: t("2026-07-02T23:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group B",
    awayTeamLabel: "Best 3rd (E/F/G/I/J)",
    venue: "BC Place, Vancouver",
    startsAt: t("2026-07-03T03:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "2nd Group D",
    awayTeamLabel: "2nd Group G",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-07-03T18:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group J",
    awayTeamLabel: "2nd Group H",
    venue: "Hard Rock Stadium, Miami",
    startsAt: t("2026-07-03T22:00:00Z"),
  },
  {
    round: "r32",
    homeTeamLabel: "1st Group K",
    awayTeamLabel: "Best 3rd (D/E/I/J/L)",
    venue: "GEHA Field, Kansas City",
    startsAt: t("2026-07-04T01:30:00Z"),
  },

  // ── Round of 16 ──────────────────────────────────────────────────────────
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "NRG Stadium, Houston",
    startsAt: t("2026-07-04T17:00:00Z"),
  },
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "Lincoln Financial Field, Philadelphia",
    startsAt: t("2026-07-04T21:00:00Z"),
  },
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-07-05T20:00:00Z"),
  },
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "Estadio Banorte, Mexico City",
    startsAt: t("2026-07-06T00:00:00Z"),
  },
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-07-06T19:00:00Z"),
  },
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "Lumen Field, Seattle",
    startsAt: t("2026-07-07T00:00:00Z"),
  },
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-07-07T16:00:00Z"),
  },
  {
    round: "r16",
    homeTeamLabel: "R32 Winner",
    awayTeamLabel: "R32 Winner",
    venue: "BC Place, Vancouver",
    startsAt: t("2026-07-07T20:00:00Z"),
  },

  // ── Quarterfinals ─────────────────────────────────────────────────────────
  {
    round: "qf",
    homeTeamLabel: "R16 Winner",
    awayTeamLabel: "R16 Winner",
    venue: "Gillette Stadium, Boston",
    startsAt: t("2026-07-09T20:00:00Z"),
  },
  {
    round: "qf",
    homeTeamLabel: "R16 Winner",
    awayTeamLabel: "R16 Winner",
    venue: "SoFi Stadium, Los Angeles",
    startsAt: t("2026-07-10T19:00:00Z"),
  },
  {
    round: "qf",
    homeTeamLabel: "R16 Winner",
    awayTeamLabel: "R16 Winner",
    venue: "Hard Rock Stadium, Miami",
    startsAt: t("2026-07-11T21:00:00Z"),
  },
  {
    round: "qf",
    homeTeamLabel: "R16 Winner",
    awayTeamLabel: "R16 Winner",
    venue: "GEHA Field, Kansas City",
    startsAt: t("2026-07-12T01:00:00Z"),
  },

  // ── Semifinals ────────────────────────────────────────────────────────────
  {
    round: "sf",
    homeTeamLabel: "QF Winner",
    awayTeamLabel: "QF Winner",
    venue: "AT&T Stadium, Dallas",
    startsAt: t("2026-07-14T19:00:00Z"),
  },
  {
    round: "sf",
    homeTeamLabel: "QF Winner",
    awayTeamLabel: "QF Winner",
    venue: "Mercedes-Benz Stadium, Atlanta",
    startsAt: t("2026-07-15T19:00:00Z"),
  },

  // ── Third-Place Match ─────────────────────────────────────────────────────
  {
    round: "third_place",
    homeTeamLabel: "SF Loser",
    awayTeamLabel: "SF Loser",
    venue: "Hard Rock Stadium, Miami",
    startsAt: t("2026-07-18T21:00:00Z"),
  },

  // ── Final ─────────────────────────────────────────────────────────────────
  {
    round: "final",
    homeTeamLabel: "SF Winner",
    awayTeamLabel: "SF Winner",
    venue: "MetLife Stadium, New Jersey",
    startsAt: t("2026-07-19T19:00:00Z"),
  },
];

export async function seed(db: DB) {
  // Wipe all data in FK-safe order
  await db.delete(osrsTeamPicks);
  await db.delete(osrsPlayers);
  await db.delete(osrsTeams);
  await db.delete(picks);
  await db.delete(matchResults);
  await db.delete(matches);
  await db.delete(teams);

  // 1. Insert teams
  const insertedTeams = await db.insert(teams).values(TEAM_DATA).returning();
  const teamByName = new Map(insertedTeams.map((t) => [t.name, t]));

  const tid = (name: string): string => {
    const team = teamByName.get(name);
    if (!team) throw new Error(`Team not found: ${name}`);
    return team.id;
  };

  // 2. Insert group stage matches
  const groupMatchValues = GROUP_MATCHES.map((m) => ({
    round: "group" as const,
    matchday: m.matchday,
    groupLetter: m.groupLetter,
    homeTeamId: tid(m.home),
    awayTeamId: tid(m.away),
    homeTeamLabel: m.home,
    awayTeamLabel: m.away,
    venue: m.venue,
    startsAt: m.startsAt,
  }));

  // 3. Insert knockout matches (team IDs null until group results come in)
  const knockoutMatchValues = KNOCKOUT_MATCHES.map((m) => ({
    round: m.round,
    matchday: null,
    groupLetter: null,
    homeTeamId: null,
    awayTeamId: null,
    homeTeamLabel: m.homeTeamLabel,
    awayTeamLabel: m.awayTeamLabel,
    venue: m.venue,
    startsAt: m.startsAt,
  }));

  await db.insert(matches).values([...groupMatchValues, ...knockoutMatchValues]);

  // 4. Insert OSRS teams and players
  const OSRS_TEAM_DATA = [
    {
      name: "DINO",
      color: "#2c2c3e",
      players: [
        { name: "DINO", isCaptain: true },
        { name: "BOATY", isCaptain: false },
        { name: "61M", isCaptain: false },
        { name: "SICK NERD", isCaptain: false },
        { name: "MMORPG", isCaptain: false },
      ],
    },
    {
      name: "WESTHAM",
      color: "#2d7a2d",
      players: [
        { name: "WESTHAM", isCaptain: true },
        { name: "GREG", isCaptain: false },
        { name: "MIKA", isCaptain: false },
        { name: "ELIOP14", isCaptain: false },
        { name: "FAUX", isCaptain: false },
      ],
    },
    {
      name: "FRAMED",
      color: "#c85c78",
      players: [
        { name: "FRAMED", isCaptain: true },
        { name: "LAKE", isCaptain: false },
        { name: "PIP", isCaptain: false },
        { name: "SYNQ", isCaptain: false },
        { name: "ALFIE", isCaptain: false },
      ],
    },
    {
      name: "RHYS",
      color: "#4a90c4",
      players: [
        { name: "RHYS", isCaptain: true },
        { name: "TORVESTA", isCaptain: false },
        { name: "MUTS", isCaptain: false },
        { name: "V THE VICTIM", isCaptain: false },
        { name: "C ENGINEER", isCaptain: false },
      ],
    },
    {
      name: "PURPP",
      color: "#7c4dbb",
      players: [
        { name: "PURPP", isCaptain: true },
        { name: "SKIDDLER", isCaptain: false },
        { name: "SKILL SPECS", isCaptain: false },
        { name: "COXIE", isCaptain: false },
        { name: "MR MAMMAL", isCaptain: false },
      ],
    },
    {
      name: "ODABLOCK",
      color: "#c9a227",
      players: [
        { name: "ODABLOCK", isCaptain: true },
        { name: "DUBIEDOBIES", isCaptain: false },
        { name: "GNOMONKEY", isCaptain: false },
        { name: "RAIKESY", isCaptain: false },
        { name: "EVSCAPE", isCaptain: false },
      ],
    },
  ];

  for (const teamData of OSRS_TEAM_DATA) {
    const [insertedTeam] = await db
      .insert(osrsTeams)
      .values({ name: teamData.name, color: teamData.color })
      .returning();
    if (!insertedTeam) throw new Error(`Failed to insert OSRS team: ${teamData.name}`);
    await db.insert(osrsPlayers).values(
      teamData.players.map((p) => ({
        teamId: insertedTeam.id,
        name: p.name,
        isCaptain: p.isCaptain,
      })),
    );
  }
}

/* c8 ignore next 5 */
if (import.meta.main) {
  const { db } = await import("./client");
  await seed(db);
  console.log("Seeded 48 teams, 104 matches, and 6 OSRS teams with players");
  process.exit(0);
}
