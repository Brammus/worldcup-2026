export const MeQuery = `
  query Me {
    me {
      id
      username
    }
  }
`;

export const LoginMutation = `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      user {
        id
        username
      }
    }
  }
`;

export const RegisterMutation = `
  mutation Register($username: String!, $password: String!) {
    register(username: $username, password: $password) {
      user {
        id
        username
      }
    }
  }
`;

export const LogoutMutation = `
  mutation Logout {
    logout
  }
`;

export const MatchesQuery = `
  query Matches($round: String, $group: String) {
    matches(round: $round, group: $group) {
      id
      round
      matchday
      group
      homeTeamLabel
      awayTeamLabel
      homeTeam { id name group }
      awayTeam { id name group }
      startsAt
      isLocked
      myPick { pickedTeamId }
    }
  }
`;

export const SetPickMutation = `
  mutation SetPick($matchId: ID!, $teamId: ID!) {
    setPick(matchId: $matchId, teamId: $teamId) {
      id
      matchId
      pickedTeamId
    }
  }
`;
