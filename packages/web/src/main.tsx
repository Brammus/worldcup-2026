import "./styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "urql";
import { App } from "./App";
import { client } from "./client";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No #root element found");

createRoot(rootEl).render(
  <StrictMode>
    <Provider value={client}>
      <App />
    </Provider>
  </StrictMode>,
);
