import 'server-only';
import { randomUUID } from 'node:crypto';
import type { CatalogPage, Title } from '@/modules/catalog/types';
import type { LocalState } from '@/modules/library/state';
import type { Filters } from '@/modules/recommendations/rank';
import { composeRowPlan, type RecommendationRow, type RowDiagnostic } from '@/modules/recommendations/rows';
import { discoveryContext, FEED } from '@/modules/recommendations/feed-context';
import { HttpError } from './http';
import { loadRecommendationCandidates } from './recommendations';
export type FeedCursor={id:string;batch:number};
export type FeedRow=Omit<RecommendationRow,'diagnostics'> & {batch:number;rowPosition:number};
export type FeedBatch={rows:FeedRow[];cursor:FeedCursor|null;batch:number;hasMore:boolean;endReason?:string;warnings:string[];diagnostics:RowDiagnostic[];candidateCount:number;retrievalPage:number};
type Load=(state:LocalState,filters:Filters,surface:'discover',sessionId:string,page:number)=>Promise<CatalogPage&{evidence:Title[]}>;
type Entry={id:string;owner:string;sessionId:string;requestId:string;context:string;expires:number;pool:Title[];evidence:Title[];rows:RecommendationRow[];page:number;upstreamMore:boolean;empty:number;results:Map<number,FeedBatch>;pending?:{batch:number;promise:Promise<FeedBatch>}};
export function createDiscoveryFeedStore(load:Load=loadRecommendationCandidates){
 const entries=new Map<string,Entry>();
 async function next(input:{owner:string;sessionId:string;requestId:string;state:LocalState;filters:Filters;cursor?:FeedCursor}){
  const {owner,sessionId,requestId,state,filters,cursor}=input;
  if(filters.query||filters.sort!=='picks')throw new HttpError(400,'Progressive rows require Our picks without a search query.');
  for(const [id,entry] of entries)if(entry.expires<Date.now()&&!entry.pending)entries.delete(id);
  const context=discoveryContext(filters,state);
  let entry=cursor?entries.get(cursor.id):[...entries.values()].find(e=>e.owner===owner&&e.sessionId===sessionId&&e.requestId===requestId&&e.context===context);
  if(cursor&&(!entry||entry.owner!==owner||entry.sessionId!==sessionId))throw new HttpError(410,'This discovery session expired. Start a new set of picks.');
  if(entry&&entry.context!==context)throw new HttpError(409,'Your discovery context changed. Start a new set of picks.');
  if(!entry){
   if(entries.size>=FEED.maxFeeds){const removable=[...entries.values()].find(e=>!e.pending);if(!removable)throw new HttpError(503,'Discovery is busy. Please retry shortly.');entries.delete(removable.id);}
   entry={id:randomUUID(),owner,sessionId,requestId,context,expires:Date.now()+FEED.ttlMs,pool:[],evidence:[],rows:[],page:0,upstreamMore:true,empty:0,results:new Map()};entries.set(entry.id,entry);
  }
  const batch=cursor?.batch??0;
  const cached=entry.results.get(batch);if(cached)return cached;
  if(entry.pending){if(entry.pending.batch!==batch)throw new HttpError(409,'Wait for the current discovery batch.');return entry.pending.promise;}
  if(batch!==entry.results.size||(batch>0&&!entry.results.get(batch-1)?.hasMore))throw new HttpError(400,'Invalid discovery continuation.');
  const current=entry;
  const job=(async()=>{
   // One bounded candidate page per demand. Commit the cursor only after success.
   const data=current.page>0&&!current.upstreamMore
    ?{titles:[] as Title[],evidence:current.evidence,page:current.page,hasMore:false,warnings:[] as string[]}
    :await load(state,filters,'discover',sessionId,current.page+1);
   const pool=[...new Map([...current.pool,...data.titles].map(t=>[t.id,t])).values()].slice(0,FEED.maxCandidates);
   const evidence=[...new Map([...pool,...current.evidence,...data.evidence].map(t=>[t.id,t])).values()];
   const plan=composeRowPlan(pool,state,evidence,'discover',sessionId,filters,{previous:current.rows,batch,limit:Math.min(batch===0?FEED.initialRows:FEED.nextRows,FEED.maxRows-current.rows.length)});
   const page=data.page,empty=plan.rows.length?0:current.empty+1;
   const count=current.rows.length+plan.rows.length;
   const capped=batch+1>=FEED.maxBatches||count>=FEED.maxRows||page>=FEED.maxPages||pool.length>=FEED.maxCandidates;
   const exhausted=empty>=FEED.maxEmptyBatches||(!data.hasMore&&plan.rows.length===0);
   const hasMore=!capped&&!exhausted;
   const result:FeedBatch={rows:plan.rows.map(({diagnostics,...row},i)=>({...row,batch,rowPosition:current.rows.length+i})),cursor:hasMore?{id:current.id,batch:batch+1}:null,batch,hasMore,endReason:capped?'You’ve reached the end of this set of picks.':exhausted?'You’ve explored the strongest distinct matches for this combination.':undefined,warnings:data.warnings??[],diagnostics:plan.diagnostics,candidateCount:pool.length,retrievalPage:page};
   current.pool=pool;current.evidence=data.evidence;current.page=page;current.upstreamMore=data.hasMore;current.empty=empty;current.rows.push(...plan.rows);current.results.set(batch,result);current.expires=Date.now()+FEED.ttlMs;
   return result;
  })();
  current.pending={batch,promise:job};
  try{return await job;}finally{current.pending=undefined;}
 }
 return {next};
}
export const discoveryFeeds=createDiscoveryFeedStore();
