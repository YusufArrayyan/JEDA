import "@fontsource-variable/inter";
import "./styles/app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { AppProvider } from "./lib/app";

// Data router diperlukan agar peringatan "isian belum disimpan" (useBlocker) bekerja.
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <AppProvider>
        <App />
      </AppProvider>
    ),
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
