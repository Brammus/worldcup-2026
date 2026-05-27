# Slice 02 — Auth

## Goal

Users can register and log in with a username and password. Session persists via a JWT in an httpOnly cookie. A `me` query tells the frontend who is logged in.

## API

```graphql
type Mutation {
  register(username: String!, password: String!): AuthResult!
  login(username: String!, password: String!): AuthResult!
  logout: Boolean!
}

type Query {
  me: User
}

type AuthResult {
  user: User!
}

type User {
  id: ID!
  username: String!
}
```

**Implementation notes:**
- Password hashed with `bcrypt` (cost factor 12)
- On `login`/`register`: sign a JWT (`userId` payload), set as `Set-Cookie: token=...; HttpOnly; SameSite=Strict; Path=/`
- `GraphQLContext` gets a `currentUser: User | null` populated from the cookie on each request
- `logout`: clear the cookie

## UI — two pages

### `/login`
- Username + password fields, submit button
- Link to `/register`
- On success → redirect to `/`

### `/register`
- Username + password + confirm password fields
- Link to `/login`
- On success → redirect to `/`

### Auth guard
- Unauthenticated users hitting any protected page are redirected to `/login`
- No library needed — a simple wrapper component checking `me` query result

## Tests to write (TDD order)

**API:**
1. `register` creates a user and returns it
2. `register` with duplicate username returns a clear error
3. `login` with correct credentials returns the user and sets a cookie
4. `login` with wrong password returns an error
5. `me` returns `null` when no cookie present
6. `me` returns the user when a valid cookie is present
7. `logout` clears the cookie

**UI:**
1. Login form renders username and password fields
2. Submitting login form calls the `login` mutation
3. Register form shows validation error when passwords don't match
4. Unauthenticated user is redirected from a protected route to `/login`
