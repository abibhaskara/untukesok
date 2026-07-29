import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const cache = {
  news: null,
  programs: null,
  newsDetails: {},
  programDetails: {}
};

export const clearCache = (type) => {
  if (type === 'news') {
    cache.news = null;
    cache.newsDetails = {};
  }
  if (type === 'programs') {
    cache.programs = null;
    cache.programDetails = {};
  }
  if (!type) {
    cache.news = null;
    cache.programs = null;
    cache.newsDetails = {};
    cache.programDetails = {};
  }
};

export const getCachedNews = async (forceRefresh = false) => {
  if (!forceRefresh && cache.news) return cache.news;
  try {
    const snap = await getDocs(collection(db, 'news'));
    cache.news = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return cache.news;
  } catch (err) {
    console.warn("Error fetching news:", err);
    return [];
  }
};

export const getCachedPrograms = async (forceRefresh = false) => {
  if (!forceRefresh && cache.programs) return cache.programs;
  try {
    const snap = await getDocs(collection(db, 'programs'));
    cache.programs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return cache.programs;
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

export const getCachedProgramDetail = async (id, forceRefresh = false) => {
  if (!forceRefresh && cache.programDetails[id]) return cache.programDetails[id];
  try {
    const snap = await getDoc(doc(db, 'programs', id));
    if (snap.exists()) {
      cache.programDetails[id] = { id: snap.id, ...snap.data() };
      return cache.programDetails[id];
    }
  } catch (err) {
    console.warn("Error fetching program detail from Firestore:", err);
  }
  return null;
};
