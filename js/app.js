// Audience view: shows the live poll and takes one vote from this device.
// All database work goes through sync.js.

import { connect, onPollChange, castVote, getUid } from "./sync.js";
import { isConfigured } from "./firebase-config.js";

const optionsEl = document.getElementById("options");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");

let myVote = null; // which option this device picked, once it has
let busy = false; // guards against double-taps while a write is in flight

start();

async function start() {
  if (!isConfigured()) {
    setStatus("Setup needed", "warn");
    showMessage(
      "Add your Firebase details to js/firebase-config.js to go live.",
    );
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
  onPollChange(render);
}

function render(poll) {
  if (!poll || !poll.options) {
    questionEl.textContent = "No poll running";
    showMessage("Waiting for the host to start a poll.");
    return;
  }

  myVote = poll.voters ? poll.voters[getUid()] ?? null : null;

  questionEl.textContent = poll.question || "Untitled poll";
  drawOptions(poll.options);
}

function drawOptions(options) {
  const entries = Object.entries(options);
  const total = entries.reduce((sum, [, o]) => sum + (o.votes || 0), 0);
  const showResults = myVote !== null;

  // Rebuild only when the set of options changed, so the CSS width transitions
  // animate smoothly instead of restarting from zero on every update.
  const existingIds = [...optionsEl.querySelectorAll(".meter")].map(
    (el) => el.dataset.id,
  );
  const sameRows =
    existingIds.length === entries.length &&
    entries.every(([id], i) => existingIds[i] === id);

  if (!sameRows) {
    optionsEl.innerHTML = "";
    for (const [id, option] of entries) {
      optionsEl.appendChild(buildRow(id, option.label));
    }
  }

  for (const [id, option] of entries) {
    const row = optionsEl.querySelector(`.meter[data-id="${id}"]`);
    if (!row) continue;

    const votes = option.votes || 0;
    const pct = total === 0 ? 0 : Math.round((votes / total) * 100);

    row.querySelector(".meter-label").textContent = option.label;
    row.querySelector(".meter-fill").style.width = showResults ? pct + "%" : "0%";
    row.querySelector(".meter-needle").style.left = showResults ? pct + "%" : "0%";
    row.querySelector(".meter-pct").textContent = showResults ? pct + "%" : "";
    row.classList.toggle("is-mine", id === myVote);
    row.disabled = showResults;
  }
}

function buildRow(id, label) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "meter";
  row.dataset.id = id;
  row.setAttribute("aria-label", `Vote for ${label}`);
  row.innerHTML = `
    <span class="meter-label"></span>
    <span class="meter-track">
      <span class="meter-fill"></span>
      <span class="meter-needle"></span>
    </span>
    <span class="meter-pct"></span>
  `;
  row.addEventListener("click", () => submitVote(id));
  return row;
}

async function submitVote(optionId) {
  if (myVote !== null || busy) return;
  busy = true;

  try {
    await castVote(optionId);
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
