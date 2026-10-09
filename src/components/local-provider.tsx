'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, Fragment } from 'react';
import type { Provider } from '@/modules/catalog/types';
import { defaultState, parseState, STORAGE_KEY, type LocalState } from '@/modules/library/state';
import { createEvent, recordChanges, type EventType } from '@/modules/library/events';
import { rebaseState } from '@/modules/auth/merge';
type User={id:string;email:string;name:string};
type EventDetails={feedId?:string;batch?:number;rowPosition?:number;context?:string;rowType?:string;anchorId?:string;mood?:import('@/modules/discovery/moods').Mood;row?:string;position?:number;surface?:string;sources?:string[];input?:'gesture'|'button'|'keyboard'};
type Context={viewState:Map<string,unknown>;providers:Provider[];providerError:boolean;state:LocalState;update:(updater:(old:LocalState)=>LocalState,details?:EventDetails)=>void;ready:boolean;notice:string;notify:(message:string)=>void;storageError:boolean;user:User|null;sessionId:string;identityKey:string;syncError:string;syncing:boolean;retrySync:()=>Promise<void>;reset:()=>void;clearHistory:()=>void;authenticate:(action:'signup'|'login',email:string,password:string,name:string,importLocal:boolean)=>Promise<void>;logout:()=>Promise<void>;track:(type:EventType,titleId?:string,details?:EventDetails)=>void};
const LocalContext=createContext<Context|null>(null);
const readAnonymous=()=>parseState(localStorage.getItem(STORAGE_KEY)??localStorage.getItem('nextscene.local.v2')??localStorage.getItem('nextscene.local.v1'));
export function LocalProvider({children}:{children:ReactNode}){
 const [providers,setProviders]=useState<Provider[]>([]),[providerError,setProviderError]=useState(false);
 const [state,setState]=useState<LocalState>(defaultState),[user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false),[notice,notify]=useState(''),[syncError,setSyncError]=useState(''),[syncing,setSyncing]=useState(false),[identityKey,setIdentityKey]=useState('loading'),[sessionId,setSessionId]=useState('');
 const [viewState,setViewState]=useState(()=>new Map<string,unknown>());
 const current=useRef(state),owner=useRef<User|null>(null),baseline=useRef(state),revision=useRef(0),dirty=useRef(false),epoch=useRef(0),session=useRef(''),timer=useRef<ReturnType<typeof setTimeout>|null>(null),flight=useRef<Promise<void>|null>(null),enabled=useRef(false);
 const publish=(next:LocalState)=>{current.current=next;setState(next);};
 const commit=useCallback(async():Promise<void>=>{
  if(flight.current){await flight.current; if(dirty.current)return commit();return;}
  if(!owner.current||!dirty.current)return;
  const capturedOwner=owner.current.id,capturedEpoch=epoch.current;
  setSyncing(true);
  const job=(async()=>{
   for(let attempt=0;attempt<3;attempt++){
    if(epoch.current!==capturedEpoch)return;
    const snapshot=current.current;
    const response=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:capturedOwner,revision:revision.current,state:snapshot})});const data=await response.json();
    if(epoch.current!==capturedEpoch)return;
    if(response.status===409&&data.state){publish(rebaseState(baseline.current,current.current,parseState(JSON.stringify(data.state))));baseline.current=parseState(JSON.stringify(data.state));revision.current=data.revision;continue;}
    if(!response.ok)throw new Error(data.error??'Changes could not be saved.');
    baseline.current=snapshot;revision.current=data.revision;dirty.current=current.current!==snapshot;setSyncError('');return;
   }
   throw new Error('Your account changed elsewhere. Retry saving to merge those changes.');
  })();flight.current=job;
  try{await job;}catch(e){setSyncError(e instanceof Error?e.message:'Changes could not be saved.');throw e;}finally{flight.current=null;setSyncing(false);}
  if(dirty.current&&epoch.current===capturedEpoch)return commit();
 },[]);
 const adopt=useCallback((data:{user:User|null;state?:LocalState;revision?:number})=>{
  if(session.current){const url=new URL(window.location.href);for(const key of ['mood','language','genre','provider','runtime','minRuntime','allServices','type','rating','year','sort'])url.searchParams.delete(key);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
  setViewState(new Map());epoch.current++;if(timer.current)clearTimeout(timer.current);dirty.current=false;
  owner.current=data.user;setUser(data.user);revision.current=data.revision??0;
  let next=structuredClone(defaultState);try{next=data.user?parseState(JSON.stringify(data.state)):readAnonymous();}catch{setStorageError(true);}
  baseline.current=next;publish(next);session.current=crypto.randomUUID();setSessionId(session.current);setIdentityKey(`${data.user?.id??'anonymous'}:${epoch.current}`);enabled.current=true;setReady(true);setSyncError('');
 },[]);
 const restore=useCallback(async()=>{
  setViewState(new Map());enabled.current=false;setReady(false);const requestEpoch=++epoch.current;owner.current=null;setUser(null);publish(structuredClone(defaultState));
  try{const r=await fetch('/api/auth',{cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error();if(epoch.current===requestEpoch)adopt(data);}catch{setSyncError('Account session could not be checked. Reload to retry.');setIdentityKey('unavailable');}
 },[adopt]);
 useEffect(()=>{void restore();const controller=new AbortController();fetch('/api/providers',{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();setProviders((await r.json()).providers);}).catch(e=>{if(e.name!=='AbortError')setProviderError(true);});
  const storage=(e:StorageEvent)=>{if(e.key==='nextscene.auth-change')void restore();else if(e.key===STORAGE_KEY&&!owner.current&&enabled.current)publish(parseState(e.newValue));};
  const focus=()=>{const focusEpoch=epoch.current;if(owner.current&&!dirty.current&&!flight.current)fetch('/api/auth',{cache:'no-store'}).then(async r=>{if(!r.ok)return;const data=await r.json();if(epoch.current!==focusEpoch)return;if(data.user?.id!==owner.current?.id)adopt(data);else if(data.revision>revision.current){revision.current=data.revision;baseline.current=parseState(JSON.stringify(data.state));publish(baseline.current);}}).catch(()=>{});};
  const pageShow=(e:PageTransitionEvent)=>{if(e.persisted)void restore();};window.addEventListener('pageshow',pageShow);
  window.addEventListener('storage',storage);window.addEventListener('focus',focus);return()=>{controller.abort();window.removeEventListener('pageshow',pageShow);window.removeEventListener('storage',storage);window.removeEventListener('focus',focus);};
 },[restore,adopt]);
 const save=useCallback((next:LocalState)=>{
  publish(next);
  if(owner.current){dirty.current=true;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void commit().catch(()=>{}),250);}
  else try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{setStorageError(true);}
 },[commit]);
 const update=useCallback((updater:(old:LocalState)=>LocalState,details:EventDetails={})=>{if(!enabled.current)return;const old=current.current;save(recordChanges(old,updater(old),{surface:window.location.pathname,sessionId:session.current,...details}));},[save]);
 const track=useCallback((type:EventType,titleId?:string,details:EventDetails={})=>{
  if(!enabled.current)return;const old=current.current;
  if(['impression','row_impression','title_open'].includes(type)&&old.events.some(e=>e.type===type&&e.titleId===titleId&&e.row===details.row&&e.feedId===details.feedId&&e.surface===(details.surface??window.location.pathname)&&e.sessionId===session.current))return;
  const event=createEvent(type,{surface:details.surface??window.location.pathname,sessionId:session.current,feedId:details.feedId,batch:details.batch,rowPosition:details.rowPosition,context:details.context,row:details.row,rowType:details.rowType,anchorId:details.anchorId,mood:details.mood,position:details.position,sources:details.sources,input:details.input},titleId);
  save({...old,events:[...old.events,event].slice(-2000),revision:old.revision+(['click','title_open','trailer','provider_click'].includes(type)?1:0)});
 },[save]);
 const reset=()=>save({...structuredClone(defaultState),revision:current.current.revision+1});
 const clearHistory=()=>{const old=current.current;save({...old,watched:[],events:old.events.filter(e=>e.type!=='watched'&&e.type!=='unwatched'),signalTimes:Object.fromEntries(Object.entries(old.signalTimes).filter(([key])=>!key.startsWith('watched:'))),revision:old.revision+1});};
 const broadcast=()=>{try{localStorage.setItem('nextscene.auth-change',crypto.randomUUID());}catch{}};
 const authenticate=async(action:'signup'|'login',email:string,password:string,name:string,importLocal:boolean)=>{
  const anonymous=owner.current?structuredClone(defaultState):current.current;enabled.current=false;setReady(false);
  try{
   const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,password,...(action==='signup'?{name}: {})})});let data=await r.json();if(!r.ok)throw new Error(data.error);
   if(importLocal){const merged=await fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:data.user.id,revision:data.revision,state:anonymous,importAnonymous:true})});const payload=await merged.json();if(merged.ok){data={...data,...payload};try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem('nextscene.local.v2');localStorage.removeItem('nextscene.local.v1');}catch{}}else notify('Signed in. Local import did not finish; your local data is still preserved.');}
   adopt(data);broadcast();
  }catch(e){enabled.current=true;setReady(true);throw e;}
 };
 const logout=async()=>{await commit();const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw new Error('Sign out could not finish. Please retry.');adopt({user:null});broadcast();};
 useEffect(()=>{if(notice){const id=setTimeout(()=>notify(''),4000);return()=>clearTimeout(id);}},[notice]);
 return <LocalContext.Provider value={{viewState,providers,providerError,state,update,ready,notice,notify,storageError,user,sessionId,identityKey,syncError,syncing,retrySync:commit,reset,clearHistory,authenticate,logout,track}}><Fragment key={identityKey}>{children}</Fragment>{syncError&&<div className="storage-warning" role="alert">{syncError} <button onClick={()=>void (owner.current?commit():restore()).catch(()=>{})}>Retry</button></div>}<div className={`toast ${notice?'visible':''}`} role="status" aria-live="polite">{notice}</div></LocalContext.Provider>;
}
export function useLocal(){const value=useContext(LocalContext);if(!value)throw new Error('LocalProvider is required');return value;}
