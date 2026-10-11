'use client';
import {useRef, type ReactNode} from 'react';
import {ArrowLeft, ArrowRight} from 'lucide-react';

/** Presentation-only carousel. Ranking, impressions and feedback stay in callers. */
export function PosterRail({label,children}:{label:string;children:ReactNode}) {
 const rail=useRef<HTMLDivElement>(null);
 const move=(direction:number)=>{
  const element=rail.current;if(!element)return;
  element.scrollBy({left:direction*element.clientWidth*.85,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 return <div className="poster-rail"><div className="rail-controls"><button aria-label={`Previous titles in ${label}`} onClick={()=>move(-1)}><ArrowLeft size={17}/></button><button aria-label={`Next titles in ${label}`} onClick={()=>move(1)}><ArrowRight size={17}/></button></div><div className="row-posters" ref={rail} tabIndex={0} role="region" aria-label={`${label} titles`}>{children}</div></div>;
}
