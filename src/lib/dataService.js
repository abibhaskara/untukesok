import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';

// ponytail: localStorage cache layer, TTL 5 menit.
// Ceiling: tidak sync antar tab jika admin update data. Upgrade: BroadcastChannel.
const TTL = 5 * 60 * 1000;

const lsGet = (key) => {
  try {
    const raw = typeof window !== 'undefined' && localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
};

const lsSet = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
};

const cache = {
  news: null,
  programs: null,
  newsDetails: {},
  programDetails: {}
};

export const clearCache = (type) => {
  if (!type) {
    Object.assign(cache, { news: null, programs: null, newsDetails: {}, programDetails: {} });
    ['ue_news', 'ue_programs'].forEach(k => { try { localStorage.removeItem(k); } catch {} });
  } else {
    cache[type] = null;
    cache[type + 'Details'] = {};
    try { localStorage.removeItem('ue_' + type); } catch {}
  }
};

export const getCachedNews = async (forceRefresh = false) => {
  if (!forceRefresh && cache.news) return cache.news;
  if (!forceRefresh) {
    const stored = lsGet('ue_news');
    if (stored) { cache.news = stored; return stored; }
  }
  try {
    const snap = await getDocs(collection(db, 'news'));
    cache.news = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lsSet('ue_news', cache.news);
    return cache.news;
  } catch (err) {
    console.warn("Error fetching news:", err);
    return [];
  }
};

export const getCachedPrograms = async (forceRefresh = false, includeDrafts = false) => {
  if (!forceRefresh && cache.programs) {
    if (includeDrafts) return cache.programs;
    return cache.programs.filter(p => p.status !== 'draft' && p.status !== 'Draft' && !p.isDraft);
  }
  if (!forceRefresh) {
    const stored = lsGet('ue_programs');
    if (stored) {
      cache.programs = stored;
      if (includeDrafts) return stored;
      return stored.filter(p => p.status !== 'draft' && p.status !== 'Draft' && !p.isDraft);
    }
  }
  try {
    const snap = await getDocs(collection(db, 'programs'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' }));
    cache.programs = list;
    lsSet('ue_programs', list);
    if (includeDrafts) return cache.programs;
    return cache.programs.filter(p => p.status !== 'draft' && p.status !== 'Draft' && !p.isDraft);
  } catch (err) {
    console.warn("Error fetching programs from Firestore:", err);
    return [];
  }
};

export const getCachedNewsDetail = async (id, forceRefresh = false) => {
  if (!forceRefresh && cache.newsDetails[id]) return cache.newsDetails[id];
  try {
    const snap = await getDoc(doc(db, 'news', id));
    if (snap.exists()) {
      cache.newsDetails[id] = { id: snap.id, ...snap.data() };
      return cache.newsDetails[id];
    }
  } catch (err) {
    console.warn("Error fetching news detail:", err);
  }
  return null;
};

export const getCachedProgramDetail = async (idOrSlug, forceRefresh = false, allowDraft = false) => {
  if (!idOrSlug) return null;

  if (!forceRefresh && cache.programDetails[idOrSlug]) {
    const p = cache.programDetails[idOrSlug];
    if (!allowDraft && (p.status === 'draft' || p.status === 'Draft' || p.isDraft)) return null;
    return p;
  }

  // Check cache.programs first
  if (!forceRefresh && cache.programs) {
    const found = cache.programs.find(p => p.id === idOrSlug || p.slug === idOrSlug);
    if (found) {
      cache.programDetails[idOrSlug] = found;
      if (found.id) cache.programDetails[found.id] = found;
      if (found.slug) cache.programDetails[found.slug] = found;
      if (!allowDraft && (found.status === 'draft' || found.status === 'Draft' || found.isDraft)) return null;
      return found;
    }
  }

  try {
    // 1. Try finding by direct doc ID
    try {
      const snap = await getDoc(doc(db, 'programs', idOrSlug));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        cache.programDetails[idOrSlug] = data;
        cache.programDetails[snap.id] = data;
        if (data.slug) cache.programDetails[data.slug] = data;
        if (!allowDraft && (data.status === 'draft' || data.status === 'Draft' || data.isDraft)) return null;
        return data;
      }
    } catch {
      // idOrSlug might not be a valid doc id or doc not found, proceed to slug search
    }

    // 2. Try querying by custom slug field
    const q = query(collection(db, 'programs'), where('slug', '==', idOrSlug));
    const snapSlug = await getDocs(q);
    if (!snapSlug.empty) {
      const docSnap = snapSlug.docs[0];
      const data = { id: docSnap.id, ...docSnap.data() };
      cache.programDetails[idOrSlug] = data;
      cache.programDetails[docSnap.id] = data;
      if (data.slug) cache.programDetails[data.slug] = data;
      if (!allowDraft && (data.status === 'draft' || data.status === 'Draft' || data.isDraft)) return null;
      return data;
    }
  } catch (err) {
    console.warn("Error fetching program detail from Firestore:", err);
  }
  return null;
};

export const getCachedStats = async () => {
  try {
    const [usersSnap, appsSnap, programsData] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'applications')),
      getCachedPrograms()
    ]);

    const usersCount = usersSnap.size;
    const activeApps = appsSnap.docs.filter(d => d.data().status !== 'Dibatalkan');
    const appsCount = activeApps.length;

    const programVolunteersSum = programsData.reduce((acc, p) => acc + (Number(p.volunteersJoined) || 0), 0);

    return {
      totalPrograms: programsData.length,
      totalUsers: Math.max(usersCount, appsCount),
      totalContributions: Math.max(appsCount, programVolunteersSum)
    };
  } catch (err) {
    console.warn("Error fetching stats:", err);
    return {
      totalPrograms: 0,
      totalUsers: 0,
      totalContributions: 0
    };
  }
};
