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
