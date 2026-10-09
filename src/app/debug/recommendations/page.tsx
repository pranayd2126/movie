import { notFound } from 'next/navigation';
import { Catalog } from '@/components/catalog';
export const dynamic='force-dynamic';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <Catalog catalog={[]} view="for-you" debug/>;}
