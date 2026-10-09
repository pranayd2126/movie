'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState, useRef } from 'react';
import { ArrowUpRight, Bookmark, Check, ChevronDown, ChevronRight, Clock3, Compass, Film, Heart, LockKeyhole, Play, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, WandSparkles, X, ThumbsUp, ThumbsDown, EyeOff } from 'lucide-react';
import { type Title, type Mood, type ProviderId, type CatalogPage, languages, languageCode, languageName, moods, titlePath } from '@/modules/catalog/types';
import { catalogGenres } from '@/modules/catalog/preferences';
import { moodLabel } from '@/modules/discovery/moods';
import { defaultFilters, getRecommendations, exclusionReason, type Filters } from '@/modules/recommendations/rank';
import { composeRowPlan } from '@/modules/recommendations/rows';
import { buildTasteProfile } from '@/modules/recommendations/taste';
import { evaluateRecommendations, exposureMetrics } from '@/modules/recommendations/metrics';
import { MODEL_VERSION } from '@/modules/recommendations/config';
import { signalIds, positiveSeedIds, toggleItem } from '@/modules/library/state';
import { useLocal } from './local-provider';
import { Modal, PosterArt, ServiceLogo, EmptyState } from './primitives';
import { ServicesModal } from './header';

import { TitleCard } from './title-card';
export { TitleCard } from './title-card';
import { ProgressiveDiscover } from './progressive-discover';

export function TasteModal({ onClose, catalog }: { onClose: () => void; catalog: Title[] }) {
  const { state, update, notify, user } = useLocal();
  const [langs, setLangs] = useState(state.languages.map(languageCode));
  const [genres, setGenres] = useState(state.genres);
  const [likes, setLikes] = useState(state.liked);
  return <Modal wide title="A little taste goes a long way." subtitle="Pick what you enjoy. Skip anything. You can always change your mind." onClose={onClose}>
    <fieldset className="taste-field"><legend>Languages you love</legend><div className="chips wrap">{languages.map(l => <button className={`chip ${langs.includes(languageCode(l)) ? 'selected' : ''}`} aria-pressed={langs.includes(languageCode(l))} key={l} onClick={() => setLangs(old => toggleItem(old, languageCode(l)))}>{l}{langs.includes(languageCode(l)) && <Check size={13}/>}</button>)}</div></fieldset>
    <fieldset className="taste-field"><legend>Your kind of story</legend><div className="chips wrap">{catalogGenres.map(g => <button className={`chip ${genres.includes(g) ? 'selected' : ''}`} aria-pressed={genres.includes(g)} key={g} onClick={() => setGenres(old => toggleItem(old, g))}>{g}</button>)}</div></fieldset>
    {catalog.length > 0 && <fieldset className="taste-field"><legend>Like a story you already love</legend><p className="small-note">Only like titles you know you enjoy. You can search for more in Discover.</p><div className="taste-posters">{catalog.slice(1, 7).map(t => <button key={t.id} className={`taste-poster ${likes.includes(t.id) ? 'selected' : ''}`} aria-pressed={likes.includes(t.id)} aria-label={`Like ${t.name}`} onClick={() => setLikes(old => toggleItem(old, t.id))}><PosterArt title={t}/><Heart size={17} fill={likes.includes(t.id) ? 'currentColor' : 'none'}/></button>)}</div></fieldset>}
    <div className="modal-actions"><span className="privacy-note"><LockKeyhole size={14}/> {user ? 'Private to your account' : 'Only on this device'}</span><button className="button primary" onClick={() => { update(s => ({ ...s, languages: langs, genres, liked: likes, disliked: s.disliked.filter(id => !likes.includes(id)) })); notify('Your next picks are a little more you'); onClose(); }}>Find my next watch <Sparkles size={16}/></button></div>
  </Modal>;
}

