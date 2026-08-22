// Audience view: shows whichever question the host currently has on screen,
// and takes one vote per question from this device.
// All database work goes through sync.js.

import {
  connect,
  onEventChange,
  castVote,
  likePoll,
  saveName,
  touch,
  getUid,
  serverNow,
  NAME_MAX,
} from "./sync.js";
import { icons, drawIcons, waitingArt } from "./icons.js";
import { flyHearts, heartColour, celebrate } from "./hearts.js";
import { screenAt, boardMarkup, fillNames, isRatingQuestion, ratingColorVar, ratingCaptionText } from "./scores.js";
import { isConfigured } from "./firebase-config.js";
import { t, setLanguage, applyStaticText } from "./i18n.js";

// What this build of the app can do, read by the freshness check in the page.
// A browser can serve a fresh page against a cached older script, and the only
// symptom is controls that don't respond — so the script says what it is.
window.VOTR_BUILD = [
  "polls", "timer", "ending", "names", "applause", "stage", "pause", "scores",
  "speed", "presence", "rating", "starpicker",
];

const optionsEl = document.getElementById("options");
const stageEl = document.querySelector(".stage");
const progressEl = document.getElementById("progress");
const clockEl = document.getElementById("clock");
const clockFillEl = document.getElementById("clock-fill");
const clockTimeEl = document.getElementById("clock-time");
const questionEl = document.getElementById("question");
const whoamiEl = document.getElementById("whoami");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");

let shownQuestionId = null; // so we only rebuild rows when the question changes
let busy = false; // guards against double-taps while a write is in flight
let latest = null; // the last event seen, so the ticker can redraw from it
let ticker = null;
let renaming = false; // true while someone is changing a name they already gave
let joinDraft = ""; // what was typed into the join field, kept across a rebuild
let joinError = ""; // why the last join was refused, if it was
let connection = { key: "connecting", state: "pending" }; // what the badge says
let likesSeen = null; // the applause already drawn, so only new taps fly

start();

async function start() {
  if (!isConfigured()) {
    setStatus("setupNeeded", "warn");
    showMessage("Add your Firebase details to js/firebase-config.js to go live.");
    return;
  }

  setStatus("connecting", "pending");

  try {
    await connect();
  } catch (error) {
    setStatus("offline", "error");
    showRetry(error.message);
    return;
  }

  const missing = Object.entries({
    options: optionsEl,
    question: questionEl,
    note: noteEl,
  })
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missing.length) {
    // Almost always a cached page running a newer script.
    setStatus("broken", "error");
    showMessage(
      `This page is missing: ${missing.join(", ")}. A hard refresh usually ` +
        `fixes it.`,
    );
    return;
  }

  setStatus("live", "live");
  keepPresent();
  whoamiEl.addEventListener("click", () => {
    renaming = true;
    render(latest);
  });
  onEventChange(render);
}

function render(event) {
  latest = event;
  // The host picks the language for the room; a change re-renders everything,
  // including anything already on screen that caches its own markup. Both
  // guards have to be cleared: one holds the vote rows, the other the waiting
  // and closing screens, and forgetting either leaves a screen in the language
  // it happened to be built in.
  if (setLanguage(event.lang)) {
    applyStaticText();
    shownQuestionId = null;
    delete optionsEl.dataset.screen;
  }
  drawStatus();

  // Nobody votes anonymously any more: the name is what puts a person on the
  // leaderboard, so it is asked for once, before anything else is shown.
  const myName = event.players[getUid()] ?? null;
  if (!myName || renaming) {
    showJoin(myName);
    return;
  }
  drawWhoami(myName);

  // Blanked hides the question but keeps the host's place, so this looks the
  // same to the audience as nothing being up at all.
  const question = event.blanked ? null : event.currentQuestion;

  // A poll ends in two screens: how it went, then what the room thought of
  // it. Which of them an index lands on is decided in one place, so the host
  // and every phone step through the same sequence.
  const screen = event.blanked ? "none" : screenAt(event);

  if (screen === "scores") {
    resting();
    stageEl.classList.add("is-ending");
    questionEl.hidden = false;
    questionEl.textContent = t("scoresTitle");
    questionEl.classList.add("is-centred");
    showScores(event);
    return;
  }

  if (screen === "ending") {
    resting();
    stageEl.classList.add("is-ending");
    questionEl.hidden = false;
    questionEl.textContent = t("likeVotr");
    questionEl.classList.add("is-centred");
    showEnding(event.likes);
    return;
  }

  questionEl.classList.remove("is-centred");
  stageEl.classList.remove("is-ending");

  if (!question) {
    resting();
    questionEl.hidden = true;
    showWaiting();
    return;
  }

  questionEl.hidden = false;
  drawProgress(event.currentIndex + 1, event.questionCount);
  questionEl.textContent = question.text;

  if (question.id !== shownQuestionId) {
    buildRows(question);
    shownQuestionId = question.id;
  }

  drawTime();
  updateRows(question, event.revealed || secondsLeft() === 0);

  // A countdown has to redraw itself; nothing arrives from the database
  // between the question going up and its time running out.
  if (!event.revealed && secondsLeft() > 0) startTicking();
  else stopTicking();
}

