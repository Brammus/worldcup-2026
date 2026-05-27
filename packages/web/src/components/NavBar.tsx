import { Link } from "wouter";

type Props = {
  currentUser: { username: string; isAdmin: boolean } | null;
};

export function NavBar({ currentUser }: Props) {
  return (
    <div className="navbar">
      <span className="navbar-brand">⚽ World Cup 2026</span>
      <nav className="navbar-links">
        <Link href="/">🏠 Home</Link>
        <Link href="/scoreboard">🏆 Scoreboard</Link>
        {currentUser?.isAdmin && <Link href="/admin">🛠 Admin</Link>}
        {currentUser && <span className="navbar-user">👤 {currentUser.username}</span>}
      </nav>
    </div>
  );
}
