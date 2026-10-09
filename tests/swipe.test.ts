import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySwipe, undoSwipe, swipeDecision, isCardTap, springStep } from '../src/modules/recommendations/swipe';
import { getRecommendations, defaultFilters } from '../src/modules/recommendations/rank';
import { buildTasteProfile } from '../src/modules/recommendations/taste';
import { recordChanges, sanitizeEvents } from '../src/modules/library/events';
import { defaultState, parseState } from '../src/modules/library/state';
import { selectTrailer } from '../src/modules/catalog/videos';
import type { Title } from '../src/modules/catalog/types';
const context = { surface: 'swipe', sessionId: 'swipe-test', row: 'deck', position: 0, sources: ['similar:tmdb:movie:1'], input: 'gesture' as const };
const base = () => structuredClone(defaultState);
const pool:Title[]=Array.from({length:8},(_,i)=>({id:`tmdb:movie:${i+1}`,name:`Test ${i}`,kind:'movie',source:'tmdb',externalId:i+1,mediaType:'movie',tagline:'',synopsis:'',language:i%2?'Malayalam':'English',genres:i%2?['Comedy']:['Science Fiction'],creators:i%2?['B']:['A'],people:[],keywords:i%2?['family']:['space'],year:2020,runtime:120,rating:7.8,votes:400,popularity:20,moods:[],offers:[]}));

test('gesture thresholds reject accidental/vertical movement and accept deliberate mouse/touch distances',()=>{
 assert.equal(swipeDecision(20,0,350,10),null);
 assert.equal(swipeDecision(100,160,350,200),null);
 assert.equal(swipeDecision(100,0,350,500),'like');
 assert.equal(swipeDecision(-100,0,300,500),'not_interested');
 assert.equal(swipeDecision(45,0,350,40),'like');
});
test('right and left use existing signals, preserving unrelated history and private watched records',()=>{
 const original={...base(),ratings:{'tmdb:movie:8':8},saved:['tmdb:movie:7'],watched:[{titleId:'tmdb:movie:6',watchedAt:new Date().toISOString(),audience:'private' as const}]};
 const right=recordChanges(original,applySwipe(original,pool[0].id,'like').state,context);
 assert.deepEqual(right.liked,[pool[0].id]);assert.deepEqual(right.ratings,original.ratings);assert.deepEqual(right.watched,original.watched);
 const left=recordChanges(right,applySwipe(right,pool[1].id,'not_interested').state,{...context,input:'button'});
 assert.deepEqual(left.dismissed,[pool[1].id]);assert.deepEqual(left.disliked,[]);
 assert.ok(left.events.some(e=>e.type==='like'&&e.surface==='swipe'));assert.ok(left.events.some(e=>e.type==='not_interested'&&e.input==='button'));
 const event=sanitizeEvents(left.events)[0];assert.deepEqual(event.sources,context.sources);assert.equal(event.position,0);assert.ok(Date.parse(event.at));
 assert.deepEqual(parseState(JSON.stringify(left)).liked,left.liked);
});
test('undo restores only the last decision and preserves a pre-existing like and other edits',()=>{
 const old={...base(),liked:[pool[0].id]};const redundant=applySwipe(old,pool[0].id,'like');assert.deepEqual(undoSwipe(redundant.state,redundant.undo).liked,old.liked);
 const first=applySwipe(base(),pool[0].id,'like');const second=applySwipe(first.state,pool[1].id,'not_interested');
 const reverted=undoSwipe({...second.state,saved:[pool[4].id]},second.undo);
 assert.deepEqual(reverted.dismissed,[]);assert.deepEqual(reverted.liked,[pool[0].id]);assert.deepEqual(reverted.saved,[pool[4].id]);
});
test('swipe exclusions avoid decided cards; left swipe suppresses exact title without negative feature evidence',()=>{
 const state={...base(),liked:[pool[0].id],favorites:[pool[1].id],ratings:{[pool[2].id]:10},disliked:[pool[3].id],dismissed:[pool[4].id]};
 const ranked=getRecommendations({titles:pool,state,surface:'swipe'});assert.ok(ranked.every(r=>!pool.slice(0,5).some(t=>t.id===r.title.id)));
 const left=applySwipe(base(),pool[0].id,'not_interested').state;
 assert.equal(buildTasteProfile(left,pool).evidenceCount,0);assert.equal(buildTasteProfile(left,pool).negative.length,0);
 assert.ok(getRecommendations({titles:pool,state:left,surface:'swipe'}).some(r=>r.title.id===pool[2].id));
});
test('swipe feedback changes the shared Home/For You model and undo removes its positive evidence',()=>{
 const initial=getRecommendations({titles:pool,state:base(),surface:'for-you'});
 let state=base();for(const title of [pool[0],pool[2]])state=recordChanges(state,applySwipe(state,title.id,'like').state,context);
 state=recordChanges(state,applySwipe(state,pool[1].id,'not_interested').state,context);
 const profile=buildTasteProfile(state,pool,'swipe-test');assert.equal(profile.evidenceCount,2);assert.equal(profile.longTerm.genre['Science Fiction'].positiveCount,2);
 const after=getRecommendations({titles:pool,state,surface:'for-you',sessionId:'swipe-test'});
 assert.ok(after.find(r=>r.title.id===pool[4].id)!.score>initial.find(r=>r.title.id===pool[4].id)!.score);
 assert.ok(!after.some(r=>r.title.id===pool[1].id));assert.ok(getRecommendations({titles:pool,state,surface:'home',filters:defaultFilters}).length);
 const choice=applySwipe(base(),pool[0].id,'like');assert.equal(buildTasteProfile(undoSwipe(choice.state,choice.undo),pool).evidenceCount,0);
});
test('trailer selection prefers official trailers, then teasers, with safe poster-only fallback',()=>{
 const teaser={site:'YouTube',key:'abcdefghijk',type:'Teaser',official:true,iso_639_1:'te'};
 const trailer={site:'YouTube',key:'12345678901',type:'Trailer',official:true,iso_639_1:'en'};
 assert.equal(selectTrailer([teaser,trailer],'te'),'https://www.youtube.com/watch?v=12345678901');
 assert.equal(selectTrailer([teaser],'te'),'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(selectTrailer([{...trailer,official:false},{...trailer,key:'../unsafe'}]),undefined);
 assert.equal(selectTrailer([]),undefined);
});


test('tap tolerance uses maximum movement and cancellation, not duration',()=>{
 assert.equal(isCardTap(0),true);assert.equal(isCardTap(7),true);
 assert.equal(isCardTap(9),false);assert.equal(isCardTap(30),false);assert.equal(isCardTap(0,true),false);
});
test('release velocity supports a late flick but rejects held, tiny and reversed gestures',()=>{
 assert.equal(swipeDecision(45,0,350,1000,.8),'like');
 assert.equal(swipeDecision(-45,0,350,1000,-.8),'not_interested');
 assert.equal(swipeDecision(25,0,350,20,2),null);
 assert.equal(swipeDecision(45,0,350,40,0),null);
 assert.equal(swipeDecision(45,0,350,40,-.8),null);
});
test('spring returns displaced cards to rest within a bounded time at mobile and desktop frame rates',()=>{
 for(const dt of [1/120,1/60,1/30])for(const start of [-150,50,150]){
  let frame={position:start,velocity:0};
  for(let time=0;time<.9;time+=dt)frame=springStep(frame.position,frame.velocity,dt);
  assert.ok(Math.abs(frame.position)<.2);assert.ok(Math.abs(frame.velocity)<3);
 }
});
