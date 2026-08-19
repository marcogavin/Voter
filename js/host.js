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
  setBlanked,
  isAnonymous,
  accountName,
  signInWithGoogle,
  signOutHost,
  saveLanguage,
  saveSeconds,
  newDeck,
  renameDeck,
  deleteDeck,
  setCurrentDeck,
  resetVotes,
  resetAllVotes,
  getUid,
  serverNow,
  DECK_MAX,
  TITLE_MAX,
} from "./sync.js";
import { isConfigured, SECONDS_CHOICES } from "./firebase-config.js";
import { encode } from "./qr.js";
import { drawIcons, icons } from "./icons.js";
import {
  t,
  setLanguage,
  applyStaticText,
  LANGUAGES,
  getLanguage,
} from "./i18n.js";

// What this build of the app can do, read by the freshness check in the page.
// A browser can serve a fresh page against a cached older script, and the only
// symptom is controls that don't respond — so the script says what it is.
window.VOTR_BUILD = ["polls", "timer", "qr", "icons", "gate", "picker"];

const els = {
  tabs: document.getElementById("tabs"),
  signedOut: document.getElementById("signed-out"),
  tabSetup: document.getElementById("tab-setup"),
  tabRun: document.getElementById("tab-run"),
  viewSetup: document.getElementById("view-setup"),
  viewRun: document.getElementById("view-run"),

  deck: document.getElementById("deck"),
  deckNew: document.getElementById("deck-new"),
  deckRename: document.getElementById("deck-rename"),
  deckDelete: document.getElementById("deck-delete"),

  editor: document.getElementById("editor"),
  editorLabel: document.getElementById("editor-label"),
  questionInput: document.getElementById("question-input"),
  optionsInput: document.getElementById("options-input"),
  correctList: document.getElementById("correct-list"),
  questionCount: document.getElementById("question-count"),
  optionsCount: document.getElementById("options-count"),
  formError: document.getElementById("form-error"),
  save: document.getElementById("save"),
  cancel: document.getElementById("cancel"),
  list: document.getElementById("question-list"),
  setupEmpty: document.getElementById("setup-empty"),
  language: document.getElementById("language"),
  seconds: document.getElementById("seconds"),

  runDeck: document.getElementById("run-deck"),
  runQuestion: document.getElementById("run-question"),
  options: document.getElementById("options"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  counter: document.getElementById("counter"),
  blank: document.getElementById("blank"),
  reopen: document.getElementById("reopen"),
  reset: document.getElementById("reset"),
  clear: document.getElementById("clear"),

  account: document.getElementById("account"),
  signin: document.getElementById("signin"),
  signout: document.getElementById("signout"),
  askOverlay: document.getElementById("ask-overlay"),
  askForm: document.getElementById("ask-form"),
  askTitle: document.getElementById("ask-title"),
  askInput: document.getElementById("ask-input"),
  askOk: document.getElementById("ask-ok"),
  askCancel: document.getElementById("ask-cancel"),

  qr: document.getElementById("qr"),
  qrOverlay: document.getElementById("qr-overlay"),
  qrArt: document.getElementById("qr-art"),
  qrUrl: document.getElementById("qr-url"),
  qrClose: document.getElementById("qr-close"),
  hint: document.getElementById("hint"),
  status: document.getElementById("status"),
};

// These mirror the limits in database.rules.json. Keeping them in step means
// the form refuses what the database would refuse, in a place you can see.
const QUESTION_MAX = 200;
const OPTION_MAX = 100;

let askedAt = null;
let seconds = 0; // how long a question stays open; 0 for no limit
let secondsMenu = null; // signature of what the duration picker currently offers
let ticker = null;

let decks = []; // every saved poll: { id, title, count }
let currentDeck = null; // the one being edited here and presented to the room
let deckMenu = null; // signature of what the poll picker currently offers
let askResolve = null; // settles the promise the ask overlay is standing in for

let likes = 0; // applause on the closing screen
let questions = []; // the live poll's questions, in running order
let currentIndex = -1;
let revealed = false;
let blanked = false;
let editingIndex = null; // which question the form is editing, null when adding
let correctIndex = null; // which option the form has ticked, null for none
let isOwner = true;
let signedIn = false; // a Google account, not just an anonymous device
let mode = "setup"; // which tab is chosen, independent of whether it's shown
let shownQuestionId = null;

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
    showMessage(error.message);
    return;
  }

  setStatus("live", "live");

  try {
    wireUp();

    // The page ships gated, and render() only opens it once the database
    // answers. Auth is settled by the time connect() resolves, so the gate is
    // decided here too — otherwise a host who is already signed in reads
    // "sign in to set up and run polls" for the second before the first
    // snapshot lands.
    signedIn = !isAnonymous();
    applyViews();

    onEventChange(render);
  } catch (error) {
    setStatus("broken", "error");
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

  els.deck.addEventListener("change", onDeckChange);
  els.deckNew.addEventListener("click", onDeckNew);
  els.deckRename.addEventListener("click", onDeckRename);
  els.deckDelete.addEventListener("click", onDeckDelete);

  els.askForm.addEventListener("submit", onAskSubmit);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAsk(null);
    hideQr();
  });
  els.askCancel.addEventListener("click", () => closeAsk(null));
  els.askOverlay.addEventListener("click", (event) => {
    if (event.target === els.askOverlay) closeAsk(null);
  });

  els.editor.addEventListener("submit", onSubmit);
  els.cancel.addEventListener("click", stopEditing);
  els.list.addEventListener("click", onListClick);
  els.questionInput.setAttribute("maxlength", String(QUESTION_MAX));
  els.questionInput.addEventListener("input", drawCounts);
  els.optionsInput.addEventListener("input", drawCounts);
  els.optionsInput.addEventListener("input", drawCorrectChoices);
  els.correctList.addEventListener("change", onCorrectChange);

  els.prev.addEventListener("click", () => go(currentIndex - 1));
  els.next.addEventListener("click", onNext);
  els.reopen.addEventListener("click", () => reveal(false));
  els.clear.addEventListener("click", () => go(-1));
  els.blank.addEventListener("click", () => blank(!blanked));
  els.reset.addEventListener("click", onReset);

  drawIcons();

  fillLanguages();
  els.language.addEventListener("change", onLanguageChange);

  fillSeconds();
  els.seconds.addEventListener("change", onSecondsChange);

  els.qr.addEventListener("click", showQr);
  els.qrClose.addEventListener("click", hideQr);
  els.qrOverlay.addEventListener("click", (event) => {
    if (event.target === els.qrOverlay) hideQr();
  });

  els.signin.addEventListener("click", onSignIn);
  els.signout.addEventListener("click", () => signOutHost());

  drawCorrectChoices();
  drawCounts();
}

