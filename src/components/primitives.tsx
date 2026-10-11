'use client';
import { useEffect, useRef, useState, useId, type ReactNode, type CSSProperties } from 'react';
import { X, Check, Plus, Film } from 'lucide-react';
import Image from 'next/image';
import { useLocal } from './local-provider';
import { type ProviderId, type Title } from '@/modules/catalog/types';

export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    const prior = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prior; dialog?.close(); queueMicrotask(()=>{if(opener?.isConnected)opener.focus({preventScroll:true});}); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) { const r = ref.current!.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }} aria-labelledby={titleId}>
    <div className="modal-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={22}/></button></div>{children}
  </dialog>;
}
export function ServiceLogo({ id, className = '' }: { id: ProviderId; className?: string }) {
  const { providers } = useLocal();
  const provider = providers.find(p => p.id === id);
  if (!provider) return <span className={`service-logo ${className}`} aria-label="Streaming service"><Film size={16}/></span>;
  if (provider.logoUrl) return <span className={`service-logo ${className}`} title={provider.name}><Image src={provider.logoUrl} alt={provider.name} width={36} height={36}/></span>;
  return <span className={`service-logo logo-${id} ${className}`} style={{ '--service-color': provider.color } as CSSProperties} aria-label={provider.name}>{provider.short}</span>;
}
export function ServicePicker({ selected, onChange, compact=false }: { selected: ProviderId[]; onChange: (id: ProviderId) => void; compact?:boolean }) {
  const { providers, providerError } = useLocal();
  const [expanded,setExpanded]=useState(false);
  if (!providers.length) return <p role="status">{providerError ? "Services could not be loaded. Close and refresh to retry." : "Loading services available in India…"}</p>;
  return <><div className="service-picker">{providers.filter(p => !p.addon).filter((p,index)=>!compact||expanded||index<8||selected.includes(p.id)).map(p => <button key={p.id} className={`service-option ${selected.includes(p.id) ? 'selected' : ''}`} onClick={() => onChange(p.id)} aria-pressed={selected.includes(p.id)}><ServiceLogo id={p.id}/><span>{p.name}</span>{selected.includes(p.id) ? <Check size={17}/> : <Plus size={17}/>}</button>)}</div>{compact&&<button className="text-button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show fewer services':'More services'}</button>}</>;
}
export function PosterArt({ title, className = '', eager = false }: { title: Title; className?: string; eager?: boolean }) {
  const [failedUrl,setFailedUrl] = useState<string>();
  return <div className={`poster-art real-poster ${className}`} aria-hidden="true">{title.posterUrl && failedUrl !== title.posterUrl ? <Image onError={()=>setFailedUrl(title.posterUrl)} src={title.posterUrl} alt="" fill loading={eager ? 'eager' : 'lazy'} sizes={eager ? '330px' : '(max-width: 600px) 45vw, (max-width: 1000px) 28vw, 220px'}/> : <div className="poster-placeholder"><Film size={32}/><span>{title.name}</span><small>Artwork unavailable</small></div>}</div>;
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Film size={28}/></div><h2>{title}</h2><p>{children}</p>{action}</div>;
}
