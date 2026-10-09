import Link from 'next/link';
import { CatalogError } from '@/adapters/tmdb/client';
import { RetryTitle } from '@/components/retry-title';
import { notFound } from 'next/navigation';
import { getCatalogSource } from '@/server/catalog';
import { TitleDetail } from '@/components/detail';
type Props = { params: Promise<{ kind: string; id: string }> };
export const dynamic = 'force-dynamic';
async function resolve(params: Props['params']) {
  const { id, kind } = await params;
  if (!['movie', 'series'].includes(kind) || !/^[1-9]\d{0,9}$/.test(id)) return undefined;
  return getCatalogSource().get(`tmdb:${kind === 'movie' ? 'movie' : 'tv'}:${id}`);
}
export async function generateMetadata({ params }: Props) {
  const title = await resolve(params).catch(e=>{if(e instanceof CatalogError)return null;throw e;});
  return title ? { title: title.name, description: title.synopsis } : { title: title===null ? 'Title data unavailable' : 'Title not found' };
}
export default async function Page({ params }: Props) {
  const title = await resolve(params).catch(e=>{if(e instanceof CatalogError)return null;throw e;});
  if (title===null) return <main id="main" className="page-shell"><div className="empty-state"><h1>Title data is temporarily unavailable.</h1><p>Your private library is still saved. Retry when the data provider is available.</p><RetryTitle/><Link className="text-button" href="/library">Your private library</Link></div></main>;
  if (!title) notFound();
  return <TitleDetail title={title} catalog={[]}/>;
}
