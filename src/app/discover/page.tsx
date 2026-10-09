import { Catalog } from '@/components/catalog';
export const metadata = { title: 'Discover' };
export const dynamic = 'force-dynamic';
export default async function Discover() { return <Catalog catalog={[]} view="discover"/>; }
