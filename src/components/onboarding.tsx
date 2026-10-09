'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { languages, languageCode } from '@/modules/catalog/types';
import { catalogGenres } from '@/modules/catalog/preferences';
import { toggleItem } from '@/modules/library/state';
import { Modal, ServicePicker } from './primitives';
import { useLocal } from './local-provider';

export function SignupOnboarding() {
 const {user,ready,state,update,retrySync}=useLocal();
 const [step,setStep]=useState(0),[invite,setInvite]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const router=useRouter();
 if(!ready||!user||state.onboarding!=='pending'&&!invite)return null;
 const finish=async(skipped=false)=>{
  setBusy(true);setError('');setInvite(true);
  update(s=>({...s,onboarding:skipped?'skipped':'completed',onboardingDismissed:true}),{surface:'onboarding'});
  try{await retrySync();if(skipped){setInvite(false);router.push('/');}else setStep(3);}
  catch{setError('Your setup is saved in this visit but has not synced yet. Retry to finish.');}
  finally{setBusy(false);}
 };
 const titles=['What do you like watching?','What are you usually into?','Which services do you use?','Your next scene starts here.'];
 return <Modal wide title={titles[step]} subtitle={step<3?`Step ${step+1} of 3 · Choose a few, or skip. You can edit these in Settings.`:'Your preferences are ready. A few Taste choices can make your picks more personal.'} onClose={()=>{if(!busy){if(step===3)setInvite(false);else void finish(true);}}}>
  {step===0&&<div className="chips wrap onboarding-options">{languages.map(name=><button key={name} className={`chip ${state.languages.includes(languageCode(name))?'selected':''}`} aria-pressed={state.languages.includes(languageCode(name))} onClick={()=>update(s=>({...s,languages:toggleItem(s.languages,languageCode(name))}),{surface:'onboarding'})}>{name}{state.languages.includes(languageCode(name))&&<Check size={14}/>}</button>)}</div>}
  {step===1&&<div className="chips wrap onboarding-options">{catalogGenres.slice(0,18).map(name=><button key={name} className={`chip ${state.genres.includes(name)?'selected':''}`} aria-pressed={state.genres.includes(name)} onClick={()=>update(s=>({...s,genres:toggleItem(s.genres,name)}),{surface:'onboarding'})}>{name}</button>)}</div>}
  {step===2&&<ServicePicker compact selected={state.services} onChange={id=>update(s=>({...s,services:toggleItem(s.services,id)}),{surface:'onboarding'})}/>}
  {step<3&&<p className="small-note">These are private starting preferences, not limits on what you can discover. No OTT passwords needed.</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="modal-actions onboarding-actions">{step<3?<><button className="text-button" disabled={busy} onClick={()=>void finish(true)}>Skip for now</button>{step>0&&<button className="button secondary" disabled={busy} onClick={()=>setStep(s=>s-1)}>Back</button>}<button className="button primary" disabled={busy} onClick={()=>step<2?setStep(s=>s+1):void finish()}>{busy?'Saving…':step===2?'Start discovering':'Next'}</button></>:<><button className="button secondary" onClick={()=>{setInvite(false);router.push('/');}}>Maybe later</button><Link className="button primary" href="/taste" onClick={()=>setInvite(false)}>Try Taste <Sparkles size={15}/></Link></>}</div>
 </Modal>;
}