/* ── Character counts ──────────────────────────────────────────────────── */

/**
 * Counts down as you type, so a limit is visible before it's hit rather than
 * discovered as a refusal after pressing the button.
 */
function drawCounts() {
  const left = QUESTION_MAX - els.questionInput.value.length;
  els.questionCount.textContent = format(left);
  els.questionCount.classList.toggle("is-over", left < 0);

  // One count per answer rather than a single worst-case number: a summary
  // says something is too long without saying which one to shorten.
  els.optionsCount.innerHTML = "";
  parseOptions().forEach((line, index) => {
    const remaining = OPTION_MAX - line.length;
    const chip = document.createElement("span");
    chip.className = "charchip" + (remaining < 0 ? " is-over" : "");
    chip.textContent = `${index + 1} · ${format(remaining)}`;
    els.optionsCount.appendChild(chip);
  });
}

/** Counts down, and goes negative once past the limit. */
function format(remaining) {
  return remaining < 0 ? `\u2212${Math.abs(remaining)}` : String(remaining);
}

function showFormError(text) {
  els.formError.textContent = text ?? "";
  els.formError.hidden = !text;
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
      `<p class="panel-message">${t("addOptionsFirst")}</p>`;
    return;
  }

  els.correctList.appendChild(
    choice("", t("noRightAnswer"), correctIndex === null),
  );
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
  decks = event.decks;

  // A half-written question belongs to the poll it was started in, and its
  // index means something different in the one being switched to. Acted on
  // below, once the language and ownership this render is drawing with settle.
  const switchedDeck = event.currentDeck !== currentDeck;
  currentDeck = event.currentDeck;
  if (switchedDeck) shownQuestionId = null;

  currentIndex = event.currentIndex;
  revealed = event.revealed;
  blanked = event.blanked;
  askedAt = event.askedAt;
  seconds = event.seconds;
  likes = event.likes;

  // The language belongs to the event, so a change made on any device
  // re-renders every string here. This has to run before anything below
  // reads t(), or that text is written in the language being replaced.
  if (setLanguage(event.lang)) {
    applyStaticText();
    fillLanguages();
    drawCorrectChoices();
    drawCounts();
    shownQuestionId = null;
    setStatus(els.status.dataset.key, els.status.dataset.state);
  }

  // Only a signed-in account can hold or claim an event. An anonymous
  // visitor watches; that's what stops an attendee who finds this page.
  signedIn = !isAnonymous();
  applyViews();
  isOwner = signedIn && (!event.ownerUid || event.ownerUid === getUid());

  els.signin.hidden = signedIn;
  els.signout.hidden = !signedIn;
  if (!els.account.classList.contains("is-error")) {
    els.account.textContent = signedIn
      ? t("signedInAs", { name: accountName() ?? "—" })
      : t("signInPrompt");
  }

  els.language.value = getLanguage();
  els.language.disabled = !isOwner;

  fillSeconds();
  els.seconds.value = String(seconds);
  els.seconds.disabled = !isOwner;

  fillDecks();
  els.deck.setAttribute("aria-label", t("pickExisting"));
  els.deck.value = currentDeck;
  els.deck.disabled = !isOwner;
  els.deckNew.disabled = !isOwner || decks.length >= DECK_MAX;
  els.deckRename.disabled = !isOwner;
  // An event always keeps one poll; there'd be nothing to fall back to.
  els.deckDelete.disabled = !isOwner || decks.length < 2;
  nameButton(els.signout, t("signOut"));
  nameButton(els.deckRename, t("renamePoll"));
  nameButton(els.deckDelete, t("deletePoll"));

  if (isOwner) {
    els.hint.innerHTML = t("attendeesHint", { url: "<b></b>" });
    const slot = els.hint.querySelector("b");
    if (slot) slot.textContent = audienceUrl();
  } else {
    els.hint.textContent = signedIn ? t("viewOnly") : t("signInPrompt");
  }

  els.editor.classList.toggle("is-locked", !isOwner);
  for (const control of [els.questionInput, els.optionsInput, els.save]) {
    control.disabled = !isOwner;
  }

  // The question being edited can disappear under us — another device could
  // delete it, or this one could while the save is still in flight. Switching
  // poll does the same thing to it, less visibly.
  if (switchedDeck || (editingIndex !== null && editingIndex >= questions.length)) {
    stopEditing();
  }

  drawEditorLabels();
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
        <small>${t("optionsCount", { n: question.options.length })}${
          answer ? ` · ✓ ${escapeHtml(answer.label)}` : ""
        }</small>
      </span>
      <span class="qbtns">
        <button type="button" class="iconbtn" data-act="up"   aria-label="${t("moveUp")}"    ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="iconbtn" data-act="down" aria-label="${t("moveDown")}"  ${index === questions.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="iconbtn" data-act="edit" aria-label="${t("edit")}">✎</button>
        <button type="button" class="iconbtn" data-act="del"  aria-label="${t("delete")}">✕</button>
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

  // Named, so a host running several polls in one session can tell which is
  // live at a glance rather than by recognising the questions. The name is
  // written into a <b> rather than interpolated, so a poll called "<script>"
  // stays a poll called "<script>".
  els.runDeck.innerHTML = t("pollNamed", { name: "<b></b>" });
  const slot = els.runDeck.querySelector("b");
  if (slot) slot.textContent = deckTitle(liveDeck());

  // One past the last question is the closing screen rather than nothing at
  // all: a poll should finish somewhere rather than just stop responding.
  const atEnd = questions.length > 0 && currentIndex === questions.length;

  els.counter.textContent = !questions.length
    ? "—"
    : atEnd
      ? t("theEnd")
      : `${question ? currentIndex + 1 : "—"} / ${questions.length}`;

  // Next does double duty, but only where there's something to reveal:
  // questions with no right answer advance on a single press. And with
  // nothing up yet it isn't a "next" at all — it's what begins the run.
  const willReveal = Boolean(question) && !revealed && Boolean(question.correct);
  setLabel(
    els.next,
    atEnd ? t("next") : !question ? t("start") : willReveal ? t("revealAnswer") : t("next"),
  );

  els.prev.disabled = !isOwner || currentIndex <= 0;
  els.next.disabled =
    !isOwner || !questions.length || (!willReveal && currentIndex >= questions.length);
  els.reopen.hidden = !revealed;
  els.reopen.disabled = !isOwner;
  // With nothing on screen there's no single question to clear, but wanting a
  // clean slate before running the set again is exactly when this is needed.
  setLabel(els.reset, question ? t("resetVotes") : t("resetAllVotes"));
  els.reset.disabled = !isOwner || !questions.length;
  els.clear.disabled = !isOwner || (!question && !atEnd);

  // Blanking only means anything while something is up.
  setLabel(els.blank, blanked ? t("showScreen") : t("hideScreen"));
  els.blank.querySelector(".btn-icon").dataset.icon = blanked ? "show" : "hide";
  drawIcons(els.blank);
  els.blank.classList.toggle("btn--primary", blanked);
  els.blank.disabled = !isOwner || (!question && !atEnd && !blanked);

  if (atEnd) {
    shownQuestionId = null;
    els.runQuestion.textContent = t("likeVotr");
    // The host watches the applause arrive; only the audience can add to it.
    els.options.innerHTML =
      `<p class="tally"><span class="tally-heart" aria-hidden="true"></span>` +
      `<span class="tally-count">${likes}</span></p>` +
      `<p class="panel-message">${t("likeHostNote")}</p>`;
    els.options.querySelector(".tally-heart").innerHTML = icons.heart;
    return;
  }

  if (!question) {
    shownQuestionId = null;
    els.runQuestion.textContent = questions.length
      ? t("nothingOnScreen")
      : t("noQuestions");
    els.options.innerHTML = `<p class="panel-message">${
      questions.length ? t("pressStart") : t("addInSetup")
    }</p>`;
    return;
  }

  // The host keeps seeing the question and its results while blanked — the
  // point is that the audience doesn't, not that the presenter flies blind.
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

  watchClock();

  els.hint.textContent = blanked
    ? t("screenHiddenNote")
    : (total === 1 ? t("voteCountOne") : t("voteCount", { n: total })) +
      (revealed ? t("votingClosedSuffix") : "");
}

