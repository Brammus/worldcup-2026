import { describe, expect, it } from "bun:test";
import { signToken, verifyToken } from "../jwt";

describe("signToken / verifyToken", () => {
  it("round-trips a user id", async () => {
    const userId = "user-123";
    const token = await signToken(userId);
    const result = await verifyToken(token);
    expect(result).toBe(userId);
  });

  it("returns null for a garbage token", async () => {
    const result = await verifyToken("not.a.valid.jwt");
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });
});
