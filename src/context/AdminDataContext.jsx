'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePathname } from 'next/navigation';

const AdminDataContext = createContext(null);

export function AdminDataProvider({ children, enabled = true }) {
  const pathname = usePathname();
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [rawApplications, setApplications] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track what has been loaded to avoid redundant full-database downloads
  const loadedRef = useRef({
    users: false,
    programs: false,
    applications: false,
    expenses: false
  });

  // Lazy load specific collections only when required by the active view
  const loadCollections = useCallback(async (targets = ['applications', 'programs']) => {
    if (!enabled) return;
    setIsLoading(true);

    try {
      const promises = [];
      const keys = [];

      if (targets.includes('programs') && !loadedRef.current.programs) {
        keys.push('programs');
        promises.push(
          getDocs(collection(db, 'programs')).catch(() => ({ docs: [] }))
        );
      }

      if (targets.includes('applications') && !loadedRef.current.applications) {
        keys.push('applications');
        promises.push(
          getDocs(collection(db, 'applications')).catch(() => ({ docs: [] }))
        );
      }

      if (targets.includes('users') && !loadedRef.current.users) {
        keys.push('users');
        promises.push(
          getDocs(collection(db, 'users')).catch(() => ({ docs: [] }))
        );
      }

      if (targets.includes('expenses') && !loadedRef.current.expenses) {
        keys.push('expenses');
        promises.push(
          getDocs(collection(db, 'expenses')).catch(() => ({ docs: [] }))
        );
      }

      if (promises.length === 0) {
        setIsLoading(false);
        return;
      }

      const results = await Promise.all(promises);

      results.forEach((snap, idx) => {
        const key = keys[idx];
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (key === 'programs') {
          setPrograms(list);
          loadedRef.current.programs = true;
        } else if (key === 'applications') {
          list.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
          setApplications(list);
          loadedRef.current.applications = true;
        } else if (key === 'users') {
          setUsers(list);
          loadedRef.current.users = true;
        } else if (key === 'expenses') {
          setExpenses(list);
          loadedRef.current.expenses = true;
        }
      });
    } catch (err) {
      console.error('Lazy AdminDataContext fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  // Enrich applications with latest user profile data if users have been loaded
  const applications = useMemo(() => {
    if (!users.length) return rawApplications;
    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = u;
    });
    return rawApplications.map(app => {
      const u = userMap[app.userId];
      if (!u) return app;
      return {
        ...app,
        userName: u.name || u.displayName || app.userName || 'Relawan',
        userPhone: u.phone || app.userPhone || '',
        userEmail: u.email || app.userEmail || ''
      };
    });
  }, [rawApplications, users]);

  // On route change, only load collections needed by that specific page
  useEffect(() => {
    if (!enabled) return;

    if (pathname === '/admin') {
      // Dashboard needs overview summary
      loadCollections(['programs', 'applications', 'expenses', 'users']);
    } else if (pathname === '/admin/analitik') {
      // Analytics needs programs, applications, users
      loadCollections(['programs', 'applications', 'users']);
    } else if (pathname === '/admin/ulasan') {
      // Reviews only needs feedback applications & programs
      loadCollections(['applications', 'programs']);
    } else {
      // Other pages manage their own isolated queries with pagination; only load applications once for sidebar badge if needed
      if (!loadedRef.current.applications) {
        loadCollections(['applications']);
      }
    }
  }, [pathname, enabled, loadCollections]);

  // Manual refresh that forces re-fetch of loaded collections
  const refreshAdminData = useCallback(async () => {
    loadedRef.current = { users: false, programs: false, applications: false, expenses: false };
    if (pathname === '/admin' || pathname === '/admin/analitik') {
      await loadCollections(['programs', 'applications', 'expenses', 'users']);
    } else {
      await loadCollections(['applications', 'programs']);
    }
  }, [loadCollections, pathname]);

  return (
    <AdminDataContext.Provider
      value={{
        users,
        setUsers,
        programs,
        setPrograms,
        applications,
        setApplications,
        expenses,
        setExpenses,
        isLoading,
        loadCollections,
        refreshAdminData
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminData() {
  return useContext(AdminDataContext);
}
