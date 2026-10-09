import { getCatalogSource } from '@/server/catalog';
import { Library } from '@/components/personal';
export const metadata = { title: 'Your private library' };
export default async function Page() { return <Library catalog={[]}/>; }
