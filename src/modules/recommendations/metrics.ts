import type { Title } from '../catalog/types';
import type { InteractionEvent } from '../library/events';
import { similarity } from './rank';
export function evaluateRecommendations(ranked:Title[],candidates:Title[],services:string[]=[],relevance?:Record<string,number>,k=10){
 const top=ranked.slice(0,k),unique=new Set(top.map(t=>t.id));const labels=relevance?Object.values(relevance).filter(v=>v>0).length:0;
 const precision=relevance?top.filter(t=>(relevance[t.id]??0)>0).length/Math.max(top.length,1):null;
 const recall=relevance&&labels?top.filter(t=>(relevance[t.id]??0)>0).length/labels:null;
 const dcg=(grades:number[])=>grades.reduce((n,g,i)=>n+(2**g-1)/Math.log2(i+2),0);
 const ideal=relevance?dcg(Object.values(relevance).sort((a,b)=>b-a).slice(0,k)):0;
 let distance=0,pairs=0;for(let a=0;a<top.length;a++)for(let b=a+1;b<top.length;b++){distance+=1-similarity(top[a],top[b]);pairs++;}
 const distribution=(values:string[])=>Object.fromEntries([...new Set(values)].map(key=>[key,values.filter(v=>v===key).length/Math.max(top.length,1)]));
 return {k,precisionAtK:precision,recallAtK:recall,ndcgAtK:relevance&&ideal?dcg(top.map(t=>relevance[t.id]??0))/ideal:null,candidateCoverage:unique.size/Math.max(new Set(candidates.map(t=>t.id)).size,1),intraListDiversity:pairs?distance/pairs:0,noveltyProxy:top.reduce((n,t)=>n+1/Math.log2(Math.max(0,t.popularity)+2),0)/Math.max(top.length,1),serendipity:null,duplicateRate:top.length?1-unique.size/top.length:0,providerAvailabilityRate:top.filter(t=>t.offers.some(o=>o.region==='IN'&&o.type==='subscription'&&(!services.length||services.includes(o.provider)))).length/Math.max(top.length,1),languageDistribution:distribution(top.map(t=>t.language)),genreDistribution:distribution(top.flatMap(t=>t.genres))};
}
export function exposureMetrics(events:InteractionEvent[]){
 const key=(e:InteractionEvent)=>`${e.sessionId}:${e.surface}:${e.row}:${e.titleId}`;
 const impressions=new Set(events.filter(e=>e.type==='impression').map(key));
 const clicks=new Set(events.filter(e=>e.type==='click'&&impressions.has(key(e))).map(key));
 return {observedImpressions:impressions.size,attributedClicks:clicks.size,ctr:impressions.size?clicks.size/impressions.size:null,providerClicks:events.filter(e=>e.type==='provider_click').length,negativeFeedback:events.filter(e=>e.type==='dislike'||e.type==='not_interested').length};
}
