import 'server-only';
import { getCatalogSource } from './catalog';
import { signalIds, type LocalState } from '@/modules/library/state';
import { candidatePlan } from '@/modules/recommendations/candidates';
import { buildTasteProfile } from '@/modules/recommendations/taste';
import { getRecommendations, type Filters } from '@/modules/recommendations/rank';
import { composeRowPlan } from '@/modules/recommendations/rows';
export async function loadRecommendationCandidates(state:LocalState,filters:Filters,surface:'home'|'for-you'|'discover'|'related'|'swipe',sessionId:string,page=1,anchorId?:string){
 const started=Date.now();
 const timing=(stage:string)=>{if(process.env.NODE_ENV==='development'&&Date.now()-started>5000)console.info(`[recommendations] ${stage}: ${Date.now()-started}ms`);};
 const source=getCatalogSource();
 const ids=[...new Set([...(anchorId?[anchorId]:[]),...signalIds(state)])].slice(0,80);
 const evidenceResults=await Promise.allSettled(ids.map(id=>source.get(id)));
 timing('evidence');
 const evidence=evidenceResults.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
 const generators=filters.query||filters.sort!=='picks'?undefined:candidatePlan(state,evidence,filters,sessionId);
 if(generators&&anchorId){const anchor=evidence.find(t=>t.id===anchorId);if(anchor?.externalId&&anchor.mediaType){generators.unshift({id:`anchor-similar:${anchorId}`,kind:'similar',mediaType:anchor.mediaType,seedId:anchor.externalId},{id:`anchor-recommendations:${anchorId}`,kind:'recommendations',mediaType:anchor.mediaType,seedId:anchor.externalId});if(generators.length>18)generators.splice(16,generators.length-18);}}
 const catalog=await source.search({generators,query:filters.query,kind:filters.kind,page,languages:filters.language?[filters.language]:[],providers:filters.provider?[filters.provider]:filters.onlyServices&&!filters.query?state.services:[],genre:filters.genre,sort:filters.sort,maxRuntime:filters.maxRuntime,minRuntime:filters.minRuntime,minRating:filters.minRating,year:filters.year,mood:filters.mood});
 timing('catalog');
 return {...catalog,evidence,generators};
}
export async function recommend(state:LocalState,filters:Filters,surface:'home'|'for-you'|'discover'|'related'|'swipe',sessionId:string,page=1,anchorId?:string){
 const catalog=await loadRecommendationCandidates(state,filters,surface,sessionId,page,anchorId);
 const {evidence,generators}=catalog;
 const allEvidence=[...new Map([...catalog.titles,...evidence].map(t=>[t.id,t])).values()];
 const anchor=evidence.find(t=>t.id===anchorId);
 const ranked=getRecommendations({titles:catalog.titles,state,filters,evidence:allEvidence,surface,sessionId,anchor});
 const rowPlan=surface==='home'||surface==='for-you'||surface==='discover'?composeRowPlan(catalog.titles,state,allEvidence,surface,sessionId,filters):{rows:[],diagnostics:[]};
 return {...catalog,evidence,ranked,rows:rowPlan.rows,rowDiagnostics:rowPlan.diagnostics,profile:buildTasteProfile(state,allEvidence,sessionId),generators};
}
