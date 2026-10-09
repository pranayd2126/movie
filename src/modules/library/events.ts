import { moods, type Mood } from '../discovery/moods';
import { MODEL_VERSION } from '../recommendations/config';
import type { LocalState } from './state';
import { parseTitleRef } from '../catalog/types';
export const EVENT_TYPES = ['like','unlike','dislike','undislike','favorite','unfavorite','watchlist_add','watchlist_remove','rating','rating_remove','not_interested','restore','watched','unwatched','services','languages','genres','impression','row_impression','click','title_open','trailer','provider_click','swipe_undo','mood'] as const;
export type EventType = typeof EVENT_TYPES[number];
export interface InteractionEvent { id: string; type: EventType; at: string; titleId?: string; value?: number; selection?: string[]; surface: string; row?: string; rowType?:string; anchorId?:string; mood?:Mood; feedId?:string; batch?:number; rowPosition?:number; context?:string; position?: number; model: string; sessionId: string; sources?: string[]; input?: 'gesture'|'button'|'keyboard' }
export type EventContext = { surface: string; sessionId: string; row?: string; rowType?:string; anchorId?:string; mood?:Mood; feedId?:string; batch?:number; rowPosition?:number; context?:string; position?: number; sources?: string[]; input?: 'gesture'|'button'|'keyboard' };
export const EVENT_MODEL = MODEL_VERSION;
export function createEvent(type: EventType, context: EventContext, titleId?: string, value?: number): InteractionEvent {
  return { id: crypto.randomUUID(), type, at: new Date().toISOString(), titleId, value, ...context, model: EVENT_MODEL };
}
export function sanitizeEvents(input: unknown): InteractionEvent[] {
  if (!Array.isArray(input)) return [];
  const result = new Map<string, InteractionEvent>();
  for (const e of input.slice(-2000)) {
    if (!e || typeof e.id !== 'string' || e.id.length > 80 || !EVENT_TYPES.includes(e.type) || typeof e.at !== 'string' || !Number.isFinite(Date.parse(e.at)) || Date.parse(e.at) > Date.now() + 300000 || (e.titleId && !parseTitleRef(e.titleId))) continue;
    result.set(e.id, { id: e.id, type: e.type, at: e.at, feedId:typeof e.feedId==='string'?e.feedId.slice(0,80):undefined,batch:Number.isInteger(e.batch)&&e.batch>=0&&e.batch<10?e.batch:undefined,rowPosition:Number.isInteger(e.rowPosition)&&e.rowPosition>=0&&e.rowPosition<100?e.rowPosition:undefined,context:typeof e.context==='string'?e.context.slice(0,1000):undefined,rowType:typeof e.rowType==='string'?e.rowType.slice(0,80):undefined,anchorId:typeof e.anchorId==='string'&&parseTitleRef(e.anchorId)?e.anchorId:undefined,mood:moods.includes(e.mood)?e.mood:undefined,sources: Array.isArray(e.sources) ? e.sources.filter((v:unknown)=>typeof v==='string'&&v.length<160).slice(0,18) : undefined, input: ['gesture','button','keyboard'].includes(e.input)?e.input:undefined, titleId: typeof e.titleId === 'string' ? e.titleId : undefined, value: typeof e.value === 'number' && e.value >= 0 && e.value <= 10 ? e.value : undefined, surface: typeof e.surface === 'string' ? e.surface.slice(0,80) : 'unknown', row: typeof e.row === 'string' ? e.row.slice(0,150) : undefined, position: Number.isInteger(e.position) && e.position >= 0 && e.position < 1000 ? e.position : undefined, selection: Array.isArray(e.selection) ? e.selection.filter((v:unknown)=>typeof v==='string'&&v.length<100).slice(0,30) : undefined, model: typeof e.model === 'string' ? e.model.slice(0,40) : EVENT_MODEL, sessionId: typeof e.sessionId === 'string' ? e.sessionId.slice(0,80) : 'legacy' });
  }
  return [...result.values()];
}
export function recordChanges(old: LocalState, next: LocalState, context: EventContext): LocalState {
  const events: InteractionEvent[] = [];
  const times = { ...next.signalTimes };
  const add = (type: EventType, key: string, id?: string, value?: number) => { const e = createEvent(type, context, id, value); events.push(e); times[key] = e.at; };
  for (const [field, on, off] of [['liked','like','unlike'],['disliked','dislike','undislike'],['favorites','favorite','unfavorite'],['saved','watchlist_add','watchlist_remove'],['dismissed','not_interested','restore']] as const) {
    for (const id of next[field]) if (!old[field].includes(id)) add(on, `${field}:${id}`, id);
    for (const id of old[field]) if (!next[field].includes(id)) add(off, `${field}:${id}`, id);
  }
  for (const id of new Set([...Object.keys(old.ratings), ...Object.keys(next.ratings)])) if (old.ratings[id] !== next.ratings[id]) add(next.ratings[id] ? 'rating' : 'rating_remove', `ratings:${id}`, id, next.ratings[id]);
  for (const field of ['services','languages','genres'] as const) if (JSON.stringify(old[field]) !== JSON.stringify(next[field])) { add(field, field); events[events.length-1].selection=[...next[field]]; }
  for (const e of next.watched) if (!old.watched.some(w => w.titleId === e.titleId)) add('watched', `watched:${e.titleId}`, e.titleId);
  for (const e of old.watched) if (!next.watched.some(w => w.titleId === e.titleId)) add('unwatched', `watched:${e.titleId}`, e.titleId);
  return { ...next, events: [...next.events, ...events].slice(-2000), signalTimes: times, revision: old.revision + 1 };
}
