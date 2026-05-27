import { useState } from "react";
import { useMutation } from "urql";
import { Link, useLocation } from "wouter";
import { LoginMutation } from "../graphql/operations";

export function LoginPage() {
  const [, navigate] = useLocation();
  const [, login] = useMutation(LoginMutation);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    setError("");
    setLoading(true);
    const result = await login({ username, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? "Something went wrong");
      return;
    }

    navigate("/");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="subtitle">World Cup 2026 Predictor</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" type="text" autoComplete="username" required />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          No account? <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
