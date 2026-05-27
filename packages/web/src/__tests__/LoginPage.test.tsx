import { describe, expect, it } from "bun:test";
import { App } from "../App";
import { render } from "./test-utils";

describe("LoginPage", () => {
  it("renders username and password inputs", () => {
    const { container } = render(<App initialPath="/login" />);
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
  });

  it("renders a link to the register page", () => {
    const { container } = render(<App initialPath="/login" />);
    const link = container.querySelector('a[href="/register"]');
    expect(link).not.toBeNull();
  });
});
