import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Title } from '../src/modules/catalog/types';
import { defaultState, type LocalState } from '../src/modules/library/state';
import { recordChanges } from '../src/modules/library/events';
import { getRecommendations, defaultFilters } from '../src/modules/recommendations/rank';
import { buildTasteProfile } from '../src/modules/recommendations/taste';
import { composeRows } from '../src/modules/recommendations/rows';
import { candidatePlan } from '../src/modules/recommendations/candidates';
import { mergeAnonymous, rebaseState } from '../src/modules/auth/merge';
const now=Date.parse('2026-10-05T10:00:00Z');
const titles:Title[]=Array.from({length:48},(_,i)=>({id:`tmdb:movie:${i+1}`,externalId:i+1,mediaType:'movie',source:'tmdb',name:`Evaluation title ${i+1}`,tagline:'',synopsis:'',kind:'movie',year:2020+i%7,language:i%2?'Malayalam':'Telugu',genres:i%2?['Comedy','Drama']:['Action','Science Fiction'],keywords:i%2?['family','friendship']:['space','rescue'],creators:i%2?['Creator B']:['Creator A'],people:[],runtime:i%2?95:140,rating:7.5,votes:1000,popularity:20,moods:[],offers:[{provider:i%2?'8':'119',region:'IN',type:'subscription'}]}));
const change=(s:LocalState,patch:Partial<LocalState>)=>recordChanges(s,{...s,...patch},{surface:'test',sessionId:'session-A'});
const recs=(s:LocalState)=>getRecommendations({titles,state:s,evidence:titles,surface:'for-you',sessionId:'session-A',now});
const score=(s:LocalState,id:string)=>recs(s).find(r=>r.title.id===id)?.score??-1;

test('each explicit signal immediately changes scores or suppression; undo restores the current signal',()=>{
 const cold=structuredClone(defaultState);const like=change(cold,{liked:[titles[0].id]});const rating=change(cold,{ratings:{[titles[0].id]:10}});const saved=change(cold,{saved:[titles[0].id]});
 assert.ok(score(like,titles[2].id)>score(cold,titles[2].id));assert.ok(score(rating,titles[2].id)>score(saved,titles[2].id));assert.ok(score(saved,titles[2].id)>score(cold,titles[2].id));
 const dislike=change(cold,{disliked:[titles[0].id,titles[2].id]});assert.ok(score(dislike,titles[4].id)<score(cold,titles[4].id));
 const hide=change(cold,{dismissed:[titles[0].id]});assert.ok(!recs(hide).some(r=>r.title.id===titles[0].id));assert.equal(score(hide,titles[2].id),score(cold,titles[2].id));
 const unlike=change(like,{liked:[]});assert.equal(score(unlike,titles[2].id),score(cold,titles[2].id));
 console.log(JSON.stringify({proof:'signal sensitivity',title:titles[2].id,cold:score(cold,titles[2].id),watchlist:score(saved,titles[2].id),like:score(like,titles[2].id),fiveStars:score(rating,titles[2].id),dislike:score(dislike,titles[4].id)}));
});
test('repeated independent evidence builds confidence; recent shifts retain long-term preferences',()=>{
 let state=change(structuredClone(defaultState),{liked:[titles[0].id,titles[2].id,titles[4].id]});
 for(const id of state.liked)state.signalTimes[`liked:${id}`]='2025-10-05T10:00:00Z';
 state=change(state,{liked:[...state.liked,titles[1].id,titles[3].id]});for(const id of [titles[1].id,titles[3].id])state.signalTimes[`liked:${id}`]='2026-10-05T09:00:00Z';
 const profile=buildTasteProfile(state,titles,'session-A',now);
 assert.ok(profile.longTerm.genre.Action.positive>0);assert.ok(profile.recent.genre.Comedy.positive>profile.recent.genre.Action.positive);
 const one=buildTasteProfile(change(structuredClone(defaultState),{liked:[titles[0].id]}),titles,'session-A',now);assert.ok(profile.confidence>one.confidence);
});
test('neutral rating and watched do not teach enjoyment; impression non-clicks are never dislikes',()=>{
 const state=change(structuredClone(defaultState),{ratings:{[titles[0].id]:6},watched:[{titleId:titles[2].id,watchedAt:new Date(now).toISOString(),audience:'private'}]});
 assert.equal(buildTasteProfile(state,titles).evidenceCount,0);
 const impressions={...defaultState,events:[{id:'impression',type:'impression' as const,at:new Date(now).toISOString(),titleId:titles[0].id,surface:'home',row:'top',position:0,model:'dynamic-v3',sessionId:'old'}]};
 assert.equal(buildTasteProfile(impressions,titles).negative.length,0);
});
test('Home and For You adapt rows, avoid cross-row duplicates and remain deterministic',()=>{
 const state=change(structuredClone(defaultState),{liked:[titles[0].id,titles[2].id,titles[4].id],saved:[titles[1].id]});
 const rows=composeRows(titles,state,titles,'home','session-A');assert.ok(rows.some(r=>r.id.startsWith('seed:')));assert.ok(rows.length>=2);
 const ids=rows.flatMap(r=>r.items.map(i=>i.title.id));assert.equal(ids.length,new Set(ids).size);
 assert.deepEqual(rows,composeRows(titles,state,titles,'home','session-A'));
 const cold=composeRows(titles,defaultState,titles,'home');assert.notDeepEqual(rows.map(r=>r.name),cold.map(r=>r.name));
 assert.ok(candidatePlan(state,titles,defaultFilters).some(p=>p.kind==='similar'));assert.ok(candidatePlan(state,titles,defaultFilters).some(p=>p.id.startsWith('exploration')));
});
test('service changes are strict when selected and a bounded ranking feature otherwise',()=>{
 const a=recs({...defaultState,services:['119']});const b=recs({...defaultState,services:['8']});assert.ok(a.every(r=>r.title.language==='Telugu'));assert.ok(b.every(r=>r.title.language==='Malayalam'));
 const withAll=getRecommendations({titles,state:{...defaultState,services:['8']},surface:'home',filters:{...defaultFilters,onlyServices:false}});assert.ok(withAll.some(r=>r.title.language==='Telugu'));assert.ok(withAll.find(r=>r.title.language==='Malayalam')!.components.availability);
});
test('anonymous import preserves account conflicts; revision rebase preserves independent remote edits',()=>{
 const account=change(structuredClone(defaultState),{liked:[titles[0].id],ratings:{[titles[0].id]:10},services:['119']});const anonymous=change(structuredClone(defaultState),{disliked:[titles[0].id],ratings:{[titles[0].id]:2},saved:[titles[1].id],services:['8']});
 const merged=mergeAnonymous(account,anonymous);assert.equal(merged.ratings[titles[0].id],10);assert.ok(!merged.disliked.includes(titles[0].id));assert.deepEqual(merged.services,['119']);assert.ok(merged.saved.includes(titles[1].id));
 const rebased=rebaseState(defaultState,{...defaultState,liked:[titles[0].id]},{...defaultState,saved:[titles[1].id]});assert.deepEqual(rebased.liked,[titles[0].id]);assert.deepEqual(rebased.saved,[titles[1].id]);
});

