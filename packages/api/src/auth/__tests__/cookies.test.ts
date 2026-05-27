import { describe, expect, it } from "bun:test";
import { buildAuthCookie, clearAuthCookie, parseCookies } from "../cookies";

describe("parseCookies", () => {
  it("parses a single cookie", () => {
    const map = parseCookies("token=abc123");
    expect(map.get("token")).toBe("abc123");
  });

  it("parses multiple cookies", () => {
    const map = parseCookies("token=abc; session=xyz; other=val");
    expect(map.get("token")).toBe("abc");
    expect(map.get("session")).toBe("xyz");
    expect(map.get("other")).toBe("val");
  });

  it("skips parts with no = sign", () => {
    const map = parseCookies("noequalssign; token=abc");
    expect(map.has("noequalssign")).toBe(false);
    expect(map.get("token")).toBe("abc");
  });

  it("trims whitespace around names and values", () => {
    const map = parseCookies("  token = abc ");
    expect(map.get("token")).toBe("abc");
  });

  it("returns empty map for empty string", () => {
    const map = parseCookies("");
    expect(map.size).toBe(0);
  });
});

describe("buildAuthCookie", () => {
  it("includes the token value", () => {
    expect(buildAuthCookie("mytoken")).toContain("token=mytoken");
  });

  it("sets HttpOnly and SameSite=Strict", () => {
    const cookie = buildAuthCookie("x");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  });
});

describe("clearAuthCookie", () => {
  it("sets Max-Age=0 to expire the cookie", () => {
    expect(clearAuthCookie()).toContain("Max-Age=0");
  });
});
