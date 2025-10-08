import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  user_type: string;
}

const CACHE_KEY = 'parliament_students_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  students: Student[];
  timestamp: number;
}

export const useStudentCache = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCacheValid = useCallback((cacheData: CacheData | null): boolean => {
    if (!cacheData) return false;
    return Date.now() - cacheData.timestamp < CACHE_DURATION;
  }, []);

  const getFromCache = useCallback((): CacheData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, []);

  const saveToCache = useCallback((students: Student[]) => {
    try {
      const cacheData: CacheData = {
        students,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }, []);

  const fetchStudents = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      
      // Check cache first
      if (!forceRefresh) {
        const cached = getFromCache();
        if (isCacheValid(cached)) {
          setStudents(cached!.students);
          setLoading(false);
          return cached!.students;
        }
      }

      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, user_id, name, position, party_number, party_name, serial_number, constituency, state, city, photo_url, user_type')
        .eq('user_type', 'student')
        .order('party_number', { ascending: true })
        .order('serial_number', { ascending: true });

      if (fetchError) throw fetchError;

      const studentsData = data || [];
      setStudents(studentsData);
      saveToCache(studentsData);
      
      return studentsData;
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch students');
      
      // Fallback to cache if available
      const cached = getFromCache();
      if (cached) {
        setStudents(cached.students);
      }
      
      return [];
    } finally {
      setLoading(false);
    }
  }, [getFromCache, isCacheValid, saveToCache]);

  const invalidateCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return {
    students,
    loading,
    error,
    refetch: (forceRefresh = false) => fetchStudents(forceRefresh),
    invalidateCache
  };
};