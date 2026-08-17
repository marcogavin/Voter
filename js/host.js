// Host view, in two modes:
//
//   Setup — write the questions before the event. Add, edit, reorder, delete.
//   Run   — put one question on screen at a time and watch votes land.
//
// They're separated because they're different jobs: authoring wants everything
// visible and editable, presenting wants one thing on screen and no way to
// change it by accident.
//
// The device that first saves questions owns the event; only it can author or
// drive (enforced by database.rules.json).

import {
  connect,
  onEventChange,
  saveQuestions,
  setCurrentIndex,
  setRevealed,
  resetVotes,
  getUid,
} from "./sync.js";
import { isConfigured } from "./firebase-config.js";

const els = {
  tabSetup: document.getElementById("tab-setup"),
  tabRun: document.getElementById("tab-run"),
  viewSetup: document.getElementById("view-setup"),
  viewRun: document.getElementById("view-run"),

  editor: document.getElementById("editor"),
  editorLabel: document.getElementById("editor-label"),
  questionInput: document.getElementById("question-input"),
  optionsInput: document.getElementById("options-input"),
  correctList: document.getElementById("correct-list"),
  save: document.getElementById("save"),
  cancel: document.getElementById("cancel"),
  list: document.getElementById("question-list"),
  setupEmpty: document.getElementById("setup-empty"),

  runQuestion: document.getElementById("run-question"),
  options: document.getElementById("options"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  counter: document.getElementById("counter"),
  reopen: document.getElementById("reopen"),
  reset: document.getElementById("reset"),
  clear: document.getElementById("clear"),

  hint: document.getElementById("hint"),
  status: document.getElementById("status"),
};

let questions = []; // local mirror, in running order
let currentIndex = -1;
let revealed = false;
let editingIndex = null; // which question the form is editing, null when adding
let correctIndex = null; // which option the form has ticked, null for none
let isOwner = true;
let shownQuestionId = null;

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

  try {
    wireUp();
    onEventChange(render);
  } catch (error) {
    setStatus("Broken", "error");
    showMessage(
      `This page didn't start: ${error.message}. A hard refresh usually fixes ` +
        `it — the usual cause is the browser holding an old copy of the page ` +
        `while running the new script.`,
    );
    console.error(error);
  }
}

function wireUp() {
  // A missing element used to kill this function silently, leaving a page that
  // looked connected but never rendered or saved. Name the casualties instead.
  const missing = Object.entries(els)
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`page is missing: ${missing.join(", ")}`);
  }

  els.tabSetup.addEventListener("click", () => showView("setup"));
  els.tabRun.addEventListener("click", () => showView("run"));

  els.editor.addEventListener("submit", onSubmit);
  els.cancel.addEventListener("click", stopEditing);
  els.list.addEventListener("click", onListClick);
  els.optionsInput.addEventListener("input", drawCorrectChoices);
  els.correctList.addEventListener("change", onCorrectChange);

  els.prev.addEventListener("click", () => go(currentIndex - 1));
  els.next.addEventListener("click", onNext);
  els.reopen.addEventListener("click", () => reveal(false));
  els.clear.addEventListener("click", () => go(-1));
  els.reset.addEventListener("click", onReset);

  drawCorrectChoices();
}

/* ── Marking the right answer ──────────────────────────────────────────── */

