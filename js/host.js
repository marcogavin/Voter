// Host view: create the poll, watch results come in, reset between rounds.
// The device that creates a poll becomes its owner; only that device can
// change the question or reset the counters (enforced by database.rules.json).

import { connect, onPollChange, createPoll, resetVotes, getUid } from "./sync.js";
import { isConfigured } from "./firebase-config.js";

const optionsEl = document.getElementById("options");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");
const setupEl = document.getElementById("setup");
const questionInput = document.getElementById("question-input");
const optionsInput = document.getElementById("options-input");
const resetButton = document.getElementById("reset");

let currentPoll = null;

start();

async function start() {
  if (!isConfigured()) {
    setStatus("Setup needed", "warn");
    questionEl.textContent = "Setup needed";
    showMessage("Add your Firebase details to js/firebase-config.js to go live.");
    return;
  }

  setStatus("Connecting", "pending");

  try {
    await connect();
  } catch (error) {
    setStatus("Offline", "error");
    questionEl.textContent = "Can't connect";
    showMessage(error.message);
    return;
  }

  setStatus("Live", "live");
  setupEl.hidden = false;
  setupEl.addEventListener("submit", onCreate);
  resetButton.addEventListener("click", onReset);

  onPollChange(render);
}

function render(poll) {
  currentPoll = poll;

  const isOwner = !poll || !poll.ownerUid || poll.ownerUid === getUid();
  setupEl.classList.toggle("is-locked", !isOwner);
  questionInput.disabled = !isOwner;
  optionsInput.disabled = !isOwner;
  resetButton.disabled = !isOwner || !poll;
  setupEl.querySelector('button[type="submit"]').disabled = !isOwner;

  if (!isOwner) {
    hintEl.textContent = "Another device owns this poll — view only";
  }

  if (!poll || !poll.options) {
    questionEl.textContent = "No poll running";
    showMessage("Fill in the form below to start one.");
    return;
  }

  questionEl.textContent = poll.question || "Untitled poll";
  drawResults(poll.options);
}

function drawResults(options) {
  const entries = Object.entries(options);
  const total = entries.reduce((sum, [, o]) => sum + (o.votes || 0), 0);

  const existingIds = [...optionsEl.querySelectorAll(".meter")].map(
    (el) => el.dataset.id,
  );
  const sameRows =
    existingIds.length === entries.length &&
    entries.every(([id], i) => existingIds[i] === id);

  if (!sameRows) {
    optionsEl.innerHTML = "";
    for (const [id] of entries) {
      optionsEl.appendChild(buildRow(id));
    }
  }

  for (const [id, option] of entries) {
    const row = optionsEl.querySelector(`.meter[data-id="${id}"]`);
    if (!row) continue;

    const votes = option.votes || 0;
    const pct = total === 0 ? 0 : Math.round((votes / total) * 100);

    row.querySelector(".meter-label").textContent = option.label;
    row.querySelector(".meter-fill").style.width = pct + "%";
    row.querySelector(".meter-needle").style.left = pct + "%";
    row.querySelector(".meter-pct").textContent = `${pct}%`;
  }

  hintEl.textContent = `${total} vote${total === 1 ? "" : "s"} in`;
}

function buildRow(id) {
  const row = document.createElement("div");
  row.className = "meter meter--static";
  row.dataset.id = id;
  row.innerHTML = `
    <span class="meter-label"></span>
    <span class="meter-track">
      <span class="meter-fill"></span>
      <span class="meter-needle"></span>
    </span>
    <span class="meter-pct"></span>
  `;
  return row;
}

async function onCreate(event) {
  event.preventDefault();

  const question = questionInput.value.trim();
  const labels = optionsInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!question || labels.length < 2) {
    setStatus("Need 2+ options", "warn");
    return;
  }

  try {
    await createPoll(question, labels);
    setStatus("Live", "live");
    questionInput.value = "";
    optionsInput.value = "";
  } catch (error) {
    setStatus("Refused", "error");
    console.error(error);
  }
}

async function onReset() {
  if (!currentPoll || !currentPoll.options) return;

  try {
    await resetVotes(Object.keys(currentPoll.options));
    setStatus("Reset", "live");
  } catch (error) {
    setStatus("Refused", "error");
    console.error(error);
  }
}

function showMessage(text) {
  optionsEl.innerHTML = `<p class="panel-message">${text}</p>`;
}

function setStatus(text, state) {
  statusEl.textContent = text;
  statusEl.dataset.state = state;
}