test('four deterministic personas differ and metric calculations have bounded, explicit semantics',async()=>{
 const {evaluateRecommendations}=await import('../src/modules/recommendations/metrics');
 const groups=[{language:'Telugu',genres:['Action','Science Fiction']},{language:'Malayalam',genres:['Crime','Thriller']},{language:'Hindi',genres:['Drama','Romance']},{language:'English',genres:['Comedy','Drama']}];
 const pool=titles.map((t,i)=>({...t,...groups[i%4],id:`tmdb:movie:${1000+i}`,externalId:1000+i,offers:[{provider:i%2?'8':'119',region:'IN',type:'subscription' as const}]}));
 const personas=groups.map((g,index)=>({...structuredClone(defaultState),languages:[g.language],genres:g.genres,...(index<3?{liked:[pool[index].id,pool[index+4].id],ratings:{[pool[index+8].id]:10}}:{services:['8']})}));
 const results=personas.map(state=>getRecommendations({titles:pool,state,evidence:pool,surface:'for-you',sessionId:'evaluation',now}).map(r=>r.title));
 assert.equal(new Set(results.map(r=>r.slice(0,5).map(t=>t.id).join(','))).size,4);
 const metrics=results.map((ranked,index)=>evaluateRecommendations(ranked,pool,personas[index].services,Object.fromEntries(pool.map(t=>[t.id,t.language===groups[index].language?2:0])),10));
 assert.ok(metrics.every(m=>m.duplicateRate===0&&m.ndcgAtK!==null&&m.ndcgAtK>=0&&m.ndcgAtK<=1));
 console.log(JSON.stringify({proof:'four persona evaluation',metrics:metrics.map((m,i)=>({persona:i+1,precision:m.precisionAtK,ndcg:m.ndcgAtK,diversity:m.intraListDiversity,duplicateRate:m.duplicateRate,availability:m.providerAvailabilityRate}))}));
});

