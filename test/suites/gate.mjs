// What the host page shows before the script has decided anything — which is
// what a phone actually looks at for the first second or two, and forever if
// Firebase can't be reached.
import { launch } from "../lib/browser.js";

const b = await launch();
let bad = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (!cond) bad++; };

for (const [label, block] of [["with Firebase unreachable", true], ["at the moment of load", false]]) {
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  if (block) await p.route("**gstatic.com/**", (r) => r.abort());
  await p.goto("http://127.0.0.1:8765/host.html", { waitUntil: "domcontentloaded" });
  if (block) await p.waitForTimeout(1200);
  const seen = await p.evaluate(() => {
    const vis = (id) => {
      const el = document.getElementById(id);
      return Boolean(el && el.offsetParent !== null);
    };
    return {
      setup: vis("view-setup"), run: vis("view-run"), tabs: vis("tabs"),
      prompt: vis("signed-out"), signin: vis("signin"), account: vis("account"),
    };
  });
  console.log(label);
  ok("no Setup screen", !seen.setup);
  ok("no Run screen", !seen.run);
  ok("no tabs", !seen.tabs);
  ok("the sign-in prompt instead", seen.prompt);
  ok("and the Sign in button", seen.signin);
  await p.close();
}
await b.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
