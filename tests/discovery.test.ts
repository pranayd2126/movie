import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,parseState,preserveOnboarding} from '../src/modules/library/state';
import {mergeAnonymous,rebaseState} from '../src/modules/auth/merge';
import {createEvent,recordChanges,sanitizeEvents} from '../src/modules/library/events';
import {moodMatch} from '../src/modules/discovery/moods';
import {defaultFilters,getRecommendations} from '../src/modules/recommendations/rank';
import {composeRowPlan} from '../src/modules/recommendations/rows';
import {candidatePlan} from '../src/modules/recommendations/candidates';
import {buildTasteProfile} from '../src/modules/recommendations/taste';
import {applySwipe} from '../src/modules/recommendations/swipe';
import type {Title} from '../src/modules/catalog/types';
const fresh=()=>structuredClone(defaultState);
// Synthetic metadata is confined to deterministic tests, never the runtime catalog.
const titles:Title[]=Array.from({length:128},(_,i)=>({id:`tmdb:movie:${i+1}`,externalId:i+1,mediaType:'movie',source:'tmdb',name:`Test ${i+1}`,tagline:'',synopsis:'',kind:i%7===0?'series':'movie',language:['Telugu','Malayalam','English','Hindi'][i%4],genres:i%4<2?['Comedy','Drama']:['Science Fiction','Mystery'],keywords:i%4<2?['friendship','family']:['time travel','space'],runtime:i%3===0?85:i%3===1?110:140,year:2025,rating:7.8,votes:i===127?2:800,popularity:i%5===0?90:15,creators:[i%4<2?'Creator A':'Creator B'],credits:[{id:10,name:i%4<2?'Actor A':'Actor B',role:'Cast'}],people:[],moods:[],offers:[{provider:i%2?'8':'119',name:i%2?'Netflix':'Prime Video',region:'IN',type:'subscription'}]}));
const context={surface:'swipe',sessionId:'phase-test'};
const persona=(ids:number[],languages:string[],genres:string[])=>recordChanges(fresh(),{...fresh(),languages,genres,liked:ids.map(i=>titles[i].id)},context);

