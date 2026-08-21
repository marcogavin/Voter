// The big screen: one shared view for a projector, a TV, or the second
// monitor in the room.
//
// It only ever *reads*. There is no name to give, nothing to tap and no way
// to drive the poll from here — which is what makes it safe to leave a laptop
// plugged into the projector all day with this open, and why the projector
// never turns up on the leaderboard as a player who answered nothing.
//
// What it shows is decided by the same screenAt() the phones and the host
// read, so the wall and the room are never a step apart. The one thing it
// adds is the way in: with nothing on screen it is a join code the size of a
// door, and while a question is up that code shrinks into the corner rather
// than leaving late arrivals with nothing to scan.

import { connect, onEventChange, serverNow } from "./sync.js";
import { isConfigured } from "./firebase-config.js";
import { encode } from "./qr.js";
import { drawIcons, icons } from "./icons.js";
import { flyHearts, celebrate } from "./hearts.js";
import { screenAt, boardMarkup, fillNames, roomSize, isRatingQuestion, ratingMean } from "./scores.js";
import { t, setLanguage, applyStaticText } from "./i18n.js";

// What this build of the app can do, read by the freshness check in the page.
window.VOTR_BUILD = [
  "screen", "scores", "pause", "timer", "speed", "cornercode", "votecount",
  "presence", "rating",
];

/**
 * The most names worth putting on a wall, and the fewest worth calling a
 * leaderboard. What actually shows is measured — see showScores — because a
 * 4K display holds half again what a 720p projector does, and a fixed number
 * is either short on one or falling off the bottom of the other.
 */
const BOARD_MOST = 14;
const BOARD_FEWEST = 3;

/** How long the fullscreen control stays up after the mouse stops moving. */
const CHROME_MS = 2500;

const els = {
  votes: document.getElementById("votes"),
  join: document.getElementById("join"),
  joinArt: document.getElementById("join-art"),
  joinUrl: document.getElementById("join-url"),
  stage: document.getElementById("stage"),
  foot: document.getElementById("foot"),
  progress: document.getElementById("progress"),
  clock: document.getElementById("clock"),
  clockFill: document.getElementById("clock-fill"),
  clockTime: document.getElementById("clock-time"),
  tally: document.getElementById("tally"),
  full: document.getElementById("full"),
};

let latest = null;
let ticker = null;
let shownQuestionId = null;
let likesSeen = null; // the applause already drawn, so only new taps fly
let idle = null;

start();

async function start() {
  drawIcons();
  wireUp();

  if (!isConfigured()) {
    return showMessage("Add your Firebase details to js/firebase-config.js to go live.");
  }

  try {
    await connect();
  } catch (error) {
    return showMessage(error.message);
  }

  keepAwake();
  onEventChange(render);
}

function wireUp() {
  // Drawn once, in both sizes: the address it carries never changes.
  els.joinArt.innerHTML = qrSvg(audienceUrl());
  els.joinUrl.textContent = audienceUrl();

  // Not every browser will take a page fullscreen — iOS Safari won't take
  // anything but a video — so the control appears only where it would work.
  if (document.documentElement.requestFullscreen) {
    els.full.hidden = false;
    els.full.addEventListener("click", toggleFull);
    document.addEventListener("fullscreenchange", drawFull);
    drawFull();
  }

  // The chrome is for whoever is setting the screen up, not for the room, so
  // it follows the mouse and then gets out of the way.
  wake();
  document.addEventListener("pointermove", wake);
}

function wake() {
  document.body.classList.add("is-awake");
  clearTimeout(idle);
  idle = setTimeout(() => document.body.classList.remove("is-awake"), CHROME_MS);
}

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

function drawFull() {
  const on = Boolean(document.fullscreenElement);
  const name = t(on ? "exitFullScreen" : "fullScreen");
  els.full.dataset.icon = on ? "shrink" : "expand";
  els.full.setAttribute("aria-label", name);
  els.full.title = name;
  drawIcons(els.full);
}

