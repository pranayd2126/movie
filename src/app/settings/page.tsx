import { getCatalogSource } from '@/server/catalog';
import { Settings } from '@/components/personal';
export const metadata = { title: 'Privacy and preferences' };
export default async function Page() { return <Settings catalog={[]}/>; }
