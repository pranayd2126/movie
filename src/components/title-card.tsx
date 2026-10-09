'use client';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {Check,Plus,Star,Sparkles,ThumbsUp,ThumbsDown,EyeOff} from 'lucide-react';
import {type Title,titlePath} from '@/modules/catalog/types';
import {type EventContext} from '@/modules/library/events';
import {toggleItem} from '@/modules/library/state';
import {useLocal} from './local-provider';
import {PosterArt,ServiceLogo} from './primitives';
export function TitleCard({ title, reason, row = 'grid', position = 0, rowType, anchorId, feedContext }: { title: Title; reason?: string; row?: string; position?: number; rowType?:string; anchorId?:string; feedContext?:Partial<EventContext> }) {
  const { state, update: updateState, notify, track } = useLocal();
  const update: typeof updateState = updater => updateState(updater, { ...feedContext, row, rowType, anchorId, position, sources:title.provenance });
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!reason || !card.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) timer = setTimeout(() => { track('impression', title.id, { ...feedContext, row, rowType, anchorId, position, sources:title.provenance }); track('row_impression', undefined, { ...feedContext, row, rowType, anchorId }); }, 800);
      else if (timer) clearTimeout(timer);
    }, { threshold: .5 });
    observer.observe(card.current); return () => { observer.disconnect(); if (timer) clearTimeout(timer); };
  }, [title.id, row, rowType, anchorId, position, reason, track, feedContext]);
  const saved = state.saved.includes(title.id);
  return <article className="title-card" ref={card}><div className="poster-wrap"><Link href={titlePath(title)} className="poster-link" onClick={() => reason && track('click', title.id, { ...feedContext, row, rowType, anchorId, position, sources:title.provenance })} aria-label={`View ${title.name}`}><PosterArt title={title}/><span className="card-type">{title.kind === 'series' ? 'SERIES' : 'FILM'}</span></Link><button className={`save-button ${saved ? 'saved' : ''}`} aria-label={`${saved ? 'Remove' : 'Save'} ${title.name}${saved ? ' from' : ' to'} watchlist`} aria-pressed={saved} onClick={() => { update(s => ({ ...s, saved: toggleItem(s.saved, title.id) })); notify(saved ? 'Removed from your private list' : 'Saved to your private list'); }}>{saved ? <Check size={18}/> : <Plus size={19}/>}</button></div>
    <div className="card-title-row"><Link href={titlePath(title)} onClick={() => reason && track('click', title.id, { ...feedContext, row, rowType, anchorId, position, sources:title.provenance })}><h3>{title.name}</h3></Link><span className="card-score" title="TMDB audience rating"><Star size={12} fill="currentColor"/>{title.rating.toFixed(1)}</span></div>
    <div className="card-meta">{title.year}<span>·</span>{title.language}<span>·</span>{title.kind === 'series' ? title.seasons ? `${title.seasons} seasons` : 'Series' : title.runtime ? `${title.runtime}m` : 'Film'}</div>
    <div className="card-services">{title.offers.filter(o => o.type === 'subscription').slice(0, 3).map(o => <ServiceLogo key={o.provider} id={o.provider}/>)}<span>{title.offers.some(o => o.type === 'subscription') ? 'Subscription · IN' : title.offers.some(o => o.type === 'rent' || o.type === 'buy') ? 'Rent / buy · IN' : title.offers.some(o => o.type === 'addon') ? 'Add-on · IN' : title.offers.some(o=>o.type==='free') ? 'Free · IN' : title.offers.some(o=>o.type==='ads') ? 'With ads · IN' : 'Availability unknown'}</span></div>
    {reason && <><p className="card-reason"><Sparkles size={12}/>{reason}</p><div className="card-feedback"><button aria-label={`Like ${title.name}`} aria-pressed={state.liked.includes(title.id)} onClick={() => update(s => ({ ...s, liked: toggleItem(s.liked,title.id), disliked: s.disliked.filter(id=>id!==title.id) }))}><ThumbsUp size={14}/></button><button aria-label={`Dislike ${title.name}`} aria-pressed={state.disliked.includes(title.id)} onClick={() => update(s => ({ ...s, disliked: toggleItem(s.disliked,title.id), liked: s.liked.filter(id=>id!==title.id), favorites:s.favorites.filter(id=>id!==title.id) }))}><ThumbsDown size={14}/></button><button aria-label={`Not interested in ${title.name}`} onClick={() => { update(s => ({ ...s, dismissed: toggleItem(s.dismissed,title.id) })); notify('Removed from your recommendations. Restore it in Privacy settings.'); }}><EyeOff size={14}/></button></div></>}
  </article>;
}