function parseOptions() {
  return els.optionsInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Redraws the tick list under the options box as they're typed, so the right
 * answer is chosen against the actual options rather than remembered by number.
 */
function drawCorrectChoices() {
  const labels = parseOptions();

  // A shrinking list can strand the tick past the end.
  if (correctIndex !== null && correctIndex >= labels.length) correctIndex = null;

  els.correctList.innerHTML = "";

  if (!labels.length) {
    els.correctList.innerHTML =
      '<p class="panel-message">Add options above to mark one as right.</p>';
    return;
  }

  els.correctList.appendChild(choice("", "No right answer", correctIndex === null));
  labels.forEach((label, index) => {
    els.correctList.appendChild(choice(index, label, correctIndex === index));
  });
}

function choice(value, label, checked) {
  const wrap = document.createElement("label");
  wrap.className = "correct-choice" + (checked ? " is-picked" : "");
  wrap.innerHTML = `
    <input type="radio" name="correct" value="${value}"${checked ? " checked" : ""}>
    <span>${escapeHtml(label)}</span>
  `;
  return wrap;
}

function onCorrectChange(changeEvent) {
  const { value } = changeEvent.target;
  correctIndex = value === "" ? null : Number(value);
  drawCorrectChoices();
}

/* ── Rendering ─────────────────────────────────────────────────────────── */

function render(event) {
  questions = event.questions;
  currentIndex = event.currentIndex;
  revealed = event.revealed;
  isOwner = !event.ownerUid || event.ownerUid === getUid();

  els.hint.textContent = isOwner
    ? "Attendees open the audience page on their phones"
    : "Another device owns this event — view only";

  els.editor.classList.toggle("is-locked", !isOwner);
  for (const control of [els.questionInput, els.optionsInput, els.save]) {
    control.disabled = !isOwner;
  }

  // The question being edited can disappear under us — another device could
  // delete it, or this one could while the save is still in flight.
  if (editingIndex !== null && editingIndex >= questions.length) {
    stopEditing();
  }

  if (editingIndex === null) {
    els.editorLabel.textContent = `Question ${questions.length + 1}`;
  }

  drawList();
  drawRun();
}

function drawList() {
  els.list.innerHTML = "";
  els.setupEmpty.hidden = questions.length > 0;

  questions.forEach((question, index) => {
    const item = document.createElement("li");
    item.className = "qitem" + (index === editingIndex ? " is-editing" : "");
    item.dataset.index = String(index);
    const answer = question.options.find((o) => o.id === question.correct);
    item.innerHTML = `
      <span class="qnum">${index + 1}</span>
      <span class="qtext">
        ${escapeHtml(question.text)}
        <small>${question.options.length} options${
          answer ? ` · ✓ ${escapeHtml(answer.label)}` : ""
        }</small>
      </span>
      <span class="qbtns">
        <button type="button" class="iconbtn" data-act="up"   aria-label="Move up"    ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="iconbtn" data-act="down" aria-label="Move down"  ${index === questions.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="iconbtn" data-act="edit" aria-label="Edit">✎</button>
        <button type="button" class="iconbtn" data-act="del"  aria-label="Delete">✕</button>
      </span>
    `;
    for (const button of item.querySelectorAll("button")) {
      button.disabled = button.disabled || !isOwner;
    }
    els.list.appendChild(item);
  });
}

function drawRun() {
  const question = questions[currentIndex] ?? null;

  els.counter.textContent = questions.length
    ? `${question ? currentIndex + 1 : "—"} / ${questions.length}`
    : "—";

  // Next does double duty, but only where there's something to reveal:
  // questions with no right answer advance on a single press. And with
  // nothing on screen yet it isn't a "next" at all — it's the thing that
  // begins the run.
  const willReveal = Boolean(question) && !revealed && Boolean(question.correct);
  els.next.textContent = !question
    ? "Start"
    : willReveal
      ? "Reveal answer"
      : "Next ›";

  els.prev.disabled = !isOwner || currentIndex <= 0;
  els.next.disabled =
    !isOwner ||
    !questions.length ||
    (!willReveal && currentIndex >= questions.length - 1);
  els.reopen.hidden = !revealed;
  els.reopen.disabled = !isOwner;
  els.reset.disabled = !isOwner || !question;
  els.clear.disabled = !isOwner || !question;

  if (!question) {
    shownQuestionId = null;
    els.runQuestion.textContent = questions.length
      ? "Nothing on screen"
      : "No questions yet";
    els.options.innerHTML = `<p class="panel-message">${
      questions.length
        ? "Press Next to put the first question up."
        : "Add questions in Setup first."
    }</p>`;
    return;
  }

  els.runQuestion.textContent = question.text;

  if (question.id !== shownQuestionId) {
    els.options.innerHTML = "";
    for (const option of question.options) {
      const row = document.createElement("div");
      row.className = "meter meter--static";
      row.dataset.id = option.id;
      row.innerHTML = `
        <span class="meter-label"></span>
        <span class="meter-track">
          <span class="meter-fill"></span>
          <span class="meter-needle"></span>
        </span>
        <span class="meter-pct"></span>
      `;
      els.options.appendChild(row);
    }
    shownQuestionId = question.id;
  }

  const total = question.options.reduce((sum, o) => sum + o.votes, 0);
  const scored = revealed && question.correct !== null;

  for (const option of question.options) {
    const row = els.options.querySelector(`.meter[data-id="${option.id}"]`);
    if (!row) continue;

    const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);
    row.querySelector(".meter-label").textContent = option.label;
    row.querySelector(".meter-fill").style.width = pct + "%";
    row.querySelector(".meter-needle").style.left = pct + "%";
    row.querySelector(".meter-pct").textContent = `${pct}%`;

    row.classList.toggle("is-right", scored && option.id === question.correct);
    row.classList.toggle("is-wrong", scored && option.id !== question.correct);
    // Before revealing, the presenter still needs to know which one it is.
    row.classList.toggle(
      "is-key",
      !revealed && option.id === question.correct,
    );
  }

  els.hint.textContent =
    `${total} vote${total === 1 ? "" : "s"} in` +
    (revealed ? " · voting closed" : "");
}

/* ── Setup actions ─────────────────────────────────────────────────────── */

