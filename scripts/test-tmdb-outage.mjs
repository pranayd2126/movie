// Test-only Node preload. Never imported by the application or normal npm scripts.
// Set TMDB_OUTAGE_MARKER to an existing local file to reject TMDB network calls.
import { existsSync } from 'node:fs';
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === 'api.themoviedb.org' && process.env.TMDB_OUTAGE_MARKER && existsSync(process.env.TMDB_OUTAGE_MARKER)) {
    return Promise.reject(new TypeError('Simulated TMDB network outage'));
  }
  return nativeFetch(input, options).catch(error => { console.error('Test upstream transport:', error.name, error.cause?.code ?? 'unknown'); throw error; });
};