/* ── Polls ─────────────────────────────────────────────────────────────── */

/**
 * The picker carries the question count as well as the name, because the one
 * thing you want to know before switching is whether you're switching to the
 * poll you actually wrote.
 */
function fillDecks() {
  const signature = JSON.stringify([getLanguage(), decks]);

  // Same reason as the duration picker: render() runs on every vote, and
  // rebuilding a <select> closes it under whoever is choosing.
  if (signature === deckMenu) return;
  deckMenu = signature;

  els.deck.innerHTML = "";
  for (const deck of decks) {
    const option = document.createElement("option");
    option.value = deck.id;
    option.textContent = `${deckTitle(deck)} · ${t("questionsCount", {
      n: deck.count,
    })}`;
    els.deck.appendChild(option);
  }
}

/** Falls back to the poll's position, so an unnamed one is still findable. */
function deckTitle(deck) {
  if (!deck) return "";
  const index = decks.findIndex((other) => other.id === deck.id);
  return deck.title || t("pollN", { n: index + 1 });
}

function liveDeck() {
  return decks.find((deck) => deck.id === currentDeck) ?? null;
}

async function onDeckChange(changeEvent) {
  const id = changeEvent.target.value;
  if (id === currentDeck) return;

  // Switching moves the whole room, so it shouldn't be something a stray tap
  // in Setup does while a question is up in front of an audience.
  if (currentIndex >= 0 && !(await ask({ title: t("switchPollWarn") }))) {
    els.deck.value = currentDeck;
    return;
  }

  try {
    await setCurrentDeck(id);
    setStatus("switched", "live");
  } catch (error) {
    els.deck.value = currentDeck;
    setStatus("refused", "error");
    console.error(error);
  }
}

