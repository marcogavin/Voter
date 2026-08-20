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
import { drawIcons, icons, waitingArt } from "./icons.js";
import { flyHearts, celebrate } from "./hearts.js";
import {
  screenAt,
  lastIndex,
  boardMarkup,
  fillNames,
  isScorable,
} from "./scores.js";
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
window.VOTR_BUILD = [
  "polls", "timer", "qr", "icons", "gate", "applause", "sheet", "pollpicker",
  "pause", "scores", "bigscreen",
];

const els = {
  tabs: document.getElementById("tabs"),
  bigScreen: document.getElementById("bigscreen"),
  signedOut: document.getElementById("signed-out"),
  editorSheet: document.getElementById("editor-sheet"),
  addQuestion: document.getElementById("add-question"),
  deckOpen: document.getElementById("deck-open"),
  deckOpenName: document.getElementById("deck-open-name"),
  pollSheet: document.getElementById("poll-sheet"),
  pollList: document.getElementById("poll-list"),
  pollClose: document.getElementById("poll-close"),
  tabSetup: document.getElementById("tab-setup"),
  tabRun: document.getElementById("tab-run"),
  viewSetup: document.getElementById("view-setup"),
  viewRun: document.getElementById("view-run"),

  deckNew: document.getElementById("deck-new"),

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
  qrCopy: document.getElementById("qr-copy"),
  qrCopyLink: document.getElementById("qr-copy-link"),
  hint: document.getElementById("hint"),
  status: document.getElementById("status"),
};

// These mirror the limits in database.rules.json. Keeping them in step means
// the form refuses what the database would refuse, in a place you can see.
const QUESTION_MAX = 200;
const OPTION_MAX = 100;

let askedAt = null;
let pausedAt = null; // when the screen was hidden, and the clock with it
let connection = { key: "connecting", state: "pending" }; // what the badge says
let flashTimer = null; // while a confirmation is borrowing the badge
let seconds = 0; // how long a question stays open; 0 for no limit
let secondsMenu = null; // signature of what the duration picker currently offers
let ticker = null;

let decks = []; // every saved poll: { id, title, count }
let currentDeck = null; // the one being edited here and presented to the room
let deckMenu = null; // signature of what the poll picker currently offers
let askResolve = null; // settles the promise the ask overlay is standing in for

let players = {}; // everyone in the room, by the name they gave
let likes = 0; // applause on the closing screen
let likesSeen = null; // the applause already drawn, so only new taps fly
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

  els.deckNew.addEventListener("click", onDeckNew);
  els.deckOpen.addEventListener("click", openPollSheet);
  els.pollClose.addEventListener("click", closePollSheet);
  els.pollList.addEventListener("click", onPollListClick);
  els.pollSheet.addEventListener("click", (event) => {
    if (event.target === els.pollSheet) closePollSheet();
  });

  els.askForm.addEventListener("submit", onAskSubmit);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAsk(null);
    hideQr();
    if (!els.editorSheet.hidden) stopEditing();
    closePollSheet();
  });
  els.askCancel.addEventListener("click", () => closeAsk(null));
  els.askOverlay.addEventListener("click", (event) => {
    if (event.target === els.askOverlay) closeAsk(null);
  });

  els.editor.addEventListener("submit", onSubmit);
  els.addQuestion.addEventListener("click", () => {
    stopEditing();
    openEditor();
  });
  els.cancel.addEventListener("click", stopEditing);
  els.editorSheet.addEventListener("click", (event) => {
    if (event.target === els.editorSheet) stopEditing();
  });
  els.list.addEventListener("click", onListClick);
  els.questionInput.setAttribute("maxlength", String(QUESTION_MAX));
  els.questionInput.addEventListener("input", drawCounts);
  els.optionsInput.addEventListener("input", drawCounts);
  els.optionsInput.addEventListener("input", drawCorrectChoices);
  els.correctList.addEventListener("change", onCorrectChange);

  els.prev.addEventListener("click", () => go(currentIndex - 1));
  els.next.addEventListener("click", onNext);
  els.reopen.addEventListener("click", () => reveal(false));
  els.clear.addEventListener("click", onStartOver);
  els.blank.addEventListener("click", () => blank(!blanked));
  els.reset.addEventListener("click", onReset);

  drawIcons();

  fillLanguages();
  els.language.addEventListener("change", onLanguageChange);

  fillSeconds();
  els.seconds.addEventListener("change", onSecondsChange);

  els.qr.addEventListener("click", showQr);
  els.qrClose.addEventListener("click", hideQr);
  els.qrCopy.addEventListener("click", onQrCopy);
  els.qrCopyLink.addEventListener("click", onQrCopyLink);
  els.qrOverlay.addEventListener("click", (event) => {
    if (event.target === els.qrOverlay) hideQr();
  });

  els.signin.addEventListener("click", onSignIn);
  els.signout.addEventListener("click", () => signOutHost());

  drawCorrectChoices();
  drawCounts();
}

