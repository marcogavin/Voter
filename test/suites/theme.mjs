// Day and night, in a real browser.
//
// The phone and the host follow the device, as they always have. The big
// screen alone has a switch — what suits it depends on the room, not on the
// laptop plugged into it — remembered in that browser. What matters is what a
// person sees: the right palette from the very first paint, the wall's button
// where whoever sets the room up would look for it, a choice that survives a
// reload, and the host's page never picking up a choice made on the wall in
// the same browser.
import { readFileSync } from "node:fs";
import { launch, SITE } from "../lib/browser.js";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };

// Each page's ground, read from the stylesheet rather than written down
// twice: the host paints the page colour; the phone and the wall the paper.
const css = readFileSync("../../css/style.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const NIGHT = ':root[data-theme="dark"] {';
const token = (block, name) => block.match(new RegExp(`${name}:\\s*([^;]+);`))[1].trim();
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const palette = (name) => ({
  light: rgb(token(css.slice(css.indexOf(":root {"), css.indexOf(NIGHT)), name)),
  dark: rgb(token(css.slice(css.indexOf(NIGHT)), name)),
});

const EVENT = {
  lang: "en", ownerUid: "me", currentDeck: "d000", currentIndex: -1, revealed: false, blanked: false,
  askedAt: 0, pausedAt: null, seconds: 30, likes: 0, seen: {}, players: { me: "Ana" },
  decks: [{ id: "d000", title: "Offsite", count: 1 }],
  questions: [{ id: "q000", kind: "question", text: "Tea or coffee?", body: "", correct: null, voters: {},
    options: [{ id: "a", label: "Tea", votes: 0 }, { id: "b", label: "Coffee", votes: 0 }] }],
};

const b = await launch();
const open = async (file, { viewport, scheme, stored = null, lang = "en" }) => {
  const context = await b.newContext({ viewport, colorScheme: scheme });
  if (stored) await context.addInitScript((v) => { try { localStorage.setItem("votr-theme", v); } catch {} }, stored);
  const p = await context.newPage();
  await p.addInitScript((e) => { window.PREVIEW = e; try { localStorage.setItem("votr-tour-seen", "1"); } catch {} }, { ...EVENT, lang });
  await p.goto(`${SITE}/${file}`, { waitUntil: "networkidle" });
  return { context, p };
};
const look = (p) => p.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  bg: getComputedStyle(document.body).backgroundColor,
  button: Boolean(document.getElementById("theme")),
}));

/* ── the phone and the host: the device, and nothing else ──────────────── */
for (const [name, file, viewport, ground] of [
  ["the phone", "index.html", { width: 390, height: 844 }, "--paper"],
  ["the host", "host.html", { width: 1100, height: 800 }, "--bg"],
]) {
  console.log(name);
  const BG = palette(ground);
  for (const scheme of ["light", "dark"]) {
    const { context, p } = await open(file, { viewport, scheme });
    const m = await look(p);
    ok(`a device set to ${scheme}: the page is ${scheme}`, m.theme === scheme && m.bg === BG[scheme]);
    ok("  with no switch of its own", !m.button);
    await context.close();
  }

  const { context, p } = await open(file, { viewport, scheme: "light" });
  await p.emulateMedia({ colorScheme: "dark" });
  await p.waitForTimeout(150);
  ok("follows the device as it goes dark", (await look(p)).theme === "dark");
  await context.close();

  // The presenter's laptop often drives the projector too: the big screen's
  // night must not turn the host's own page dark in the same browser.
  const shared = await open(file, { viewport, scheme: "light", stored: "dark" });
  ok("ignores a night chosen on the big screen in the same browser", (await look(shared.p)).theme === "light");
  await shared.context.close();

  // …from the very first paint, not only once its scripts have caught up: a
  // flash of night on the presenter's own page is the same mistake, briefly.
  const first = await b.newContext({ viewport, colorScheme: "light" });
  await first.addInitScript(() => { try { localStorage.setItem("votr-theme", "dark"); } catch {} });
  const fp = await first.newPage();
  await fp.goto(`${SITE}/${file}`, { waitUntil: "commit" });
  ok("  from the very first paint", await fp.evaluate(() => document.documentElement.dataset.theme) === "light");
  await first.close();
}

