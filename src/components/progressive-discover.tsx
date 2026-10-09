'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState,useMemo} from 'react';
import {defaultFilters,exclusionReason,type Filters} from '@/modules/recommendations/rank';
import {discoveryContext} from '@/modules/recommendations/feed-context';
import type {FeedBatch,FeedRow,FeedCursor} from '@/server/discovery-feed';
import {TitleCard} from './title-card';
import {useLocal} from './local-provider';

type Snapshot={key:string;requestId:string;rows:FeedRow[];cursor?:FeedCursor;received:boolean;hasMore:boolean;endReason?:string;warnings:string[];debug:unknown[];batches:number};
type ResponseBatch=Omit<FeedBatch,'diagnostics'>&{debug?:unknown};
export function ProgressiveDiscover({filters,debug=false,onClear}:{filters:Filters;debug?:boolean;onClear:()=>void}){
 const {state,user,sessionId,identityKey,ready,retrySync,viewState}=useLocal();
 const key=identityKey+discoveryContext(filters,state);
 const [feed,setFeed]=useState<Snapshot|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[expired,setExpired]=useState(false);
 const current=useRef<Snapshot|null>(null),flight=useRef<AbortController|null>(null),epoch=useRef(0),sentinel=useRef<HTMLDivElement>(null);
 const latest=useRef({state,user,sessionId,filters,key,retrySync});latest.current={state,user,sessionId,filters,key,retrySync};
 const publish=useCallback((next:Snapshot)=>{current.current=next;viewState.set('discover-feed',next);setFeed(next);},[viewState]);
 const load=useCallback(async()=>{
  const snapshot=current.current;if(!snapshot||!snapshot.hasMore||flight.current)return;
  const generation=epoch.current,controller=new AbortController();flight.current=controller;
  setLoading(true);setError('');setExpired(false);
  let timedOut=false;const deadline=setTimeout(()=>{timedOut=true;controller.abort();},60000);
  try{
   await latest.current.retrySync();if(controller.signal.aborted)throw new Error('Timed out');
   const {state,user,sessionId,filters}=latest.current;
   const response=await fetch('/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({surface:'discover',sessionId,filters,feed:{requestId:snapshot.requestId,...(snapshot.cursor?{cursor:snapshot.cursor}:{})},...(user?{}:{state}),debug})});
   const data=await response.json();
   if(generation!==epoch.current||latest.current.key!==snapshot.key)return;
   if(response.ok&&data.owner!==(user?.id??null))throw new Error('Your account changed. Reload before continuing.');
   if(!response.ok){if(response.status===410||response.status===409)setExpired(true);throw new Error(data.error??'More picks could not be loaded.');}
   if(generation!==epoch.current||latest.current.key!==snapshot.key)return;
   const batch=data as ResponseBatch;
   // Snapshot rows are append-only. Feedback changes only future server batches.
   publish({...snapshot,rows:[...snapshot.rows,...batch.rows],cursor:batch.cursor??undefined,hasMore:batch.hasMore,received:true,endReason:batch.endReason,warnings:batch.warnings,debug:batch.debug?[...snapshot.debug,{batch:batch.batch,candidates:batch.candidateCount,retrievalPage:batch.retrievalPage,...batch.debug as object}]:snapshot.debug,batches:snapshot.batches+1});
  }catch(e){if(generation===epoch.current&&(!controller.signal.aborted||timedOut))setError(timedOut?'Finding more took too long. Your loaded picks are still here.':e instanceof Error?e.message:'More picks could not be loaded.');}
  finally{clearTimeout(deadline);if(generation===epoch.current){flight.current=null;setLoading(false);}}
 },[debug,publish]);
 const reset=useCallback(()=>{epoch.current++;flight.current?.abort();flight.current=null;publish({key:latest.current.key,requestId:crypto.randomUUID(),rows:[],received:false,hasMore:true,warnings:[],debug:[],batches:0});void load();},[load,publish]);
 useEffect(()=>{
  if(!ready)return;
  const saved=viewState.get('discover-feed') as Snapshot|undefined;
  if(saved?.key===key){publish(saved);if(!saved.received)void load();}else reset();
  return()=>{epoch.current++;flight.current?.abort();flight.current=null;};
 },[key,ready,viewState,load,publish,reset]);
 const visible=feed?.key===key?feed:null;
 useEffect(()=>{
  if(!sentinel.current||!visible?.received||!visible.hasMore||loading||error)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void load();},{rootMargin:'600px 0px'});
  observer.observe(sentinel.current);return()=>observer.disconnect();
 },[visible?.batches,visible?.hasMore,visible?.received,loading,error,load]);
 return <div className="progressive-discover" aria-label="Personalized discovery feed">
  <div className="results-line"><span>{visible?.rows.length??0} personalized rows · TMDB ratings · India watch options</span>{Object.entries(defaultFilters).some(([k,v])=>filters[k as keyof Filters]!==v)&&<button className="text-button" onClick={onClear}>Clear filters</button>}</div>
  {!visible?.received&&!error&&<div className="skeleton-grid" role="status" aria-label="Finding your first picks">{[1,2,3,4,5,6].map(n=><div key={n} className="skeleton"/>)}</div>}
  <div className="personalized-rows">{visible?.rows.map(row=><ProgressiveRow key={row.id} row={row} feedId={visible.requestId} context={discoveryContext(filters,state)} filters={filters}/>)}</div>
  <div className="feed-sentinel" ref={sentinel} aria-label="More discovery rows">
   {loading&&visible?.received&&<div role="status" className="feed-loading"><span className="feed-pulse"/>Finding more for you…</div>}
   {error?<div role="status"><p>{error}</p><button className="button secondary" onClick={()=>expired?reset():void load()}>{expired?'Start a new set of picks':'Retry more picks'}</button></div>:!loading&&visible?.hasMore?<button className="button secondary" onClick={()=>void load()}>Discover more rows</button>:null}
   {visible?.received&&!visible.rows.length&&!loading&&!error&&<p>No strong matches for this combination yet.</p>}
   {visible?.received&&!visible.hasMore&&!error&&<div className="feed-end"><p>{visible.endReason}</p><div><button className="text-button" onClick={onClear}>Change filters</button><Link className="text-button" href="/taste">Explore your taste</Link></div></div>}
  </div>
  {visible?.warnings.map(w=><p role="status" className="small-note" key={w}>{w}</p>)}
  {debug&&process.env.NODE_ENV==='development'&&<section className="panel recommendation-debug"><h2>Progressive row diagnostics</h2><pre>{JSON.stringify(visible?.debug,null,2)}</pre></section>}
 </div>;
}
function ProgressiveRow({row,feedId,context,filters}:{row:FeedRow;feedId:string;context:string;filters:Filters}){
 const {state}=useLocal();
 const eventContext=useMemo(()=>({feedId,context,batch:row.batch,rowPosition:row.rowPosition,surface:'discover'}),[feedId,context,row.batch,row.rowPosition]);
 return <section className="recommendation-row" aria-label={row.name} data-row-id={row.id} data-batch={row.batch}><div className="section-heading"><div><h2>{row.name}</h2><p>{row.reason}</p></div></div><div className="row-posters">{row.items.filter(r=>!exclusionReason(r.title,state,filters,'discover')).map((r,position)=><TitleCard key={r.title.id} title={r.title} reason={r.reason} row={row.id} rowType={row.theme} anchorId={row.anchorId} position={position} feedContext={eventContext}/>)}</div></section>;
}
