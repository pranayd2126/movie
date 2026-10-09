import { sameLanguage, type Title, type Mood } from '../catalog/types';
import type { LocalState } from '../library/state';
import { moodMatch, moodLabel } from '../discovery/moods';
import { genreMatches } from '../catalog/preferences';
import { CONFIG, MODEL_VERSION } from './config';
import { buildTasteProfile, vectorAffinity, signalStrength } from './taste';
export { MODEL_VERSION } from './config';

export interface Filters {
  query: string; kind: 'all' | 'movie' | 'series'; language: string; genre: string;
  mood: Mood; maxRuntime: number; minRuntime?: number; provider?:string; minRating: number; year: number; sort: 'picks' | 'rating' | 'newest' | 'alphabetical';
  onlyServices: boolean; excludeWatched: boolean;
}
export const defaultFilters: Filters = { query: '', kind: 'all', language: '', genre: '', mood: 'All moods', maxRuntime: 0, minRuntime:0, provider:'', minRating: 0, year: 0, sort: 'picks', onlyServices: true, excludeWatched: false };
export const WEIGHTS = CONFIG.score;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const overlap = (a: string[] = [], b: string[] = []) => a.filter(g => b.includes(g)).length / Math.max(a.length, b.length, 1);
export function similarity(a: Title, b: Title): number {
  return .35 * overlap(a.genres, b.genres) + .15 * overlap(a.keywords, b.keywords) + .1 * overlap(a.people, b.people) + .1 * overlap(a.creators, b.creators) + .15 * Number(a.language === b.language) + .05 * Number(a.kind === b.kind) + .05 * (1 - Math.min(Math.abs(a.year - b.year) / 20, 1)) + .05 * (a.runtime && b.runtime ? 1 - Math.min(Math.abs(a.runtime - b.runtime) / 90, 1) : 0);
}
export function exclusionReason(t:Title,state:LocalState,filters:Filters,surface?:string,anchor?:Title):string|null {
 const search=!!filters.query.trim();
 if(surface==='swipe'&&(state.liked.includes(t.id)||state.favorites.includes(t.id)||(state.ratings[t.id]??0)>=7))return 'Already decided for taste training';
 if(!search&&state.dismissed.includes(t.id))return 'Not Interested: exact title';
 if(!search&&state.disliked.includes(t.id))return 'Explicit dislike';
 if(!search&&(state.ratings[t.id]??10)<=4)return 'Low personal rating';
 if(!search&&(filters.excludeWatched||surface==='for-you'||surface==='swipe')&&state.useHistory&&state.watched.some(w=>w.titleId===t.id))return 'Already watched in this discovery context';
 if(anchor?.id===t.id)return 'Current title';
 if(filters.kind!=='all'&&t.kind!==filters.kind)return 'Media type filter';
 if(filters.language&&!sameLanguage(t.language,filters.language))return 'Original-language filter';
 if(filters.genre&&!genreMatches(t.genres,filters.genre))return 'Genre filter';
 if(filters.mood!=='All moods'&&!moodMatch(t,filters.mood).matches)return 'Mood filter';
 if((filters.maxRuntime||filters.minRuntime)&&(!t.runtime||(filters.maxRuntime>0&&t.runtime>=filters.maxRuntime)||(!!filters.minRuntime&&t.runtime<filters.minRuntime)))return 'Runtime filter or unknown runtime';
 if(t.rating<filters.minRating)return 'TMDB rating filter';
 if(filters.year&&t.year!==filters.year)return 'Release-year filter';
 if(filters.provider&&!t.offers.some(o=>o.region==='IN'&&o.type==='subscription'&&o.provider===filters.provider))return 'Selected provider subscription filter';
 if(!filters.provider&&!search&&filters.onlyServices&&state.services.length&&!t.offers.some(o=>o.region==='IN'&&o.type==='subscription'&&state.services.includes(o.provider)))return 'No reported included offer on selected India subscriptions';
 return null;
}
export function rankTitles(catalog: Title[], state: LocalState, filters: Filters = defaultFilters, evidence: Title[] = catalog, anchor?: Title, sessionId = '', now = Math.floor(Date.now()/3600000)*3600000, surface?: string) {
  const profile = buildTasteProfile(state, evidence, sessionId, now);
  const positive = profile.positive;
  const isSearch=!!filters.query.trim();
  const candidates=[...new Map(catalog.map(t=>[t.id,t])).values()].filter(t=>!exclusionReason(t,state,filters,surface,anchor)).map((title, retrievalRank) => {
    const neighbors = positive.filter(p => p.title.id !== title.id).map(p => ({ title: p.title, kind: p.kind, value: similarity(title, p.title) * p.strength })).sort((a,b)=>b.value-a.value);
    const long = vectorAffinity(title, profile.longTerm), recent = vectorAffinity(title, profile.recent), session = vectorAffinity(title, profile.session);
    const explicit = (state.languages.some(l=>sameLanguage(l,title.language)) ? .5 : 0) + (state.genres.some(g=>genreMatches(title.genres,g)) ? .5 : 0);
    const priorWeight = CONFIG.score.explicit * (1-.65*profile.confidence);
    const mood = moodMatch(title,filters.mood).score;
    const taste = long.positive;
    const quality = (title.votes * title.rating / 10 + 100 * .65) / (title.votes + 100);
    const popularity = clamp(Math.log1p(Math.max(0,title.popularity))/Math.log1p(1000));
    const freshness = clamp(1-(new Date(now).getUTCFullYear()-title.year)/15);
    const penalty = CONFIG.score.negative*(long.negative+.6*recent.negative+.3*session.negative);
    const anchorAffinity = anchor ? similarity(title,anchor) : 0;
    const included = title.offers.some(o=>o.region==='IN'&&o.type==='subscription'&&state.services.includes(o.provider));
    const exposures = state.events.filter(e=>e.type==='impression'&&e.titleId===title.id&&e.sessionId!==sessionId).length;
    const repetition = Math.min(1,exposures/6)*CONFIG.score.repetition;
    const neighbor = neighbors[0]?.value ?? 0;
    const score = CONFIG.score.longTerm*taste+CONFIG.score.recent*recent.positive+CONFIG.score.session*session.positive+priorWeight*explicit+CONFIG.score.mood*mood+CONFIG.score.neighbor*neighbor+CONFIG.score.quality*quality+(CONFIG.score.popularityCold*(1-profile.confidence)+CONFIG.score.popularityWarm*profile.confidence)*popularity+CONFIG.score.freshness*freshness+CONFIG.score.availability*Number(included)+CONFIG.score.anchor*anchorAffinity-penalty-repetition;
    let reason = 'A starting point based on TMDB audience ratings and popularity';
    if(filters.mood!=='All moods')reason=`Matches your ${moodLabel(filters.mood)} mood based on genres and keywords`;
    else if (anchor && anchorAffinity > .2) reason = `Shares story, genre or language traits with ${anchor.name}`;
    else if (explicit > 0 && explicit >= neighbor) reason = state.languages.some(l=>sameLanguage(l,title.language)) ? `Matches your ${title.language} preference` : `Matches your ${state.genres.find(g=>genreMatches(title.genres,g))} preference`;
    else if (neighbors[0]?.value > .15) reason = `Because you ${(state.ratings[neighbors[0].title.id] ?? 0) >= 7 ? 'rated highly' : state.favorites.includes(neighbors[0].title.id) ? 'favorited' : state.liked.includes(neighbors[0].title.id) ? 'liked' : 'saved'} ${neighbors[0].title.name}`;
    else if (state.services.length) {
      const offer = title.offers.find(o => o.type === 'subscription' && o.region === 'IN' && state.services.includes(o.provider));
      if (offer) reason = `Listed with your ${offer.name ?? 'selected service'} subscription in India`;
    }
    return { title, score, reason, components: { mood, priorWeight, taste, recent: recent.positive, session: session.positive, explicit, neighbor, quality, popularity, freshness, availability: Number(included), penalty, anchorAffinity, repetition, genre: long.parts.genre, language: long.parts.language, creator: long.parts.creator, theme: long.parts.theme }, model: MODEL_VERSION, retrievalRank };
  });
  if (filters.sort === 'rating') return candidates.sort((a, b) => b.title.rating - a.title.rating || a.title.id.localeCompare(b.title.id));
  if (filters.sort === 'newest') return candidates.sort((a, b) => b.title.year - a.title.year || a.title.name.localeCompare(b.title.name));
  if (filters.sort === 'alphabetical') return candidates.sort((a, b) => a.title.name.localeCompare(b.title.name));
  if (isSearch) return candidates; // Preserve provider search relevance rather than taste-reranking an explicit lookup.
  const ranked: typeof candidates = [];
  // Incremental MMR: each candidate pair is compared once, rather than during
  // every comparator call against the entire prefix. Ranking semantics stay identical.
  const maximumSimilarity=new Map<string,number>();
  const collections=new Set<number>(),creators=new Set<string>();
  while (candidates.length) {
    const utility=(item:typeof candidates[number])=>(1-CONFIG.rerank.diversity)*item.score-CONFIG.rerank.diversity*(maximumSimilarity.get(item.title.id)??0)-CONFIG.rerank.franchisePenalty*Number(!!item.title.collectionId&&collections.has(item.title.collectionId))-CONFIG.rerank.creatorPenalty*Number(!!item.title.creators?.some(c=>creators.has(c)));
    candidates.sort((a,b)=>utility(b)-utility(a)||a.title.id.localeCompare(b.title.id));
    const explore = ranked.length > 0 && ranked.length % CONFIG.rerank.explorationEvery === 0 ? candidates.findIndex(c=>c.components.quality>=CONFIG.rerank.explorationQuality && c.title.votes>=CONFIG.rerank.explorationVotes && c.components.taste<.1 && c.components.penalty<.04) : -1;
    const chosen=candidates.splice(explore>=0?explore:0,1)[0];ranked.push(chosen);
    if(chosen.title.collectionId)collections.add(chosen.title.collectionId);
    chosen.title.creators?.forEach(c=>creators.add(c));
    for(const candidate of candidates)maximumSimilarity.set(candidate.title.id,Math.max(maximumSimilarity.get(candidate.title.id)??0,similarity(candidate.title,chosen.title)));
  }
  return ranked;
}
export function getRecommendations(input: { titles: Title[]; state: LocalState; filters?: Filters; evidence?: Title[]; surface: 'home' | 'discover' | 'for-you' | 'related' | 'swipe'; anchor?: Title; sessionId?: string; now?: number }) {
  return rankTitles(input.titles, input.state, { ...(input.filters ?? defaultFilters), excludeWatched: input.surface === 'for-you' || input.surface === 'swipe' || !!input.filters?.excludeWatched }, input.evidence ?? input.titles, input.anchor, input.sessionId, input.now, input.surface);
}
