import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOrigin, HttpError } from '../src/server/http';

test('origin guard accepts exact deployment URLs and rejects forged or cross-site origins', () => {
  const keys = ['APP_ORIGIN', 'VERCEL', 'VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const request = (origin?: string, site = 'same-origin') => new Request('https://internal.invalid/api/recommendations', {
    method: 'POST', headers: { ...(origin ? { origin } : {}), 'sec-fetch-site': site, host: 'attacker.vercel.app', 'x-forwarded-host': 'attacker.vercel.app' },
  });
  const blocked = (origin?: string, site?: string) => assert.throws(() => checkOrigin(request(origin, site)), (e: unknown) => e instanceof HttpError && e.status === 403);
  try {
    for (const key of keys) delete process.env[key];
    checkOrigin(request('http://localhost:5000'));
    checkOrigin(request('http://127.0.0.1:5000'));
    blocked('http://localhost:5001');
    Object.assign(process.env, {
      VERCEL: '1', APP_ORIGIN: 'https://movie.example.com/',
      VERCEL_URL: 'movie-build-project.vercel.app',
      VERCEL_BRANCH_URL: 'movie-git-main-project.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'movie.vercel.app',
    });
    for (const origin of ['https://movie.example.com', 'https://movie-build-project.vercel.app', 'https://movie-git-main-project.vercel.app', 'https://movie.vercel.app']) checkOrigin(request(origin));
    for (const origin of [undefined, 'null', 'https://attacker.vercel.app', 'https://movie.vercel.app.evil.com', 'http://movie.vercel.app', 'https://movie.vercel.app:444', 'http://localhost:5000']) blocked(origin);
    blocked('https://movie.vercel.app', 'cross-site');
    process.env.APP_ORIGIN = 'not-a-url';
    checkOrigin(request('https://movie-build-project.vercel.app'));
    blocked('not-a-url');
    process.env.VERCEL_URL = 'attacker.vercel.app/path';
    blocked('https://attacker.vercel.app');
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
