import { describe, expect, it } from "bun:test";
import { App } from "../App";
import { render } from "./test-utils";

describe("App", () => {
  it("renders heading", () => {
    const { container } = render(<App />);
    expect(container.querySelector("h1")?.textContent).toBe("World Cup 2026");
  });
});
