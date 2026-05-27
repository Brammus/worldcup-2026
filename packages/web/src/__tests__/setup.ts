import { Window } from "happy-dom";

const happyWindow = new Window({ url: "http://localhost/" });

// Expose DOM globals so components can use document, window, etc.
Object.assign(globalThis, {
  document: happyWindow.document,
  window: happyWindow,
  navigator: happyWindow.navigator,
  location: happyWindow.location,
  history: happyWindow.history,
  HTMLElement: happyWindow.HTMLElement,
  Element: happyWindow.Element,
  Node: happyWindow.Node,
  Event: happyWindow.Event,
  CustomEvent: happyWindow.CustomEvent,
});
