import { languageName, type CandidateSpec, type Title } from '../catalog/types';
import type { LocalState } from '../library/state';
import { moodDefinitions } from '../discovery/moods';
import { CONFIG } from './config';
import { buildTasteProfile } from './taste';
import type { Filters } from './rank';
export function candidatePlan(state:LocalState,metadata:Title[],filters:Filters,sessionId=''):CandidateSpec[]{
 const profile=buildTasteProfile(state,metadata,sessionId);const plan:CandidateSpec[]=[];
 const types=filters.kind==='movie'?['movie'] as const:filters.kind==='series'?['tv'] as const:['movie','tv'] as const;
 const learnedLanguages=Object.entries(profile.recent.language).filter(([,v])=>v.count>=2&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive).map(([name])=>name);
 const languages=filters.language?[filters.language]:[...new Set([...state.languages.map(languageName),...learnedLanguages,...['Telugu','Hindi','Tamil','Malayalam','English']])].slice(0,3);
 const providers=filters.provider?[filters.provider]:filters.onlyServices?state.services:[];
 const moodGenre=moodDefinitions.find(m=>m.id===filters.mood)?.genres[0];
 for(const language of languages)for(const mediaType of types)plan.push({id:`language:${language}:${mediaType}`,kind:'discover',mediaType,language,providers,genre:filters.genre||moodGenre});
 for(const seed of profile.positive.slice(0,CONFIG.retrieval.maxSeeds))if(seed.title.externalId&&seed.title.mediaType)for(const kind of ['recommendations','similar'] as const)plan.push({id:`${kind}:${seed.title.id}`,kind,mediaType:seed.title.mediaType,seedId:seed.title.externalId});
 const preferredGenre=filters.genre||state.genres[0]||Object.entries(profile.recent.genre).filter(([,v])=>v.count>=2&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive)[0]?.[0];
 for(const mediaType of types){
  plan.push({id:`quality:${mediaType}`,kind:'discover',mediaType,providers,genre:preferredGenre,sort:'quality'});
  plan.push({id:`recent:${mediaType}`,kind:'discover',mediaType,providers,sort:'recent',yearFrom:new Date().getFullYear()-2});
 }
 const creator=Object.entries(profile.longTerm.creator).filter(([,v])=>v.positiveCount>=2&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive)[0]?.[0];
 const person=metadata.flatMap(t=>t.credits??[]).find(c=>c.name===creator&&c.role==='Director');
 if(person)plan.unshift({id:`creator:${person.id}`,kind:'discover',mediaType:'movie',personId:person.id,providers});
 const theme=Object.entries(profile.longTerm.theme).filter(([,v])=>v.count>=2&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive)[0]?.[0];
 const keyword=metadata.flatMap(t=>t.keywordRefs??[]).find(k=>k.name===theme);
 if(keyword)plan.unshift({id:`theme:${keyword.id}`,kind:'discover',mediaType:'movie',keywordId:keyword.id,providers});
 const actor=Object.entries(profile.longTerm.actor).filter(([,v])=>v.positiveCount>=CONFIG.taste.actorMinimum&&v.positive>v.negative).sort((a,b)=>b[1].positive-a[1].positive)[0]?.[0];
 const actorCredit=metadata.flatMap(t=>t.credits??[]).find(c=>c.name===actor&&c.role!=='Director');
 if(actorCredit)plan.unshift({id:`actor:${actorCredit.id}`,kind:'discover',mediaType:'movie',personId:actorCredit.id,providers});
 // TMDB trending is global; India subscription constraints are verified after hydration.
 if(profile.evidenceCount===0)for(const mediaType of types)plan.unshift({id:`trending:${mediaType}`,kind:'trending',mediaType});
 // Reserve exploration capacity rather than allowing seed pools to exhaust the request budget.
 // Explicit constraints shape every discovery pool, then the shared ranker verifies hydrated metadata.
 for(const spec of plan)if(spec.kind==='discover'){if(filters.language)spec.language=languageName(filters.language);if(filters.genre)spec.genre=filters.genre;}
 return [...plan.slice(0,CONFIG.retrieval.maxJobs-2),...types.slice(0,2).map(mediaType=>({id:`exploration:${mediaType}`,kind:'discover' as const,mediaType,providers,language:filters.language||undefined,genre:filters.genre||moodGenre,sort:'quality' as const}))];
}
