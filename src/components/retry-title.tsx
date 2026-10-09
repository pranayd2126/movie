'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
export function RetryTitle() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="button secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? 'Retrying…' : 'Try again'}</button>;
}
