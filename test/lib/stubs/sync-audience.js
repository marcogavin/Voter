// Stands in for js/sync.js: no Firebase, and saveName answers however the
// test wants it to.
export const NAME_MAX = 24;
export const state = { uid: "u1", votes: [], saved: [], nextSave: null, nextLike: null, push: null };
export function connect() { return Promise.resolve(); }
export function onEventChange(cb) { state.push = cb; }
export function castVote(qid, oid, ms) { state.votes.push({ qid, oid, ms }); return Promise.resolve(); }
export function likePoll() { return state.nextLike ? state.nextLike() : Promise.resolve(); }
export function touch() { state.touched = (state.touched ?? 0) + 1; return Promise.resolve(); }
export function getUid() { return state.uid; }
export function serverNow() { return Date.now(); }
export function saveName(name) {
  state.saved.push(name);
  return state.nextSave ? state.nextSave(name) : Promise.resolve();
}
