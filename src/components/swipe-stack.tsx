'use client';
import Link from 'next/link';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type PointerEvent } from 'react';
import type { Title } from '@/modules/catalog/types';
import { titlePath } from '@/modules/catalog/types';
import { SWIPE, isCardTap, springStep, swipeDecision, type SwipeDecision } from '@/modules/recommendations/swipe';
import { PosterArt } from './primitives';
export type SwipeInput = 'gesture'|'button'|'keyboard';
export type SwipeStackHandle = { choose: (decision: SwipeDecision, input: SwipeInput) => void };
type Props = { watched:boolean;title:Title; next:Title[]; disabled:boolean; restore:number; restoreDirection:SwipeDecision; onBusy:(busy:boolean)=>void; onDecision:(decision:SwipeDecision,input:SwipeInput,next?:Title)=>void; onOpen:()=>void };
type Drag = { id:number;x:number;y:number;at:number;width:number;movement:number;dx:number;dy:number;samples:{x:number;at:number}[] };

// Motion stays in refs and writes only transforms/opacity once per frame.
// No pointer-move React state, recommendation ranking or network work runs here.
export const SwipeStack = forwardRef<SwipeStackHandle,Props>(function SwipeStack(props,ref) {
  const root=useRef<HTMLDivElement>(null), latest=useRef(props);latest.current=props;
  const drag=useRef<Drag|null>(null), frame=useRef(0), motion=useRef(false), x=useRef(0), width=useRef(300);
  const suppressClick=useRef(false), frozenNext=useRef<Title[]>(props.next);
  const restored=useRef(props.restore), reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes=useRef<{active:HTMLElement|null;backs:HTMLElement[];like:HTMLElement|null;pass:HTMLElement|null}>({active:null,backs:[],like:null,pass:null});
  if(!motion.current&&!drag.current)frozenNext.current=props.next;
  const paint=(position:number,opacity=1,progressOverride?:number)=>{
    x.current=position;
    const progress=progressOverride??Math.min(1,Math.abs(position)/Math.max(SWIPE.minimumDistance,width.current*SWIPE.distanceRatio));
    const n=nodes.current;
    if(n.active){n.active.style.transform=`translate3d(${position}px,0,0) rotate(${Math.max(-12,Math.min(12,position/30))}deg)`;n.active.style.opacity=String(opacity);}
    if(n.like)n.like.style.opacity=String(position>0?progress:0);
    if(n.pass)n.pass.style.opacity=String(position<0?progress:0);
    n.backs.forEach((node,index)=>{const depth=index+1-progress;node.style.transform=`translate3d(0,${depth*12}px,0) scale(${1-depth*.045})`;node.style.opacity=String(1-depth*.18);});
  };
  const cancelFrame=()=>cancelAnimationFrame(frame.current);
  const rest=()=>{motion.current=false;paint(0);latest.current.onBusy(false);};
  const spring=(initialVelocity=0)=>{
    cancelFrame();motion.current=true;
    if(reduced()){rest();return;}
    let position=x.current,velocity=initialVelocity,last=performance.now(),start=last;
    const tick=(time:number)=>{
      const dt=Math.min(.032,Math.max(.001,(time-last)/1000));last=time;
      ({position,velocity}=springStep(position,velocity,dt));paint(position);
      if((Math.abs(position)<.15&&Math.abs(velocity)<3)||time-start>900){rest();return;}
      frame.current=requestAnimationFrame(tick);
    };frame.current=requestAnimationFrame(tick);
  };
  const choose=(decision:SwipeDecision,input:SwipeInput,releaseVelocity=0)=>{
    if(motion.current||latest.current.disabled)return;
    cancelFrame();drag.current=null;motion.current=true;suppressClick.current=true;latest.current.onBusy(true);
    width.current=root.current?.clientWidth??width.current;
    const from=x.current,sign=decision==='like'?1:-1;
    const destination=sign*(window.innerWidth/2+width.current+70);
    const duration=Math.max(150,SWIPE.exitMs-Math.min(80,Math.abs(releaseVelocity)*45));
    const start=performance.now(),next=frozenNext.current[0];
    const initialProgress=Math.min(1,Math.abs(from)/Math.max(SWIPE.minimumDistance,width.current*SWIPE.distanceRatio));
    const done=()=>{latest.current.onDecision(decision,input,next);motion.current=false;latest.current.onBusy(false);};
    if(reduced()){done();return;}
    const tick=(time:number)=>{
      const p=Math.min(1,(time-start)/duration);
      // Continue from the released position; accelerate gently beyond the edge.
      const t=.65*p+.35*p*p;
      paint(from+(destination-from)*t,1-Math.max(0,(p-.45)/.55),Math.min(1,initialProgress+(1-initialProgress)*p*2));
      if(p===1){done();return;}frame.current=requestAnimationFrame(tick);
    };frame.current=requestAnimationFrame(tick);
  };
  useImperativeHandle(ref,()=>({choose}));
  useLayoutEffect(()=>{
    cancelFrame();drag.current=null;motion.current=false;
    const el=root.current!;width.current=el.clientWidth;
    nodes.current={active:el.querySelector('[data-active="true"]'),backs:[...el.querySelectorAll<HTMLElement>('[data-depth]')].sort((a,b)=>Number(a.dataset.depth)-Number(b.dataset.depth)),like:el.querySelector('[data-like]'),pass:el.querySelector('[data-pass]')};
    // Keep click suppression until the next genuine pointer down, even if a new
    // card replaced the old one before the browser dispatches its click event.
    paint(0);latest.current.onBusy(false);
    if(restored.current!==props.restore){restored.current=props.restore;paint((props.restoreDirection==='like'?1:-1)*width.current*.65);latest.current.onBusy(true);spring();}
    return cancelFrame;
  },[props.title.id,props.restore]);
  useLayoutEffect(()=>{if(!motion.current&&!drag.current){nodes.current.backs=[...root.current!.querySelectorAll<HTMLElement>('[data-depth]')].sort((a,b)=>Number(a.dataset.depth)-Number(b.dataset.depth));paint(0);}},[props.next.map(t=>t.id).join('|')]);
  const finish=(event:PointerEvent<HTMLAnchorElement>,cancelled=false)=>{
    const d=drag.current;if(!d||d.id!==event.pointerId)return;drag.current=null;
    const now=performance.now();d.dx=event.clientX-d.x;d.dy=event.clientY-d.y;d.movement=Math.max(d.movement,Math.hypot(d.dx,d.dy));
    suppressClick.current=!isCardTap(d.movement,cancelled);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    const sample=d.samples.find(s=>now-s.at<=SWIPE.velocityWindowMs)??{x:event.clientX,at:now};
    const velocity=(event.clientX-sample.x)/Math.max(1,now-sample.at);
    const decision=cancelled||latest.current.disabled?null:swipeDecision(d.dx,d.dy,d.width,now-d.at,velocity);
    cancelFrame();
    if(isCardTap(d.movement,cancelled)){rest();}
    else if(decision){paint(d.dx);choose(decision,'gesture',velocity);}
    else if(Math.abs(x.current)>.1){spring(velocity*1000);}
    else latest.current.onBusy(false);
  };
  const titles=[props.title,...frozenNext.current.slice(0,2)];
  return <div className="swipe-motion-stack" ref={root}>{titles.map((title,index)=>{
    const content=<><PosterArt title={title} eager/><div className="taste-card-shade"/><span className="taste-kind">{title.kind==='series'?'SERIES':'FILM'}{index===0&&props.watched?' · WATCHED':''}</span><span aria-hidden="true" className="taste-direction" data-like>LIKE</span><span aria-hidden="true" className="taste-direction pass" data-pass>NOT INTERESTED</span><div className="taste-card-copy"><h2>{title.name}</h2><p>{[title.year||undefined,title.language,title.genres[0]].filter(Boolean).join(' · ')}</p></div></>;
    return <Link key={title.id} href={titlePath(title)} prefetch={false} className={`taste-card motion-card ${index ? 'motion-back' : ''}`} data-active={index===0 ? 'true' : undefined} data-depth={index || undefined} data-title-id={title.id} aria-hidden={index ? true : undefined} tabIndex={index ? -1 : 0} style={{zIndex:3-index,...(index ? {transform:`translate3d(0,${index*12}px,0) scale(${1-index*.045})`,opacity:1-index*.18} : {})}} aria-label={`View details for ${title.name}`}
      onClick={event=>{if(motion.current||(suppressClick.current&&event.detail!==0)){event.preventDefault();return;}if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(index===0&&(!suppressClick.current||event.detail===0)&&!motion.current)latest.current.onOpen();}}
      onPointerDown={event=>{if(index!==0||motion.current||event.button!==0||!event.isPrimary)return;cancelFrame();width.current=root.current?.clientWidth??width.current;suppressClick.current=false;const at=performance.now();drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,at,width:width.current,movement:0,dx:0,dy:0,samples:[{x:event.clientX,at}]};frozenNext.current=latest.current.next;event.currentTarget.setPointerCapture(event.pointerId);latest.current.onBusy(true);}}
      onPointerMove={event=>{const d=drag.current;if(!d||event.pointerId!==d.id)return;d.dx=event.clientX-d.x;d.dy=event.clientY-d.y;d.movement=Math.max(d.movement,Math.hypot(d.dx,d.dy));const at=performance.now();d.samples.push({x:event.clientX,at});d.samples=d.samples.filter(s=>at-s.at<=SWIPE.velocityWindowMs);cancelFrame();frame.current=requestAnimationFrame(()=>paint(!latest.current.disabled&&Math.abs(d.dx)>Math.abs(d.dy)?d.dx:0));}}
      onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)} onDragStart={event=>event.preventDefault()}>{content}</Link>;
  })}</div>;
});
