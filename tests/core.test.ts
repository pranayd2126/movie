import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Title } from '../src/modules/catalog/types';
import { defaultState, markWatched, parseState, positiveSeedIds } from '../src/modules/library/state';
import { defaultFilters, rankTitles, getRecommendations } from '../src/modules/recommendations/rank';

// Isolated synthetic records exercise ranking invariants; never imported by the application.
const title = (id: number, patch: Partial<Title> = {}): Title => ({ id: `tmdb:movie:${id}`, externalId: id, mediaType: 'movie', source: 'tmdb', name: `Test ${id}`, tagline: '', synopsis: '', kind: 'movie', year: 2024, language: 'Telugu', genres: ['Thriller'], runtime: 110, rating: 7.5, votes: 1000, popularity: 20, moods: ['Edge of my seat'], people: [], offers: [{ provider: '119', name: 'Amazon Prime Video', region: 'IN', type: 'subscription' }], ...patch });
const titles = [title(1), title(2, { genres: ['Comedy'], language: 'Hindi' }), title(3, { offers: [{ provider: '119', region: 'IN', type: 'rent' }] }), title(4, { offers: [{ provider: '2074', region: 'IN', type: 'addon' }] }), title(5, { genres: ['Thriller'], name: 'Alpha' })];

test('watched is private, deduplicated and never creates taste or public activity', () => {
  const state = markWatched(defaultState, titles[0].id, '2026-10-05T10:00:00Z');
  assert.deepEqual(state.watched, [{ titleId: titles[0].id, watchedAt: '2026-10-05T10:00:00Z', audience: 'private' }]);
  assert.deepEqual(state.ratings, {}); assert.deepEqual(state.liked, []);
  assert.equal('publications' in state, false);
  assert.equal(markWatched(state, titles[0].id).watched.length, 1);
  assert.equal(markWatched(state, 'old-fictional-slug'), state);
});
test('untrusted storage forces private audience and rejects legacy fictional references', () => {
  assert.deepEqual(parseState('{broken'), defaultState);
  const parsed = parseState(JSON.stringify({ version: 1, services: ['bogus', '119'], saved: ['old-fixture', titles[1].id], ratings: { [titles[0].id]: 999 }, watched: [{ titleId: titles[0].id, watchedAt: '2026-10-05', audience: 'public' }] }));
  assert.equal(parsed.watched[0].audience, 'private');
  assert.deepEqual(parsed.services, ['119']); assert.deepEqual(parsed.ratings, {});
  assert.deepEqual(parsed.saved, [titles[1].id]);
});
test('selected subscriptions exclude rental, purchase, channel and wrong-region offers', () => {
  const foreign = title(6, { offers: [{ provider: '119', region: 'US', type: 'subscription' }] });
  const result = rankTitles([...titles, foreign], { ...defaultState, services: ['119'] });
  assert.deepEqual(result.map(r => r.title.id).sort(), [titles[0].id, titles[1].id, titles[4].id].sort());
  assert.equal(rankTitles(titles, { ...defaultState, services: ['9999'] }).length, 0);
});
test('watched is neutral and opting out disables watched suppression', () => {
  const state = markWatched(defaultState, titles[0].id);
  assert.deepEqual(rankTitles(titles, state).map(r => r.score), rankTitles(titles, defaultState).map(r => r.score));
  assert.ok(!rankTitles(titles, state, { ...defaultFilters, excludeWatched: true }).some(r => r.title.id === titles[0].id));
  assert.ok(rankTitles(titles, { ...state, useHistory: false }, { ...defaultFilters, excludeWatched: true }).some(r => r.title.id === titles[0].id));
});
test('explicit search keeps watched, disliked and dismissed titles and provider relevance', () => {
  const state = { ...markWatched(defaultState, titles[0].id), services: ['9999'], disliked: [titles[0].id], dismissed: [titles[1].id] };
  const results = rankTitles(titles, state, { ...defaultFilters, query: 'lookup', excludeWatched: true });
  assert.deepEqual(results.map(r => r.title.id), titles.map(t => t.id));
});
test('not interested suppresses exact title without general negative taste', () => {
  const base = rankTitles(titles, defaultState);
  const result = rankTitles(titles, { ...defaultState, dismissed: [titles[0].id] });
  assert.ok(!result.some(r => r.title.id === titles[0].id));
  assert.equal(result.find(r => r.title.id === titles[4].id)?.score, base.find(r => r.title.id === titles[4].id)?.score);
});
test('dislikes and low ratings reduce similar picks; low ratings supersede likes', () => {
  const liked = rankTitles(titles, { ...defaultState, liked: [titles[0].id] });
  const disliked = rankTitles(titles, { ...defaultState, liked: [titles[0].id], ratings: { [titles[0].id]: 2 } });
  assert.ok(disliked.find(r => r.title.id === titles[4].id)!.score < liked.find(r => r.title.id === titles[4].id)!.score);
  assert.ok(disliked.every(r => !r.reason.startsWith('Because you liked')));
  assert.deepEqual(positiveSeedIds({ ...defaultState, liked: [titles[0].id], ratings: { [titles[0].id]: 2 } }), []);
});
test('favorite and like signals outweigh watchlist; off-page evidence still works', () => {
  const candidate = [titles[4]];
  const score = (field: 'saved' | 'liked' | 'favorites') => rankTitles(candidate, { ...defaultState, [field]: [titles[0].id] }, defaultFilters, [titles[0]])[0].score;
  assert.ok(score('favorites') > score('liked'));
  assert.ok(score('liked') > score('saved'));
});
test('hard filters and explicit sorts win over taste', () => {
  const state = { ...defaultState, languages: ['Telugu'] };
  const filtered = rankTitles(titles, state, { ...defaultFilters, language: 'Hindi' });
  assert.deepEqual(filtered.map(r => r.title.id), [titles[1].id]);
  assert.equal(rankTitles([title(10, { runtime: 0 })], state, { ...defaultFilters, maxRuntime: 120 }).length, 0);
  assert.equal(rankTitles(titles, state, { ...defaultFilters, sort: 'alphabetical' })[0].title.name, 'Alpha');
});
test('shared surfaces are deterministic with evidence-backed reasons', () => {
  const state = { ...defaultState, languages: ['Telugu'], genres: ['Thriller'] };
  const home = getRecommendations({ titles, state, surface: 'home' });
  assert.deepEqual(home, getRecommendations({ titles, state, surface: 'discover' }));
  assert.ok(home.every(r => Number.isFinite(r.score)));
  assert.ok(home.filter(r => r.reason.includes('Telugu')).every(r => r.title.language === 'Telugu'));
  const related = getRecommendations({ titles, state, surface: 'related', anchor: titles[0] });
  assert.ok(!related.some(r => r.title.id === titles[0].id));
});
