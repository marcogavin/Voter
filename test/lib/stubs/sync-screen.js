// Stands in for js/sync.js. The big screen only ever reads, so anything that
// writes is here to prove it is never called.
export const state = { push: null, calls: [], now: () => Date.now() };
export function connect() { return Promise.resolve("screen-uid"); }
// See the matching comment in sync-host.js: a fixture pushes a plain
// `questions` array and a `currentIndex`, and withDerived() adds the
// `currentQuestion`/`questionCount` the real js/sync.js now computes instead.
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
export function serverNow() { return state.now(); }
export function castVote() { state.calls.push("castVote"); return Promise.resolve(); }
export function likePoll() { state.calls.push("likePoll"); return Promise.resolve(); }
export function saveName() { state.calls.push("saveName"); return Promise.resolve(); }
export function getUid() { return "screen-uid"; }
