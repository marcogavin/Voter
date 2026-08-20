// Stands in for js/sync.js. The big screen only ever reads, so anything that
// writes is here to prove it is never called.
export const state = { push: null, calls: [], now: () => Date.now() };
export function connect() { return Promise.resolve("screen-uid"); }
export function onEventChange(cb) { state.push = (e) => cb(e); }
export function serverNow() { return state.now(); }
export function castVote() { state.calls.push("castVote"); return Promise.resolve(); }
export function likePoll() { state.calls.push("likePoll"); return Promise.resolve(); }
export function saveName() { state.calls.push("saveName"); return Promise.resolve(); }
export function getUid() { return "screen-uid"; }
