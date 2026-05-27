import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQuery } from "urql";
import { useLocation } from "wouter";
import { MeQuery } from "../graphql/operations";

export function AuthGuard({ children }: { children: ReactNode }) {
  const [result] = useQuery({ query: MeQuery });
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!result.fetching && !result.data?.me) {
      navigate("/login");
    }
  }, [result.fetching, result.data?.me, navigate]);

  if (result.fetching) return <div className="loading">Loading…</div>;
  if (!result.data?.me) return null;

  return <>{children}</>;
}
