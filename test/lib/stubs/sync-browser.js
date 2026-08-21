// A sync.js that answers from window.PREVIEW instead of a database.
export const DECK_MAX = 20, TITLE_MAX = 60, NAME_MAX = 24;
let push = null;
export function connect() { return Promise.resolve(); }
// A preview pushes a plain `questions` array and a `currentIndex`, the way
// the app used to receive the whole deck; withDerived() adds the
// `currentQuestion`/`questionCount` the real js/sync.js now computes instead
// of handing the array over to be indexed. See the comment at the top of
// js/sync.js for why those fields exist at all.
function withDerived(event) {
  if (!event) return event;
  const questions = event.questions ?? [];
  return {
    questionCount: questions.length,
    currentQuestion: questions[event.currentIndex] ?? null,
    ...event,
  };
}
export function onEventChange(cb) {
  push = cb;
  window.PREVIEW_PUSH = (e) => cb(withDerived(e));
  if (window.PREVIEW) cb(withDerived(window.PREVIEW));
}
export function castVote() { return Promise.resolve(); }
export function likePoll() { return Promise.resolve(); }
export function saveName() { return Promise.resolve(); }
export function touch() { return Promise.resolve(); }
export function getUid() { return "me"; }
export function serverNow() { return Date.now(); }
export function isAnonymous() { return false; }
export function accountName() { return "marco.gavin@gmail.com"; }
export function signInWithGoogle() { return Promise.resolve(); }
export function onSignedIn() { return () => {}; }
export function signOutHost() { return Promise.resolve(); }
export function saveQuestions() { return Promise.resolve(); }
export function setCurrentIndex() { return Promise.resolve(); }
export function setRevealed() { return Promise.resolve(); }
export function setBlanked() { return Promise.resolve(); }
export function saveLanguage() { return Promise.resolve(); }
export function saveSeconds() { return Promise.resolve(); }
export function newDeck() { return Promise.resolve(); }
export function renameDeck() { return Promise.resolve(); }
export function deleteDeck() { return Promise.resolve(); }
export function setCurrentDeck() { return Promise.resolve(); }
export function resetVotes() { return Promise.resolve(); }
export function resetAllVotes() { return Promise.resolve(); }
export function clearRoom() { return Promise.resolve(); }
