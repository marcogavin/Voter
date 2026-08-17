// Audience view: shows whichever question the host currently has on screen,
// and takes one vote per question from this device.
// All database work goes through sync.js.

import { connect, onEventChange, castVote, getUid, serverNow } from "./sync.js";
import { isConfigured, SECONDS_PER_QUESTION } from "./firebase-config.js";
import { t, setLanguage, applyStaticText } from "./i18n.js";

const optionsEl = document.getElementById("options");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");

let shownQuestionId = null; // so we only rebuild rows when the question changes
let busy = false; // guards against double-taps while a write is in flight
let latest = null; // the last event seen, so the ticker can redraw from it
let ticker = null;

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
  onEventChange(render);
}

function render(event) {
  latest = event;
  // The host picks the language for the room; a change re-renders everything,
  // including rows that would otherwise keep their old labels.
  if (setLanguage(event.lang)) {
    applyStaticText();
    shownQuestionId = null;
  }
  setStatus(statusEl.dataset.key, statusEl.dataset.state);

  // Blanked hides the question but keeps the host's place, so this looks the
  // same to the audience as nothing being up at all.
  const question = event.blanked
    ? null
    : (event.questions[event.currentIndex] ?? null);

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

/** Seconds still on the clock, floored at zero. Null when nothing is timed. */
function secondsLeft() {
  if (!latest?.askedAt) return null;
  const gone = (serverNow() - latest.askedAt) / 1000;
  return Math.max(0, Math.ceil(SECONDS_PER_QUESTION - gone));
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
 * should look deliberate rather than empty. The magnifying glass is the one
 * from the wordmark, with its bars breathing — something is being measured,
 * just not here.
 */
function showWaiting() {
  optionsEl.innerHTML = `
    <div class="waiting">
      <svg class="waiting-art" viewBox="0 0 100 100" role="img"
           aria-label="${t("waitingForHost")}">
        <line class="waiting-handle" x1="33" y1="65" x2="15" y2="84"/>
        <circle class="waiting-lens" cx="57" cy="41" r="30"/>
        <rect class="waiting-bar" x="45" y="44" width="6" height="12" rx="3"/>
        <rect class="waiting-bar" x="54" y="34" width="6" height="22" rx="3"/>
        <rect class="waiting-bar" x="63" y="39" width="6" height="17" rx="3"/>
      </svg>
      <p class="panel-message">${t("waitingForHost")}</p>
    </div>
  `;
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