/* ── Being here ────────────────────────────────────────────────────────── */

/** Often enough to stay inside the hour, rarely enough to be free. */
const HEARTBEAT_MS = 10 * 60 * 1000;

/**
 * Says this phone is still in the room, so the count on the wall means the
 * people looking at it rather than everyone who has ever opened the page.
 *
 * Only while the page is actually being looked at: a tab left open in the
 * background for the afternoon is not somebody waiting to vote, and should
 * drop out of the count like anyone else who wandered off.
 */
function keepPresent() {
  const beat = () => {
    if (document.visibilityState === "visible") touch();
  };
  beat();
  setInterval(beat, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", beat);
}

/**
 * Puts the stage back to nothing-is-being-asked: no place in the poll, no
 * clock, no note, and no ticker running behind it.
 *
 * Shared by every screen that isn't a question, because a screen that only
 * says what it *wants* leaves the last screen's furniture on the page — which
 * is how the closing screen ended up with a countdown bar for a poll that had
 * already finished, and the waiting screen with one for a question that had
 * been taken down.
 */
function resting() {
  shownQuestionId = null;
  drawProgress(null);
  clockEl.hidden = true;
  clockEl.classList.remove("is-urgent");
  noteEl.textContent = "";
  noteEl.classList.remove("is-urgent");
  stopTicking();
}

/* ── Countdown ─────────────────────────────────────────────────────────── */

/**
 * Seconds still on the clock, floored at zero. Null when nothing is timed —
 * either the host turned the limit off, or no question has gone up yet.
 */
function secondsLeft() {
  if (!latest?.askedAt || !latest?.seconds) return null;
  // While the host has the screen hidden the clock holds: it counts up to the
  // moment it was paused rather than to now, so the seconds that were left
  // are still there when the question comes back.
  const gone = ((latest.pausedAt ?? serverNow()) - latest.askedAt) / 1000;
  return Math.max(0, Math.ceil(latest.seconds - gone));
}

/**
 * How long this phone took to answer, in milliseconds, or null when nothing
 * is being timed — which is what a poll with no time limit is.
 *
 * Clamped to the limit at both ends. A phone whose clock disagrees with the
 * server's by a minute would otherwise post a negative time and win, and the
 * rules would refuse it besides.
 */
function elapsed() {
  if (!latest?.askedAt || !latest?.seconds) return null;
  const gone = (latest.pausedAt ?? serverNow()) - latest.askedAt;
  return Math.min(Math.max(gone, 0), latest.seconds * 1000);
}

/** "Question 2 of 3", or nothing at all when no question is up. */
function drawProgress(index, total) {
  const show = index !== null;
  progressEl.hidden = !show;
  if (show) progressEl.textContent = t("questionProgress", { n: index, of: total });
}

/**
 * The clock is a bar that empties, with the seconds beside it. As a number
 * alone in the footer it was both too small to glance at and nowhere near
 * the question it was counting down.
 */
function drawTime() {
  const left = secondsLeft();
  const closed = latest?.revealed || left === 0;
  const urgent = !closed && left !== null && left <= 5;

  clockEl.hidden = left === null || closed;
  if (!clockEl.hidden) {
    clockFillEl.style.width = `${(left / latest.seconds) * 100}%`;
    clockTimeEl.textContent = t("secondsLeft", { n: left });
    clockEl.classList.toggle("is-urgent", urgent);
  }

  noteEl.textContent = closed ? t("votingClosed") : "";
  noteEl.classList.toggle("is-urgent", false);
}

function startTicking() {
  if (ticker) return;
  ticker = setInterval(() => {
    const question = latest?.currentQuestion ?? null;
    if (!question) return stopTicking();

    drawTime();
    if (secondsLeft() === 0) {
      updateRows(question, true);
      drawStatus(); // voting just closed, so Live stops being true
      stopTicking();
    }
  }, 250);
}

function stopTicking() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

function buildRows(question) {
  optionsEl.dataset.screen = "question";

  if (isRatingQuestion(question)) {
    buildStars(question);
    return;
  }

  optionsEl.innerHTML = "";
  for (const option of question.options) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "choice";
    row.dataset.id = option.id;
    row.setAttribute("aria-label", t("voteFor", { label: option.label }));
    // The mark is what tells people this row is theirs to press — tapping
    // anywhere on the card still works, but nothing else says "choose one".
    row.innerHTML = `
      <span class="choice-fill"></span>
      <span class="choice-body">
        <span class="choice-mark" aria-hidden="true"></span>
        <span class="choice-label"></span>
        <span class="choice-pct"></span>
      </span>
    `;
    row.addEventListener("click", () => submitVote(question.id, option.id));
    optionsEl.appendChild(row);
  }
}

