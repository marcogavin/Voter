// Stands in for js/sync.js on the host side: records what the page asked the
// database to do, and answers however the test wants.
export const DECK_MAX = 20;
export const TITLE_MAX = 60;
export const state = { calls: [], push: null, anonymous: false, uid: "host-uid" };
const note = (name, arg) => { state.calls.push({ name, arg }); return Promise.resolve(); };

export function connect() { return Promise.resolve(); }
// A suite pushes a plain fixture — a `questions` array and a `currentIndex` —
// the way the app used to receive the whole deck. The real js/sync.js now
// derives `currentQuestion`/`questionCount` instead of handing over the array
// to be indexed; withDerived() mirrors that so existing fixtures don't all
// need to grow the same two fields by hand. See the comment at the top of
// js/sync.js for why those fields exist at all.
export function onEventChange(cb) { state.push = (e) => cb(withDerived(e)); }
function withDerived(event) {
  if (!event) return event;
  const questions = event.questions ?? [];
  return {
    questionCount: questions.length,
    currentQuestion: questions[event.currentIndex] ?? null,
    ...event,
  };
}
export function saveQuestions(q) { return note("saveQuestions", q); }
export function setCurrentIndex(i, options = {}) {
  state.calls.push({ name: "setCurrentIndex", arg: i, starting: options.starting === true });
  return Promise.resolve();
}
export function setRevealed(v) { return note("setRevealed", v); }
export function setBlanked(v, resumed = null) {
  state.paused = v === true;
  state.calls.push({ name: "setBlanked", arg: v, resumed });
  return Promise.resolve();
}
export function isAnonymous() { return state.anonymous; }
export function accountName() { return "marco@example.test"; }
export function signInWithGoogle() {
  note("signInWithGoogle");
  return state.nextSignIn ? state.nextSignIn() : Promise.resolve();
}
// Fires when a real account appears, however it got here. The test drives
// it with state.signedIn().
export function onSignedIn(cb) { state.signedIn = cb; return () => {}; }
export function signOutHost() { return note("signOutHost"); }
export function saveLanguage(l) { return note("saveLanguage", l); }
export function saveSeconds(s) { return note("saveSeconds", s); }
export function newDeck(t) { return note("newDeck", t); }
export function renameDeck(a, b) { return note("renameDeck", [a, b]); }
export function deleteDeck(d) { return note("deleteDeck", d); }
export function setCurrentDeck(d) { return note("setCurrentDeck", d); }
export function resetVotes(q) { return note("resetVotes", q.id); }
export function resetAllVotes(qs) { return note("resetAllVotes", qs.map((q) => q.id)); }
export function getUid() { return state.uid; }
export function serverNow() { return Date.now(); }
