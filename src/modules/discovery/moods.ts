import type { Title } from '../catalog/types';
// Editorial inference from actual genres/keywords, not a field supplied by TMDB.
export const moodDefinitions = [
 {id:'Mind-bending',label:'Mind-bending',genres:['Science Fiction','Mystery','Sci-Fi & Fantasy'],keywords:['time travel','parallel universe','dream','alternate reality','psychological','time loop'],exclude:['slapstick'],threshold:.65},
 {id:'Edge of my seat',label:'Suspenseful',genres:['Thriller','Mystery','Crime'],keywords:['suspense','conspiracy','investigation','serial killer'],exclude:[],threshold:.55},
 {id:'Feel-good',label:'Feel Good',genres:['Comedy','Family'],keywords:['friendship','feel good','inspiring','reunion','hope'],exclude:['tragedy','suicide','torture','serial killer','grief'],threshold:.55},
 {id:'Funny',label:'Funny',genres:['Comedy'],keywords:['comedy','satire','slapstick'],exclude:[],threshold:.55},
 {id:'Romantic',label:'Romantic',genres:['Romance'],keywords:['romance','falling in love','romantic comedy'],exclude:[],threshold:.55},
 {id:'Scary',label:'Scary',genres:['Horror'],keywords:['haunted house','supernatural horror','demonic possession'],exclude:[],threshold:.55},
 {id:'Action-packed',label:'Action-Packed',genres:['Action','Action & Adventure'],keywords:['martial arts','rescue mission','car chase'],exclude:[],threshold:.55},
 {id:'A little escape',label:'A little escape',genres:['Adventure','Fantasy','Animation','Sci-Fi & Fantasy','Action & Adventure'],keywords:['magic','fantasy world','quest'],exclude:['torture'],threshold:.55},
] as const;
export type Mood = 'All moods' | typeof moodDefinitions[number]['id'];
export const moods: Mood[] = ['All moods', ...moodDefinitions.map(m=>m.id)];
export const moodLabel = (id:Mood) => moodDefinitions.find(m=>m.id===id)?.label ?? 'All moods';
export function moodMatch(title: Pick<Title,'genres'|'keywords'>, mood:Mood) {
 const definition=moodDefinitions.find(m=>m.id===mood);if(!definition)return {score:0,matches:true,evidence:[] as string[]};
 const keywords=(title.keywords??[]).map(k=>k.toLowerCase());
 const genres=definition.genres.filter(g=>title.genres.includes(g));
 const matched=definition.keywords.filter(k=>keywords.some(v=>v.includes(k)));
 const blocked=definition.exclude.some(k=>keywords.some(v=>v.includes(k))) || (mood==='Feel-good'&&title.genres.some(g=>['Horror','Thriller','Crime'].includes(g)));
 const genreWeight=mood==='Mind-bending'?.22:.6;
 const score=blocked?0:Math.min(1,genres.length*genreWeight+matched.length*.7);
 return {score,matches:score>=definition.threshold,evidence:[...genres,...matched]};
}
export const deriveMoods=(title:Pick<Title,'genres'|'keywords'>):Mood[]=>moodDefinitions.filter(m=>moodMatch(title,m.id).matches).map(m=>m.id);
