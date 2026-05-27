export function parseCookies(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    map.set(part.slice(0, idx).trim(), part.slice(idx + 1).trim());
  }
  return map;
}

export function buildAuthCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`;
}

export function clearAuthCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
