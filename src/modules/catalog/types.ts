export type ProviderId = string;
export type MediaType = 'movie' | 'tv';
import type { Mood } from '../discovery/moods';
export type { Mood } from '../discovery/moods';
export { moods } from '../discovery/moods';
export type OfferType = 'subscription' | 'rent' | 'buy' | 'addon' | 'free' | 'ads';
export interface Provider { id: ProviderId; name: string; short: string; color: string; logoUrl?: string; addon?: boolean; mediaTypes?: MediaType[] }
export interface Offer { provider: ProviderId; name?: string; logoUrl?: string; region: string; type: OfferType; fixture?: boolean }
export interface Title {
  id: string; name: string; tagline: string; synopsis: string;
  kind: 'movie' | 'series'; year: number; language: string; originalLanguage?: string; genres: string[];
  runtime: number; seasons?: number; rating: number; votes: number; popularity: number;
  art?: number; color?: string; moods: Mood[]; people: string[];
  offers: Offer[]; source: 'fixture' | 'tmdb';
  provenance?: string[]; collectionId?: number; keywordRefs?: {id:number;name:string}[];
  externalId?: number; mediaType?: MediaType; originalTitle?: string;
  posterUrl?: string; backdropUrl?: string; credits?: { id: number; name: string; role: string; image?: string }[];
  creators?: string[]; keywords?: string[]; trailerUrl?: string; certification?: string;
  availabilityStatus?: 'known' | 'unknown' | 'error'; availabilityCheckedAt?: string; watchOptionsUrl?: string;
}
export interface CandidateSpec { id:string; kind:'discover'|'recommendations'|'similar'|'trending'; mediaType:MediaType; language?:string; genre?:string; personId?:number; keywordId?:number; seedId?:number; providers?:string[]; sort?:'popular'|'quality'|'recent'; yearFrom?:number }
export interface CatalogQuery { generators?: CandidateSpec[]; query?: string; kind?: 'all' | 'movie' | 'series'; page?: number; languages?: string[]; providers?: string[]; genre?: string; sort?: 'picks' | 'rating' | 'newest' | 'alphabetical'; seedIds?: string[]; maxRuntime?: number; minRuntime?: number; minRating?: number; year?: number; mood?: Mood }
export interface CatalogPage { titles: Title[]; hasMore: boolean; page: number; total?: number; warnings?: string[] }
export interface CatalogSource { mode: 'fixture' | 'live'; list(query?: CatalogQuery): Promise<Title[]>; get(id: string): Promise<Title | undefined>; search(query?: CatalogQuery): Promise<CatalogPage>; providers(): Promise<Provider[]> }
export const languages = ['Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'English'];
export const languageCodes: Record<string,string> = {Hindi:'hi',Telugu:'te',Tamil:'ta',Malayalam:'ml',Kannada:'kn',Bengali:'bn',Marathi:'mr',English:'en'};
export const languageCode=(value:string)=>languageCodes[value]??value;
export const languageName=(value:string)=>Object.entries(languageCodes).find(([,code])=>code===value)?.[0]??value;
export const sameLanguage=(a:string,b:string)=>languageCode(a)===languageCode(b);
export const titlePath = (title: Title) => title.source === 'tmdb' ? `/${title.kind}/${title.externalId}` : `/${title.kind}/${title.id}`;
export function parseTitleRef(ref: string): { mediaType: MediaType; id: number } | null { const match = /^tmdb:(movie|tv):([1-9]\d{0,9})$/.exec(ref); return match ? { mediaType: match[1] as MediaType, id: Number(match[2]) } : null; }