/**
 * A row of tappable stars — the Nth star votes for the option at position N,
 * the same castVote() any other question uses. Once you've picked one, or
 * once the room's seen the answer, the average takes the row's place as the
 * thing worth reading.
 */
function buildStars(question) {
  optionsEl.innerHTML =
    `<div class="star-picker" style="--star-color: var(${ratingColorVar(question.ratingColor)})">` +
    question.options
      .map(
        (option, i) => `
          <button type="button" class="star-btn" data-id="${option.id}" data-value="${i + 1}"
                  aria-label="${i + 1 === 1 ? t("rateStarsOne") : t("rateStars", { n: i + 1 })}">${icons.star}</button>
        `,
      )
      .join("") +
    `</div>` +
    `<p class="panel-message" id="rating-mean"></p>`;

  for (const button of optionsEl.querySelectorAll(".star-btn")) {
    button.addEventListener("click", () => submitVote(question.id, button.dataset.id));
  }
}

function updateRows(question, revealed) {
  const myVote = question.voters[getUid()] ?? null;

  // Results appear once you've voted, and to everyone once the answer is out —
  // so someone who didn't vote in time still sees how it landed.
  const showResults = myVote !== null || revealed;

  if (isRatingQuestion(question)) {
    updateStars(question, myVote, showResults, revealed);
    return;
  }

  const scored = revealed && question.correct !== null;
  const total = question.options.reduce((sum, o) => sum + o.votes, 0);

  for (const option of question.options) {
    const row = optionsEl.querySelector(`.choice[data-id="${option.id}"]`);
    if (!row) continue;

    const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);

    row.querySelector(".choice-label").textContent = option.label;
    row.querySelector(".choice-fill").style.width = showResults ? pct + "%" : "0%";
    row.querySelector(".choice-pct").textContent = pct + "%";

    row.classList.toggle("is-counted", showResults);
    row.classList.toggle("is-mine", option.id === myVote);
    row.classList.toggle("is-right", scored && option.id === question.correct);
    // Only your own wrong answer is marked wrong. Painting every other option
    // red as well says "all of this was wrong", when the one thing worth
    // seeing is which one wasn't.
    row.classList.toggle(
      "is-missed",
      scored && option.id === myVote && option.id !== question.correct,
    );
    row.disabled = revealed || myVote !== null;
  }
}

function updateStars(question, myVote, showResults, revealed) {
  const myValue = myVote ? question.options.findIndex((o) => o.id === myVote) + 1 : 0;

  for (const button of optionsEl.querySelectorAll(".star-btn")) {
    const filled = myValue > 0 && Number(button.dataset.value) <= myValue;
    button.innerHTML = filled ? icons.starFilled : icons.star;
    button.classList.toggle("is-filled", filled);
    button.disabled = revealed || myVote !== null;
  }

  optionsEl.querySelector("#rating-mean").textContent = showResults ? ratingCaptionText(question) : "";
}

async function submitVote(questionId, optionId) {
  if (busy) return;
  busy = true;

  try {
    await castVote(questionId, optionId, elapsed());
    touch();
    drawStatus();
  } catch (error) {
    setStatus("voteRefused", "error");
    console.error(error);
  } finally {
    busy = false;
  }
}

