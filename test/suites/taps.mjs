// Two quick taps on the heart must not be read as "zoom in on this", and the
// palette the script names has to exist in the stylesheet.
import { launch } from "../lib/browser.js";
import { readFileSync } from "node:fs";

const b = await launch();
const p = await b.newPage({ viewport: { width: 430, height: 900 } });
await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(200);

let bad = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) bad++; };

const seen = await p.evaluate(async () => {
  const { icons } = await import("/js/icons.js");
  const { flyHearts, heartColour } = await import("/js/hearts.js");
  document.getElementById("options").innerHTML =
    `<div class="ending"><div class="heart-stage">` +
    `<button type="button" class="heart" id="like">${icons.heart}</button>` +
    `</div><p class="ending-count">3</p></div>`;
  const heart = document.getElementById("like");
  const stage = document.querySelector(".heart-stage");
  flyHearts(stage, 5);                       // a burst from the room
  flyHearts(stage, 1, heartColour("abc123")); // and one of your own
  const style = (el, prop) => getComputedStyle(el).getPropertyValue(prop);
  const flown = [...document.querySelectorAll(".heart-fly")];
  return {
    heartTouch: style(heart, "touch-action"),
    btnTouch: style(document.createElement("button") && heart, "touch-action"),
    callout: style(heart, "-webkit-touch-callout"),
    select: style(heart, "user-select"),
    count: flown.length,
    colours: flown.map((h) => style(h, "color")),
    delays: flown.map((h) => style(h, "animation-delay")),
    tokens: Array.from({ length: 8 }, (_, i) =>
      getComputedStyle(document.documentElement).getPropertyValue(`--heart-${i + 1}`).trim()),
  };
});

ok("double-tap zoom is off on the heart", seen.heartTouch === "manipulation");
// -webkit-touch-callout is Safari's alone, so the test browser reports
// nothing for it — read the rule instead of the computed value.
const heartRule = readFileSync("../../css/style.css", "utf8").match(/\.heart \{[\s\S]*?\}/)[0];
ok("the hold-to-select callout is off", /-webkit-touch-callout:\s*none/.test(heartRule));
ok("and it can't be text-selected", seen.select === "none");
ok("six hearts in the air", seen.count === 6);
ok("all eight palette tokens exist", seen.tokens.every((t) => /^#[0-9a-f]{6}$/i.test(t)));
ok("every heart resolved to a real colour", seen.colours.every((c) => /^rgb\(/.test(c)));
ok("the burst is staggered, not simultaneous", new Set(seen.delays).size > 1);
ok("more than one colour in a burst from the room", new Set(seen.colours.slice(0, 5)).size > 1);

await p.locator(".ending").screenshot({ path: "../shots/hearts.png" }).catch(() => {});
await b.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
