'use client';
import { useEffect } from 'react';
import { getCachedPrograms, getCachedNews } from '../lib/dataService';

// ponytail: warm cache on mount, background fire-and-forget.
// Ceiling: fetches both collections on every hard reload, even if user never visits those pages.
export default function CacheWarmer() {
  useEffect(() => {
    getCachedPrograms();
    getCachedNews();
  }, []);
  return null;
}