/**
 * The blank state is where a phone sits while the speaker is talking, so it
 * should look deliberate rather than empty. The mark is the wordmark's own O,
 * lifted from img/votr-logo.svg unaltered, with its bars breathing — something
 * is being measured, just not here.
 */
function showWaiting() {
  optionsEl.dataset.screen = "waiting";
  optionsEl.innerHTML = `
    <div class="waiting">
      ${waitingArt(t("waitingForHost"))}
      <p class="panel-message">${t("waitingForHost")}</p>
    </div>
  `;
}

/**
 * How it went. Built once on arrival — the rows arrive in order and the
 * winner's row is celebrated, and neither should happen again every time
 * somebody's phone reports something.
 */
function showScores(event) {
  if (optionsEl.dataset.screen === "scores") return;
  optionsEl.dataset.screen = "scores";
  optionsEl.innerHTML = boardMarkup(event, getUid());
  fillNames(optionsEl, event);
  celebrate(optionsEl.querySelector(".board-row.is-first"));
}

/**
 * The closing screen. The heart takes as many taps as anyone wants to give it
 * — there is nothing to win, so there is nothing to protect against, and a
 * counter that only goes up is a friendlier ending than a rating out of five.
 */
/** Shown on every screen but the join one — this phone's own name, changeable. */
function drawWhoami(name) {
  whoamiEl.hidden = false;
  whoamiEl.querySelector(".whoami-name").textContent = name;
  whoamiEl.setAttribute("aria-label", t("changeName"));
  drawIcons(whoamiEl);
}

/**
 * The first thing anyone sees. Asking before the first question rather than
 * after it means nobody is half-way through a quiz before finding out their
 * answers are about to be attributed to them.
 */
function showJoin(existing) {
  resting();
  whoamiEl.hidden = true;
  questionEl.hidden = false;
  questionEl.textContent = t("whatsYourName");
  questionEl.classList.add("is-centred");

  if (optionsEl.dataset.screen !== "join") {
    optionsEl.dataset.screen = "join";
    optionsEl.innerHTML = `
      <form class="join" id="join">
        <input type="text" id="join-name" class="join-name" required
               maxlength="${NAME_MAX}" autocomplete="name"
               enterkeyhint="go" aria-label="${t("whatsYourName")}">
        <button type="submit" class="btn btn--primary btn--wide">
          <span class="btn-label">${t("join")}</span>
        </button>
        <p class="panel-message" id="join-note"></p>
      </form>
    `;
    optionsEl.querySelector("#join").addEventListener("submit", onJoin);
    const field = optionsEl.querySelector("#join-name");
    // A refused write is rolled back, which re-renders this screen from
    // scratch. Whatever was typed has to come back with it, or the refusal
    // looks like the name simply vanishing.
    field.value = joinDraft || existing || "";
    field.focus();
    field.select();
  }

  // Painted every time rather than once at build: the message explaining a
  // refusal arrives *after* the rollback has already rebuilt the form, so a
  // note written straight to the DOM would land on a discarded element.
  const note = optionsEl.querySelector("#join-note");
  note.textContent = joinError || t("joinNote");
  note.classList.toggle("is-error", Boolean(joinError));
}

async function onJoin(submitEvent) {
  submitEvent.preventDefault();

  const field = optionsEl.querySelector("#join-name");
  const name = field.value.trim();

  // A blank name puts a blank row on the leaderboard. Refuse by putting the
  // cursor back rather than by doing nothing at all.
  if (!name) return field.focus();

  joinDraft = name;
  joinError = "";

  try {
    await saveName(name.slice(0, NAME_MAX));
    renaming = false;
    joinDraft = "";
    // Re-typing the same name is not a change, so no snapshot follows it, and
    // the snapshot for a new one lands a moment later. Neither is worth
    // waiting on with the join screen still up, so the name goes into the
    // event we already hold and this screen redraws from that.
    latest.players[getUid()] = name.slice(0, NAME_MAX);
    render(latest);
  } catch (error) {
    // Held as state, not written to the note directly: the failed write has
    // already been rolled back, and the rollback rebuilt this screen.
    joinError = `${t("joinRefused")} ${error.message}`;
    setStatus("refused", "error");
    showJoin(name);
    console.error(error);
  }
}

