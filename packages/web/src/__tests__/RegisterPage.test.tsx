import { describe, expect, it } from "bun:test";
import { App } from "../App";
import { render } from "./test-utils";

describe("RegisterPage", () => {
  it("renders username, password and confirm password inputs", () => {
    const { container } = render(<App initialPath="/register" />);
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.querySelector('input[name="confirmPassword"]')).not.toBeNull();
  });

  it("renders a link to the login page", () => {
    const { container } = render(<App initialPath="/register" />);
    const link = container.querySelector('a[href="/login"]');
    expect(link).not.toBeNull();
  });
});
