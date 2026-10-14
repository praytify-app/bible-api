import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/lib/theme";
import { Gallery } from "./Gallery";

// Screenshots force a theme through the URL; set it before the provider reads storage.
const forced = new URLSearchParams(location.search).get("theme");
if (forced === "light" || forced === "dark") {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, forced);
  } catch {
    document.documentElement.setAttribute("data-theme", forced);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <Gallery
        open={new URLSearchParams(location.search).get("open")}
        focus={new URLSearchParams(location.search).get("focus")}
      />
    </ThemeProvider>
  </StrictMode>,
);
