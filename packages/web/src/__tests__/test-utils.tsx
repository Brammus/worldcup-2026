import type { OperationDefinitionNode } from "graphql";
import { createElement } from "react";
import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Provider, cacheExchange, createClient, fetchExchange, makeResult } from "urql";
import { map, pipe } from "wonka";

// Set up happy-dom globals when running outside of the web package's bunfig.toml context
// (e.g. `bun test` from the monorepo root)
/* c8 ignore start */
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
/* c8 ignore stop */

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

// ── Mock client for urql-dependent component tests ────────────────────────────

/** Each key is a GraphQL operation name.
 *  - Plain value → returned as `data`
 *  - `{ __errors: [{ message }] }` → returned as a GraphQL error result
 */
type MockValue = { __errors: Array<{ message: string }> } | unknown;
type Mocks = Record<string, MockValue>;

function isErrorMock(v: MockValue): v is { __errors: Array<{ message: string }> } {
  return typeof v === "object" && v !== null && "__errors" in v;
}

function createMockClient(mocks: Mocks) {
  return createClient({
    url: "/graphql",
    exchanges: [
      () => (ops$) =>
        pipe(
          ops$,
          map((op) => {
            const name = (op.query.definitions[0] as OperationDefinitionNode).name?.value ?? "";
            const mock = mocks[name];
            if (mock !== undefined && isErrorMock(mock)) {
              return makeResult(op, { errors: mock.__errors as never });
            }
            const data = mock !== undefined ? (mock as Record<string, unknown>) : {};
            return makeResult(op, { data });
          }),
        ),
    ],
  });
}

function MockWrapper({
  client,
  children,
}: {
  client: ReturnType<typeof createMockClient>;
  children?: ReactElement;
}) {
  return createElement(Provider, { value: client }, children);
}

export async function renderWithMocks(ui: ReactElement, mocks: Mocks = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const client = createMockClient(mocks);
  flushSync(() => {
    createRoot(container).render(createElement(MockWrapper, { client }, ui));
  });
  // Flush microtasks so urql state updates (query results) settle
  await Promise.resolve();
  flushSync(() => {});
  return { container };
}
