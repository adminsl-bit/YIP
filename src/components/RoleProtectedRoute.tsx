import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedUserType: 'student' | 'jury' | 'organizer' | 'super_admin';
  allowedRole?: 'admin_student' | 'journalist';
}

export const RoleProtectedRoute = ({ children, allowedUserType, allowedRole }: RoleProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const [roleChecked, setRoleChecked] = useState(false);
  const [hasRole, setHasRole] = useState(false);

  useEffect(() => {
    if (!loading && profile) {
      // Check if user has the required role (if specified)
      if (allowedRole) {
        import('@/hooks/useUserRole').then(({ useUserRole }) => {
          // We can't use hooks conditionally, so we'll check directly in the database
          import('@/integrations/supabase/client').then(({ supabase }) => {
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user?.id)
              .eq('role', allowedRole)
              .single()
              .then(({ data }) => {
                setHasRole(!!data);
                setRoleChecked(true);
              });
          });
        });
      } else {
        setRoleChecked(true);
        setHasRole(true);
      }
    }
  }, [loading, profile, user, allowedRole]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading Young Indians Parliament...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has the required user_type
  if (profile?.user_type !== allowedUserType) {
    return <Navigate to="/" replace />;
  }

  // If a specific role is required, wait for role check and verify
  if (allowedRole && !roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  if (allowedRole && !hasRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