test('new/legacy/completed/skipped status and canonical language preferences survive persistence and merge',()=>{
 const legacy=parseState(JSON.stringify({...fresh(),onboarding:undefined,languages:['Telugu','ml','invalid']}));assert.equal(legacy.onboarding,'legacy');assert.deepEqual(legacy.languages,['te','ml']);
 for(const status of ['pending','completed','skipped'] as const)assert.equal(parseState(JSON.stringify({...fresh(),onboarding:status})).onboarding,status);
 const account={...fresh(),onboarding:'pending' as const};assert.equal(preserveOnboarding(account,fresh()).onboarding,'pending');
 assert.equal(mergeAnonymous(account,{...fresh(),onboarding:'completed'}).onboarding,'pending');
 assert.equal(rebaseState(account,{...account,onboarding:'skipped'},account).onboarding,'skipped');
});
test('onboarding priors influence cold start and fade as behavioral confidence grows',()=>{
 const cold={...fresh(),languages:['te'],genres:['Comedy']};
 const before=getRecommendations({titles,state:cold,surface:'home'});
 assert.ok(before.find(r=>r.title.id===titles[4].id)!.score>before.find(r=>r.title.id===titles[6].id)!.score);
 const warm=persona([2,6,10,14,18,22],['te'],['Comedy']);
 const after=getRecommendations({titles,state:warm,surface:'home'});
 assert.ok(after[0].components.priorWeight<before[0].components.priorWeight);
 assert.ok(after.find(r=>r.title.id===titles[30].id)!.score>before.find(r=>r.title.id===titles[30].id)!.score);
 assert.ok(candidatePlan(cold,titles,defaultFilters).some(g=>g.language==='Telugu'));
 assert.ok(candidatePlan(cold,titles,defaultFilters).some(g=>g.kind==='trending'));
 assert.ok(candidatePlan(cold,titles,defaultFilters).length<=18);
});
test('mood is derived from metadata, rejects contrary evidence, and does not change long-term taste',()=>{
 assert.equal(moodMatch({genres:['Science Fiction'],keywords:[]},'Mind-bending').matches,false);
 assert.equal(moodMatch({genres:['Mystery'],keywords:['time travel']},'Mind-bending').matches,true);
 assert.equal(moodMatch({genres:['Comedy','Crime'],keywords:['serial killer']},'Feel-good').matches,false);
 const state=persona([2,6],['en'],['Science Fiction']);const prior=buildTasteProfile(state,titles,context.sessionId);
 const event=createEvent('mood',{...context,mood:'Funny'});state.events.push(event);
 assert.deepEqual(buildTasteProfile(state,titles,context.sessionId).longTerm,prior.longTerm);
 const filtered=getRecommendations({titles,state,filters:{...defaultFilters,mood:'Funny'},surface:'discover'});
 assert.ok(filtered.length);assert.ok(filtered.every(r=>r.title.genres.includes('Comedy')));
 assert.equal(sanitizeEvents([event])[0].mood,'Funny');
});
test('explicit language, subscription, runtime, and sort win over taste; unknown runtime is excluded',()=>{
 const state=persona([2,6],['en'],['Science Fiction']);
 const filters={...defaultFilters,language:'Telugu',mood:'Funny' as const,provider:'119',maxRuntime:90,sort:'newest' as const};
 const source=[...titles,{...titles[0],id:'tmdb:movie:999',runtime:0},{...titles[4],id:'tmdb:movie:998',runtime:89,offers:[{provider:'119',region:'IN',type:'rent' as const}]}];
 const result=getRecommendations({titles:source,state,filters,surface:'discover'});
 assert.ok(result.length);assert.ok(result.every(r=>r.title.language==='Telugu'&&r.title.runtime>0&&r.title.runtime<90&&r.title.offers.some(o=>o.type==='subscription'&&o.provider==='119')));
 assert.ok(result.some(r=>r.title.kind==='series'),'Reported episode runtime works for TV');
 assert.ok(!result.some(r=>r.title.id==='tmdb:movie:998'));
 const long=getRecommendations({titles,state,filters:{...defaultFilters,minRuntime:120},surface:'discover'});assert.ok(long.every(r=>r.title.runtime>=120));
 const plan=candidatePlan(state,titles,filters);assert.ok(plan.filter(p=>p.kind==='discover').every(p=>p.language==='Telugu'&&p.providers?.includes('119')));
});
test('rows require truthful strong anchors and positive creator/actor evidence; preserve swipe semantics',()=>{
 let state=persona([0,4,8],['te'],['Comedy']);state=recordChanges(state,{...state,ratings:{[titles[2].id]:9,[titles[6].id]:6}},context);
 state=recordChanges(state,applySwipe(state,titles[12].id,'like').state,context);
 state=recordChanges(state,applySwipe(state,titles[16].id,'not_interested').state,context);
 const plan=composeRowPlan(titles,state,titles,'discover',context.sessionId);
 assert.ok(plan.diagnostics.some(r=>r.id===`seed:${titles[12].id}`&&r.name.includes('liked')));
 assert.ok(plan.diagnostics.some(r=>r.id===`seed:${titles[2].id}`&&r.name.includes('rated')));
 assert.ok(!plan.diagnostics.some(r=>r.id===`seed:${titles[6].id}`));
 assert.ok(plan.diagnostics.some(r=>r.id.startsWith('combination:Telugu:Comedy')));
 assert.ok(plan.diagnostics.some(r=>r.id==='creator:Creator A'));assert.ok(plan.diagnostics.some(r=>r.id==='actor:Actor A'));
 assert.ok(plan.rows.every(r=>r.items.every(i=>i.title.id!==titles[16].id)));assert.equal(buildTasteProfile(state,titles).negative.length,0);
 const weak=composeRowPlan(titles,persona([0],[],[]),titles,'discover');assert.ok(!weak.diagnostics.some(r=>r.id.startsWith('creator:')||r.id.startsWith('actor:')));
});
test('row composition differs between personas, is stable, deduplicates, and distinguishes surfaces',()=>{
 const a=persona([0,4,8],['te'],['Comedy']),b=persona([2,6,10],['en'],['Science Fiction']);
 const ar=composeRowPlan(titles,a,titles,'discover',context.sessionId),br=composeRowPlan(titles,b,titles,'discover',context.sessionId);
 assert.notDeepEqual(ar.rows.map(r=>r.id),br.rows.map(r=>r.id));assert.deepEqual(ar,composeRowPlan(titles,a,titles,'discover',context.sessionId));
 const ids=ar.rows.flatMap(r=>r.items.map(i=>i.title.id));assert.equal(new Set(ids).size,ids.length);
 assert.ok(ar.rows.length>composeRowPlan(titles,a,titles,'home',context.sessionId).rows.length);
 assert.ok(ar.diagnostics.some(r=>r.exclusion));assert.ok(ar.rows.every(r=>Number.isFinite(r.score)));
});
test('gems, provider, recent/session and mood proposals are evidence-based',()=>{
 const state=persona([0,4,8],['te'],['Comedy']);state.services=['119'];
 const plan=composeRowPlan(titles,state,titles,'discover',context.sessionId,{...defaultFilters,onlyServices:false});
 assert.ok(plan.diagnostics.some(r=>r.id==='gems'));assert.ok(plan.diagnostics.some(r=>r.id==='explore'));assert.ok(plan.diagnostics.some(r=>r.id==='recent-interests'));assert.ok(plan.diagnostics.some(r=>r.id==='session'));assert.ok(plan.diagnostics.some(r=>r.id==='provider:119'));assert.ok(!plan.diagnostics.some(r=>r.id==='provider:8'));
 const mood=composeRowPlan(titles,state,titles,'discover',context.sessionId,{...defaultFilters,mood:'Funny',onlyServices:false});assert.equal(mood.rows[0].id,'mood:Funny');
 const gems=plan.rows.find(r=>r.id==='gems');if(gems)assert.ok(gems.items.every(r=>r.title.votes>=80&&r.title.popularity<30));
 const provider=plan.rows.find(r=>r.theme==='provider');if(provider)assert.ok(provider.items.every(r=>r.title.offers.some(o=>o.provider==='119'&&o.type==='subscription')));
});
test('row events retain anchor, theme, timestamp and model for diagnostics',()=>{
 const e=createEvent('click',{...context,row:'seed:tmdb:movie:1',rowType:'anchor',anchorId:'tmdb:movie:1',position:2},'tmdb:movie:2');const clean=sanitizeEvents([e])[0];assert.equal(clean.anchorId,e.anchorId);assert.equal(clean.rowType,'anchor');assert.ok(Date.parse(clean.at));assert.ok(clean.model);
});
