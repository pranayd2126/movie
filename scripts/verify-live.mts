import assert from 'node:assert/strict';
import { defaultState } from '../src/modules/library/state';
import { defaultFilters, getRecommendations } from '../src/modules/recommendations/rank';
import type { CatalogPage } from '../src/modules/catalog/types';
const origin = process.env.TEST_ORIGIN ?? 'http://localhost:5000';
const post = async (path: string, data: unknown) => {
  const response = await fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(90000) });
  assert.equal(response.status, 200, `${path} status`);
  return response.json();
};
const providers = await (await fetch(`${origin}/api/providers`)).json();
assert.ok(providers.providers.some((p: { id: string }) => p.id === '8'));
assert.ok(providers.providers.some((p: { id: string }) => p.id === '119'));
for (const persona of [
  { name: 'Telugu / Netflix + Prime / thriller', languages: ['Telugu'], providers: ['8', '119'], genre: 'Thriller' },
  { name: 'Hindi + English / Netflix / drama', languages: ['Hindi', 'English'], providers: ['8'], genre: 'Drama' },
  { name: 'Tamil + Malayalam / Prime + JioHotstar / crime', languages: ['Tamil', 'Malayalam'], providers: ['119', '2336'], genre: 'Crime' },
]) {
  const page: CatalogPage = await post('/api/catalog', persona);
  assert.ok(page.titles.every(t => t.source === 'tmdb' && /^tmdb:(movie|tv):\d+$/.test(t.id)));
  const ranked = getRecommendations({ titles: page.titles, state: { ...defaultState, services: persona.providers, languages: persona.languages, genres: [persona.genre] }, filters: { ...defaultFilters, genre: persona.genre }, surface: 'for-you' });
  assert.ok(ranked.length, `${persona.name}: needs eligible real results`);
  assert.ok(ranked.every(r => r.title.offers.some(o => o.region === 'IN' && o.type === 'subscription' && persona.providers.includes(o.provider))));
  console.log(JSON.stringify({ persona: persona.name, candidates: page.titles.length, eligible: ranked.length, first: ranked.slice(0, 3).map(r => ({ name: r.title.name, reason: r.reason })) }));
}
const details = await post('/api/titles', { ids: ['tmdb:movie:157336', 'tmdb:tv:1399'] });
assert.equal(details.titles.length, 2);
assert.ok(details.titles.every((t: { posterUrl?: string; source: string }) => t.source === 'tmdb' && t.posterUrl?.startsWith('https://image.tmdb.org/')));
assert.ok(details.titles.some((t: { kind: string }) => t.kind === 'series'));
const search: CatalogPage = await post('/api/catalog', { query: 'Interstellar' });
assert.equal(search.titles[0].id, 'tmdb:movie:157336');
const empty: CatalogPage = await post('/api/catalog', { query: 'zzzxqnotarealtitle734929' });
assert.equal(empty.titles.length, 0);
const invalid = await fetch(`${origin}/api/titles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ['fictional-title'] }) });
assert.equal(invalid.status, 400);
console.log('Verified real movie/TV lookup, India providers, three preference personas, search, no-results and invalid-reference handling.');
