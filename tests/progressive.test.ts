import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDiscoveryFeedStore} from '../src/server/discovery-feed';
import {defaultFilters} from '../src/modules/recommendations/rank';
import {defaultState} from '../src/modules/library/state';
import {recordChanges,createEvent,sanitizeEvents} from '../src/modules/library/events';
import {composeRowPlan} from '../src/modules/recommendations/rows';
import {discoveryContext,FEED} from '../src/modules/recommendations/feed-context';
import {buildTasteProfile} from '../src/modules/recommendations/taste';
import type {Title} from '../src/modules/catalog/types';
const titles:Title[]=Array.from({length:360},(_,i)=>({id:`tmdb:movie:${i+1}`,externalId:i+1,mediaType:'movie',source:'tmdb',name:`Fixture ${i}`,tagline:'',synopsis:'',kind:i%3?'movie':'series',language:['Telugu','English','Malayalam','Hindi'][i%4],genres:[['Comedy','Drama'],['Science Fiction','Mystery'],['Crime','Thriller'],['Action','Adventure']][i%4],runtime:70+i%100,year:1980+i%46,rating:8.2,votes:1000,popularity:i%50,creators:[`Creator ${i%4}`],credits:[{id:i%4,name:`Actor ${i%4}`,role:'Cast'}],keywords:i%4===1?['time travel']:['friendship'],people:[],moods:[],offers:[{provider:i%2?'8':'119',name:i%2?'Netflix':'Prime Video',region:'IN',type:'subscription'}],provenance:['test-only']}));
const persona=(offset=0)=>recordChanges(structuredClone(defaultState),{...structuredClone(defaultState),languages:offset?['en']:['te','ml'],genres:offset?['Science Fiction']:['Comedy','Thriller'],liked:[titles[offset].id,titles[offset+4].id,titles[offset+8].id],ratings:{[titles[offset+12].id]:9}},{surface:'swipe',sessionId:'test'});
const request=(state=persona())=>({owner:'A',sessionId:'test',requestId:randomUUID(),state,filters:{...defaultFilters,onlyServices:false}});
const loader=async(_state:unknown,_filters:unknown,_surface:unknown,_session:unknown,page:number)=>({titles:titles.slice((page-1)*60,page*60),evidence:titles.slice(0,20),page,hasMore:page<6});

