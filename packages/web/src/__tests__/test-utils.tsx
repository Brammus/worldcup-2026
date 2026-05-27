import { createElement } from "react";
import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Provider, cacheExchange, createClient, fetchExchange } from "urql";

// Set up happy-dom globals when running outside of the web package's bunfig.toml context
// (e.g. `bun test` from the monorepo root)
if (typeof document === "undefined") {
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, {
    document: win.document,
    window: win,
    navigator: win.navigator,
    location: win.location,
    history: win.history,
    HTMLElement: win.HTMLElement,
    Element: win.Element,
    Node: win.Node,
    Event: win.Event,
    CustomEvent: win.CustomEvent,
  });
}

const testClient = createClient({
  url: "http://localhost:4000/graphql",
  exchanges: [cacheExchange, fetchExchange],
});

function Wrapper({ children }: { children: ReactElement }) {
  return createElement(Provider, { value: testClient }, children);
}

export function render(ui: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  flushSync(() => {
    createRoot(container).render(createElement(Wrapper, null, ui));
  });
  return { container };
}
