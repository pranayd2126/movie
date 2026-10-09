import { parseState, type LocalState } from '../library/state';
// Account values win conflicts. Import is deliberate, never automatic on every login.
export function mergeAnonymous(account: LocalState, anonymous: LocalState): LocalState {
  const result = structuredClone(account);
  for (const field of ['services','languages','genres'] as const) if (!result[field].length) result[field] = [...anonymous[field]];
  const accountTouched = new Set([...account.liked,...account.disliked,...account.favorites,...account.saved,...account.dismissed,...Object.keys(account.ratings),...Object.keys(account.signalTimes).flatMap(k => k.includes(':tmdb:') ? [k.slice(k.indexOf(':')+1)] : [])]);
  for (const field of ['liked','disliked','favorites','saved','dismissed'] as const) result[field] = [...new Set([...account[field], ...anonymous[field].filter(id => !accountTouched.has(id))])];
  for (const [id, rating] of Object.entries(anonymous.ratings)) if (!accountTouched.has(id)) result.ratings[id] = rating;
  result.watched = [...account.watched, ...anonymous.watched.filter(w => !account.watched.some(a => a.titleId === w.titleId))];
  result.events = [...new Map([...anonymous.events,...account.events].map(e => [e.id,e])).values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-2000);
  result.signalTimes = { ...anonymous.signalTimes, ...account.signalTimes };
  result.revision++;
  return parseState(JSON.stringify(result));
}

// Rebase only edits made locally since the acknowledged snapshot; preserve independent remote edits.
export function rebaseState(base: LocalState, local: LocalState, remote: LocalState): LocalState {
  const result = structuredClone(remote);
  for (const field of ['liked','disliked','favorites','saved','dismissed','services','languages','genres'] as const) {
    const removed = new Set(base[field].filter(id => !local[field].includes(id)));
    result[field] = [...new Set([...remote[field].filter(id => !removed.has(id)),...local[field].filter(id => !base[field].includes(id))])];
  }
  for (const id of new Set([...Object.keys(base.ratings),...Object.keys(local.ratings)])) if(base.ratings[id]!==local.ratings[id]) { if(local.ratings[id])result.ratings[id]=local.ratings[id];else delete result.ratings[id]; }
  const removed = new Set(base.watched.filter(w=>!local.watched.some(l=>l.titleId===w.titleId)).map(w=>w.titleId));
  result.watched=[...remote.watched.filter(w=>!removed.has(w.titleId)),...local.watched.filter(w=>!remote.watched.some(r=>r.titleId===w.titleId)&&!base.watched.some(b=>b.titleId===w.titleId))];
  result.events=[...new Map([...remote.events,...local.events].map(e=>[e.id,e])).values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-2000);
  result.signalTimes={...remote.signalTimes,...Object.fromEntries(Object.entries(local.signalTimes).filter(([k,v])=>v!==base.signalTimes[k]))};
  if(base.onboarding!==local.onboarding)result.onboarding=local.onboarding;
  if(base.onboardingDismissed!==local.onboardingDismissed)result.onboardingDismissed=local.onboardingDismissed;
  if(base.useHistory!==local.useHistory)result.useHistory=local.useHistory;
  result.revision=Math.max(local.revision,remote.revision)+1;
  return result;
}
