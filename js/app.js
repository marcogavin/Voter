// Audience view: shows whichever question the host currently has on screen,
// and takes one vote per question from this device.
// All database work goes through sync.js.

import { connect, onEventChange, castVote, getUid } from "./sync.js";
import { isConfigured } from "./firebase-config.js";
import { t, setLanguage, applyStaticText } from "./i18n.js";

const optionsEl = document.getElementById("options");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");

let shownQuestionId = null; // so we only rebuild rows when the question changes
let busy = false; // guards against double-taps while a write is in flight

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
    questionEl.textContent = t("nothingOnScreen");
    noteEl.textContent = t("oneVotePerQuestion");
    showWaiting();
    return;
  }

  questionEl.textContent = question.text;
  noteEl.textContent = event.revealed
    ? t("votingClosed")
    : t("questionNofM", {
        n: event.currentIndex + 1,
        m: event.questions.length,
      });

  if (question.id !== shownQuestionId) {
    buildRows(question);
    shownQuestionId = question.id;
  }

  updateRows(question, event.revealed);
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
 * should look deliberate rather than empty. The bubble is the one from the
 * wordmark, with the three dots resting — something is coming, just not here.
 */
function showWaiting() {
  optionsEl.innerHTML = `
    <div class="waiting">
      <svg class="waiting-art" viewBox="0 0 120 104" role="img"
           aria-label="${t("nothingOnScreen")}">
        <path class="waiting-bubble"
              d="M60 8a44 40 0 1 1-27 78l-19 9 6-19A40 40 0 0 1 60 8Z"/>
        <circle class="waiting-dot" cx="42" cy="48" r="6"/>
        <circle class="waiting-dot" cx="60" cy="48" r="6"/>
        <circle class="waiting-dot" cx="78" cy="48" r="6"/>
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
