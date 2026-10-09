'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="page-shell"><div className="empty-state"><h1>A brief intermission.</h1><p>Something went wrong while loading this view. Your saved browser data hasn’t been cleared.</p><button className="button primary" onClick={reset}>Try again</button></div></main>; }