function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  return { ...defaultFilters, query: params.get('q') ?? '', kind: ['movie', 'series'].includes(params.get('type') ?? '') ? params.get('type') as 'movie' | 'series' : 'all', language: languages.includes(params.get('language') ?? '') ? params.get('language')! : '', genre: params.get('genre') ?? '', provider:/^[1-9]\d{0,8}$/.test(params.get('provider')??'')?params.get('provider')!:'',minRuntime:Math.min(600,Math.max(0,Number(params.get('minRuntime'))||0)),mood: moods.includes(params.get('mood') as Mood) ? params.get('mood') as Mood : 'All moods', maxRuntime: Math.max(0, Number(params.get('runtime')) || 0), minRating: Math.min(10, Math.max(0, Number(params.get('rating')) || 0)), year: Math.max(0, Number(params.get('year')) || 0), sort: ['rating', 'newest', 'alphabetical'].includes(params.get('sort') ?? '') ? params.get('sort') as Filters['sort'] : 'picks', onlyServices: params.get('allServices') !== '1' };
}
export function Catalog({ catalog, view = 'home', debug = false }: { catalog: Title[]; view?: 'home' | 'discover' | 'for-you'; debug?: boolean }) {
  const { state, ready, update, providers, user, sessionId, retrySync, identityKey, track, viewState } = useLocal();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const progressive=view==='discover'&&!filters.query&&filters.sort==='picks';
  const [page, setPage] = useState(1);
  const [remote, setRemote] = useState<CatalogPage & { evidence?: Title[]; debug?: unknown }>({ titles: catalog, page: 1, hasMore: true });
  const lastQuery = useRef<string | null>(null);
  const [received, setReceived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const evidence = useMemo(()=>({ titles: remote.evidence ?? [] }),[remote.evidence]);
  const requestKey = JSON.stringify({ filters, surface: view, revision: state.revision, sessionId, identityKey });
  const latestState = useRef(state); latestState.current = state;
  useEffect(() => { setPage(1); setVisibleCount(12); }, [requestKey]);
  useEffect(() => {
    if (!ready || progressive) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        await retrySync();
        const response = await fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: JSON.parse(requestKey).filters, surface: view, sessionId, page, ...(user ? {} : { state: latestState.current }), debug }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Movie data could not be loaded.');
        lastQuery.current = JSON.parse(requestKey).filters.query;
        setReceived(true);
        setRemote(old => {
          const merged:Title[]=page===1?data.titles:[...new Map([...old.titles,...data.titles].map((t:Title)=>[t.id,t])).values()];
          const limit=filters.query?600:180;
          return {...data,titles:merged.slice(0,limit),hasMore:data.hasMore&&merged.length<limit};
        });
      } catch (e) { if (!controller.signal.aborted) { setReceived(true); setError(e instanceof Error ? e.message : 'Movie data could not be loaded.'); setRemote(old => lastQuery.current === JSON.parse(requestKey).filters.query ? ({ ...old, hasMore: false }) : ({ titles: [], page, hasMore: false })); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, filters.query ? 350 : 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestKey, page, ready, retry, retrySync, progressive]);
  const [services, setServices] = useState(false);
  const [taste, setTaste] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  useEffect(() => { setFilters(window.location.search?readFilters():(viewState.get(`filters:${view}`) as Filters|undefined)??readFilters()); const onPop = () => setFilters(readFilters()); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); document.getElementById('catalog-search')?.focus(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const change = (next: Partial<Filters>) => {
    const f = { ...filters, ...next }; setFilters(f);viewState.set(`filters:${view}`,f);if(next.mood&&next.mood!==filters.mood)track('mood',undefined,{mood:next.mood}); setVisibleCount(12); setPage(1);
    const params = new URLSearchParams();
    if(f.provider)params.set('provider',f.provider);if(f.minRuntime)params.set('minRuntime',String(f.minRuntime));if (f.query) params.set('q', f.query); if (f.kind !== 'all') params.set('type', f.kind); if (f.language) params.set('language', f.language); if (f.genre) params.set('genre', f.genre); if (f.mood !== 'All moods') params.set('mood', f.mood); if (f.maxRuntime) params.set('runtime', String(f.maxRuntime)); if (f.minRating) params.set('rating', String(f.minRating)); if (f.year) params.set('year', String(f.year)); if (f.sort !== 'picks') params.set('sort', f.sort); if (!f.onlyServices) params.set('allServices', '1');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  };
  const ranked = useMemo(() => getRecommendations({ titles: remote.titles, state, filters, evidence: [...remote.titles, ...evidence.titles], surface: view, sessionId }), [remote.titles, state, filters, view, evidence.titles, sessionId]);
  const rowPlan = useMemo(() => composeRowPlan(remote.titles,state,[...remote.titles,...evidence.titles],view,sessionId,filters),[remote.titles,state,evidence.titles,view,sessionId,filters]);
  const rows=rowPlan.rows;
  const showRows=!filters.query&&filters.sort==='picks'&&(view==='discover'||!filters.kind||filters.kind==='all');
  const featured = ranked.find(r => r.title.backdropUrl)?.title;
  const isFiltered = filters.query || filters.kind !== 'all' || filters.language || filters.genre || filters.mood !== 'All moods' || filters.maxRuntime || filters.minRuntime || filters.provider || filters.minRating || filters.year;
  const hasTaste = state.liked.length || state.languages.length || state.genres.length || Object.keys(state.ratings).length;
  const heading = view === 'for-you' ? 'More your kind of cinema.' : view === 'discover' ? 'Every mood has a movie.' : 'Your next great watch starts here.';
  return <main id="main" className="page-shell">
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-line"/>{view === 'for-you' ? 'A LITTLE MORE YOU' : 'LESS SCROLLING. MORE CINEMA.'}</div><h1>{heading}</h1><p>{view === 'for-you' ? 'Your taste, your services, and a few unexpected discoveries.' : 'Across your services. In your languages. For the way you feel.'}</p></div><button className="text-button taste-trigger" onClick={() => setTaste(true)}><Sparkles size={17}/>{hasTaste ? 'Fine-tune my taste' : 'Make it more me'}<ChevronRight size={16}/></button></section>

    {view === 'home' && !isFiltered && featured && ready && received && <section className="hero-card" aria-label={`Featured: ${featured.name}`}><Image src={featured.backdropUrl!} alt={`${featured.name} backdrop`} fill priority sizes="(max-width: 1200px) 100vw, 1320px" className="hero-image"/><div className="hero-shade"/><div className="hero-content"><span className="hero-label"><span/>YOUR NEXT SCENE</span><div className="hero-title real-hero-title">{featured.name}</div><p className="hero-tagline">{featured.tagline}</p><div className="hero-meta"><span>{featured.year || 'Release date unavailable'}</span><span>{featured.language}</span><span>{featured.runtime ? `${featured.runtime} min` : featured.kind === 'series' ? 'Series' : 'Film'}</span><span>{featured.genres.slice(0, 2).join(' · ')}</span></div><p className="hero-description">{featured.synopsis}</p><div className="hero-actions"><Link href={titlePath(featured)} className="button primary"><Play size={17} fill="currentColor"/> Explore {featured.kind === 'series' ? 'the series' : 'the film'}</Link><button className={`button glass ${state.saved.includes(featured.id) ? 'is-saved' : ''}`} onClick={() => update(s => ({ ...s, saved: toggleItem(s.saved, featured.id) }))}>{state.saved.includes(featured.id) ? <Check size={17}/> : <Plus size={18}/>}My list</button></div><div className="hero-reason"><Sparkles size={14}/><span>{ranked.find(r => r.title.id === featured.id)?.reason}</span></div></div><div className="hero-caption"><span>METADATA & ARTWORK · TMDB</span><span>INDIA WATCH OPTIONS · JUSTWATCH</span></div></section>}

    <section className="services-bar" aria-label="Your streaming services"><div className="services-title"><span>YOUR SCREEN,</span><strong>your services.</strong></div><div className="services-inline">{providers.filter(p => !p.addon).slice(0, 6).map(p => <button key={p.id} className={`inline-service ${state.services.includes(p.id) ? 'selected' : ''}`} aria-label={`${state.services.includes(p.id) ? 'Remove' : 'Select'} ${p.name}`} aria-pressed={state.services.includes(p.id)} onClick={() => update(s => ({ ...s, services: s.services.includes(p.id) ? s.services.filter(id => id !== p.id) : [...s.services, p.id] }))}><ServiceLogo id={p.id}/>{state.services.includes(p.id) && <span className="service-check"><Check size={10}/></span>}</button>)}</div><button className="manage-services text-button" onClick={() => setServices(true)}><Plus size={15}/><span>{state.services.length ? 'Manage services' : 'Choose yours'}</span></button></section>
    {ready && !state.onboardingDismissed && !state.services.length && <div className="onboarding-note"><span>Select the services you have to narrow your next watch. No sign-in needed.</span><button onClick={() => update(s => ({ ...s, onboardingDismissed: true }))}>Maybe later <X size={12}/></button></div>}

    <section className="discovery-section" aria-labelledby="picks-title"><div className="section-heading"><div><span className="eyebrow">{view === 'for-you' ? 'YOUR OWN LITTLE FILM FESTIVAL' : 'THE GOOD STUFF, WITHOUT THE SCROLL'}</span><h2 id="picks-title">{filters.query ? `Results for “${filters.query}”` : view === 'for-you' ? 'Picked around your taste' : 'Find your next obsession'}<span className="heading-spark"><Sparkles size={21}/></span></h2></div><div className="type-switch" role="group" aria-label="Title type">{(['all', 'movie', 'series'] as const).map(type => <button key={type} className={filters.kind === type ? 'selected' : ''} aria-pressed={filters.kind === type} onClick={() => change({ kind: type })}>{type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'Series'}</button>)}</div></div>
    <div className="mood-row"><span className="mood-label">In the mood for</span><div className="chips">{moods.map((m, i) => <button className={`chip ${filters.mood === m ? 'selected' : ''}`} key={m} aria-pressed={filters.mood === m} onClick={() => change({ mood: m })}>{i === 0 ? <Compass size={14}/> : i === 1 ? <WandSparkles size={14}/> : i === 2 ? <Film size={14}/> : i === 3 ? <Heart size={14}/> : <GlobeIcon/>}{moodLabel(m)}</button>)}</div></div>
    {view==='discover'&&<><p className="small-note">Mood is for this visit. We infer it from genres and keywords; it doesn’t change your lasting preferences.</p><div className="discovery-chips"><span>Language</span><div className="chips">{['',...languages].map(l=><button key={l} className={`chip ${filters.language===l?'selected':''}`} aria-pressed={filters.language===l} onClick={()=>change({language:l})}>{l||'All languages'}</button>)}</div></div><div className="discovery-chips"><span>Genre</span><div className="chips">{['',...catalogGenres.slice(0,18)].map(g=><button key={g} className={`chip ${filters.genre===g?'selected':''}`} aria-pressed={filters.genre===g} onClick={()=>change({genre:g})}>{g||'Any genre'}</button>)}</div></div></>}
    <div className="filter-row"><label className="catalog-search"><Search size={17}/><input id="catalog-search" value={filters.query} placeholder="Search movies and series…" aria-label="Search movies and series" onChange={e => change({ query: e.target.value })}/>{filters.query && <button aria-label="Clear search" onClick={() => change({ query: '' })}><X size={14}/></button>}</label><label className="select-wrap"><span className="sr-only">Language</span><select value={filters.language} onChange={e => change({ language: e.target.value })}><option value="">All languages</option>{languages.map(l => <option key={l}>{l}</option>)}</select><ChevronDown size={14}/></label><button className={`filter-button ${advanced ? 'selected' : ''}`} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} aria-controls="advanced-filters"><SlidersHorizontal size={16}/> More filters{(filters.genre || filters.year || filters.maxRuntime || filters.minRuntime || filters.provider || filters.minRating) ? <span className="filter-dot"/> : null}</button><label className="select-wrap sort-select"><span className="sort-label">Sort:</span><span className="sr-only">Sort results</span><select value={filters.sort} onChange={e => change({ sort: e.target.value as Filters['sort'] })}><option value="picks">Our picks</option><option value="rating">TMDB rating</option><option value="newest">Newest</option><option value="alphabetical">A–Z</option></select><ChevronDown size={14}/></label></div>
    {advanced && <div className="advanced-filters" id="advanced-filters"><label>Genre<select value={filters.genre} onChange={e => change({ genre: e.target.value })}><option value="">Any genre</option>{catalogGenres.map(g => <option key={g}>{g}</option>)}</select></label><label>Runtime (film / episode)<select value={filters.minRuntime?'long':String(filters.maxRuntime)} onChange={e => change({ maxRuntime:e.target.value==='long'?0:Number(e.target.value),minRuntime:e.target.value==='long'?120:0 })}><option value="0">Any length</option><option value="90">Under 90 minutes</option><option value="120">Under 2 hours</option><option value="106">105 minutes or less</option><option value="long">2+ hours</option></select></label><label>Included subscription<select value={filters.provider??''} onChange={e=>change({provider:e.target.value})}><option value="">{filters.onlyServices?'My selected services':'Any service'}</option>{providers.filter(p=>!p.addon).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>TMDB rating<select value={filters.minRating} onChange={e => change({ minRating: Number(e.target.value) })}><option value="0">Any rating</option><option value="8">8 and above</option><option value="8.5">8.5 and above</option></select></label><label>Release year<select value={filters.year} onChange={e => change({ year: Number(e.target.value) })}><option value="0">Any year</option>{Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y}>{y}</option>)}</select></label><label className="checkbox-label"><input type="checkbox" disabled={!!filters.query} checked={filters.onlyServices && !filters.query} onChange={e => change({ onlyServices: e.target.checked })}/> Only my services</label></div>}
    {!progressive&&<div className="results-line" aria-busy={loading}><span>{loading ? 'Loading… · ' : ''}{ranked.length} {ranked.length === 1 ? 'story' : 'stories'} to get lost in{state.services.length > 0 && filters.onlyServices && !filters.query ? ' · included subscriptions in India' : ''}</span>{!!isFiltered && <button className="text-button" onClick={() => change(defaultFilters)}>Clear filters <X size={12}/></button>}<span className="sample-scores">TMDB ratings · JustWatch IN · Sort applies to loaded results</span></div>}
    {progressive?<ProgressiveDiscover filters={filters} debug={debug} onClear={()=>{setAdvanced(true);change(defaultFilters);document.getElementById('picks-title')?.scrollIntoView({block:'start'});}}/>:<>
    {error && remote.titles.length > 0 && <div role="status" className="onboarding-note"><span>{error} Showing previously loaded results with your current filters.</span><button onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
    {!received || (loading && (!remote.titles.length || !!filters.query)) || !ready ? <div className="skeleton-grid" role="status" aria-label="Loading real movie and TV data">{[1, 2, 3, 4, 5, 6].map(n => <div className="skeleton" key={n}/>)}<span className="sr-only">Loading real movie and TV data…</span></div> : error && !remote.titles.length ? <EmptyState title="Movie data is taking a break." action={<button className="button secondary" onClick={() => setRetry(n => n + 1)}>Try again</button>}>{error}</EmptyState> : showRows && rows.length ? <div className="personalized-rows">{rows.map(row => <section className="recommendation-row" key={row.id} aria-label={row.name}><div className="section-heading"><div><h2>{row.name}</h2><p>{row.reason}</p></div></div><div className="row-posters">{row.items.map((r,position) => <TitleCard key={r.title.id} title={r.title} reason={r.reason} row={row.id} rowType={row.theme} anchorId={row.anchorId} position={position}/>)}</div></section>)}</div> : ranked.length ? <div className="poster-grid">{ranked.slice(0, visibleCount).map((r, position) => <TitleCard position={position} key={r.title.id} title={r.title} reason={filters.query ? undefined : r.reason}/>)}</div> : loading ? <p role="status">Updating your picks…</p> : <EmptyState title="No matches for this combination." action={<button className="button secondary" onClick={() => change({ ...defaultFilters, onlyServices: false })}>Explore all services</button>}>Try another language, mood or service. We won’t quietly change your filters.</EmptyState>}
    {!loading && !error && ((showRows ? remote.hasMore : ranked.length > visibleCount || remote.hasMore)) && <div className="load-more"><button className="button secondary" onClick={() => { if (showRows || ranked.length <= visibleCount) setPage(p => p + 1); setVisibleCount(c => c + 12); }}>A few more good stories <ChevronDown size={16}/></button></div>}
    </>}
    </section>
    {!progressive&&remote.warnings?.map(w => <p className="small-note" key={w} role="status">{w}</p>)}
    {filters.query && <p className="small-note">Search includes watched, disliked and out-of-subscription titles. Other filters still apply.</p>}
    <section className="taste-banner"><div className="taste-symbol"><Sparkles size={32}/></div><div><span className="eyebrow">GOOD TASTE DESERVES BETTER PICKS</span><h2>Less “what’s popular.” More “that’s so me.”</h2><p>A few favorites. Your languages. A better starting point.</p></div><button className="button secondary" onClick={() => setTaste(true)}>Tune your taste <Sparkles size={15}/></button></section>
    <div className="trust-row"><span><ShieldCheck size={17}/>Your watch history stays yours.</span><span>No OTT passwords. No automatic sharing.</span><Link href="/settings">Your privacy, explained <ArrowUpRight size={14}/></Link></div>
    {debug && process.env.NODE_ENV === 'development' && <section className="panel recommendation-debug"><h2>Private recommendation debugger</h2><p>Model {MODEL_VERSION} · {user ? 'Authenticated account' : 'Anonymous browser'} · {state.events.length} private events</p><pre>{JSON.stringify({metrics:evaluateRecommendations(ranked.map(r=>r.title),remote.titles,state.services),exposure:exposureMetrics(state.events),excluded:remote.titles.map(title=>({title:title.name,reason:exclusionReason(title,state,filters,view)})).filter(t=>t.reason),reranking:ranked.slice(0,20).map((r,index)=>({title:r.title.name,finalRank:index+1,rawRank:[...ranked].sort((a,b)=>b.score-a.score).findIndex(x=>x.title.id===r.title.id)+1})),profile:buildTasteProfile(state,[...remote.titles,...evidence.titles],sessionId),rows:rowPlan.diagnostics,candidates:ranked.slice(0,20).map(r=>({name:r.title.name,score:r.score,reason:r.reason,components:r.components,provenance:r.title.provenance})),retrieval:remote.debug},null,2)}</pre></section>}
    {services && <ServicesModal onClose={() => setServices(false)}/>}{taste && <TasteModal catalog={remote.titles} onClose={() => setTaste(false)}/>}
  </main>;
}
function GlobeIcon() { return <Compass size={14}/>; }
