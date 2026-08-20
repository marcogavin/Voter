// Enough of js/firebase-config.js for the parts of sync.js that don't connect.
export const firebaseConfig = {};
export const EVENT_ID = "live";
export const FIREBASE_VERSION = "12.0.0";
export const DEFAULT_SECONDS = 30;
export const SECONDS_CHOICES = [0, 10, 30, 60, 120];
export function isConfigured() { return true; }