test('session intent changes scores; related ranking follows its anchor and excludes the anchor',()=>{
 const state=change(structuredClone(defaultState),{liked:[titles[0].id]});
 const same=getRecommendations({titles,state,evidence:titles,surface:'home',sessionId:'session-A',now});
 const other=getRecommendations({titles,state,evidence:titles,surface:'home',sessionId:'session-B',now});
 assert.ok(same.find(r=>r.title.id===titles[2].id)!.score>other.find(r=>r.title.id===titles[2].id)!.score);
 const a=getRecommendations({titles,state:defaultState,surface:'related',anchor:titles[0],now});
 const b=getRecommendations({titles,state:defaultState,surface:'related',anchor:titles[1],now});
 assert.ok(!a.some(r=>r.title.id===titles[0].id));assert.ok(!b.some(r=>r.title.id===titles[1].id));
 assert.notEqual(a[0].title.language,b[0].title.language);
 assert.ok(a[0].components.anchorAffinity>0);assert.match(a[0].reason,/Evaluation title 1/);
});

test('negative people evidence cannot unlock positive creator/actor retrieval or rows',()=>{
 const pool=titles.map(t=>({...t,credits:[{id:20,name:'Creator A',role:'Director'},{id:21,name:'Actor A',role:'Cast'}],creators:['Creator A']}));
 const mixed=change(structuredClone(defaultState),{liked:[pool[0].id,pool[1].id],disliked:[pool[2].id]});
 assert.ok(!candidatePlan(mixed,pool,defaultFilters).some(p=>p.id==='actor:21'));
 const onePositive=change(structuredClone(defaultState),{liked:[pool[0].id],disliked:[pool[1].id]});
 assert.ok(!candidatePlan(onePositive,pool,defaultFilters).some(p=>p.id==='creator:20'));
 assert.ok(!composeRows(pool,onePositive,pool,'home').some(r=>r.id.startsWith('creator:')||r.id.startsWith('actor:')));
 const positive=change(structuredClone(defaultState),{liked:[pool[0].id,pool[1].id,pool[2].id]});
 const plan=candidatePlan(positive,pool,defaultFilters);
 assert.ok(plan.some(p=>p.id==='actor:21'));assert.ok(plan.some(p=>p.id==='creator:20'));
 for(const row of composeRows(pool,positive,pool,'home').filter(r=>r.theme==='actor'||r.theme==='creator'))assert.match(row.reason,/positively to 3 titles/);
});

test('event context, selections, signal recency and metrics retain meaningful semantics',async()=>{
 const {sanitizeEvents,createEvent}=await import('../src/modules/library/events');
 const {signalIds}=await import('../src/modules/library/state');
 const {evaluateRecommendations,exposureMetrics}=await import('../src/modules/recommendations/metrics');
 const context={surface:'for-you',sessionId:'session-A',row:'top',position:2};
 const state=recordChanges(structuredClone(defaultState),{...structuredClone(defaultState),liked:[titles[0].id],services:['8'],languages:['Malayalam'],genres:['Comedy']},context);
 const events=sanitizeEvents(state.events);const like=events.find(e=>e.type==='like')!;
 const bsonRoundTrip=JSON.parse(JSON.stringify(events,(_key,value)=>value===undefined?null:value));
 assert.deepEqual(sanitizeEvents(bsonRoundTrip),events,'Legacy BSON null fields normalize to the same event contract');
 assert.equal(like.titleId,titles[0].id);assert.equal(like.row,'top');assert.equal(like.position,2);assert.equal(like.surface,'for-you');assert.equal(like.sessionId,'session-A');assert.ok(Number.isFinite(Date.parse(like.at)));
 for(const type of ['services','languages','genres'] as const)assert.deepEqual(events.find(e=>e.type===type)?.selection,state[type]);
 const many={...state,liked:Array.from({length:100},(_,i)=>`tmdb:movie:${i+100}`),events:[createEvent('provider_click',context,titles[0].id)]};
 assert.ok(signalIds(many).includes(titles[0].id));assert.equal(signalIds(many).length,80);
 const impression=createEvent('impression',context,titles[0].id),click=createEvent('click',context,titles[0].id);
 assert.equal(exposureMetrics([impression,click]).ctr,1);assert.equal(exposureMetrics([click]).ctr,null);
 const empty=evaluateRecommendations([],[]);assert.equal(empty.duplicateRate,0);assert.equal(empty.ndcgAtK,null);assert.equal(empty.precisionAtK,null);
});
