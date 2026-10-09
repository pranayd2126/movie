import type { Metadata } from 'next';
import Link from 'next/link';
import { LocalProvider } from '@/components/local-provider';
import { SignupOnboarding } from '@/components/onboarding';
import { Header } from '@/components/header';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'NextScene — Find your next great watch', template: '%s · NextScene' },
  description: 'A private-by-default, India-first movie and series discovery preview. Real TMDB movies, series and India watch options.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><body><LocalProvider><SignupOnboarding/><Header/>{children}<footer className="site-footer"><Link href="/" className="footer-brand">nextscene<span>.</span></Link><span>A little less scrolling. A little more cinema.</span><div><Link href="/credits">Data & credits</Link><Link href="/settings">Privacy</Link><span>Made for India.</span></div></footer></LocalProvider></body></html>;
}