/* ── Character counts ──────────────────────────────────────────────────── */

/** How close to a limit is close enough to be worth saying so. */
const NEAR_LIMIT = 40;

/**
 * Counts down as you type, so a limit is visible before it's hit rather than
 * discovered as a refusal after pressing the button — but only once it is
 * near. "200" beside an empty field is a number nobody needs, and a screen
 * of numbers nobody needs is what makes a tool feel like a form.
 */
function drawCounts() {
  const left = QUESTION_MAX - els.questionInput.value.length;
  els.questionCount.textContent = left <= NEAR_LIMIT ? format(left) : "";
  els.questionCount.classList.toggle("is-over", left < 0);

  // One count per answer rather than a single worst-case number: a summary
  // says something is too long without saying which one to shorten.
  els.optionsCount.innerHTML = "";
  parseOptions().forEach((line, index) => {
    const remaining = OPTION_MAX - line.length;
    if (remaining > NEAR_LIMIT) return;
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
  players = event.players;
  askedAt = event.askedAt;
  pausedAt = event.pausedAt;
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
    drawStatus();
  }

  // Only a signed-in account can hold or claim an event. An anonymous
  // visitor watches; that's what stops an attendee who finds this page.
  signedIn = !isAnonymous();
  applyViews();
  isOwner = signedIn && (!event.ownerUid || event.ownerUid === getUid());

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

  drawPolls();
  els.deckNew.disabled = !isOwner || decks.length >= DECK_MAX;
  nameButton(els.signout, t("signOut"));
  nameButton(els.bigScreen, t("bigScreen"));
  // Its label goes on a narrow screen, so its name has to come from here.
  nameButton(els.qr, t("qrCode"));

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
    // The question takes the full width and the four things you can do to it
    // share the line under it with its own summary — they used to sit on a
    // line of their own, which cost about 30px on every row in the list.
    item.innerHTML = `
      <span class="qnum">${index + 1}</span>
      <div class="qbody">
        <span class="qtext">${escapeHtml(question.text)}</span>
        <span class="qfoot">
          <small class="qmeta">${t("optionsCount", { n: question.options.length })}${
            answer ? ` · ✓ ${escapeHtml(answer.label)}` : ""
          }</small>
          <span class="qbtns">
            <button type="button" class="iconbtn" data-act="up"   aria-label="${t("moveUp")}"    ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="iconbtn" data-act="down" aria-label="${t("moveDown")}"  ${index === questions.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="iconbtn" data-act="edit" aria-label="${t("edit")}">✎</button>
            <button type="button" class="iconbtn" data-act="del"  aria-label="${t("delete")}">✕</button>
          </span>
        </span>
      </div>
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
  // The run ends in two screens when there is anything to score: how it went,
  // then what the room thought of it.
  const event = { questions, currentIndex, players };
  const screen = screenAt(event);
  const atEnd = screen === "scores" || screen === "ending";

  els.counter.textContent = !questions.length
    ? "—"
    : screen === "scores"
      ? t("scoresTitle")
      : screen === "ending"
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
    !isOwner || !questions.length || (!willReveal && currentIndex >= lastIndex(event));
  els.reopen.hidden = !revealed;
  els.reopen.disabled = !isOwner;
  setLabel(els.reopen, t("reopenVotingShort"));
  nameButton(els.reopen, t("reopenVoting"));
  // Two short labels in a row of equal cells, each carrying its full
  // sentence as its accessible name — the whole of "Reset this question's
  // votes" doesn't fit under an icon on a phone, and it is the difference
  // between this button and Start over beside it.
  nameButton(els.reset, t("resetVotes"));
  nameButton(els.clear, t("startOver"));
  els.reset.disabled = !isOwner || !question;
  els.clear.disabled = !isOwner || (!question && !atEnd && !votesCast() && !likes);

  // Blanking only means anything while something is up.
  // Two words on the tile, the whole sentence as its name — the same split
  // the reset button uses, for the same reason: the cell is ten characters
  // wide and German needs more than that to say "hide the screen".
  setLabel(els.blank, blanked ? t("showScreenShort") : t("hideScreenShort"));
  nameButton(els.blank, blanked ? t("showScreen") : t("hideScreen"));
  els.blank.querySelector(".btn-icon").dataset.icon = blanked ? "show" : "hide";
  drawIcons(els.blank);
  // Engaged, not primary: the room's screen is off, and this is the button
  // that turns it back on. Primary blue here read as "press me next", beside
  // a Next button that actually is.
  els.blank.classList.toggle("btn--on", blanked);
  els.blank.setAttribute("aria-pressed", String(blanked));
  els.blank.disabled = !isOwner || (!question && !atEnd && !blanked);

  if (screen === "scores") {
    shownQuestionId = null;
    els.runQuestion.textContent = t("scoresTitle");

    // Built once on arrival: the rows come in in order and the winner is
    // celebrated, and neither should happen again on every vote that lands.
    if (els.options.dataset.screen !== "scores") {
      els.options.dataset.screen = "scores";
      els.options.innerHTML = boardMarkup(event, null);
      fillNames(els.options, event);
      celebrate(els.options.querySelector(".board-row.is-first"));
    }
    return;
  }

  if (screen === "ending") {
    shownQuestionId = null;
    els.runQuestion.textContent = t("likeVotr");
    // Rebuilt only on arrival now: this used to be redrawn on every snapshot,
    // which would wipe a heart out of the air the moment it took off.
    if (els.options.dataset.screen !== "ending") {
      els.options.dataset.screen = "ending";
      // The host watches the applause arrive; only the audience can add to it.
      els.options.innerHTML =
        `<p class="tally"><span class="tally-heart" aria-hidden="true"></span>` +
        `<span class="tally-count">${likes}</span></p>` +
        `<p class="panel-message">${t("likeHostNote")}</p>`;
      els.options.querySelector(".tally-heart").innerHTML = icons.heart;
      likesSeen = null;
    }

    // The room's taps, on the screen the room is looking at. Nobody here can
    // add to the count, so every heart that flies came from somebody else.
    if (likesSeen === null) likesSeen = likes;
    else if (likes > likesSeen) {
      flyHearts(els.options.querySelector(".tally-heart"), likes - likesSeen);
      likesSeen = likes;
    } else if (likes < likesSeen) likesSeen = likes;

    els.options.querySelector(".tally-count").textContent = likes;
    return;
  }

  if (!question) {
    shownQuestionId = null;
    els.runQuestion.textContent = questions.length
      ? t("nothingOnScreen")
      : t("noQuestions");

    // With nothing up, the useful thing to show the host is the screen the
    // room is actually looking at — otherwise the presenter is the only
    // person in the building who doesn't know what's on the phones.
    // The guard carries what the screen says, not just which screen it is:
    // the note underneath changes with the language and with whether there
    // are any questions yet.
    const key = `waiting:${getLanguage()}:${questions.length ? "some" : "none"}`;
    if (els.options.dataset.screen !== key) {
      els.options.dataset.screen = key;
      els.options.innerHTML =
        `<p class="preview-label">${t("whatTheRoomSees")}</p>` +
        `<div class="preview">` +
        `<div class="waiting">${waitingArt(t("waitingForHost"))}` +
        `<p class="panel-message">${t("waitingForHost")}</p></div></div>` +
        `<p class="panel-message">${
          questions.length ? t("pressStart") : t("addInSetup")
        }</p>`;
    }
    return;
  }

  // The host keeps seeing the question and its results while blanked — the
  // point is that the audience doesn't, not that the presenter flies blind.
  els.runQuestion.textContent = question.text;

  if (question.id !== shownQuestionId) {
    delete els.options.dataset.screen;
    els.options.innerHTML = "";
    for (const option of question.options) {
      const row = document.createElement("div");
      row.className = "choice choice--static";
      row.dataset.id = option.id;
      row.innerHTML = `
        <span class="choice-fill"></span>
        <span class="choice-body">
          <span class="choice-label"></span>
          <span class="choice-pct"></span>
        </span>
      `;
      els.options.appendChild(row);
    }
    shownQuestionId = question.id;
  }

  const total = question.options.reduce((sum, o) => sum + o.votes, 0);
  const scored = revealed && question.correct !== null;

  for (const option of question.options) {
    const row = els.options.querySelector(`.choice[data-id="${option.id}"]`);
    if (!row) continue;

    const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);
    row.querySelector(".choice-label").textContent = option.label;
    row.querySelector(".choice-fill").style.width = pct + "%";
    row.querySelector(".choice-pct").textContent = `${pct}%`;

    row.classList.add("is-counted");
    row.classList.toggle("is-right", scored && option.id === question.correct);
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
/**
 * Whose questions are below. The name is the part that identifies the poll,
 * so it carries the weight; the rest is the same summary the picker shows,
 * minus the count that the list underneath already makes plain.
 */
function drawPolls() {
  const deck = liveDeck();
  els.deckOpenName.innerHTML = "";
  if (!deck) return;

  const name = document.createElement("b");
  name.textContent = deckTitle(deck);
  els.deckOpenName.append(name);

  const when = deck.lastRunAt
    ? t("lastRun", { when: whenText(deck.lastRunAt) })
    : deck.createdAt
      ? t("createdOn", { when: whenText(deck.createdAt) })
      : "";
  if (when) els.deckOpenName.append(` · ${when}`);

  if (!els.pollSheet.hidden) fillPollList();
}

/**
 * The picker. A name alone doesn't tell you which of five polls you want a
 * month later — how big it is and when it last faced a room does.
 */
function fillPollList() {
  const signature = JSON.stringify([getLanguage(), decks, currentDeck, isOwner]);
  if (signature === deckMenu) return;
  deckMenu = signature;

  els.pollList.innerHTML = "";
  for (const deck of decks) {
    const open = deck.id === currentDeck;
    const item = document.createElement("li");
    item.className = "pollitem" + (open ? " is-open" : "");
    item.innerHTML = `
      <button type="button" class="pollpick" data-act="open" data-id="${deck.id}">
        <span class="pollmark" aria-hidden="true"></span>
        <span class="pollbody">
          <span class="polltitle"></span>
          <span class="pollmeta"></span>
        </span>
      </button>
      <span class="qbtns">
        <button type="button" class="iconbtn" data-act="rename" data-id="${deck.id}"
                data-icon="edit" aria-label="${t("renamePoll")}"></button>
        <button type="button" class="iconbtn" data-act="delete" data-id="${deck.id}"
                data-icon="remove" aria-label="${t("deletePoll")}"></button>
      </span>
    `;
    // Titles are typed by a person, so they go in as text and never as markup.
    item.querySelector(".polltitle").textContent = deckTitle(deck);
    item.querySelector(".pollmeta").textContent = describeDeck(deck);
    for (const button of item.querySelectorAll("button")) {
      button.disabled = !isOwner;
    }
    // An event always keeps one poll; there'd be nothing to fall back to.
    if (decks.length < 2) {
      item.querySelector('[data-act="delete"]').disabled = true;
    }
    drawIcons(item);
    els.pollList.appendChild(item);
  }
}

/** "3 questions · last run 2 days ago", in as much of it as is known. */
function describeDeck(deck) {
  const parts = [t("questionsCount", { n: deck.count })];
  if (deck.lastRunAt) parts.push(t("lastRun", { when: whenText(deck.lastRunAt) }));
  else if (deck.createdAt) {
    parts.push(t("createdOn", { when: whenText(deck.createdAt) }));
  }
  else if (deck.count) parts.push(t("neverRun"));
  return parts.join(" · ");
}

/**
 * A date the way a person would say it: how long ago while that is still the
 * useful answer, and a date once it isn't. Both come from Intl, so both are
 * already in the language the room is reading.
 */
function whenText(stamp) {
  const days = Math.round((stamp - Date.now()) / 86400000);
  const language = getLanguage();

  if (days > -7) {
    return new Intl.RelativeTimeFormat(language, { numeric: "auto" })
      .format(days, "day");
  }
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year:
      new Date(stamp).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(stamp);
}

function openPollSheet() {
  deckMenu = null; // rebuild it: what it says about each poll may have moved on
  fillPollList();
  els.pollSheet.hidden = false;
}

function closePollSheet() {
  els.pollSheet.hidden = true;
}

function onPollListClick(clickEvent) {
  const button = clickEvent.target.closest("button[data-act]");
  if (!button || button.disabled) return;

  const deck = decks.find((other) => other.id === button.dataset.id);
  if (!deck) return;

  if (button.dataset.act === "open") return openDeck(deck.id);
  if (button.dataset.act === "rename") return onDeckRename(deck);
  if (button.dataset.act === "delete") return onDeckDelete(deck);
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

async function openDeck(id) {
  if (id === currentDeck) return closePollSheet();

  // Switching moves the whole room, so it shouldn't be something a stray tap
  // in Setup does while a question is up in front of an audience.
  if (currentIndex >= 0 && !(await ask({ title: t("switchPollWarn") }))) return;

  try {
    await setCurrentDeck(id);
    flash("switched");
    closePollSheet();
  } catch (error) {
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
    flash("added");
  } catch (error) {
    setStatus("refused", "error");
    els.hint.textContent = `Database refused the write: ${error.message}`;
    console.error(error);
  }
}

async function onDeckRename(deck) {
  if (!deck) return;

  const title = await ask({ title: t("namePoll"), value: deckTitle(deck) });
  if (title === null) return;

  try {
    await renameDeck(deck.id, title.slice(0, TITLE_MAX));
    flash("saved");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

async function onDeckDelete(deck) {
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
    flash("deleted");
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

/**
 * The form takes the screen while it is being used, and gives it back after.
 * It used to sit open and empty above the list, so the first thing anyone saw
 * in Setup was an empty form rather than the questions they had written.
 */
function openEditor() {
  els.editorSheet.hidden = false;
  els.questionInput.focus();
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
  openEditor();
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
}

function stopEditing() {
  editingIndex = null;
  correctIndex = null;
  els.editorSheet.hidden = true;
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
    flash(verb);
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
    flash(show ? "revealed" : "reopened");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

async function go(index) {
  // Past the last screen there is means nothing on screen, which is where a
  // run starts and where Start over puts it back.
  const last = lastIndex({ questions, currentIndex, players });
  const target = index < 0 || index > last ? -1 : index;
  // Going from nothing on screen to something is a run beginning, which is
  // what the picker means by "last run".
  const starting = currentIndex < 0 && target >= 0;
  try {
    await setCurrentIndex(target, { starting });
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

  // Hidden means paused: the counter shows what is left, holds there, and
  // nothing closes behind a blank screen.
  if (pausedAt) {
    els.counter.textContent =
      `${currentIndex + 1} / ${questions.length} · ${secondsLeft()}s`;
    return;
  }

  ticker = setInterval(() => {
    const left = secondsLeft();

    els.counter.textContent = `${currentIndex + 1} / ${questions.length} · ${left}s`;
    if (left === 0) {
      clearInterval(ticker);
      ticker = null;
      reveal(true);
    }
  }, 250);
}

/** What's left on the clock, holding still while the screen is hidden. */
function secondsLeft() {
  const gone = ((pausedAt ?? serverNow()) - askedAt) / 1000;
  return Math.max(0, Math.ceil(seconds - gone));
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

/**
 * Hiding the question stops its clock; showing it again hands back the
 * seconds that were left, by moving the question's start forward by however
 * long it was hidden. Taking a question from the floor shouldn't cost the
 * room the time they had to answer in.
 */
async function blank(hide) {
  const resumed =
    !hide && pausedAt && askedAt ? askedAt + (serverNow() - pausedAt) : null;

  try {
    await setBlanked(hide, resumed);
    flash(hide ? "hidden" : "shown");
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
    flash("saved");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

async function onReset() {
  const question = questions[currentIndex] ?? null;
  if (!question) return;

  try {
    await resetVotes(question);
    flash("reset");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

/**
 * Back to the top with a clean sheet — which is what starting over means, and
 * it used to leave every answer from the last run in place.
 *
 * It asks first, but only when there is something to lose: a poll nobody has
 * answered yet has nothing to confirm, and a confirmation people always say
 * yes to stops being read.
 *
 * The screen goes blank rather than straight to the first question, so the
 * room doesn't get it before the presenter is ready. Next puts it up.
 */
async function onStartOver() {
  const cast = votesCast();
  // Hearts are part of what the last run left behind, so they go with the
  // votes — and the question says so rather than quietly taking them.
  const warn = likes
    ? t("startOverWarnHearts", { n: cast, hearts: likes })
    : t("startOverWarn", { n: cast });

  if ((cast || likes) && !(await ask({ title: warn }))) return;

  try {
    if (cast || likes) await resetAllVotes(questions);
    flash("reset");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
    return;
  }

  await go(-1);
}

/** Every answer given in this poll, across all its questions. */
function votesCast() {
  return questions.reduce(
    (all, question) =>
      all + question.options.reduce((sum, option) => sum + option.votes, 0),
    0,
  );
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
  // Nobody in the room needs the host's email address, and Run is the view
  // most likely to be held up, handed over or photographed.
  els.account.hidden = !setup || !signedIn;
  // Everything in the app bar follows from whether an account is signed in,
  // and is set here rather than on the next snapshot — the bar is on screen
  // from the first paint, and a Sign in button beside a signed-in account is
  // exactly the sort of thing that reads as an app not knowing its own state.
  els.signin.hidden = signedIn;
  els.signout.hidden = !signedIn;
  els.qr.hidden = !signedIn; // nothing to share until there's an event to run
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

/**
 * The QR as a PNG on the clipboard, so it can go straight into a slide.
 *
 * The blob is handed to ClipboardItem as a *promise* rather than awaited
 * first: Safari only allows a clipboard write inside the gesture that asked
 * for it, and awaiting anything beforehand ends the gesture.
 */
async function onQrCopy() {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": qrPng() }),
    ]);
    said(els.qrCopy, "copied");
  } catch (error) {
    // Not every browser will put an image on the clipboard. The address is
    // the useful half of the code anyway, so it goes instead of nothing —
    // and the button says which of the two you actually got.
    console.error(error);
    try {
      await navigator.clipboard.writeText(audienceUrl());
      said(els.qrCopy, "copiedLinkInstead");
    } catch (also) {
      setStatus("refused", "error");
      console.error(also);
    }
  }
}

async function onQrCopyLink() {
  try {
    await navigator.clipboard.writeText(audienceUrl());
    said(els.qrCopyLink, "copied");
  } catch (error) {
    setStatus("refused", "error");
    console.error(error);
  }
}

/** Says what happened on the button that was pressed, then puts it back. */
function said(button, key) {
  const slot = button.querySelector(".btn-label");
  const was = slot.textContent;
  slot.textContent = t(key);
  clearTimeout(button.dataset.timer);
  button.dataset.timer = String(
    setTimeout(() => {
      slot.textContent = was;
    }, 1600),
  );
}

/**
 * The code, drawn into a PNG big enough to project.
 *
 * Painted module by module rather than by loading the SVG that is already on
 * screen: an inline SVG carries no namespace and no intrinsic size, and Safari
 * refuses to load one as an image — which is why "Copy image" was quietly
 * copying the link instead. Nothing to load means nothing to refuse.
 */
function qrPng() {
  const modules = encode(audienceUrl());
  const quiet = 4;
  const span = modules.length + quiet * 2;
  const scale = Math.max(1, Math.floor(1024 / span));

  const canvas = document.createElement("canvas");
  canvas.width = span * scale;
  canvas.height = span * scale;

  const paper = canvas.getContext("2d");
  // The quiet zone stays white whatever the code is pasted onto.
  paper.fillStyle = "#ffffff";
  paper.fillRect(0, 0, canvas.width, canvas.height);
  paper.fillStyle = "#000000";
  modules.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) {
        paper.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    });
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("no image came back"))),
      "image/png",
    );
  });
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
/**
 * The badge says one thing: whether this page is talking to the database.
 *
 * It used to double as a log of the last thing you did — "Hidden" sat there
 * long after the screen came back — which made a state and an event look like
 * the same kind of thing. Confirmations now visit for a moment and leave, and
 * they arrive with a tick so it is obvious which of the two you are reading.
 */
function setStatus(key, state) {
  if (!key) return;
  connection = { key, state };
  clearTimeout(flashTimer);
  flashTimer = null;
  drawStatus();
}

/** Says something just happened, then gives the badge back. */
function flash(key) {
  els.status.dataset.key = key;
  els.status.dataset.state = "done";
  els.status.textContent = t(key);

  clearTimeout(flashTimer);
  flashTimer = setTimeout(drawStatus, 1800);
}

function drawStatus() {
  flashTimer = null;
  els.status.dataset.key = connection.key;
  els.status.dataset.state = connection.state;
  els.status.textContent = t(connection.key);
}
