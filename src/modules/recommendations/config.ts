export const MODEL_VERSION='dynamic-v3.1';
export const CONFIG={
 signals:{favorite:1,like:.8,watchlist:.25,dislike:-1,click:.07,title_open:.035,trailer:.1,provider_click:.025},
 rating:{1:-1,2:-1,3:-.9,4:-.65,5:-.15,6:0,7:.4,8:.8,9:.9,10:1} as Record<number,number>,
 taste:{prior:2,longHalfLifeDays:180,longFloor:.35,recentHalfLifeDays:7,peopleMinimum:2,actorMinimum:3,weakPerTitleCap:.15},
 features:{genre:.24,language:.16,theme:.14,creator:.13,actor:.07,kind:.06,era:.07,runtime:.05,popularity:.04,combination:.04},
 score:{mood:.35,longTerm:.34,recent:.18,session:.08,explicit:.2,neighbor:.16,quality:.22,popularityCold:.08,popularityWarm:.025,freshness:.04,availability:.08,negative:.32,anchor:.45,repetition:.04},
 rerank:{diversity:.16,franchisePenalty:.14,creatorPenalty:.07,explorationEvery:6,explorationQuality:.67,explorationVotes:80},
 rows:{minimumTitles:3,maximumRows:10,homeRows:5,discoverRows:8,titlesPerRow:8,overlapPenalty:.3,themePenalty:.1,engagementBonus:.12,evidenceBonus:.07,recentBonus:.1,moodBonus:.5,exposurePenalty:.03},
 retrieval:{maxJobs:18,maxCandidates:60,maxSeeds:3},
} as const;