function showEnding(count) {
  if (optionsEl.dataset.screen !== "ending") {
    optionsEl.dataset.screen = "ending";
    // A screen that has just been built hasn't drawn any of the applause yet,
    // and shouldn't replay all of it at once.
    likesSeen = null;
    optionsEl.innerHTML = `
      <div class="ending">
        <div class="heart-stage">
          <button type="button" class="heart" id="like" aria-label="${t("likeVotr")}">
            ${icons.heart}
          </button>
        </div>
        <p class="ending-count" id="like-count">0</p>
        <p class="panel-message" id="like-hint">${t("likeHint")}</p>
      </div>
    `;
    optionsEl.querySelector("#like").addEventListener("click", onLike);
  }

  // The counter is the only thing everyone shares, so it is what says someone
  // tapped: every step up is a heart from somebody, and it flies here too.
  // Your own taps are claimed in onLike before their snapshot arrives, so
  // they aren't counted twice — and a refused one comes back down without
  // flying anything.
  if (likesSeen === null) likesSeen = count;
  else if (count > likesSeen) {
    flyHearts(optionsEl.querySelector(".heart-stage"), count - likesSeen);
    likesSeen = count;
  } else if (count < likesSeen) likesSeen = count;

  // Only when it changes: overwriting it on every snapshot would undo the
  // optimistic bump between the tap and the database answering.
  const shown = optionsEl.querySelector("#like-count");
  if (Number(shown.textContent) !== count) shown.textContent = count;
}

async function onLike(clickEvent) {
  // The database answers a moment later; the beat of feedback has to happen
  // now, or the tap feels like it missed. The count is bumped here too and
  // corrected by the next snapshot — which is almost always the same number.
  const button = clickEvent.currentTarget;
  button.classList.remove("is-beating");
  void button.offsetWidth; // restart the animation on a repeated tap
  button.classList.add("is-beating");
  flyHearts(button.parentElement, 1, heartColour(getUid()));
  likesSeen = (likesSeen ?? 0) + 1;

  // A tap that works clears the last one's complaint.
  const hint = optionsEl.querySelector("#like-hint");
  hint.classList.remove("is-error");
  hint.textContent = t("likeHint");

  const shown = optionsEl.querySelector("#like-count");
  const before = Number(shown.textContent) || 0;
  shown.textContent = before + 1;

  try {
    await likePoll();
  } catch (error) {
    // A refused write used to leave the count sitting at zero with nothing
    // said, which looks exactly like a button that doesn't work.
    shown.textContent = before;
    likesSeen = Math.max((likesSeen ?? 1) - 1, 0);
    hint.textContent = `${t("likeRefused")} ${error.message}`;
    hint.classList.add("is-error");
    setStatus("refused", "error");
    console.error(error);
  }
}

function showMessage(text) {
  optionsEl.innerHTML = `<p class="panel-message">${text}</p>`;
}

/**
 * A failed connection needs a way out that doesn't involve knowing to reload,
 * or asking the host to change anything.
 */
function showRetry(text) {
  questionEl.textContent = t("cantConnect");
  optionsEl.innerHTML = `<p class="panel-message">${text}</p>`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn--primary";
  button.textContent = t("tryAgain");
  button.addEventListener("click", () => location.reload());
  optionsEl.appendChild(button);
}

/**
 * The badge is about *this phone's* connection, and it only says Live when
 * live means something: a question is up and your vote would count.
 *
 * It used to say Live whenever the page had a database behind it, which is
 * true and useless — it was on screen while the room waited, while the answer
 * was up, and after voting had closed.
 */
function setStatus(key, state) {
  if (!key) return;
  connection = { key, state };
  drawStatus();
}

function drawStatus() {
  // Anything wrong outranks everything: that is what a badge is for.
  const wrong = connection.state !== "live";
  const votable = wrong ? false : canVote();

  statusEl.hidden = !wrong && !votable;
  statusEl.dataset.key = wrong ? connection.key : "live";
  statusEl.dataset.state = wrong ? connection.state : "live";
  statusEl.textContent = t(statusEl.dataset.key);
}

/** True while a question is on screen and this phone could still answer it. */
function canVote() {
  const question = latest?.blanked ? null : (latest?.currentQuestion ?? null);

  if (!question || latest.revealed) return false;
  if (secondsLeft() === 0) return false;
  return question.voters[getUid()] === undefined;
}