async function onSubmit(submitEvent) {
  submitEvent.preventDefault();

  const text = els.questionInput.value.trim();
  const labels = els.optionsInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!text || labels.length < 2) {
    setStatus("Need 2+ options", "warn");
    return;
  }

  const next = [...questions];
  const correct = correctIndex === null ? null : optionId(correctIndex);

  if (editingIndex === null) {
    next.push({ text, correct, options: labels.map(toOption), voters: {} });
  } else {
    const existing = next[editingIndex];
    const sameOptions =
      existing.options.length === labels.length &&
      existing.options.every((option, i) => option.label === labels[i]);

    // Votes belong to specific options, so they only survive an edit that
    // leaves the options themselves untouched.
    next[editingIndex] = sameOptions
      ? { ...existing, text, correct }
      : { text, correct, options: labels.map(toOption), voters: {} };
  }

  // Only clear the form once the save has actually landed — otherwise a
  // refused write silently throws away what was just typed.
  if (await commit(next, editingIndex === null ? "Added" : "Saved")) {
    stopEditing();
    els.questionInput.focus();
  }
}

function onListClick(clickEvent) {
  const button = clickEvent.target.closest("button[data-act]");
  if (!button || !isOwner) return;

  const index = Number(button.closest(".qitem").dataset.index);
  const next = [...questions];

  switch (button.dataset.act) {
    case "up":
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      commit(next, "Moved");
      break;

    case "down":
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      commit(next, "Moved");
      break;

    case "edit":
      startEditing(index);
      break;

    case "del":
      next.splice(index, 1);
      // Keep whatever is on screen on screen, even as indices shift beneath it.
      if (currentIndex === index) setCurrentIndex(-1);
      else if (currentIndex > index) setCurrentIndex(currentIndex - 1);
      commit(next, "Deleted");
      break;
  }
}

function startEditing(index) {
  const question = questions[index];
  editingIndex = index;
  els.questionInput.value = question.text;
  els.optionsInput.value = question.options.map((o) => o.label).join("\n");

  const marked = question.options.findIndex((o) => o.id === question.correct);
  correctIndex = marked === -1 ? null : marked;
  drawCorrectChoices();

  els.editorLabel.textContent = `Editing question ${index + 1}`;
  els.save.textContent = "Save changes";
  els.cancel.hidden = false;
  drawList();
  els.questionInput.focus();
}

function stopEditing() {
  editingIndex = null;
  correctIndex = null;
  els.editor.reset();
  drawCorrectChoices();
  els.editorLabel.textContent = `Question ${questions.length + 1}`;
  els.save.textContent = "Add question";
  els.cancel.hidden = true;
  drawList();
}

/** Returns true when the write landed, so callers know not to discard input. */
async function commit(next, verb) {
  try {
    await saveQuestions(next);
    setStatus(verb, "live");
    return true;
  } catch (error) {
    setStatus("Refused", "error");
    els.hint.textContent = `Database refused the write: ${error.message}`;
    console.error(error);
    return false;
  }
}

/* ── Run actions ───────────────────────────────────────────────────────── */

function onNext() {
  const question = questions[currentIndex] ?? null;

  // Reveal first, advance second — but only for questions that have an answer
  // to show. The rest would just be an extra press on the way to nowhere.
  if (question && !revealed && question.correct) {
    reveal(true);
  } else {
    go(currentIndex + 1);
  }
}

async function reveal(show) {
  try {
    await setRevealed(show);
    setStatus(show ? "Revealed" : "Reopened", "live");
  } catch (error) {
    setStatus("Refused", "error");
    console.error(error);
  }
}

async function go(index) {
  const target = index < 0 || index >= questions.length ? -1 : index;
  try {
    await setCurrentIndex(target);
  } catch (error) {
    setStatus("Refused", "error");
    console.error(error);
  }
}

async function onReset() {
  const question = questions[currentIndex];
  if (!question) return;

  try {
    await resetVotes(question);
    setStatus("Reset", "live");
  } catch (error) {
    setStatus("Refused", "error");
    console.error(error);
  }
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function showView(name) {
  const setup = name === "setup";
  els.viewSetup.hidden = !setup;
  els.viewRun.hidden = setup;
  els.tabSetup.classList.toggle("is-active", setup);
  els.tabRun.classList.toggle("is-active", !setup);
}

function toOption(label) {
  return { label, votes: 0 };
}

/** 0 → "a", 1 → "b", … matching how sync.js keys stored options. */
function optionId(index) {
  return String.fromCharCode(97 + index);
}

function escapeHtml(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function showMessage(text) {
  els.options.innerHTML = `<p class="panel-message">${text}</p>`;
}

function setStatus(text, state) {
  els.status.textContent = text;
  els.status.dataset.state = state;
}