/**
 * A screen at the front of a room shouldn't go dark between questions. The
 * lock is dropped whenever the tab is hidden, so it has to be asked for
 * again on the way back.
 */
async function keepAwake() {
  try {
    await navigator.wakeLock?.request("screen");
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") keepAwake();
});

/* ── What's on the wall ────────────────────────────────────────────────── */

function render(event) {
  latest = event;

  // The host picks the language for the room, and the wall is the most public
  // thing in it. Anything holding cached markup has to forget it.
  if (setLanguage(event.lang)) {
    applyStaticText();
    delete els.stage.dataset.screen;
    shownQuestionId = null;
    drawFull();
  }

  // Hiding the screen is the host asking for the room's attention. On the
  // wall that means the way in, not a blank rectangle.
  const screen = event.blanked ? "none" : screenAt(event);

  // The corner code is for latecomers while something else is up. On the join
  // screen the code *is* the screen, and at the end it would be an invitation
  // to something that has finished. The count of votes keeps it company: it
  // means nothing on any other screen.
  els.join.hidden = screen !== "question";
  els.votes.hidden = screen !== "question";

  if (screen === "question") return showQuestion(event);

  stopTicking();
  if (screen === "scores") return showScores(event);
  if (screen === "ending") return showEnding(event);
  showJoin(event);
}

/**
 * The way in, at the size of a door. This is what the room looks at while the
 * speaker is talking, so it carries the one thing worth reading from the back:
 * where to go, and that other people are already there.
 */
function showJoin(event) {
  if (els.stage.dataset.screen !== "join") {
    els.stage.dataset.screen = "join";
    els.stage.innerHTML =
      `<div class="big-join">` +
      `<h1 class="big-title">${t("scanToJoin")}</h1>` +
      `<div class="big-code" id="big-code"></div>` +
      `<p class="big-url">${escapeHtml(audienceUrl())}</p>` +
      `</div>`;
    document.getElementById("big-code").innerHTML = qrSvg(audienceUrl());
  }

  const count = Object.keys(event.players ?? {}).length;
  foot({
    tally: !count
      ? t("nobodyYet")
      : count === 1
        ? t("oneInTheRoom")
        : t("inTheRoom", { n: count }),
  });
}

/**
 * The question, and how the room is answering it.
 *
 * Shares are held back until the host reveals, but only where there is a right
 * answer to protect: on a wall in front of everyone, a bar that fills as the
 * votes land is a quiz being copied. An opinion question has nothing to copy
 * and watching it move is most of the point, so that one counts live.
 */
