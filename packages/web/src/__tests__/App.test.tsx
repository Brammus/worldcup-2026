import { describe, expect, it } from "bun:test";
import { App } from "../App";
import { render } from "./test-utils";

describe("App", () => {
  it("renders the login page at /login", () => {
    const { container } = render(<App initialPath="/login" />);
    expect(container.querySelector("h1")?.textContent).toBe("Sign in");
  });

  it("renders the register page at /register", () => {
    const { container } = render(<App initialPath="/register" />);
    expect(container.querySelector("h1")?.textContent).toBe("Create account");
  });
});
