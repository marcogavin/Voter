// Day or night, chosen per browser.
//
// The night palette has always been there, following the device's own
// setting. This lets a person override it with one button, top right on each
// page, and remembers the choice in this browser alone — never on the event,
// because one person's dark room is not the next person's.
//
// The very first choice is made before the page paints, by a few lines inline
// at the top of each page, so a page set to night never flashes white. This
// module is everything after that: the button, the memory, and following the
// device for as long as nobody has chosen.

import { t } from "./i18n.js";
import { icons } from "./icons.js";

const KEY = "votr-theme";
const DEVICE = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

/** The browser bar's colour, for each palette — its --paper. */
const BAR = { light: "#ffffff", dark: "#101014" };

/** What this browser has chosen, or null while it follows the device. */
function chosen() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null; // storage refused — a private window, say: follow the device
  }
}

function device() {
  return DEVICE?.matches ? "dark" : "light";
}

/** The palette on screen right now. */
export function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", BAR[theme]);
  }
}

/**
 * Wires a button to switch between day and night. Returns a function that
 * redraws its icon and its name — call it whenever the language changes, so
 * the name follows the room like every other word on the page.
 */
export function wireTheme(button) {
  // The inline script has normally set this already; a page that lost it
  // still starts on the right palette.
  apply(chosen() ?? (document.documentElement.dataset.theme || device()));
  // A page from before the switch existed, served against this script: the
  // palette is right, and there is simply no button to draw.
  if (!button) return () => {};

  const draw = () => {
    const night = currentTheme() === "dark";
    // The button shows where it takes you, not where you are.
    button.innerHTML = night ? icons.sun : icons.moon;
    const name = night ? t("themeToDay") : t("themeToNight");
    button.setAttribute("aria-label", name);
    button.title = name;
    button.setAttribute("aria-pressed", String(night));
  };

  button.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, but still switched for as long as the page is open.
    }
    apply(next);
    draw();
  });

  // Until somebody chooses, the page keeps following the device — the phone
  // that goes dark at sunset takes the page with it.
  DEVICE?.addEventListener?.("change", () => {
    if (chosen()) return;
    apply(device());
    draw();
  });

  draw();
  return draw;
}