test('progressive batches append distinct rows/titles, preserve prefix, rank by persona and terminate within bounds',async()=>{
 let calls=0;const store=createDiscoveryFeedStore(async(...args)=>{calls++;return loader(...args);});const a=request();
 const first=await store.next(a);assert.ok(first.rows.length>=5);assert.ok(first.rows.length<=FEED.initialRows);
 const prefix=JSON.stringify(first.rows);let rows=[...first.rows],batch=first;
 while(batch.cursor){batch=await store.next({...a,cursor:batch.cursor});assert.ok(batch.rows.length<=FEED.nextRows);rows.push(...batch.rows);}
 assert.equal(JSON.stringify(rows.slice(0,first.rows.length)),prefix);
 assert.ok(rows.length>first.rows.length);assert.ok(calls<=FEED.maxPages);assert.ok(rows.length<=FEED.maxRows);assert.ok(batch.endReason);
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);const ids=rows.flatMap(r=>r.items.map(i=>i.title.id));assert.equal(new Set(ids).size,ids.length);
 assert.ok(rows.some(r=>r.batch>=2));
 const b=await store.next({...request(persona(1)),owner:'B'});assert.notDeepEqual(b.rows.map(r=>r.id),first.rows.map(r=>r.id));
});
test('duplicate concurrent calls are deduplicated; failure leaves the same continuation retryable',async()=>{
 let calls=0,fail=false;const store=createDiscoveryFeedStore(async(...args)=>{calls++;await new Promise(r=>setTimeout(r,5));if(fail)throw new Error('offline');return loader(...args);});const a=request();
 const [one,two]=await Promise.all([store.next(a),store.next(a)]);assert.deepEqual(one,two);assert.equal(calls,1);assert.ok(one.cursor);
 fail=true;await assert.rejects(store.next({...a,cursor:one.cursor!}),/offline/);const stable=JSON.stringify(one.rows);
 fail=false;const next=await store.next({...a,cursor:one.cursor!});assert.ok(next.rows.length);assert.equal(JSON.stringify(one.rows),stable);assert.equal(next.retrievalPage,2);
 const repeat=await store.next({...a,cursor:one.cursor!});assert.deepEqual(repeat,next);assert.equal(calls,3);
});
test('continuations are bound to owner/session/context and filtered at every depth',async()=>{
 const store=createDiscoveryFeedStore(loader);const a=request();a.filters={...a.filters,mood:'Funny',language:'Telugu',provider:'119',maxRuntime:120};let batch=await store.next(a);
 for(const forged of [{owner:'B'},{sessionId:'other'},{filters:{...a.filters,language:'English'}}])await assert.rejects(store.next({...a,...forged,cursor:batch.cursor!}));
 const rows=[...batch.rows];while(batch.cursor){batch=await store.next({...a,cursor:batch.cursor});rows.push(...batch.rows);}
 assert.ok(rows.length);assert.ok(rows.every(r=>r.items.every(i=>i.title.language==='Telugu'&&i.title.genres.includes('Comedy')&&i.title.runtime<120&&i.title.offers.some(o=>o.provider==='119'&&o.type==='subscription'))));
});
test('new taste affects future proposals, not prior batches; exposure is not positive taste',async()=>{
 const store=createDiscoveryFeedStore(loader);const cold={...structuredClone(defaultState),languages:['te'],genres:['Comedy']};const a=request(cold);const first=await store.next(a);const prefix=JSON.stringify(first.rows);
 const warm=recordChanges(cold,{...cold,liked:[titles[1].id,titles[5].id,titles[9].id]},{surface:'swipe',sessionId:'test'});
 assert.equal(discoveryContext(a.filters,cold),discoveryContext(a.filters,warm));
 const second=await store.next({...a,state:warm,cursor:first.cursor!});assert.ok(second.diagnostics.some(r=>r.id===`seed:${titles[1].id}`));assert.equal(JSON.stringify(first.rows),prefix);
 const event=createEvent('row_impression',{surface:'discover',sessionId:'test',feedId:'feed',batch:2,rowPosition:10,context:'Funny',row:'gems'});
 const exposed={...warm,events:[...warm.events,event]};assert.deepEqual(buildTasteProfile(exposed,titles).longTerm,buildTasteProfile(warm,titles).longTerm);
 const clean=sanitizeEvents([event])[0];assert.equal(clean.batch,2);assert.equal(clean.rowPosition,10);assert.equal(clean.context,'Funny');
});
test('deep exploration contribution increases, weak rows are rejected and legacy surfaces retain budgets',()=>{
 const state=persona(),opts={previous:[],limit:4,batch:0};
 const early=composeRowPlan(titles,state,titles,'discover','test',defaultFilters,opts),deep=composeRowPlan(titles,state,titles,'discover','test',defaultFilters,{...opts,batch:4});
 assert.equal(early.diagnostics.find(r=>r.id==='explore')?.components.exploration,0);
 assert.ok((deep.diagnostics.find(r=>r.id==='explore')?.components.exploration??0)>0);
 const weak=composeRowPlan(titles.slice(0,2),state,titles,'discover','test',defaultFilters,opts);assert.equal(weak.rows.length,0);assert.ok(weak.diagnostics.every(r=>!r.selected));
 assert.ok(composeRowPlan(titles,state,titles,'home','test').rows.length<=5);
});

test('incremental diversity ranking matches the previous algorithm exactly',async()=>{
 const {getRecommendations,similarity}=await import('../src/modules/recommendations/rank');const {CONFIG}=await import('../src/modules/recommendations/config');
 const actual=getRecommendations({titles:titles.slice(0,100).map((t,i)=>({...t,creators:i%7?t.creators:undefined,collectionId:i%5===0?17:undefined})),state:persona(),surface:'discover'});
 const remaining=[...actual],legacy:typeof actual=[];
 while(remaining.length){remaining.sort((a,b)=>{
  const utility=(item:typeof a)=>(1-CONFIG.rerank.diversity)*item.score-CONFIG.rerank.diversity*Math.max(0,...legacy.map(r=>similarity(item.title,r.title)))-CONFIG.rerank.franchisePenalty*Number(!!item.title.collectionId&&legacy.some(r=>r.title.collectionId===item.title.collectionId))-CONFIG.rerank.creatorPenalty*Number(legacy.some(r=>item.title.creators?.some(c=>r.title.creators?.includes(c))));
  return utility(b)-utility(a)||a.title.id.localeCompare(b.title.id);
 });const explore=legacy.length>0&&legacy.length%CONFIG.rerank.explorationEvery===0?remaining.findIndex(c=>c.components.quality>=CONFIG.rerank.explorationQuality&&c.title.votes>=CONFIG.rerank.explorationVotes&&c.components.taste<.1&&c.components.penalty<.04):-1;legacy.push(remaining.splice(explore>=0?explore:0,1)[0]);}
 assert.deepEqual(actual.map(r=>r.title.id),legacy.map(r=>r.title.id));
});

test('an exhausted source is not fetched again just to fill more rows',async()=>{
 let calls=0;const store=createDiscoveryFeedStore(async()=>{calls++;return {titles:titles.slice(0,60),evidence:titles.slice(0,20),page:1,hasMore:false};});const req=request();let batch=await store.next(req),count=1;
 while(batch.cursor){batch=await store.next({...req,cursor:batch.cursor});count++;}
 assert.equal(calls,1);assert.ok(count<=FEED.maxBatches);assert.ok(batch.endReason);
});
