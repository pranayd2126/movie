import type { Offer } from '@/modules/catalog/types';

// Exact names intentionally avoid sending channel/add-on offers to a different plan.
const platforms: Record<string, string> = {
  netflix: 'https://www.netflix.com/in/',
  'netflix kids': 'https://www.netflix.com/in/',
  'netflix standard with ads': 'https://www.netflix.com/in/',
  'amazon prime video': 'https://www.primevideo.com/',
  'amazon prime video with ads': 'https://www.primevideo.com/',
  'amazon video': 'https://www.primevideo.com/',
  jiohotstar: 'https://www.hotstar.com/in',
  hotstar: 'https://www.hotstar.com/in',
  zee5: 'https://www.zee5.com/',
  'sony liv': 'https://www.sonyliv.com/',
  'apple tv': 'https://tv.apple.com/in',
  'apple tv+': 'https://tv.apple.com/in',
  'apple tv store': 'https://tv.apple.com/in',
};

export function providerDestination(offer: Offer, watchOptionsUrl?: string) {
  const platform = offer.type !== 'addon' && platforms[offer.name?.trim().toLowerCase() ?? ''];
  if (platform) return { href: platform, label: `Open ${offer.name}`, platform: true };
  // Only accept the title watch URL supplied by our metadata provider.
  if (watchOptionsUrl) {
    try {
      const url = new URL(watchOptionsUrl);
      if (url.protocol === 'https:' && url.hostname === 'www.themoviedb.org') {
        return { href: url.href, label: `See watch options for ${offer.name ?? 'this provider'}`, platform: false };
      }
    } catch { /* A missing or malformed URL must not become a broken link. */ }
  }
  return null;
}
