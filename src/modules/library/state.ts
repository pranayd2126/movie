import { sanitizeEvents, type InteractionEvent } from './events';
import { languages, languageCode, parseTitleRef, type ProviderId } from '../catalog/types';

export interface LocalState {
  version: 3;
  events: InteractionEvent[];
  signalTimes: Record<string,string>;
  revision: number;
  services: ProviderId[];
  languages: string[];
  genres: string[];
  saved: string[];
  liked: string[];
  disliked: string[];
  favorites: string[];
  dismissed: string[];
  ratings: Record<string, number>;
  watched: { titleId: string; watchedAt: string; audience: 'private' }[];
  useHistory: boolean;
  onboardingDismissed: boolean;
  onboarding: 'legacy' | 'pending' | 'completed' | 'skipped';
}
export const defaultState: LocalState = {
  version: 3, events: [], signalTimes: {}, revision: 0, services: [], languages: [], genres: [], saved: [], liked: [], disliked: [], favorites: [], dismissed: [], ratings: {},
  watched: [], useHistory: true, onboardingDismissed: false, onboarding: 'legacy',
};
export const STORAGE_KEY = 'nextscene.local.v3';
const strings = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string' && x.length < 100))].slice(0, 500) : [];
const refs = (value: unknown) => strings(value).filter(id => parseTitleRef(id));
// Browser state is untrusted. Legacy fictional IDs are never translated into real titles.
export function parseState(raw: string | null): LocalState {
  if (!raw) return structuredClone(defaultState);
  try {
    const s = JSON.parse(raw);
    if (!s || ![1, 2, 3].includes(s.version)) return structuredClone(defaultState);
    const ratings: Record<string, number> = {};
    if (s.ratings && typeof s.ratings === 'object') for (const [k, v] of Object.entries(s.ratings).slice(0, 500)) {
      if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10 && parseTitleRef(k)) ratings[k] = v;
    }
    return {
      ...defaultState,
      events: sanitizeEvents(s.events), revision: Number.isSafeInteger(s.revision) && s.revision >= 0 ? s.revision : 0,
      signalTimes: Object.fromEntries(Object.entries(s.signalTimes ?? {}).filter(([k,v]) => k.length < 150 && typeof v === 'string' && Number.isFinite(Date.parse(v))).slice(-3000)) as Record<string,string>,
      services: strings(s.services).filter(id => /^[1-9]\d{0,8}$/.test(id)),
      languages: [...new Set(strings(s.languages).map(languageCode).filter(l => languages.some(name=>languageCode(name)===l)))], genres: strings(s.genres),
      saved: refs(s.saved), liked: refs(s.liked), disliked: refs(s.disliked), favorites: refs(s.favorites), dismissed: refs(s.dismissed), ratings,
      watched: Array.isArray(s.watched) ? s.watched.filter((e: unknown): e is { titleId: string; watchedAt: string } => !!e && typeof e === 'object' && 'titleId' in e && typeof e.titleId === 'string' && !!parseTitleRef(e.titleId) && 'watchedAt' in e && typeof e.watchedAt === 'string' && !Number.isNaN(Date.parse(e.watchedAt))).slice(0, 500).map((e: { titleId: string; watchedAt: string }) => ({ titleId: e.titleId, watchedAt: e.watchedAt, audience: 'private' as const })) : [],
      onboarding: ['pending','completed','skipped'].includes(s.onboarding)?s.onboarding:'legacy',
      useHistory: s.useHistory !== false, onboardingDismissed: s.onboardingDismissed === true,
    };
  } catch { return structuredClone(defaultState); }
}
export function markWatched(state: LocalState, titleId: string, date = new Date().toISOString()): LocalState {
  if (!parseTitleRef(titleId)) return state;
  return { ...state, watched: [...state.watched.filter(e => e.titleId !== titleId), { titleId, watchedAt: date, audience: 'private' }] };
}
export function toggleItem(items: string[], id: string) { return items.includes(id) ? items.filter(item => item !== id) : [...items, id]; }
export function signalIds(state: LocalState): string[] {
  const ids=[...new Set([...state.favorites,...Object.keys(state.ratings),...state.liked,...state.disliked,...state.saved,...state.events.filter(e=>['click','title_open','trailer','provider_click'].includes(e.type)).slice(-20).flatMap(e=>e.titleId?[e.titleId]:[])])];
  const time=(id:string)=>Math.max(0,...state.events.filter(e=>e.titleId===id&&['click','title_open','trailer','provider_click'].includes(e.type)).map(e=>Date.parse(e.at)||0),...['favorites','ratings','liked','disliked','saved'].map(key=>Date.parse(state.signalTimes[`${key}:${id}`]??'')||0));
  const recent=[...ids].sort((a,b)=>time(b)-time(a)||a.localeCompare(b)).slice(0,60);
  return [...recent,...ids.filter(id=>!recent.includes(id)).slice(0,20)];
}
export function positiveSeedIds(state: LocalState): string[] {
  return [...new Set([...state.favorites, ...Object.keys(state.ratings).filter(id => state.ratings[id] >= 7), ...state.liked, ...state.saved])].filter(id => !state.disliked.includes(id) && !state.dismissed.includes(id) && (state.ratings[id] ?? 10) > 4).slice(0, 3);
}

// Older clients omit this field (or normalize it to legacy). They must not erase
// a new account's pending/completed/skipped setup while saving unrelated data.
export function preserveOnboarding(account:LocalState,incoming:LocalState):LocalState {
 return incoming.onboarding==='legacy'?{...incoming,onboarding:account.onboarding}:incoming;
}