function showQuestion(event) {
  const question = event.currentQuestion;
  const scorable = question.correct !== null;
  const live = !scorable || event.revealed || secondsLeft() === 0;

  // Rebuilt when the question changes, and also when the answers under it do:
  // the host can edit a question while it is up, and a row that kept its old
  // label would be the room reading something nobody wrote.
  const stale =
    question.id !== shownQuestionId ||
    els.stage.dataset.screen !== "question" ||
    els.stage.querySelectorAll(".big-choice").length !== question.options.length;

  if (stale) {
    els.stage.dataset.screen = "question";
    shownQuestionId = question.id;
    els.stage.innerHTML =
      `<h1 class="big-question"></h1>` +
      (isRatingQuestion(question) ? `<p class="big-message" id="big-rating-mean"></p>` : "") +
      `<ol class="big-choices" data-n="${Math.min(question.options.length, 6)}"></ol>`;

    const list = els.stage.querySelector(".big-choices");
    question.options.forEach((option, index) => {
      const row = document.createElement("li");
      row.className = "big-choice";
      row.dataset.id = option.id;
      row.innerHTML =
        `<span class="big-fill"></span>` +
        `<span class="big-body">` +
        `<span class="big-key">${String.fromCharCode(65 + index)}</span>` +
        `<span class="big-label"></span>` +
        `<span class="big-pct"></span>` +
        `</span>`;
      list.appendChild(row);
    });
  }

  // Written every time for the same reason the labels are: an edit lands as a
  // snapshot, not as a new question.
  els.stage.querySelector(".big-question").textContent = question.text;

  const total = question.options.reduce((sum, option) => sum + option.votes, 0);

  const meanEl = els.stage.querySelector("#big-rating-mean");
  if (meanEl) {
    const mean = live ? ratingMean(question) : null;
    meanEl.textContent = mean === null ? "" : t("ratingAverage", { n: mean.toFixed(1) });
  }

  for (const option of question.options) {
    const row = els.stage.querySelector(`.big-choice[data-id="${option.id}"]`);
    if (!row) continue;

    const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);
    row.querySelector(".big-label").textContent = option.label;
    row.querySelector(".big-fill").style.width = live ? `${pct}%` : "0%";
    row.querySelector(".big-pct").textContent = live ? `${pct}%` : "";
    row.classList.toggle("is-counted", live);
    row.classList.toggle(
      "is-right",
      event.revealed && option.id === question.correct,
    );
  }

  const left = secondsLeft();
  const running = left !== null && left > 0 && !event.revealed;

  // Out of how many people are in the room, and at the top of the wall rather
  // than in the strip along the bottom: 7/12 with everyone watching is a
  // better way of asking the other five to vote than any wording would be.
  drawVotes(total, roomSize(event, serverNow()));

  drawTime();
  foot({
    progress: t("questionProgress", {
      n: event.currentIndex + 1,
      of: event.questionCount,
    }),
    clock: running,
  });

  // Nothing arrives from the database between a question going up and its
  // time running out, so the countdown has to redraw itself.
  if (running) startTicking();
  else stopTicking();
}

/**
 * How it went — as many places as the display will hold, in one column.
 *
 * Nothing here can be scrolled to, so the board is drawn and then measured,
 * and a row is dropped until it fits. Two columns would be the other way to
 * hold more, and it is the wrong one: it puts fourth place level with first
 * and reads as two separate tables.
 */
function showScores(event) {
  if (els.stage.dataset.screen !== "scores") {
    els.stage.dataset.screen = "scores";
    shownQuestionId = null;
    els.stage.innerHTML =
      `<h1 class="big-title">${t("scoresTitle")}</h1>` +
      `<div class="big-board"></div>`;

    const holder = els.stage.querySelector(".big-board");
    const draw = (rows) => {
      holder.innerHTML = boardMarkup(event, null, rows);
      fillNames(holder, event);
    };

    let rows = BOARD_MOST;
    draw(rows);
    // clientHeight is 0 in a page that isn't being laid out, which would take
    // this straight down to the floor; measuring only when there is a height
    // to measure leaves such a page with the full board.
    while (rows > BOARD_FEWEST && els.stage.clientHeight > 0 && spills()) {
      rows -= 1;
      draw(rows);
    }

    celebrate(holder.querySelector(".board-row.is-first"));
  }
  foot({});
}

/**
 * True while the stage is holding more than it can show.
 *
 * Not scrollHeight: the stage centres its contents, so anything too tall
 * overflows the top as well as the bottom, and scrollHeight only ever counts
 * the bottom half of that. The first thing on the stage running up under the
 * header is exactly the failure this exists to catch.
 */
function spills() {
  const kids = [...els.stage.children];
  if (!kids.length) return false;

  const box = els.stage.getBoundingClientRect();
  const foot = parseFloat(window.getComputedStyle(els.stage).paddingBottom) || 0;
  const first = kids[0].getBoundingClientRect();
  const last = kids[kids.length - 1].getBoundingClientRect();

  return first.top < box.top - 1 || last.bottom > box.bottom - foot + 1;
}

/**
 * The applause, on the screen the room is clapping at. Nobody can tap from
 * here, so every heart that flies came from somebody's phone — which is also
 * why the wall doesn't repeat the phone's "tap the heart": the only heart
 * within reach of the room is the one in their hands.
 */
