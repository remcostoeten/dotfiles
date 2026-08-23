// main.tsx — Vite React entry point.
//
// If your app already has a src/main.tsx, you don't need this file verbatim;
// just render <AuthDemo /> wherever your app mounts. This is the minimal entry
// that boots the demo on its own.

import React from "react";
import ReactDOM from "react-dom/client";
import AuthDemo from "./AuthDemo";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthDemo />
  </React.StrictMode>
);
