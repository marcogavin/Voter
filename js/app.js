// Audience view: shows whichever question the host currently has on screen,
// and takes one vote per question from this device.
// All database work goes through sync.js.

import {
  connect,
  onEventChange,
  castVote,
  likePoll,
  saveName,
  getUid,
  serverNow,
  NAME_MAX,
} from "./sync.js";
import { icons, drawIcons } from "./icons.js";
import { isConfigured } from "./firebase-config.js";
import { t, setLanguage, applyStaticText } from "./i18n.js";

// What this build of the app can do, read by the freshness check in the page.
// A browser can serve a fresh page against a cached older script, and the only
// symptom is controls that don't respond — so the script says what it is.
window.VOTR_BUILD = ["polls", "timer", "ending", "names"];

const optionsEl = document.getElementById("options");
const questionEl = document.getElementById("question");
const whoamiEl = document.getElementById("whoami");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");

let shownQuestionId = null; // so we only rebuild rows when the question changes
let busy = false; // guards against double-taps while a write is in flight
let latest = null; // the last event seen, so the ticker can redraw from it
let ticker = null;
let renaming = false; // true while someone is changing a name they already gave

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
  setStatus(statusEl.dataset.key, statusEl.dataset.state);

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
  const question = event.blanked
    ? null
    : (event.questions[event.currentIndex] ?? null);

  // One past the last question: the poll is over and the room gets a way to
  // say what it thought, which is nicer than a screen that simply stops.
  if (!event.blanked && event.questions.length &&
      event.currentIndex === event.questions.length) {
    shownQuestionId = null;
    questionEl.hidden = false;
    questionEl.textContent = t("likeVotr");
    questionEl.classList.add("is-centred");
    noteEl.textContent = "";
    stopTicking();
    showEnding(event.likes);
    return;
  }

  questionEl.classList.remove("is-centred");

  if (!question) {
    shownQuestionId = null;
    questionEl.hidden = true;
    noteEl.textContent = "";
    stopTicking();
    showWaiting();
    return;
  }

  questionEl.hidden = false;

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

/* ── Countdown ─────────────────────────────────────────────────────────── */

/**
 * Seconds still on the clock, floored at zero. Null when nothing is timed —
 * either the host turned the limit off, or no question has gone up yet.
 */
function secondsLeft() {
  if (!latest?.askedAt || !latest?.seconds) return null;
  const gone = (serverNow() - latest.askedAt) / 1000;
  return Math.max(0, Math.ceil(latest.seconds - gone));
}

function drawTime() {
  const left = secondsLeft();
  const closed = latest?.revealed || left === 0;

  noteEl.textContent = closed
    ? t("votingClosed")
    : left === null
      ? ""
      : t("secondsLeft", { n: left });
  noteEl.classList.toggle("is-urgent", !closed && left !== null && left <= 5);
}

