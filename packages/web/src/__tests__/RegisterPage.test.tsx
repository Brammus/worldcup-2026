import { describe, expect, it } from "bun:test";
import { flushSync } from "react-dom";
import { App } from "../App";
import { render, renderWithMocks } from "./test-utils";

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

  it("shows passwords-do-not-match error", async () => {
    const { container } = await renderWithMocks(<App initialPath="/register" />, {});
    const form = container.querySelector("form") as HTMLFormElement;
    (form.elements.namedItem("username") as HTMLInputElement).value = "alice";
    (form.elements.namedItem("password") as HTMLInputElement).value = "secret";
    (form.elements.namedItem("confirmPassword") as HTMLInputElement).value = "different";

    flushSync(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector(".error-banner")?.textContent).toBe("Passwords do not match");
  });

  it("shows error banner when register mutation returns a GraphQL error", async () => {
    const { container } = await renderWithMocks(<App initialPath="/register" />, {
      Register: { __errors: [{ message: "Username already taken" }] },
    });
    const form = container.querySelector("form") as HTMLFormElement;
    (form.elements.namedItem("username") as HTMLInputElement).value = "alice";
    (form.elements.namedItem("password") as HTMLInputElement).value = "secret";
    (form.elements.namedItem("confirmPassword") as HTMLInputElement).value = "secret";
    flushSync(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await new Promise((r) => setTimeout(r, 10));
    flushSync(() => {});
    expect(container.querySelector(".error-banner")?.textContent).toBe("Username already taken");
  });

  it("disables submit button while loading", async () => {
    const { container } = await renderWithMocks(<App initialPath="/register" />, {});
    const form = container.querySelector("form") as HTMLFormElement;
    (form.elements.namedItem("username") as HTMLInputElement).value = "alice";
    (form.elements.namedItem("password") as HTMLInputElement).value = "secret";
    (form.elements.namedItem("confirmPassword") as HTMLInputElement).value = "secret";

    flushSync(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const btn = container.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
