import type { LocalState } from '../library/state';
import type { Filters } from './rank';
export const FEED={initialRows:8,nextRows:4,maxRows:24,maxPages:6,maxBatches:6,maxCandidates:360,titlesPerRow:6,maxEmptyBatches:2,minimumQuality:.55,explorationStep:.05,maxExplorationBonus:.2,ttlMs:30*60*1000,maxFeeds:32} as const;
// Feedback is deliberately absent: future batches use new evidence, visible rows stay stable.
export function discoveryContext(filters:Filters,state:Pick<LocalState,'services'|'languages'|'genres'>){
 return JSON.stringify([filters,[...state.services].sort(),[...state.languages].sort(),[...state.genres].sort()]);
}
