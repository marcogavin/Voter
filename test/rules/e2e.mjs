// A host, an attendee in a separate browser profile, and the projector, all
// on the real pages against the real rules. See e2e.sh for the setup; this
// is the run itself.
//
// Every assertion here is on what a person would see: a button they could
// press, a heading they could read. The attendee's profile shares nothing
// with the host's — no cookies, no storage, no session — which is exactly
// what an incognito window, or anybody else's phone, is.

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp as initAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getDatabase as getAdminDatabase } from "firebase-admin/database";
import { launch } from "../lib/browser.js";

const PROJECT = "votr-rules-test";
const DB_PORT = 9110;
const DB_NS = `${PROJECT}-default-rtdb`;
const EVENT_PATH = "events/live";
const HOST_UID = "host-uid-1";
const SITE_PORT = 8768;
const ROOT = fileURLToPath(new URL("../build/e2e/", import.meta.url));
const SHOTS = fileURLToPath(new URL("../shots/", import.meta.url));

let failures = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (!cond) failures++; };

/* ── the site ───────────────────────────────────────────────────────────── */
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = join(ROOT, path.endsWith("/") ? path + "index.html" : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(SITE_PORT, "127.0.0.1", r));
const url = (page) => `http://127.0.0.1:${SITE_PORT}/${page}`;

/* ── the event, as a host would have left it ────────────────────────────── */
const adminApp = initAdminApp({ projectId: PROJECT, databaseURL: `http://127.0.0.1:${DB_PORT}/?ns=${DB_NS}` });
const adminDb = getAdminDatabase(adminApp);
await adminDb.ref(EVENT_PATH).set({
  ownerUid: HOST_UID,
  currentDeck: "d000",
  currentIndex: -1,
  revealed: false,
  blanked: false,
  seconds: 30,
  lang: "en",
  decks: {
    d000: {
      title: "Offsite",
      // No questionCount, on purpose: a poll saved before the count existed,
      // which is what every poll older than August is. The first step of the
      // run has to fill it in, or the phones never learn how long it is.
      questions: {
        q000: { text: "Capital of France?", correct: "b",
          options: { a: { label: "Berlin", votes: 0 }, b: { label: "Paris", votes: 0 }, c: { label: "Rome", votes: 0 }, d: { label: "Madrid", votes: 0 } } },
        q001: { text: "Tea or coffee?",
          options: { a: { label: "Tea", votes: 0 }, b: { label: "Coffee", votes: 0 }, c: { label: "Neither", votes: 0 } } },
        q002: { text: "How was the day?", ratingStars: 5, ratingColor: "gold",
          options: { a: { label: "1", votes: 0 }, b: { label: "2", votes: 0 }, c: { label: "3", votes: 0 }, d: { label: "4", votes: 0 }, e: { label: "5", votes: 0 } } },
      },
    },
  },
});
const token = await getAdminAuth(adminApp).createCustomToken(HOST_UID);

/* ── three browsers' worth of people ────────────────────────────────────── */
await mkdir(SHOTS, { recursive: true });
const browser = await launch();
const hostCtx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const wallCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });

const host = await hostCtx.newPage();
const phone = await phoneCtx.newPage();
const wall = await wallCtx.newPage();
for (const [name, page] of [["host", host], ["phone", phone], ["wall", wall]]) {
  page.on("pageerror", (e) => { console.log(`  ✗ ${name} threw: ${e.message}`); failures++; });
}

await host.addInitScript((t) => { window.VOTR_TOKEN = t; }, token);
await host.goto(url("host.html"));
await phone.goto(url("index.html"));
await wall.goto(url("screen.html"));

const visible = (page, selector) => page.locator(selector).first().isVisible();
const shot = (name) => phone.screenshot({ path: join(SHOTS, `e2e-${name}.png`) });
const tap = async (page, selector) => {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 8000 });
  await page.locator(selector).first().click();
};
/** Waits for a condition on the page, then reports it. */
const eventually = async (label, page, fn, arg) => {
  try { await page.waitForFunction(fn, arg, { timeout: 8000 }); ok(label, true); }
  catch { ok(label, false); }
};
const heading = (page, id) => page.locator(`#${id}`).textContent();

