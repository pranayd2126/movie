import 'server-only';
import { tmdbCatalog } from '@/adapters/tmdb/catalog';
import type { CatalogSource } from '@/modules/catalog/types';
export function getCatalogSource(): CatalogSource { return tmdbCatalog; }
