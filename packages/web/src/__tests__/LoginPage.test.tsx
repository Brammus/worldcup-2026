import { describe, expect, it } from "bun:test";
import { flushSync } from "react-dom";
import { App } from "../App";
import { render, renderWithMocks } from "./test-utils";

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

  it("shows error banner when login mutation returns a GraphQL error", async () => {
    const { container } = await renderWithMocks(<App initialPath="/login" />, {
      Login: { __errors: [{ message: "Invalid credentials" }] },
    });
    const form = container.querySelector("form") as HTMLFormElement;
    (form.elements.namedItem("username") as HTMLInputElement).value = "alice";
    (form.elements.namedItem("password") as HTMLInputElement).value = "wrong";
    flushSync(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 10));
    flushSync(() => {});
    expect(container.querySelector(".error-banner")?.textContent).toBe("Invalid credentials");
  });

  it("disables the submit button while loading", async () => {
    const { container } = await renderWithMocks(<App initialPath="/login" />, {});
    const form = container.querySelector("form") as HTMLFormElement;
    (form.elements.namedItem("username") as HTMLInputElement).value = "alice";
    (form.elements.namedItem("password") as HTMLInputElement).value = "pass";
    flushSync(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const btn = container.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
