export type VideoReference = { site: string; key: string; type: string; official?: boolean; iso_639_1?: string; iso_3166_1?: string };
export function selectTrailer(videos: VideoReference[], originalLanguage?: string): string | undefined {
  const candidates = videos.filter(v => v.site === 'YouTube' && v.official && ['Trailer','Teaser'].includes(v.type) && /^[\w-]{11}$/.test(v.key));
  const score = (v: VideoReference) => (v.type === 'Trailer' ? 10 : 0) + (v.iso_639_1 === originalLanguage ? 3 : v.iso_639_1 === 'en' ? 2 : 0) + Number(v.iso_3166_1 === 'IN');
  const selected = candidates.sort((a,b) => score(b)-score(a))[0];
  return selected ? `https://www.youtube.com/watch?v=${selected.key}` : undefined;
}
