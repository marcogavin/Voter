import { launch } from "../lib/browser.js";
const b = await launch();
let bad = 0;
for (const width of [320, 375, 430, 834]) {
  for (const signedIn of [false, true]) {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    // The page's own script reaches for Firebase, and whether that has failed
    // yet changes what is on screen. Refuse it up front so the measurement is
    // of one settled page rather than of whichever half arrived first.
    await p.route("**gstatic.com/**", (r) => r.abort());
    await p.goto("http://127.0.0.1:8765/host.html", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(400);
    await p.evaluate(async (inn) => {
      document.getElementById("deck-open-name").textContent =
        "Kickoff 2026 · 3 questions · last run 2 days ago";
      document.getElementById("view-setup").hidden = false;
      document.getElementById("account").textContent = inn ? "Signed in as marco.gavin@gmail.com" : "";
      document.getElementById("signin").hidden = inn;
      document.getElementById("signout").hidden = !inn;
      const { drawIcons } = await import("/js/icons.js");
      drawIcons(document);
    }, signedIn);
    const over = await p.evaluate(() => {
      const out = [];
      const panel = document.querySelector(".panel").getBoundingClientRect();
      document.querySelectorAll(".panel *").forEach((el) => {
        if (el.offsetParent === null) return;
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > panel.right + 1 || r.left < panel.left - 1)) {
          out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : "." + (el.className || "")} right=${r.right.toFixed(0)} panel=${panel.right.toFixed(0)}`);
        }
      });
      return { out, scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    const label = `${width}px ${signedIn ? "signed in " : "signed out"}`;
    if (over.out.length || over.scrolls) { bad++; console.log(`  ✗ ${label}: ${over.scrolls ? "page scrolls sideways; " : ""}${over.out.join(" | ")}`); }
    else console.log(`  ✓ ${label}: nothing escapes the panel`);
    await p.close();
  }
}
// The run screen in the language with the longest words, since that is where
// a label that no longer fits shows up first.
for (const width of [320, 390, 834]) {
  for (const lang of ["de", "pt", "es", "fr"]) {
  const p = await b.newPage({ viewport: { width, height: 900 } });
  await p.route("**gstatic.com/**", (r) => r.abort());
  await p.goto("http://127.0.0.1:8765/host.html", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(400);
  await p.evaluate(async (lang) => {
    document.getElementById("view-setup").hidden = true;
    document.getElementById("view-run").hidden = false;
    document.getElementById("tabs").hidden = false;
    document.getElementById("signed-out").hidden = true;
    document.getElementById("reopen").hidden = false;
    const { setLanguage, applyStaticText } = await import("/js/i18n.js");
    setLanguage(lang);
    applyStaticText();
    const { drawIcons } = await import("/js/icons.js");
    drawIcons(document);
  }, lang);
  const over = await p.evaluate(() => {
    const panel = document.querySelector(".panel").getBoundingClientRect();
    const out = [];
    document.querySelectorAll("#view-run *").forEach((el) => {
      if (el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > panel.right + 1 || r.left < panel.left - 1)) out.push(el.id || el.className);
    });
    return { out, scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  const label = `${width}px run screen, ${lang}`;
  if (over.out.length || over.scrolls) { bad++; console.log(`  ✗ ${label}: ${over.scrolls ? "scrolls sideways; " : ""}${over.out.join(" | ")}`); }
  else console.log(`  ✓ ${label}: every control fits`);
  await p.close();
  }
}

await b.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
