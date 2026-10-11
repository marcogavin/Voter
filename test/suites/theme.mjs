// Day and night, in a real browser, on all three pages.
//
// The night palette used to follow the device and nothing else. Now a button
// at the top right of each page overrides it, per browser. What matters is
// what a person sees: the right palette from the very first paint, the button
// where they'd look for it and never pushed off the edge, a choice that
// survives a reload, and a page that keeps following the device for as long
// as nobody has chosen.
import { readFileSync } from "node:fs";
import { launch, SITE } from "../lib/browser.js";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };

// The two backgrounds, read from the stylesheet rather than written down
// twice — the same way the contrast suite reads its palette.
const css = readFileSync("../../css/style.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const NIGHT = ':root[data-theme="dark"] {';
const token = (block, name) => block.match(new RegExp(`${name}:\\s*([^;]+);`))[1].trim();
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
// Each page paints its own ground: the host the page colour, the phone and
// the wall the paper — the phone because on a phone nothing of the page shows
// around the panel, the wall because the wall is all panel.
const palette = (name) => ({
  light: rgb(token(css.slice(css.indexOf(":root {"), css.indexOf(NIGHT)), name)),
  dark: rgb(token(css.slice(css.indexOf(NIGHT)), name)),
});

const EVENT = {
  lang: "en", ownerUid: "me", currentDeck: "d000", currentIndex: -1, revealed: false, blanked: false,
  askedAt: 0, pausedAt: null, seconds: 30, likes: 0, seen: {},
  // The longest name allowed, on the phone: it must give way to the switch.
  players: { me: "Maximiliana Rodrigues-F" },
  decks: [{ id: "d000", title: "Offsite", count: 1 }],
  questions: [{ id: "q000", kind: "question", text: "Tea or coffee?", body: "", correct: null, voters: {},
    options: [{ id: "a", label: "Tea", votes: 0 }, { id: "b", label: "Coffee", votes: 0 }] }],
};

const PAGES = [
  ["the phone", "index.html", { width: 360, height: 740 }, "--paper"],
  ["the host", "host.html", { width: 390, height: 844 }, "--bg"],
  ["the host, on a laptop", "host.html", { width: 1100, height: 800 }, "--bg"],
  ["the wall", "screen.html", { width: 1280, height: 720 }, "--paper"],
];

const b = await launch();

for (const [name, file, viewport, ground] of PAGES) {
  console.log(name);
  const BG = palette(ground);
  for (const scheme of ["light", "dark"]) {
    const context = await b.newContext({ viewport, colorScheme: scheme });
    const p = await context.newPage();
    await p.addInitScript((e) => { window.PREVIEW = e; }, EVENT);
    await p.goto(`${SITE}/${file}`, { waitUntil: "networkidle" });
    const other = scheme === "light" ? "dark" : "light";

    const read = () => p.evaluate(() => {
      const button = document.getElementById("theme");
      const r = button.getBoundingClientRect();
      return {
        theme: document.documentElement.dataset.theme,
        bg: getComputedStyle(document.body).backgroundColor,
        label: button.getAttribute("aria-label"),
        rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width },
        viewport: document.documentElement.clientWidth,
        opacity: getComputedStyle(button).opacity,
        stored: (() => { try { return localStorage.getItem("votr-theme"); } catch { return "?"; } })(),
      };
    });

    let m = await read();
    ok(`a device set to ${scheme}: the page is ${scheme} from the start`, m.theme === scheme && m.bg === BG[scheme]);
    ok(`  with nothing chosen yet`, m.stored === null);
    ok(`  and a button offering ${other}`, m.label === (other === "dark" ? "Switch to night mode" : "Switch to day mode"));
    ok(`  at the top right, wholly on screen (${m.rect.left.toFixed(0)}–${m.rect.right.toFixed(0)} of ${m.viewport})`,
       m.rect.right <= m.viewport + 0.5 && m.rect.left >= m.viewport * 0.6 && m.rect.top < 140 && m.rect.width >= 40);

    if (file === "screen.html") {
      // For whoever sets the room up: it fades with the mouse.
      await p.mouse.move(viewport.width - 40, 40);
      await p.waitForTimeout(400);
      ok("  showing while the mouse moves", (await read()).opacity === "1");
    }

    if (file === "index.html") {
      const crowd = await p.evaluate(() => {
        const name = document.querySelector(".whoami").getBoundingClientRect();
        const button = document.getElementById("theme").getBoundingClientRect();
        const label = document.querySelector(".whoami-name");
        return { gap: button.left - name.right, shortened: label.scrollWidth > label.clientWidth };
      });
      ok(`  beside the longest name allowed, which gives way rather than touching it (gap ${crowd.gap.toFixed(0)}px)`, crowd.gap >= 0);
    }

    await p.click("#theme");
    await p.waitForTimeout(150);
    m = await read();
    ok(`  pressed: ${other}`, m.theme === other && m.bg === BG[other]);
    ok(`  remembered in this browser`, m.stored === other);
    ok(`  and the button now offers the way back`, m.label === (scheme === "dark" ? "Switch to night mode" : "Switch to day mode"));

    await p.reload({ waitUntil: "networkidle" });
    m = await read();
    ok(`  still ${other} after a reload, though the device says ${scheme}`, m.theme === other && m.bg === BG[other]);

    // A choice outlives the device changing its mind.
    await p.emulateMedia({ colorScheme: other === "dark" ? "light" : "dark" });
    await p.waitForTimeout(150);
    ok("  and when the device changes", (await read()).theme === other);
    await context.close();
  }

  // Nobody has chosen: the page follows the device as it changes.
  const context = await b.newContext({ viewport, colorScheme: "light" });
  const p = await context.newPage();
  await p.addInitScript((e) => { window.PREVIEW = e; }, EVENT);
  await p.goto(`${SITE}/${file}`, { waitUntil: "networkidle" });
  await p.emulateMedia({ colorScheme: "dark" });
  await p.waitForTimeout(150);
  ok("with nothing chosen, it follows the device going dark", await p.evaluate(() => document.documentElement.dataset.theme) === "dark");
  ok("  and the button follows it too",
     await p.getAttribute("#theme", "aria-label") === "Switch to day mode");
  await context.close();
}

console.log("in the room's language");
{
  const context = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  await p.addInitScript((e) => { window.PREVIEW = { ...e, lang: "pt" }; }, EVENT);
  await p.goto(`${SITE}/index.html`, { waitUntil: "networkidle" });
  ok("the button's name follows the event's language",
     await p.getAttribute("#theme", "aria-label") === "Mudar para o modo noturno");
  await context.close();
}

console.log("before the first paint");
{
  // The inline script runs before the stylesheet is applied to anything: a
  // page set to night must never be drawn white first.
  const context = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  await context.addInitScript(() => { try { localStorage.setItem("votr-theme", "dark"); } catch {} });
  const p = await context.newPage();
  let atFirstSight = null;
  p.on("domcontentloaded", async () => {});
  await p.goto(`${SITE}/index.html`, { waitUntil: "commit" });
  atFirstSight = await p.evaluate(() => document.documentElement.dataset.theme);
  ok("night is set as soon as the page exists, before its scripts load", atFirstSight === "dark");
  await context.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
