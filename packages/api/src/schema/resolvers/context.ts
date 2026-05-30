import type { DB } from "../../db/client";

export type CurrentUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export type GraphQLContext = {
  db: DB;
  currentUser: CurrentUser | null;
  responseHeaders: Headers;
  ip: string;
};
