import type { Title } from '../catalog/types';
import type { LocalState } from '../library/state';
import { CONFIG, MODEL_VERSION } from './config';
export type Dimension=keyof typeof CONFIG.features;
export type FeatureEvidence={positive:number;negative:number;count:number;positiveCount:number;negativeCount:number};
export type Vector=Record<Dimension,Record<string,FeatureEvidence>>;
export type TasteProfile={version:string;longTerm:Vector;recent:Vector;session:Vector;confidence:number;evidenceCount:number;positive:{title:Title;strength:number;kind:string;at:string}[];negative:Title[];generatedAt:string};
export function titleFeatures(t:Title):Record<Dimension,string[]>{
 return {genre:t.genres,language:[t.language],theme:(t.keywords??[]).slice(0,12),creator:t.creators??[],actor:(t.credits??[]).filter(c=>c.role!=='Director').slice(0,8).map(c=>c.name),kind:[t.kind],era:t.year?[`${Math.floor(t.year/10)*10}s`]:[],runtime:t.runtime?[t.runtime<=100?'short':t.runtime<=140?'medium':'long']:[],popularity:[t.popularity>=40?'mainstream':t.popularity>=10?'midrange':'niche'],combination:t.genres.slice(0,3).map(g=>`${t.language}:${g}`)};
}
export function signalStrength(state:LocalState,id:string):{strength:number;kind:string;at:string}{
 let strength=0,kind='';
 if(state.disliked.includes(id)){strength=CONFIG.signals.dislike;kind='disliked';}
 else if((state.ratings[id]??10)<=4){strength=CONFIG.rating[state.ratings[id]];kind='ratings';}
 else if(state.favorites.includes(id)){strength=CONFIG.signals.favorite;kind='favorites';}
 else if(id in state.ratings){strength=CONFIG.rating[state.ratings[id]]??0;kind='ratings';}
 else if(state.liked.includes(id)){strength=CONFIG.signals.like;kind='liked';}
 else if(state.saved.includes(id)){strength=CONFIG.signals.watchlist;kind='saved';}
 return {strength,kind,at:state.signalTimes[`${kind}:${id}`]??'2000-01-01T00:00:00.000Z'};
}
const blank=():Vector=>Object.fromEntries(Object.keys(CONFIG.features).map(k=>[k,{}])) as Vector;
function add(vector:Vector,title:Title,value:number){
 const features=titleFeatures(title);
 for(const dimension of Object.keys(features) as Dimension[])for(const key of new Set(features[dimension])){
  const existing=vector[dimension][key]??{positive:0,negative:0,count:0,positiveCount:0,negativeCount:0};
  // A single title contributes at most one vote to a feature; evidence count is distinct-title based.
  vector[dimension][key]={positive:existing.positive+Math.max(0,value),negative:existing.negative+Math.max(0,-value),count:existing.count+1,positiveCount:existing.positiveCount+Number(value>0),negativeCount:existing.negativeCount+Number(value<0)};
 }
}
export function buildTasteProfile(state:LocalState,metadata:Title[],sessionId='',now=Math.floor(Date.now()/3600000)*3600000):TasteProfile{
 const longTerm=blank(),recent=blank(),session=blank();const positive:TasteProfile['positive']=[],negative:Title[]=[];
 let count=0;const titles=[...new Map(metadata.map(t=>[t.id,t])).values()];
 for(const title of titles){
  const signal=signalStrength(state,title.id);if(!signal.strength)continue;
  count++;const days=Math.max(0,(now-Date.parse(signal.at))/86400000);
  const longWeight=CONFIG.taste.longFloor+(1-CONFIG.taste.longFloor)*Math.pow(.5,days/CONFIG.taste.longHalfLifeDays);
  add(longTerm,title,signal.strength*longWeight);add(recent,title,signal.strength*Math.pow(.5,days/CONFIG.taste.recentHalfLifeDays));
  if(state.events.some(e=>e.titleId===title.id&&e.sessionId===sessionId&&['like','dislike','rating','favorite','watchlist_add'].includes(e.type)))add(session,title,signal.strength);
  if(signal.strength>0&&!state.dismissed.includes(title.id))positive.push({title,...signal});
  if(signal.strength<0)negative.push(title);
 }
 // Weak events never become dislikes, and repeating a click cannot overpower explicit feedback.
 for(const title of titles){
  if(state.dismissed.includes(title.id)||signalStrength(state,title.id).strength<0)continue;
  let contextual=0,recentValue=0;const seen=new Set<string>();
  for(const e of state.events.filter(e=>e.titleId===title.id)){
   const weight=CONFIG.signals[e.type as keyof typeof CONFIG.signals];if(!['click','title_open','trailer','provider_click'].includes(e.type)||!weight)continue;
   const key=`${e.type}:${e.at.slice(0,10)}`;if(seen.has(key))continue;seen.add(key);
   const days=Math.max(0,(now-Date.parse(e.at))/86400000);recentValue+=weight*Math.pow(.5,days/CONFIG.taste.recentHalfLifeDays);
   if(e.sessionId===sessionId)contextual+=weight;
  }
  if(recentValue)add(recent,title,Math.min(CONFIG.taste.weakPerTitleCap,recentValue));
  if(contextual)add(session,title,Math.min(CONFIG.taste.weakPerTitleCap,contextual));
 }
 return {version:MODEL_VERSION,longTerm,recent,session,confidence:count/(count+4),evidenceCount:count,positive:positive.sort((a,b)=>b.strength-a.strength||b.at.localeCompare(a.at)),negative,generatedAt:new Date(now).toISOString()};
}
export function vectorAffinity(title:Title,vector:Vector){
 const parts:Record<string,number>={};const features=titleFeatures(title);let positive=0,negative=0;
 for(const dim of Object.keys(features) as Dimension[]){
  const values=features[dim].flatMap(key=>{const e=vector[dim][key];if(!e)return[];if((dim==='creator'&&e.count<CONFIG.taste.peopleMinimum)||(dim==='actor'&&e.count<CONFIG.taste.actorMinimum))return[];return[e];});
  const pos=values.reduce((n,e)=>n+e.positive/(CONFIG.taste.prior+e.positive+e.negative),0)/Math.max(features[dim].length,1);
  const neg=values.reduce((n,e)=>n+e.negative/(CONFIG.taste.prior+e.positive+e.negative),0)/Math.max(features[dim].length,1);
  parts[dim]=pos-neg;positive+=CONFIG.features[dim]*pos;negative+=CONFIG.features[dim]*neg;
 }
 return {positive,negative,parts};
}
