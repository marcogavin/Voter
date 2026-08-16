// Audience view: shows whichever question the host currently has on screen,
// and takes one vote per question from this device.
// All database work goes through sync.js.

import { connect, onEventChange, castVote, getUid } from "./sync.js";
import { isConfigured } from "./firebase-config.js";

const optionsEl = document.getElementById("options");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");

let shownQuestionId = null; // so we only rebuild rows when the question changes
let busy = false; // guards against double-taps while a write is in flight

start();

async function start() {
  if (!isConfigured()) {
    setStatus("Setup needed", "warn");
    showMessage("Add your Firebase details to js/firebase-config.js to go live.");
    return;
  }

  setStatus("Connecting", "pending");

  try {
    await connect();
  } catch (error) {
    setStatus("Offline", "error");
    showMessage(error.message);
    return;
  }

  setStatus("Live", "live");
  onEventChange(render);
}

function render(event) {
  const question = event.questions[event.currentIndex] ?? null;

  if (!question) {
    shownQuestionId = null;
    questionEl.textContent = "Nothing on screen";
    noteEl.textContent = "One vote per question";
    showMessage("Waiting for the host to put a question up.");
    return;
  }

  questionEl.textContent = question.text;
  noteEl.textContent = `Question ${event.currentIndex + 1} of ${event.questions.length}`;

  if (question.id !== shownQuestionId) {
    buildRows(question);
    shownQuestionId = question.id;
  }

  updateRows(question);
}

function buildRows(question) {
  optionsEl.innerHTML = "";

  for (const option of question.options) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "meter";
    row.dataset.id = option.id;
    row.setAttribute("aria-label", `Vote for ${option.label}`);
    row.innerHTML = `
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

function updateRows(question) {
  const myVote = question.voters[getUid()] ?? null;
  const showResults = myVote !== null;
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
    row.disabled = showResults;
  }
}

async function submitVote(questionId, optionId) {
  if (busy) return;
  busy = true;

  try {
    await castVote(questionId, optionId);
  } catch (error) {
    setStatus("Vote refused", "error");
    console.error(error);
  } finally {
    busy = false;
  }
}

function showMessage(text) {
  optionsEl.innerHTML = `<p class="panel-message">${text}</p>`;
}

function setStatus(text, state) {
  statusEl.textContent = text;
  statusEl.dataset.state = state;
}
