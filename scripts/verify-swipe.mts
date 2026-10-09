import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { defaultState } from '../src/modules/library/state';
import { applySwipe, undoSwipe } from '../src/modules/recommendations/swipe';
import { recordChanges } from '../src/modules/library/events';
import { defaultFilters } from '../src/modules/recommendations/rank';
const base=process.env.TEST_ORIGIN??'http://localhost:5000';
const suffix=randomBytes(6).toString('hex'),password=randomBytes(24).toString('base64url');
let cookie='';const records:Record<string,{email:string;id:string}>={};
async function api(path:string,method='GET',body?:unknown){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
 assert.equal(response.status,200,`${path}: ${response.status}`);return response.json();
}
for(const name of ['A','B']){
 const email=`nextscene-swipe-${name.toLowerCase()}-${suffix}@example.invalid`;
 const result=await api('/api/auth','POST',{action:'signup',email,password,name:`Swipe ${name}`});records[name]={email,id:result.user.id};
 const state={...structuredClone(defaultState),services:name==='A'?['119']:['8'],languages:name==='A'?['English']:['Malayalam'],genres:name==='A'?['Science Fiction']:['Comedy'],saved:['tmdb:movie:603']};
 await api('/api/profile','PUT',{owner:result.user.id,revision:result.revision,state});await api('/api/auth','POST',{action:'logout'});
}
await writeFile('/tmp/nextscene-swipe-fixture.json',JSON.stringify({records,password}),{mode:0o600});
let account=await api('/api/auth','POST',{action:'login',email:records.A.email,password});
const request={surface:'swipe',filters:defaultFilters,sessionId:'focused-swipe',debug:true};
const initial=await api('/api/recommendations','POST',request);
assert.ok(initial.ranked.length>3);assert.ok(initial.ranked.every((r:any)=>r.title.id.startsWith('tmdb:')&&r.title.source==='tmdb'));
const liked=initial.ranked.filter((r:any)=>r.title.genres.includes('Science Fiction')).slice(0,3).map((r:any)=>r.title);
assert.ok(liked.length>=2,'Actual deck offers related real titles for the learning sequence');
const passed=initial.ranked.filter((r:any)=>!liked.some((t:any)=>t.id===r.title.id)).slice(0,2).map((r:any)=>r.title);
let state=account.state;let position=0;
for(const [decision,titles] of [['like',liked],['not_interested',passed]] as const)for(const title of titles){state=recordChanges(state,applySwipe(state,title.id,decision).state,{surface:'swipe',row:'deck',position:position++,sessionId:'focused-swipe',sources:title.provenance,input:'gesture'});}
const saved=await api('/api/profile','PUT',{owner:records.A.id,revision:account.revision,state});
const after=await api('/api/recommendations','POST',request);
assert.ok(after.debug.taste.evidenceCount>initial.debug.taste.evidenceCount);
for(const title of [...liked,...passed])assert.ok(!after.ranked.some((r:any)=>r.title.id===title.id),'Decided titles do not repeat');
assert.equal(after.debug.taste.negative.length,0,'Passing adds no negative feature evidence');
assert.deepEqual(saved.state.saved,['tmdb:movie:603'],'Existing watchlist preserved');
const home=await api('/api/recommendations','POST',{...request,surface:'home'});
const forYou=await api('/api/recommendations','POST',{...request,surface:'for-you'});
assert.ok(home.ranked.length&&forYou.ranked.length);
const scoresChanged=home.ranked.filter((r:any)=>{const before=initial.ranked.find((b:any)=>b.title.id===r.title.id);return before&&r.score>before.score+.01;}).map((r:any)=>r.title.name);
assert.ok(scoresChanged.length>0,'Shared Home ranking reacts to swipe evidence');
const undoChoice=applySwipe(saved.state,after.ranked[0].title.id,'like');
const applied=await api('/api/profile','PUT',{owner:records.A.id,revision:saved.revision,state:recordChanges(saved.state,undoChoice.state,{surface:'swipe',sessionId:'focused-swipe'})});
const reversed=await api('/api/profile','PUT',{owner:records.A.id,revision:applied.revision,state:recordChanges(applied.state,undoSwipe(applied.state,undoChoice.undo),{surface:'swipe',sessionId:'focused-swipe'})});
assert.deepEqual(reversed.state.liked,saved.state.liked);
await api('/api/auth','POST',{action:'logout'});
account=await api('/api/auth','POST',{action:'login',email:records.B.email,password});
assert.deepEqual(account.state.liked,[]);assert.deepEqual(account.state.dismissed,[]);assert.equal(account.state.events.filter((e:any)=>e.surface==='swipe').length,0);
const b=await api('/api/recommendations','POST',{...request,state});assert.equal(b.owner,records.B.id);assert.equal(b.debug.taste.evidenceCount,1);assert.deepEqual(b.debug.taste.positive.map((p:any)=>p.title.id),['tmdb:movie:603']);
await api('/api/auth','POST',{action:'logout'});
console.log(JSON.stringify({passed:true,realCards:initial.ranked.length,liked:liked.map((t:any)=>t.name),notInterested:passed.map((t:any)=>t.name),tasteEvidence:{before:initial.debug.taste.evidenceCount,after:after.debug.taste.evidenceCount},homeScoresIncreased:scoresChanged.slice(0,6),deckChanged:initial.ranked[0].title.id!==after.ranked[0].title.id,notInterestedNegativeEvidence:after.debug.taste.negative.length,undoPersisted:true,accountB:{likes:account.state.liked.length,notInterested:account.state.dismissed.length,tasteEvidence:b.debug.taste.evidenceCount},homeAndForYouLoad:true},null,2));
