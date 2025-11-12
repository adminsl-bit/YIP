import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin_student' | 'journalist';

export const useUserRole = (userId: string | undefined) => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (error) throw error;
        setRoles(data?.map(r => r.role as AppRole) || []);
      } catch (error) {
        console.error('Error fetching user roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [userId]);

  const hasRole = (role: AppRole) => roles.includes(role);

  return { roles, hasRole, loading };
};
