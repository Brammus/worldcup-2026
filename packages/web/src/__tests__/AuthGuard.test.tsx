import { describe, expect, it } from "bun:test";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthGuard } from "../components/AuthGuard";
import { renderWithMocks } from "./test-utils";

function withRouter(ui: React.ReactElement) {
  const { hook } = memoryLocation({ path: "/" });
  return <Router hook={hook}>{ui}</Router>;
}

const child = <p>Protected content</p>;

describe("AuthGuard", () => {
  it("renders children when user is authenticated", async () => {
    const { container } = await renderWithMocks(withRouter(<AuthGuard>{child}</AuthGuard>), {
      Me: { me: { id: "1", username: "alice" } },
    });
    expect(container.textContent).toContain("Protected content");
  });

  it("renders nothing when unauthenticated", async () => {
    const { container } = await renderWithMocks(withRouter(<AuthGuard>{child}</AuthGuard>), {
      Me: { me: null },
    });
    expect(container.querySelector("p")).toBeNull();
  });
});
