'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState,useMemo} from 'react';
import {defaultFilters,exclusionReason,type Filters} from '@/modules/recommendations/rank';
import {composeRowPlan,type RecommendationRow} from '@/modules/recommendations/rows';
import type {CatalogPage,Title} from '@/modules/catalog/types';
import {discoveryContext,FEED} from '@/modules/recommendations/feed-context';
type HomeRow=RecommendationRow & {batch:number;rowPosition:number};
export type HomePage=CatalogPage & {evidence?:Title[];owner:string|null};
import {PosterRail} from './poster-rail';
import {TitleCard} from './title-card';
import {useLocal} from './local-provider';

type Snapshot={key:string;requestId:string;rows:HomeRow[];pool:Title[];evidence:Title[];upstreamMore:boolean;page:number;empty:number;spotlight:HomePage|null;received:boolean;hasMore:boolean;endReason?:string;warnings:string[];batches:number};
export function ProgressiveHome({filters,onClear,onSpotlight}:{filters:Filters;onClear:()=>void;onSpotlight:(page:HomePage|null)=>void}){
 const {state,user,sessionId,identityKey,ready,retrySync,viewState}=useLocal();
 const key=identityKey+discoveryContext(filters,state);
 const [feed,setFeed]=useState<Snapshot|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const current=useRef<Snapshot|null>(null),flight=useRef<AbortController|null>(null),epoch=useRef(0),sentinel=useRef<HTMLDivElement>(null);
 const latest=useRef({state,user,sessionId,filters,key,retrySync,onSpotlight});latest.current={state,user,sessionId,filters,key,retrySync,onSpotlight};
 const publish=useCallback((next:Snapshot)=>{current.current=next;viewState.set('home-feed',next);setFeed(next);},[viewState]);
 const load=useCallback(async()=>{
  const snapshot=current.current;if(!snapshot||!snapshot.hasMore||flight.current)return;
  const generation=epoch.current,controller=new AbortController();flight.current=controller;
  setLoading(true);setError('');
  let timedOut=false;const deadline=setTimeout(()=>{timedOut=true;controller.abort();},60000);
  try{
   await latest.current.retrySync();if(controller.signal.aborted)throw new Error('Timed out');
   const {state,user,sessionId,filters}=latest.current;
   let result:HomePage;
   if(snapshot.upstreamMore){
    const response=await fetch('/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({surface:'home',sessionId,filters,page:snapshot.page+1,...(user?{}:{state})})});
    const data=await response.json();
    if(generation!==epoch.current||latest.current.key!==snapshot.key)return;
    if(response.ok&&data.owner!==(user?.id??null))throw new Error('Your account changed. Reload before continuing.');
    if(!response.ok)throw new Error(data.error??'More picks could not be loaded.');
    result=data as HomePage;
   }else result={titles:[],evidence:snapshot.evidence,page:snapshot.page,hasMore:false,owner:user?.id??null};
   if(generation!==epoch.current||latest.current.key!==snapshot.key)return;
   const pool=[...new Map([...snapshot.pool,...result.titles].map(t=>[t.id,t])).values()].slice(0,FEED.maxCandidates);
   // Reuse the existing row composer with Home semantics; never alter visible rows.
   const plan=composeRowPlan(pool,state,[...pool,...(result.evidence??[])],'home',sessionId,filters,{previous:snapshot.rows,batch:snapshot.batches,limit:Math.min(snapshot.received?FEED.nextRows:FEED.initialRows,FEED.maxRows-snapshot.rows.length)});
   const rows=[...snapshot.rows,...plan.rows.map((row,i)=>({...row,batch:snapshot.batches,rowPosition:snapshot.rows.length+i}))];
   const empty=plan.rows.length?0:snapshot.empty+1;
   const capped=rows.length>=FEED.maxRows||result.page>=FEED.maxPages||snapshot.batches+1>=FEED.maxBatches||pool.length>=FEED.maxCandidates;
   const hasMore=!capped&&empty<FEED.maxEmptyBatches&&(result.hasMore||plan.rows.length>0);
   const spotlight=snapshot.spotlight??result;
   publish({...snapshot,pool,evidence:result.evidence??[],upstreamMore:result.hasMore,page:result.page,rows,empty,spotlight,hasMore,received:true,endReason:capped?'You’ve reached the end of this set of picks.':'You’ve explored the strongest matches for this combination.',warnings:result.warnings??[],batches:snapshot.batches+1});
   if(!snapshot.received)latest.current.onSpotlight(spotlight);
  }catch(e){if(generation===epoch.current&&(!controller.signal.aborted||timedOut))setError(timedOut?'Finding more took too long. Your loaded picks are still here.':e instanceof Error?e.message:'More picks could not be loaded.');}
  finally{clearTimeout(deadline);if(generation===epoch.current){flight.current=null;setLoading(false);}}
 },[publish]);
 const reset=useCallback(()=>{epoch.current++;flight.current?.abort();flight.current=null;latest.current.onSpotlight(null);publish({key:latest.current.key,requestId:crypto.randomUUID(),rows:[],pool:[],evidence:[],upstreamMore:true,page:0,empty:0,spotlight:null,received:false,hasMore:true,warnings:[],batches:0});void load();},[load,publish]);
 useEffect(()=>{
  if(!ready)return;
  const saved=viewState.get('home-feed') as Snapshot|undefined;
  if(saved?.key===key){publish(saved);latest.current.onSpotlight(saved.spotlight);if(!saved.received)void load();}else reset();
  return()=>{epoch.current++;flight.current?.abort();flight.current=null;};
 },[key,ready,viewState,load,publish,reset]);
 const visible=feed?.key===key?feed:null;
 useEffect(()=>{
  if(!sentinel.current||!visible?.received||!visible.hasMore||loading||error)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void load();},{rootMargin:'600px 0px'});
  observer.observe(sentinel.current);return()=>observer.disconnect();
 },[visible?.batches,visible?.hasMore,visible?.received,loading,error,load]);
 return <div className="progressive-discover" aria-label="Personalized home feed">
  <div className="results-line"><span>{visible?.rows.length??0} personalized rows · TMDB ratings · India watch options</span>{Object.entries(defaultFilters).some(([k,v])=>filters[k as keyof Filters]!==v)&&<button className="text-button" onClick={onClear}>Clear filters</button>}</div>
  {!visible?.received&&!error&&<div className="skeleton-grid" role="status" aria-label="Finding your first picks">{[1,2,3,4,5,6].map(n=><div key={n} className="skeleton"/>)}</div>}
  <div className="personalized-rows">{visible?.rows.map(row=><ProgressiveRow key={row.id} row={row} feedId={visible.requestId} context={discoveryContext(filters,state)} filters={filters}/>)}</div>
  <div className="feed-sentinel" ref={sentinel} aria-label="More home recommendations">
   {loading&&visible?.received&&<div role="status" className="feed-loading"><span className="feed-pulse"/>Finding more for you…</div>}
   {error?<div role="status"><p>{error}</p><button className="button secondary" onClick={()=>void load()}>Retry more picks</button></div>:null}
   {visible?.received&&!visible.rows.length&&!loading&&!error&&<p>No strong matches for this combination yet.</p>}
   {visible?.received&&!visible.hasMore&&!error&&<div className="feed-end"><p>{visible.endReason}</p><div><button className="text-button" onClick={onClear}>Change filters</button><Link className="text-button" href="/taste">Explore your taste</Link></div></div>}
  </div>
  {visible?.warnings.map(w=><p role="status" className="small-note" key={w}>{w}</p>)}
 </div>;
}
function ProgressiveRow({row,feedId,context,filters}:{row:HomeRow;feedId:string;context:string;filters:Filters}){
 const {state}=useLocal();
 const eventContext=useMemo(()=>({feedId,context,batch:row.batch,rowPosition:row.rowPosition,surface:'home'}),[feedId,context,row.batch,row.rowPosition]);
 return <section className="recommendation-row" aria-label={row.name} data-row-id={row.id} data-batch={row.batch}><div className="section-heading"><div><h2>{row.name}</h2><p>{row.reason}</p></div></div><PosterRail label={row.name}>{row.items.filter(r=>!exclusionReason(r.title,state,filters,'home')).map((r,position)=><TitleCard key={r.title.id} title={r.title} reason={r.reason} row={row.id} rowType={row.theme} anchorId={row.anchorId} position={position} feedContext={eventContext}/>)}</PosterRail></section>;
}
