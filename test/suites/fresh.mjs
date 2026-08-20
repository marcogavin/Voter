// Pull the inline checker out of host.html and run it against a fake page.
import { readFileSync } from "fs";
const html = readFileSync("../../host.html", "utf8");
const script = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];

let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✗", n)); };

async function run({ build, styled = "groups sections hint hearts choices clock pollsheet paper preview board bigscreen times cornerfoot tourmarks versionsheet", alreadyTried }) {
  const state = { fetched: [], reloaded: false, appended: [], store: {} };
  if (alreadyTried) state.store["votr-refetched"] = "1";
  let onLoad = null;

  const sandbox = {
    window: { VOTR_BUILD: build },
    addEventListener: (_, fn) => { onLoad = fn; },
    setTimeout: (fn) => fn(),
    sessionStorage: {
      getItem: (k) => state.store[k] ?? null,
      setItem: (k, v) => { state.store[k] = v; },
      removeItem: (k) => { delete state.store[k]; },
    },
    fetch: (f, o) => { state.fetched.push(`${f} ${o.cache}`); return Promise.resolve(); },
    location: { reload: () => { state.reloaded = true; } },
    getComputedStyle: () => ({ getPropertyValue: () => `"${styled}"` }),
    document: {
      documentElement: {},
      createElement: () => ({ set className(v) { this._c = v; }, get className() { return this._c; } }),
      body: { appendChild: (n) => state.appended.push(n) },
    },
  };
  const fn = new Function(...Object.keys(sandbox), script);
  fn(...Object.values(sandbox));
  onLoad();
  await new Promise((r) => setImmediate(r));
  return state;
}

console.log("current script, everything present");
let s = await run({ build: ["polls", "timer", "qr", "icons", "gate", "applause", "sheet", "pollpicker", "pause", "scores", "bigscreen", "speed", "signin", "presence", "tour", "version"] });
ok("no refetch", s.fetched.length === 0);
ok("no reload", !s.reloaded);
ok("no banner", s.appended.length === 0);

ok("the tried-flag is cleared for next time", !s.store["votr-refetched"]);

console.log("stale script (the bug you hit: no polls)");
s = await run({ build: ["timer", "qr", "icons", "gate", "sheet"] });
ok("refetches past the cache", s.fetched.every((f) => f.endsWith(" reload")));
// Counted from the page itself: a module added to the app and left out of
// FILES is exactly the file that would stay stale.
const listed = (script.match(/var FILES = \[([\s\S]*?)\];/)[1].match(/"[^"]+"/g) ?? []).length;
ok(`covers every module and the css (${listed})`, s.fetched.length === listed);
ok("then reloads", s.reloaded);
ok("no banner on the first try", s.appended.length === 0);
ok("remembers it tried", s.store["votr-refetched"] === "1");

console.log("script missing entirely (failed to load)");
s = await run({ build: undefined });
ok("still handled, no crash", s.reloaded);

console.log("still stale after the refetch");
s = await run({ build: ["timer", "qr", "icons", "gate", "sheet"], alreadyTried: true });
ok("does not reload again", !s.reloaded);
ok("says so instead", s.appended.length === 1 && s.appended[0].className === "stale");

/* the stylesheet can be the stale half on its own */
console.log("fresh script, stale stylesheet");
let t = await run({ build: ["polls", "timer", "qr", "icons", "gate", "applause", "sheet", "pollpicker", "pause", "scores", "bigscreen", "speed", "signin", "presence", "tour", "version"], styled: "" });
ok("caught by the same check", t.reloaded);
ok("refetches the css too", t.fetched.some((f) => f.startsWith("css/style.css")));

/* ── The contract itself ────────────────────────────────────────────────
   Every word a page NEEDS has to be declared somewhere — by its own script
   or by the stylesheet — or the page believes it is permanently stale and
   reloads once on every visit. And a word declared by a script that no page
   checks catches nothing.

   This is also the thing that is easy to forget: a change that ships without
   a new word is a change the freshness check cannot see, and a browser
   holding the old copy shows it as "nothing happened".                     */
{
  const read = (f) => readFileSync("../../" + f, "utf8");
  const listed = (text, re) => (text.match(re)?.[1].match(/"[^"]+"/g) ?? [])
    .map((w) => w.slice(1, -1));

  const css = (read("css/style.css").match(/--build:\s*"([^"]*)"/)?.[1] ?? "")
    .split(/\s+/)
    .filter(Boolean);
  ok(`the stylesheet says what it is (${css.length} words)`, css.length > 0);

  for (const [page, script] of [
    ["index.html", "js/app.js"],
    ["host.html", "js/host.js"],
    ["screen.html", "js/screen.js"],
  ]) {
    const needs = listed(read(page), /var NEEDS = \[([\s\S]*?)\];/);
    const build = listed(read(script), /window\.VOTR_BUILD = \[?([\s\S]*?)\];/);

    const undeclared = needs.filter((w) => !build.includes(w) && !css.includes(w));
    ok(`${page}: all ${needs.length} words it needs are declared`, undeclared.length === 0);
    if (undeclared.length) console.log("      undeclared:", undeclared.join(", "));

    const unchecked = build.filter((w) => !needs.includes(w));
    ok(`${script}: nothing announced that its page doesn't check`, unchecked.length === 0);
    if (unchecked.length) console.log("      unchecked:", unchecked.join(", "));
  }
}

console.log(fail ? `\n${fail} FAILED` : `\nall ${pass} passed`);
process.exit(fail ? 1 : 0);