function showEnding(event) {
  if (els.stage.dataset.screen !== "ending") {
    els.stage.dataset.screen = "ending";
    shownQuestionId = null;
    likesSeen = null;
    els.stage.innerHTML =
      `<div class="big-ending">` +
      `<h1 class="big-title">${t("likeVotr")}</h1>` +
      `<p class="big-heart" id="big-heart">${icons.heart}</p>` +
      `<p class="big-count" id="big-count">0</p>` +
      `</div>`;
  }

  const count = event.likes;
  if (likesSeen === null) likesSeen = count;
  else if (count > likesSeen) {
    flyHearts(document.getElementById("big-heart"), count - likesSeen);
    likesSeen = count;
  } else if (count < likesSeen) likesSeen = count;

  document.getElementById("big-count").textContent = count;
  foot({});
}

/**
 * How much of the room has answered. Nobody in it means nobody could have
 * voted, so there is nothing to say — and "0/0" on a wall reads as broken
 * rather than as early.
 */
function drawVotes(votes, room) {
  els.votes.hidden = room === 0;
  if (room === 0) return;
  // A count can outrun the room it is measured against — somebody votes and
  // then closes the tab — and 8/7 reads as a bug rather than as arithmetic.
  els.votes.textContent = t("votesOfRoom", { n: votes, of: Math.max(room, votes) });
  els.votes.classList.toggle("is-all", votes >= room);
}

/* ── The strip along the bottom ────────────────────────────────────────── */

/** Everything not asked for goes away, so no screen inherits the last one's. */
function foot({ progress = "", clock = false, tally = "" }) {
  els.progress.textContent = progress;
  els.progress.hidden = !progress;
  els.clock.hidden = !clock;
  els.tally.textContent = tally;
  els.tally.hidden = !tally;
  els.foot.hidden = !progress && !clock && !tally;
}

/**
 * Seconds still on the clock, floored at zero, and null when nothing is
 * timed. Counts up to the moment the host hid the screen rather than to now,
 * so a paused question comes back with the seconds it had.
 */
function secondsLeft() {
  if (!latest?.askedAt || !latest?.seconds) return null;
  const gone = ((latest.pausedAt ?? serverNow()) - latest.askedAt) / 1000;
  return Math.max(0, Math.ceil(latest.seconds - gone));
}

/** Paints the clock. Whether it is on screen at all is the footer's call. */
function drawTime() {
  const left = secondsLeft();
  if (left === null) return;

  els.clockFill.style.width = `${(left / latest.seconds) * 100}%`;
  els.clockTime.textContent = t("secondsLeft", { n: left });
  els.clock.classList.toggle("is-urgent", left <= 5);
}

function startTicking() {
  if (ticker) return;
  ticker = setInterval(() => {
    if (!latest?.currentQuestion) return stopTicking();
    drawTime();
    // Time running out is what puts the shares up on a quiz question, and
    // nothing arrives from the database to say so.
    if (secondsLeft() === 0) {
      stopTicking();
      render(latest);
    }
  }, 250);
}

function stopTicking() {
  clearInterval(ticker);
  ticker = null;
}

/* ── Odds and ends ─────────────────────────────────────────────────────── */

/** The code, drawn once: the address it carries never changes. */
function qrSvg(url) {
  const modules = encode(url);
  const quiet = 4;
  const span = modules.length + quiet * 2;

  const rects = [];
  modules.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) {
        rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`);
      }
    });
  });

  return (
    `<svg viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges" ` +
    `role="img" aria-label="${escapeHtml(url)}">` +
    `<rect width="${span}" height="${span}" fill="#fff"/>` +
    `<g fill="#000">${rects.join("")}</g></svg>`
  );
}

/**
 * Where attendees should go, derived from where this page is rather than
 * written down anywhere — so it stays right on any deployment. Shown without
 * the scheme, since that's what someone types.
 */
function audienceUrl() {
  const url = new URL(".", location.href);
  return (url.host + url.pathname).replace(/\/$/, "");
}

function showMessage(text) {
  els.stage.dataset.screen = "message";
  els.stage.innerHTML = `<p class="big-message"></p>`;
  els.stage.querySelector(".big-message").textContent = text;
  foot({});
}

function escapeHtml(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}
