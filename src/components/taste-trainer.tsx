'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Heart, RefreshCw, RotateCcw, Sparkles, EyeOff } from 'lucide-react';
import type { Title } from '@/modules/catalog/types';
import { titlePath } from '@/modules/catalog/types';
import { defaultFilters, getRecommendations, exclusionReason } from '@/modules/recommendations/rank';
import { applySwipe, undoSwipe, SWIPE, type SwipeDecision, type SwipeUndo } from '@/modules/recommendations/swipe';
import { useLocal } from './local-provider';
import { SwipeStack, type SwipeStackHandle } from './swipe-stack';

type UndoRecord = { title: Title; change: SwipeUndo; sequence: number; decision: SwipeDecision };
type DeckSnapshot = { pool:Title[];evidence:Title[];active:Title|null;seen:string[];request:{page:number;generation:number};hasMore:boolean;undo:UndoRecord|null;sequence:number };
type Input = 'gesture' | 'button' | 'keyboard';
export function TasteTrainer() {
  const { state, ready, user, sessionId, update, track, retrySync, syncError, storageError, viewState } = useLocal();
  const router = useRouter();
  const initial = useRef(viewState.get('taste') as DeckSnapshot | undefined).current;
  const [pool, setPool] = useState<Title[]>(initial?.pool ?? []), [evidence, setEvidence] = useState<Title[]>(initial?.evidence ?? []);
  const [active, setActive] = useState<Title | null>(initial?.active ?? null), [seen, setSeen] = useState<string[]>(initial?.seen ?? []);
  const [request, setRequest] = useState(initial?.request ?? { page: 1, generation: 0 }), [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [warning, setWarning] = useState('');
  const [exiting, setExiting] = useState(false), [restore, setRestore] = useState(0), [restoreDirection, setRestoreDirection] = useState<SwipeDecision>('like');
  const [undo, setUndo] = useState<UndoRecord | null>(initial?.undo ?? null), [sequence, setSequence] = useState(initial?.sequence ?? 0), [message, setMessage] = useState('');
  const latest = useRef(state); latest.current = state;
  const deck = useRef<HTMLDivElement>(null), stack = useRef<SwipeStackHandle>(null);
  const busy = useRef(false), pending = useRef<(()=>void)|null>(null);
  const snapshot = useRef<DeckSnapshot>(null!);
  snapshot.current = {pool,evidence,active,seen,request,hasMore,undo,sequence};
  // This map belongs to one identity epoch; logout/login replaces it entirely.
  useEffect(() => () => { viewState.set('taste',snapshot.current); }, [viewState]);
  const onBusy = (value:boolean) => { busy.current=value;setExiting(value);if(!value&&pending.current){const apply=pending.current;pending.current=null;apply();} };
  const preferences = JSON.stringify([state.services, state.languages, state.genres]);
  const previousPreferences = useRef(preferences);
  const ranked = useMemo(() => getRecommendations({ titles: pool, state, evidence: [...pool, ...evidence], surface: 'swipe', sessionId }), [pool, evidence, state, sessionId]);
  const queue = ranked.filter(r => !seen.includes(r.title.id)).slice(0, SWIPE.bufferSize);
  const current = active && (exiting || (!seen.includes(active.id) && !exclusionReason(active,state,defaultFilters,'swipe'))) ? active : queue[0]?.title ?? null;
  const reason = ranked.find(r => r.title.id === current?.id)?.reason;

  useEffect(() => {
    if (previousPreferences.current !== preferences) { previousPreferences.current = preferences; setRequest(r => ({ page: 1, generation: r.generation + 1 })); }
  }, [preferences]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    (async () => {
      try {
        await retrySync();
        const response = await fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ surface: 'swipe', filters: defaultFilters, sessionId, page: request.page, ...(user ? {} : { state: latest.current }) }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Picks could not be refreshed.');
        if (controller.signal.aborted) return;
        const apply = () => { if (controller.signal.aborted) return; setPool(old => [...new Map([...old, ...data.titles].map((t: Title) => [t.id, t])).values()].slice(-120));
        setEvidence(data.evidence ?? []); setHasMore(data.hasMore); setWarning((data.warnings ?? []).join(' ')); };
        if (busy.current) pending.current=apply; else apply();
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Picks could not be loaded.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [request, ready, sessionId, retrySync, user]);
  useEffect(() => {
    if (!loading && !error && hasMore && queue.length <= SWIPE.refillAt && request.page < 3) setRequest(r => ({ ...r, page: r.page + 1 }));
  }, [loading, error, hasMore, queue.length, request.page]);
  useEffect(() => { if (!exiting && current?.id !== active?.id) setActive(current); }, [current, active, exiting]);
  useEffect(() => {
    if (!current || exiting || !deck.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(entries => {
      if (timer) clearTimeout(timer);
      if (entries[0].intersectionRatio >= .5) timer = setTimeout(() => {
        if (document.visibilityState === 'visible' && !busy.current) track('impression', current.id, { surface: 'swipe', row: 'deck', position: sequence, sources: current.provenance });
      }, 600);
    }, { threshold: .5 });
    observer.observe(deck.current);
    return () => { observer.disconnect(); if (timer) clearTimeout(timer); };
  }, [current?.id, exiting, sequence, track]);
  const decide = (decision: SwipeDecision, input: Input, preparedNext?:Title) => {
    if (!current) return;
    const title = current;
    const change = applySwipe(latest.current, title.id, decision);
    setUndo({ title, change: change.undo, sequence, decision });
    update(s => applySwipe(s, title.id, decision).state, { surface: 'swipe', row: 'deck', position: sequence, sources: title.provenance, input });
    setSeen(ids => [...new Set([...ids, title.id])]); setSequence(n => n + 1);
    setMessage(decision === 'like' ? `Liked ${title.name}. Your taste has been updated.` : `${title.name} is hidden from your picks. This is not a dislike.`);
    if ((sequence + 1) % SWIPE.refreshEvery === 0) setRequest(r => ({ page: 1, generation: r.generation + 1 }));
    setActive(preparedNext ?? null);
  };
  const reverse = () => {
    if (!undo || busy.current) return;
    update(s => undoSwipe(s, undo.change), { surface: 'swipe', row: 'deck', position: undo.sequence, sources: undo.title.provenance });
    track('swipe_undo', undo.title.id, { surface: 'swipe', row: 'deck', position: undo.sequence, sources: undo.title.provenance });
    setSeen(ids => ids.filter(id => id !== undo.title.id)); setActive(undo.title); setRestoreDirection(undo.decision); setRestore(n=>n+1); setUndo(null);
    setMessage(`Undid your decision on ${undo.title.name}.`); setRequest(r => ({ page: 1, generation: r.generation + 1 }));
  };
  const openDetails = () => {
    if (!current || busy.current) return;
    viewState.set('taste',snapshot.current);
    track('click',current.id,{surface:'swipe',row:'deck',position:sequence,sources:current.provenance});
    router.push(titlePath(current));
  };
  const refresh = () => { setRequest(r => ({ page: r.page >= 3 || !hasMore ? 1 : r.page + 1, generation: r.generation + 1 })); };
  const paused = !!syncError;
  return <main id="main" className="page-shell taste-page">
    <section className="taste-intro"><span className="eyebrow"><Sparkles size={13}/> A FEW CHOICES. BETTER PICKS.</span><h1>Less searching. More feeling.</h1><p>Like what catches your eye. Pass on what doesn’t.<br/>Every choice makes Home and For You more yours.</p><div className="taste-guide"><div><span>01</span><div><strong>Go with your instinct</strong><p>Swipe right for Like. Left for Not Interested.</p></div></div><div><span>02</span><div><strong>Changed your mind?</strong><p>Undo brings your last card right back.</p></div></div><div><span>03</span><div><strong>Watch your world open up</strong><p>Your choices shape your next recommendations.</p></div></div></div><Link href="/for-you" className="text-button">Explore your personal edit <ArrowRight size={16}/></Link></section>
    <div className="taste-workspace">
      <div ref={deck} className="taste-deck" tabIndex={0} role="group" aria-label="Taste cards. Right arrow to like, left arrow for not interested." onKeyDown={event => {
        if ((event.target !== event.currentTarget && !(event.target instanceof Element && event.target.closest('[data-active]'))) || event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); stack.current?.choose(event.key === 'ArrowRight' ? 'like' : 'not_interested', 'keyboard'); }
      }}>
        {current ? <SwipeStack ref={stack} watched={state.watched.some(w=>w.titleId===current.id)} title={current} next={queue.filter(r=>r.title.id!==current.id).slice(0,2).map(r=>r.title)} disabled={paused} restore={restore} restoreDirection={restoreDirection} onBusy={onBusy} onDecision={decide} onOpen={openDetails}/> : <div className="taste-empty" role="status"><Sparkles size={28}/><h2>{loading || !ready ? 'Finding your next scene…' : error ? 'Your picks need a moment.' : 'You’ve explored the current picks.'}</h2><p>{loading || !ready ? 'Real movies and series, chosen around you.' : error || 'Refresh for more, or see how your choices changed For You.'}</p>{!loading && ready && <button className="button secondary" onClick={refresh}><RefreshCw size={15}/>Refresh picks</button>}</div>}
      </div>
      <div className="taste-bottom">
        <p className="taste-reason">{current && <><Sparkles size={14}/>{reason ?? 'A story from your current recommendation mix'}</>}</p>
        <div className="taste-controls"><button className="button secondary" disabled={!current || !!exiting || paused} onClick={()=>stack.current?.choose('not_interested','button')} aria-label="Not interested in this title"><EyeOff size={18}/>Not interested</button><button className="button primary" disabled={!current || !!exiting || paused} onClick={()=>stack.current?.choose('like','button')} aria-label="Like this title"><Heart size={18}/>Like</button></div>
        <div className="taste-secondary"><button className="text-button" disabled={!undo || !!exiting} onClick={reverse}><RotateCcw size={14}/>Undo</button>{current && <Link className="text-button" href={titlePath(current)} onClick={event=>{event.preventDefault();openDetails();}}>Details<ExternalLink size={13}/></Link>}{current?.trailerUrl && <a className="text-button" href={current.trailerUrl} target="_blank" rel="noopener noreferrer" onClick={()=>track('trailer',current.id,{surface:'swipe',row:'deck',position:sequence,sources:current.provenance})}>Trailer on YouTube<ExternalLink size={13}/></a>}</div>
        <p className="taste-help"><span><ArrowLeft size={12}/> Not interested</span><span>Like <ArrowRight size={12}/></span></p><p className="small-note">Swipe or use the buttons. Watched history stays private.</p>
        <p className="sr-only" role="status" aria-live="polite">{message}</p>
        {paused && <div className="taste-notice" role="alert">Your last choice still needs saving. Swipe is paused so you can retry or undo. <button onClick={()=>void retrySync().catch(()=>{})}>Retry save</button></div>}
        {storageError && <p className="taste-notice">Browser storage is unavailable. Anonymous decisions last only for this visit.</p>}
        {current && error && <div className="taste-notice" role="status">{error} You can keep using loaded cards. <button onClick={refresh}>Retry picks</button></div>}
        {warning && <p className="small-note">{warning}</p>}
        <div className="taste-progress"><span>{sequence} {sequence === 1 ? 'choice' : 'choices'} this visit{loading && current ? ' · refreshing your mix' : ''}</span><Link href="/for-you">See your picks <ArrowRight size={14}/></Link></div>
      </div>
    </div>
  </main>;
}