function startTicking() {
  if (ticker) return;
  ticker = setInterval(() => {
    const question = latest?.questions[latest.currentIndex] ?? null;
    if (!question) return stopTicking();

    drawTime();
    if (secondsLeft() === 0) {
      updateRows(question, true);
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
  optionsEl.innerHTML = "";

  for (const option of question.options) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "meter meter--vote";
    row.dataset.id = option.id;
    row.setAttribute("aria-label", t("voteFor", { label: option.label }));
    // The tick box is what tells people this row is theirs to press — tapping
    // anywhere on the row still works, but nothing else says "choose one".
    row.innerHTML = `
      <span class="tick" aria-hidden="true"></span>
      <span class="meter-label"></span>
      <span class="meter-track">
        <span class="meter-fill"></span>
        <span class="meter-needle"></span>
      </span>
      <span class="meter-pct"></span>
    `;
    row.addEventListener("click", () => submitVote(question.id, option.id));
    optionsEl.appendChild(row);
  }
}

function updateRows(question, revealed) {
  const myVote = question.voters[getUid()] ?? null;

  // Results appear once you've voted, and to everyone once the answer is out —
  // so someone who didn't vote in time still sees how it landed.
  const showResults = myVote !== null || revealed;
  const scored = revealed && question.correct !== null;
  const total = question.options.reduce((sum, o) => sum + o.votes, 0);

  for (const option of question.options) {
    const row = optionsEl.querySelector(`.meter[data-id="${option.id}"]`);
    if (!row) continue;

    const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);

    row.querySelector(".meter-label").textContent = option.label;
    row.querySelector(".meter-fill").style.width = showResults ? pct + "%" : "0%";
    row.querySelector(".meter-needle").style.left = showResults ? pct + "%" : "0%";
    row.querySelector(".meter-pct").textContent = showResults ? pct + "%" : "";

    row.classList.toggle("is-mine", option.id === myVote);
    row.classList.toggle("is-right", scored && option.id === question.correct);
    row.classList.toggle("is-wrong", scored && option.id !== question.correct);
    row.disabled = revealed || myVote !== null;
  }
}

async function submitVote(questionId, optionId) {
  if (busy) return;
  busy = true;

  try {
    await castVote(questionId, optionId);
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
      <svg class="waiting-art" viewBox="269 13 328 352" role="img"
           aria-label="${t("waitingForHost")}">
        <path d="M 516,42 L 495,31 L 467,22 L 445,19 L 401,22 L 365,34 L 343,47 L 318,69 L 303,88 L 282,132 L 275,182 L 279,215 L 288,243 L 299,264 L 320,291 L 307,354 L 311,359 L 325,358 L 379,331 L 419,339 L 457,338 L 485,331 L 506,322 L 533,304 L 549,289 L 567,265 L 581,237 L 589,209 L 591,164 L 588,145 L 580,119 L 563,87 L 534,55 Z M 414,53 L 447,52 L 459,54 L 481,61 L 507,76 L 528,96 L 542,116 L 552,138 L 558,164 L 558,194 L 554,214 L 544,239 L 531,259 L 510,280 L 492,292 L 477,299 L 450,306 L 407,304 L 385,297 L 362,284 L 339,263 L 329,250 L 317,227 L 310,204 L 308,172 L 311,151 L 319,127 L 330,107 L 351,83 L 370,69 L 391,59 Z" fill="#1D4ED8" fill-rule="evenodd"/>
        <path d="M 358,172 L 356,173 L 352,178 L 352,258 L 357,264 L 360,265 L 395,265 L 396,263 L 396,179 L 395,176 L 390,172 Z" fill="#0B7D88" fill-rule="evenodd" class="waiting-bar waiting-bar--a"/>
        <path d="M 420,106 L 415,108 L 412,113 L 412,263 L 414,265 L 453,265 L 455,263 L 455,113 L 453,109 L 450,107 L 439,107 L 438,106 L 422,107 Z" fill="#1D4ED8" fill-rule="evenodd" class="waiting-bar waiting-bar--b"/>
        <path d="M 479,150 L 476,151 L 472,156 L 472,264 L 473,265 L 508,265 L 514,260 L 515,257 L 515,158 L 514,155 L 510,151 L 507,150 Z" fill="#17743C" fill-rule="evenodd" class="waiting-bar waiting-bar--c"/>
      </svg>
      <p class="panel-message">${t("waitingForHost")}</p>
    </div>
  `;
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
  whoamiEl.hidden = true;
  questionEl.hidden = false;
  questionEl.textContent = t("whatsYourName");
  questionEl.classList.add("is-centred");
  noteEl.textContent = "";
  stopTicking();

  // The rows that were on screen are gone now, so the guard that remembers
  // them has to go too, or they never come back.
  shownQuestionId = null;

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
        <p class="panel-message" id="join-note">${t("joinNote")}</p>
      </form>
    `;
    optionsEl.querySelector("#join").addEventListener("submit", onJoin);
    const field = optionsEl.querySelector("#join-name");
    field.value = existing ?? "";
    field.focus();
    field.select();
  }
}

async function onJoin(submitEvent) {
  submitEvent.preventDefault();

  const field = optionsEl.querySelector("#join-name");
  const note = optionsEl.querySelector("#join-note");
  const name = field.value.trim();

  // A blank name puts a blank row on the leaderboard. Refuse by putting the
  // cursor back rather than by doing nothing at all.
  if (!name) return field.focus();

  try {
    await saveName(name.slice(0, NAME_MAX));
    renaming = false;
    // Re-typing the same name is not a change, so no snapshot follows it.
    // Waiting for one would leave this screen up for good.
    render(latest);
  } catch (error) {
    note.textContent = `${t("joinRefused")} ${error.message}`;
    note.classList.add("is-error");
    setStatus("refused", "error");
    console.error(error);
  }
}

function showEnding(count) {
  if (optionsEl.dataset.screen !== "ending") {
    optionsEl.dataset.screen = "ending";
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

  // Only when it changes: overwriting it on every snapshot would undo the
  // optimistic bump between the tap and the database answering.
  const shown = optionsEl.querySelector("#like-count");
  if (Number(shown.textContent) !== count) shown.textContent = count;
}

/**
 * One heart per tap, drifting up and out. Each gets its own drift, tilt and
 * size, or a burst of taps leaves in a single column and reads as one heart
 * stuttering rather than as a room clapping.
 */
function flyHeart(stage) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const fly = document.createElement("span");
  fly.className = "heart-fly";
  fly.innerHTML = icons.heart;
  fly.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 140)}px`);
  fly.style.setProperty("--tilt", `${Math.round((Math.random() - 0.5) * 60)}deg`);
  fly.style.setProperty("--size", `${(1.5 + Math.random() * 1.5).toFixed(2)}rem`);
  fly.addEventListener("animationend", () => fly.remove());
  stage.appendChild(fly);
}

async function onLike(clickEvent) {
  // The database answers a moment later; the beat of feedback has to happen
  // now, or the tap feels like it missed. The count is bumped here too and
  // corrected by the next snapshot — which is almost always the same number.
  const button = clickEvent.currentTarget;
  button.classList.remove("is-beating");
  void button.offsetWidth; // restart the animation on a repeated tap
  button.classList.add("is-beating");
  flyHeart(button.parentElement);

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

/** Takes a translation key, so the badge can be re-rendered on a language change. */
function setStatus(key, state) {
  if (!key) return;
  statusEl.dataset.key = key;
  statusEl.textContent = t(key);
  statusEl.dataset.state = state;
}
