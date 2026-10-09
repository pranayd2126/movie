import { Catalog } from '@/components/catalog';
export const metadata = { title: 'For you' };
export const dynamic = 'force-dynamic';
export default async function ForYou() { return <Catalog catalog={[]} view="for-you"/>; }
