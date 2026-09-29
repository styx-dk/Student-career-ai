import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export function initializeTheme() {
  let preference: string | null = null;
  try { preference = localStorage.getItem("career-theme"); } catch { /* Storage may be disabled. */ }
  const dark = preference ? preference === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === "dark");
  return <button className="secondary theme-toggle" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => {
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("career-theme", theme); } catch { /* Still apply for this visit. */ }
    setDark(!dark);
  }}>{dark ? <Sun size={17} /> : <Moon size={17} />}<span>{dark ? "Light" : "Dark"}</span></button>;
}
