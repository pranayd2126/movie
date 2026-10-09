import type { LocalState } from '../library/state';
export const SWIPE = { distanceRatio: .24, minimumDistance: 72, velocity: .65, velocityDistance: 36, tapDistance: 8, velocityWindowMs: 90, exitMs: 240, springStiffness: 280, springDamping: 27, bufferSize: 12, refillAt: 5, refreshEvery: 4 } as const;
export type SwipeDecision = 'like' | 'not_interested';
const fields = ['liked', 'disliked', 'dismissed'] as const;
export type SwipeUndo = { titleId: string; before: Record<typeof fields[number], boolean>; after: Record<typeof fields[number], boolean> };
export function swipeDecision(dx: number, dy: number, width: number, elapsedMs: number, releaseVelocity?: number): SwipeDecision | null {
  if (Math.abs(dy) > Math.abs(dx)) return null;
  const distance = Math.abs(dx);
  const crossed = distance >= Math.max(SWIPE.minimumDistance, width * SWIPE.distanceRatio);
  const velocity = releaseVelocity ?? dx / Math.max(elapsedMs, 1);
  const flick = distance >= SWIPE.velocityDistance && Math.abs(velocity) >= SWIPE.velocity && Math.sign(velocity) === Math.sign(dx);
  return crossed || flick ? dx > 0 ? 'like' : 'not_interested' : null;
}
export function isCardTap(maxMovement: number, cancelled = false) { return !cancelled && maxMovement <= SWIPE.tapDistance; }
export function springStep(position: number, velocity: number, dt: number) {
  const v = velocity + (-SWIPE.springStiffness * position - SWIPE.springDamping * velocity) * dt;
  return { position: position + v * dt, velocity: v };
}
export function applySwipe(state: LocalState, titleId: string, decision: SwipeDecision): { state: LocalState; undo: SwipeUndo } {
  const before = Object.fromEntries(fields.map(key => [key, state[key].includes(titleId)])) as SwipeUndo['before'];
  const next = decision === 'like' ? { ...state, liked: [...new Set([...state.liked, titleId])], disliked: state.disliked.filter(id => id !== titleId), dismissed: state.dismissed.filter(id => id !== titleId) } : { ...state, dismissed: [...new Set([...state.dismissed, titleId])] };
  const after = Object.fromEntries(fields.map(key => [key, next[key].includes(titleId)])) as SwipeUndo['after'];
  return { state: next, undo: { titleId, before, after } };
}
export function undoSwipe(state: LocalState, undo: SwipeUndo): LocalState {
  const next = { ...state };
  for (const key of fields) {
    // Revert only this decision's change, preserving unrelated and later edits.
    if (undo.before[key] === undo.after[key] || state[key].includes(undo.titleId) !== undo.after[key]) continue;
    next[key] = undo.before[key] ? [...new Set([...state[key], undo.titleId])] : state[key].filter(id => id !== undo.titleId);
  }
  return next;
}
