'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Bookmark, Compass, Search, Sparkles, Users, Settings2, Globe2, Clapperboard, Layers } from 'lucide-react';
import { useState } from 'react';
import { Modal, ServicePicker } from './primitives';
import { useLocal } from './local-provider';
import type { ProviderId } from '@/modules/catalog/types';

export function ServicesModal({ onClose }: { onClose: () => void }) {
  const { state, update, notify, user } = useLocal();
  const [draft, setDraft] = useState<ProviderId[]>(state.services);
  return <Modal title="Where do you watch?" subtitle="Choose your services. No account connections. No passwords." onClose={onClose}>
    <ServicePicker selected={draft} onChange={id => setDraft(old => old.includes(id) ? old.filter(p => p !== id) : [...old, id])}/>
    <p className="small-note">India providers are supplied by TMDB. “My services” matches base subscription offers only; rentals, purchases and channel add-ons cost extra.</p>
    <div className="modal-actions"><button className="text-button" onClick={() => setDraft([])}>Clear selection</button><button className="button primary" onClick={() => { update(old => ({ ...old, services: draft, onboardingDismissed: true })); notify(user ? 'Services saved to your private account' : 'Services saved on this device'); onClose(); }}>Save {draft.length ? `${draft.length} services` : 'preferences'}</button></div>
  </Modal>;
}
const nav = [{ href: '/', label: 'Home', icon: Home }, { href: '/discover', label: 'Discover', icon: Compass }, { href: '/for-you', label: 'For you', icon: Sparkles }, { href: '/taste', label: 'Taste', icon: Layers }, { href: '/club', label: 'Movie club', icon: Users }, { href: '/library', label: 'My list', icon: Bookmark }];
export function Header() {
  const pathname = usePathname();
  const [services, setServices] = useState(false);
  const { state, storageError, user } = useLocal();
  return <>
    <a href="#main" className="skip-link">Skip to content</a>
    <header className="site-header"><div className="header-inner"><Link href="/" className="brand" aria-label="NextScene home"><span className="brand-mark"><Clapperboard size={23}/></span>nextscene<span className="brand-dot">.</span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{nav.map(n => <Link className={pathname === n.href ? 'active' : ''} href={n.href} key={n.href}>{n.label}{n.href === '/for-you' && <Sparkles size={12}/>}</Link>)}</nav>
      <div className="header-tools"><Link className="header-search" href="/discover" aria-label="Search movies and series"><Search size={18}/><span>Find your next watch</span><kbd>/</kbd></Link><button className="my-services" aria-label={`My services (${state.services.length} selected)`} onClick={() => setServices(true)}><Settings2 size={16}/><span>My services</span>{state.services.length > 0 && <span className="count">{state.services.length}</span>}</button><Link href="/account" className="profile-button" aria-label={user ? "Your account" : "Sign in or create account"}><span>{user ? user.name.slice(0,1).toUpperCase() : "Sign in"}</span></Link></div>
    </div></header>
    <div className="preview-strip"><div><span className="preview-pill">PREVIEW</span><span>Real stories from TMDB. India watch options via JustWatch.</span></div><span className="region"><Globe2 size={13}/> India <span>IN</span></span></div>
    {storageError && <p className="storage-warning" role="alert">Browser storage is unavailable. Your choices will last for this visit only.</p>}
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(n => <Link className={pathname === n.href ? 'active' : ''} href={n.href} key={n.href}><n.icon size={21}/><span>{n.label}</span></Link>)}</nav>
    {services && <ServicesModal onClose={() => setServices(false)}/>}
  </>;
}