try {
  console.log("\n-- the attendee joins, in a profile that shares nothing with the host's --");
  await phone.locator("#join-name").waitFor({ state: "visible", timeout: 15000 });
  await phone.fill("#join-name", "Ana");
  await tap(phone, "#join button[type=submit]");
  await eventually("the phone is waiting for the host", phone,
    () => document.getElementById("options").dataset.screen === "waiting");
  await shot("1-waiting");

  console.log("\n-- the host opens Run and presses Next --");
  await host.locator("#tab-run").waitFor({ state: "visible", timeout: 15000 });
  await tap(host, "#tab-run");
  await tap(host, "#next");
  await eventually("the host sees the first question", host,
    () => document.getElementById("run-question").textContent.includes("Capital of France"));

  console.log("\n-- the first question, on the attendee's phone --");
  await eventually("the question is up", phone,
    () => document.getElementById("question").textContent === "Capital of France?");
  await eventually("with all four answers to tap", phone,
    () => [...document.querySelectorAll(".choice")].filter((b) => b.offsetParent && !b.disabled).length === 4);
  await eventually("and the countdown", phone, () => !document.getElementById("clock").hidden);
  await eventually("as question 1 of 3", phone,
    () => document.getElementById("progress").textContent === "Question 1 of 3");
  await shot("2-question-1");
  ok("the count was written back by the host's first step",
     (await adminDb.ref(`${EVENT_PATH}/decks/d000/questionCount`).get()).val() === 3);

  console.log("\n-- the wall, in its own profile --");
  await eventually("shows the same question", wall,
    () => document.querySelector(".big-question")?.textContent === "Capital of France?");
  await eventually("with its four answers", wall, () => document.querySelectorAll(".big-choice").length === 4);

  console.log("\n-- the attendee votes --");
  await tap(phone, '.choice[data-id="b"]');
  await eventually("their answer is marked as theirs", phone,
    () => document.querySelector('.choice[data-id="b"]').classList.contains("is-mine"));
  await eventually("and the others are closed to them", phone,
    () => [...document.querySelectorAll(".choice")].every((b) => b.disabled));
  await eventually("the host sees one vote in", host,
    () => document.body.textContent.includes("1 / 1") || document.body.textContent.includes("Votes 1"));
  await shot("3-voted");

  console.log("\n-- the host reveals (Next on a question with a right answer) --");
  await tap(host, "#next");
  await eventually("the right answer is marked on the phone", phone,
    () => document.querySelector('.choice[data-id="b"]').classList.contains("is-right"));
  await eventually("and voting is closed", phone,
    () => document.getElementById("note").textContent === "Voting closed");
  await shot("4-revealed");

  console.log("\n-- Next again: the second question, not the closing screen --");
  await tap(host, "#next");
  await eventually("the second question is up", phone,
    () => document.getElementById("question").textContent === "Tea or coffee?");
  await eventually("with three answers to tap", phone,
    () => [...document.querySelectorAll(".choice")].filter((b) => b.offsetParent && !b.disabled).length === 3);
  await eventually("as question 2 of 3", phone,
    () => document.getElementById("progress").textContent === "Question 2 of 3");
  await eventually("the wall moved with it", wall,
    () => document.querySelector(".big-question")?.textContent === "Tea or coffee?");
  await shot("5-question-2");
  await tap(phone, '.choice[data-id="a"]');
  await eventually("a vote on it lands", phone,
    () => document.querySelector('.choice[data-id="a"]').classList.contains("is-mine"));

  console.log("\n-- Next: the rating --");
  await tap(host, "#next");
  await eventually("five stars to tap", phone,
    () => [...document.querySelectorAll(".star-btn")].filter((b) => b.offsetParent && !b.disabled).length === 5);
  await eventually("as question 3 of 3", phone,
    () => document.getElementById("progress").textContent === "Question 3 of 3");
  await shot("6-rating");
  await tap(phone, '.star-btn[data-value="4"]');
  await eventually("four of them fill", phone,
    () => document.querySelectorAll(".star-btn.is-filled").length === 4);
  await eventually("and the average shows", phone,
    () => document.getElementById("rating-mean").textContent.includes("4.0"));

  console.log("\n-- Next: the standings --");
  await tap(host, "#next");
  await eventually("the phone shows the scores", phone,
    () => document.getElementById("question").textContent === "Scores");
  await eventually("with the attendee on the board, 1 of 1 right", phone,
    () => document.querySelector(".board-row.is-me .board-score")?.textContent === "1/1");
  await eventually("the wall shows them too", wall,
    () => document.getElementById("stage").dataset.screen === "scores");
  await shot("7-scores");

  console.log("\n-- Next: the heart, at last --");
  await tap(host, "#next");
  await eventually("the closing screen", phone, () => !!document.getElementById("like")?.offsetParent);
  await tap(phone, "#like");
  await eventually("a tap counts", phone, () => document.getElementById("like-count").textContent === "1");
  await shot("8-ending");

  console.log("\n-- a second attendee arriving late, straight into a question --");
  await tap(host, "#prev"); // back to the standings
  await tap(host, "#prev"); // back to the rating
  const lateCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const late = await lateCtx.newPage();
  late.on("pageerror", (e) => { console.log(`  ✗ late phone threw: ${e.message}`); failures++; });
  await late.goto(url("index.html"));
  await late.locator("#join-name").waitFor({ state: "visible", timeout: 15000 });
  await late.fill("#join-name", "Bo");
  await tap(late, "#join button[type=submit]");
  await eventually("sees the question that is already up", late,
    () => document.getElementById("question").textContent === "How was the day?");
  await eventually("with its stars ready to tap", late,
    () => [...document.querySelectorAll(".star-btn")].filter((b) => b.offsetParent && !b.disabled).length === 5);
  await late.screenshot({ path: join(SHOTS, "e2e-9-late-arrival.png") });
  await lateCtx.close();
} catch (error) {
  failures++;
  console.log(`  ✗ the run itself broke: ${error.message}`);
  await shot("crash").catch(() => {});
  await host.screenshot({ path: join(SHOTS, "e2e-crash-host.png") }).catch(() => {});
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