async function onDeckNew() {
  if (decks.length >= DECK_MAX) return;

  const title = await ask({
    title: t("namePoll"),
    value: t("pollN", { n: decks.length + 1 }),
  });
  if (title === null) return;

  try {
    await newDeck(
      title.slice(0, TITLE_MAX),
      decks.map((deck) => deck.id),
    );
    setStatus("added", "live");
  } catch (error) {
    setStatus("refused", "error");
    els.hint.textContent = `Database refused the write: ${error.message}`;
    console.error(error);
  }
}

async function onDeckRename() {
  const deck = liveDeck();
  if (!deck) return;

  const title = await ask({ title: t("namePoll"), value: deckTitle(deck) });
  if (title === null) return;

  try {
    await renameDeck(deck.id, title.slice(0, TITLE_MAX));
    setStatus("saved", "live");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

async function onDeckDelete() {
  const deck = liveDeck();
  if (!deck || decks.length < 2) return;

  const confirmed = await ask({
    title: t("deletePollWarn", { title: deckTitle(deck), n: deck.count }),
    ok: t("delete"),
  });
  if (!confirmed) return;

  try {
    await deleteDeck(
      deck.id,
      decks.map((other) => other.id),
    );
    setStatus("deleted", "live");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

/* ── Asking for a name, or for a confirmation ──────────────────────────── */

/**
 * Stands in for prompt() and confirm(), which arrive in the browser's own
 * language and styling rather than the room's.
 *
 * Resolves with the typed string, or with true for a confirmation, or with
 * null if it was dismissed. Pass `value` to ask for text; leave it out and
 * the field is hidden, which is what makes this a confirmation.
 */
function ask({ title, value = null, ok = null }) {
  closeAsk(null); // settle an earlier one rather than leaving it hanging

  els.askTitle.textContent = title;
  els.askInput.hidden = value === null;
  els.askInput.value = value ?? "";
  els.askInput.setAttribute("maxlength", String(TITLE_MAX));
  setLabel(els.askOk, ok ?? t("ok"));
  els.askOverlay.hidden = false;

  if (value !== null) {
    els.askInput.focus();
    els.askInput.select();
  } else {
    els.askOk.focus();
  }

  return new Promise((resolve) => {
    askResolve = resolve;
  });
}

function onAskSubmit(submitEvent) {
  submitEvent.preventDefault();

  if (els.askInput.hidden) return closeAsk(true);

  // An unnamed poll can't be told apart from another unnamed one. Refuse
  // by putting the cursor back rather than by doing nothing at all.
  const typed = els.askInput.value.trim();
  if (typed) closeAsk(typed);
  else els.askInput.focus();
}

function closeAsk(answer) {
  if (!askResolve) return;

  const resolve = askResolve;
  askResolve = null;
  els.askOverlay.hidden = true;
  resolve(answer);
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
    setStatus("needTwoOptions", "warn");
    showFormError(t("needTwoOptions"));
    return;
  }

  // Catch an over-long answer here rather than letting the database refuse it,
  // which reported into the footer where it couldn't be seen.
  const overLong = labels.findIndex((label) => label.length > OPTION_MAX);
  if (overLong !== -1) {
    setStatus("needTwoOptions", "warn");
    showFormError(
      t("optionTooLong", {
        i: overLong + 1,
        n: labels[overLong].length,
        max: OPTION_MAX,
      }),
    );
    return;
  }

  showFormError(null);

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
  if (await commit(next, editingIndex === null ? "added" : "saved")) {
    stopEditing();
    els.questionInput.focus();
  } else {
    showFormError(els.hint.textContent);
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
      commit(next, "moved");
      break;

    case "down":
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      commit(next, "moved");
      break;

    case "edit":
      startEditing(index);
      break;

    case "del":
      next.splice(index, 1);
      // Keep whatever is on screen on screen, even as indices shift beneath it.
      if (currentIndex === index) setCurrentIndex(-1);
      else if (currentIndex > index) setCurrentIndex(currentIndex - 1);
      commit(next, "deleted");
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

  drawCounts();
  drawEditorLabels();
  drawList();
  els.questionInput.focus();
}

/**
 * The form's own labels depend on whether a question is being edited, and on
 * the current language. Deriving them in one place means every render keeps
 * them current instead of leaving whichever language they were written in.
 */
function drawEditorLabels() {
  const adding = editingIndex === null;

  els.editorLabel.textContent = adding
    ? t("questionN", { n: questions.length + 1 })
    : t("editingQuestionN", { n: editingIndex + 1 });
  setLabel(els.save, adding ? t("addQuestion") : t("saveChanges"));
  els.cancel.hidden = adding;
}

function stopEditing() {
  editingIndex = null;
  correctIndex = null;
  els.editor.reset();
  showFormError(null);
  drawCorrectChoices();
  drawCounts();
  drawEditorLabels();
  drawList();
}

/** Returns true when the write landed, so callers know not to discard input. */
async function commit(next, verb) {
  try {
    await saveQuestions(next);
    setStatus(verb, "live");
    return true;
  } catch (error) {
    setStatus("refused", "error");
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
    setStatus(show ? "revealed" : "reopened", "live");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

async function go(index) {
  // questions.length is the closing screen; anything past it is nothing.
  const target = index < 0 || index > questions.length ? -1 : index;
  try {
    await setCurrentIndex(target);
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

/**
 * Closes the current question when its time runs out. Only the owner may
 * write that, so the host's page is what actually ends it — the audience
 * merely stops offering the buttons.
 *
 * With the limit set to none there's nothing to watch: the question stays open
 * until the host closes it, and the counter keeps the plain "3 / 10" drawn by
 * drawRun rather than growing a clock that never runs down.
 */
function watchClock() {
  clearInterval(ticker);
  ticker = null;

  const question = questions[currentIndex] ?? null;
  if (!isOwner || !question || revealed || !askedAt || !seconds) return;

  ticker = setInterval(() => {
    const gone = (serverNow() - askedAt) / 1000;
    const left = Math.max(0, Math.ceil(seconds - gone));

    els.counter.textContent = `${currentIndex + 1} / ${questions.length} · ${left}s`;
    if (left === 0) {
      clearInterval(ticker);
      ticker = null;
      reveal(true);
    }
  }, 250);
}

async function onSignIn() {
  // Report next to the button that was pressed. The status badge and hint sit
  // in the footer, which on a phone is below the fold exactly when sign-in
  // fails — so a failure looked like nothing happening at all.
  els.account.textContent = "…";

  try {
    await signInWithGoogle();
  } catch (error) {
    setStatus("refused", "error");
    els.account.textContent = explain(error);
    els.account.classList.add("is-error");
    console.error(error);
  }
}

/** Firebase's own messages don't say which console setting is missing. */
function explain(error) {
  switch (error.code) {
    case "auth/unauthorized-domain":
      return `This site isn't on the Firebase allow-list. Add ${location.hostname} under Authentication → Settings → Authorized domains.`;
    case "auth/operation-not-allowed":
      return "Google sign-in isn't switched on. Enable it under Authentication → Sign-in method.";
    case "auth/network-request-failed":
      return "Couldn't reach Google. Check the connection and try again.";
    case undefined:
      // No auth/ code means it isn't Firebase Auth complaining — in practice
      // it's the browser refusing the storage the session is kept in.
      return `The browser blocked the sign-in from being saved (${error.message}). Turning off Private Browsing for this site usually fixes it.`;
    default:
      return `${error.code || "Sign-in failed"} — ${error.message}`;
  }
}

async function blank(hide) {
  try {
    await setBlanked(hide);
    setStatus(hide ? "hidden" : "shown", "live");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

function fillLanguages() {
  const chosen = getLanguage();
  els.language.innerHTML = "";

  for (const [code, name] of Object.entries(LANGUAGES)) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    option.selected = code === chosen;
    els.language.appendChild(option);
  }
}

async function onLanguageChange(changeEvent) {
  try {
    await saveLanguage(changeEvent.target.value);
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

/**
 * Offers the standard durations plus whatever the event is already set to, so
 * a value set from somewhere else can still be seen rather than leaving the
 * picker looking empty.
 */
function fillSeconds() {
  const choices = [...new Set([...SECONDS_CHOICES, seconds])].sort(
    (a, b) => a - b,
  );
  const signature = getLanguage() + ":" + choices.join(",");

  // Rebuilding a <select> closes it under whoever is choosing, and render()
  // runs on every vote that lands. Only touch it when it would really differ.
  if (signature === secondsMenu) return;
  secondsMenu = signature;

  els.seconds.innerHTML = "";
  for (const value of choices) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent =
      value === 0 ? t("noTimeLimit") : t("secondsOption", { n: value });
    els.seconds.appendChild(option);
  }
}

async function onSecondsChange(changeEvent) {
  try {
    await saveSeconds(Number(changeEvent.target.value));
    setStatus("saved", "live");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

async function onReset() {
  const question = questions[currentIndex] ?? null;
  if (!question && !questions.length) return;

  try {
    await (question ? resetVotes(question) : resetAllVotes(questions));
    setStatus("reset", "live");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function showView(name) {
  mode = name;
  applyViews();
}

/**
 * What's on screen depends on the chosen tab and on whether anyone is signed
 * in. Before sign-in there is nothing worth showing: every control would be
 * dead, and a dimmed copy of a working screen reads as a broken one.
 *
 * This hides the controls, not the data. Anyone signed in — including an
 * anonymous attendee — can already read the questions straight from the
 * database, so this is tidiness rather than secrecy. See README.
 */
function applyViews() {
  const setup = mode === "setup";
  els.tabs.hidden = !signedIn;
  els.signedOut.hidden = signedIn;
  els.viewSetup.hidden = !signedIn || !setup;
  els.viewRun.hidden = !signedIn || setup;
  els.tabSetup.classList.toggle("is-active", setup);
  els.tabRun.classList.toggle("is-active", !setup);
}

function toOption(label) {
  return { label, votes: 0 };
}

/**
 * Writes a control's visible text. Buttons keep their label in a span beside
 * the icon, so assigning textContent to the button itself would delete the
 * icon along with the old label.
 */
function setLabel(element, text) {
  const slot = element.querySelector(".btn-label");
  (slot ?? element).textContent = text;
}

/** Names an icon-only button, for a screen reader and for a long press. */
function nameButton(element, text) {
  element.setAttribute("aria-label", text);
  element.title = text;
}

/**
 * Draws the audience address as a QR code, big enough to be read from a few
 * rows back. Forty people typing an address is forty chances to mistype it.
 */
function showQr() {
  const url = audienceUrl();
  const modules = encode(url);
  const quiet = 4;
  const span = modules.length + quiet * 2;

  const rects = [];
  modules.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`);
    });
  });

  els.qrArt.innerHTML =
    `<svg viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges" ` +
    `role="img" aria-label="${url}">` +
    `<rect width="${span}" height="${span}" fill="#fff"/>` +
    `<g fill="#000">${rects.join("")}</g></svg>`;

  // Readable without the scheme, but a link needs the whole thing.
  els.qrUrl.textContent = url;
  els.qrUrl.href = new URL(".", location.href).href;
  els.qrOverlay.hidden = false;
}

function hideQr() {
  els.qrOverlay.hidden = true;
}

/**
 * Where attendees should go, derived from where the host page is rather than
 * written down anywhere — so it stays right on any deployment.
 * Shown without the scheme, since that's what someone types.
 */
function audienceUrl() {
  const url = new URL(".", location.href);
  return (url.host + url.pathname).replace(/\/$/, "");
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

/** Takes a translation key, so the badge survives a language change. */
function setStatus(key, state) {
  if (!key) return;
  els.status.dataset.key = key;
  els.status.textContent = t(key);
  els.status.dataset.state = state;
}
