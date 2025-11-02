import { render } from "@opentui/react";
import { App } from "./App";
import { SetupProvider } from "./context/SetupContext";
import { packages } from "./data/packages";

render(
  <SetupProvider packages={packages}>
    <App />
  </SetupProvider>
);