/* ── the big screen: a switch of its own ───────────────────────────────── */
console.log("the big screen");
const WALL = palette("--paper");
const viewport = { width: 1280, height: 720 };
for (const scheme of ["light", "dark"]) {
  const other = scheme === "light" ? "dark" : "light";
  const { context, p } = await open("screen.html", { viewport, scheme });
  const read = () => p.evaluate(() => {
    const button = document.getElementById("theme");
    const r = button.getBoundingClientRect();
    return {
      theme: document.documentElement.dataset.theme,
      bg: getComputedStyle(document.body).backgroundColor,
      label: button.getAttribute("aria-label"),
      rect: { left: r.left, right: r.right, top: r.top, width: r.width },
      width: document.documentElement.clientWidth,
      opacity: getComputedStyle(button).opacity,
      stored: (() => { try { return localStorage.getItem("votr-theme"); } catch { return "?"; } })(),
    };
  });

  let m = await read();
  ok(`a device set to ${scheme}: the wall starts ${scheme}`, m.theme === scheme && m.bg === WALL[scheme]);
  ok("  with nothing chosen yet", m.stored === null);
  ok(`  and a switch offering ${other}`, m.label === (other === "dark" ? "Switch to night mode" : "Switch to day mode"));
  ok(`  at the top right, wholly on screen (${m.rect.left.toFixed(0)}–${m.rect.right.toFixed(0)} of ${m.width})`,
     m.rect.right <= m.width + 0.5 && m.rect.left >= m.width * 0.8 && m.rect.top < 100 && m.rect.width >= 40);
  await p.mouse.move(viewport.width - 40, 40);
  await p.waitForTimeout(400);
  ok("  showing while the mouse moves", (await read()).opacity === "1");

  await p.click("#theme");
  await p.waitForTimeout(150);
  m = await read();
  ok(`  pressed: ${other}`, m.theme === other && m.bg === WALL[other]);
  ok("  remembered on this screen", m.stored === other);
  ok("  and the switch now offers the way back", m.label === (scheme === "dark" ? "Switch to night mode" : "Switch to day mode"));

  await p.reload({ waitUntil: "networkidle" });
  ok(`  still ${other} after a reload, though the device says ${scheme}`, (await read()).theme === other);

  await p.emulateMedia({ colorScheme: other === "dark" ? "light" : "dark" });
  await p.waitForTimeout(150);
  ok("  and when the device changes", (await read()).theme === other);
  await context.close();
}

{
  const { context, p } = await open("screen.html", { viewport, scheme: "light" });
  await p.emulateMedia({ colorScheme: "dark" });
  await p.waitForTimeout(150);
  ok("with nothing chosen, it follows the device going dark", (await look(p)).theme === "dark");
  await context.close();
}

{
  const { context, p } = await open("screen.html", { viewport, scheme: "light", lang: "pt" });
  ok("the switch's name follows the event's language",
     await p.getAttribute("#theme", "aria-label") === "Mudar para o modo noturno");
  await context.close();
}

{
  // The inline script runs before anything is drawn: a wall set to night must
  // never be shown white first.
  const context = await b.newContext({ viewport, colorScheme: "light" });
  await context.addInitScript(() => { try { localStorage.setItem("votr-theme", "dark"); } catch {} });
  const p = await context.newPage();
  await p.goto(`${SITE}/screen.html`, { waitUntil: "commit" });
  ok("night is set as soon as the wall exists, before its scripts load",
     await p.evaluate(() => document.documentElement.dataset.theme) === "dark");
  await context.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
