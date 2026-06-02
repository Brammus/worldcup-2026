import { Link } from "wouter";

type Props = {
  currentUser: { username: string; isAdmin: boolean } | null;
};

export function NavBar({ currentUser }: Props) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          ⚽ <span>World Cup 2026</span>
        </Link>
        <nav className="navbar-links">
          <Link href="/" className="navbar-link">
            Home
          </Link>
          <Link href="/scoreboard" className="navbar-link">
            🏆 Scoreboard
          </Link>
          <Link href="/osrs" className="navbar-link">
            🎮 OSRS
          </Link>
          {currentUser?.isAdmin && (
            <Link href="/admin" className="navbar-link">
              🛠 Admin
            </Link>
          )}
          {currentUser && (
            <span className="navbar-user">
              <span className="navbar-avatar">{currentUser.username[0]?.toUpperCase()}</span>
              {currentUser.username}
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
