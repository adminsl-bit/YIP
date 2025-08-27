import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, LogOut, Filter, Search, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DuplicateLogin {
  user_id: string;
  name: string;
  email: string;
  position: string;
  is_duplicate_session: boolean;
  session_id: string;
  previous_session_id?: string;
  last_login_at: string;
}

export const DuplicateLoginMonitor = () => {
  const [duplicateLogins, setDuplicateLogins] = useState<DuplicateLogin[]>([]);
  const [filteredLogins, setFilteredLogins] = useState<DuplicateLogin[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDuplicateLogins();
    
    // Set up real-time subscription for login audit
    const subscription = supabase
      .channel('login_audit_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'login_audit' },
        () => {
          fetchDuplicateLogins();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [duplicateLogins, searchTerm, statusFilter]);

  const fetchDuplicateLogins = async () => {
    try {
      // Get users with potential duplicate sessions
      const { data: auditData, error: auditError } = await supabase
        .from('login_audit')
        .select(`
          user_id,
          is_duplicate_session,
          session_id,
          previous_session_id,
          created_at
        `)
        .eq('is_duplicate_session', true)
        .order('created_at', { ascending: false });

      if (auditError) throw auditError;

      // Get profile information for these users
      if (auditData && auditData.length > 0) {
        const userIds = [...new Set(auditData.map(item => item.user_id))];
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, name, email, position, last_login_at')
          .in('user_id', userIds);

        if (profileError) throw profileError;

        // Combine audit and profile data
        const combinedData: DuplicateLogin[] = auditData.map(audit => {
          const profile = profileData?.find(p => p.user_id === audit.user_id);
          return {
            user_id: audit.user_id,
            name: profile?.name || 'Unknown',
            email: profile?.email || 'Unknown',
            position: profile?.position || 'Unknown',
            is_duplicate_session: audit.is_duplicate_session,
            session_id: audit.session_id,
            previous_session_id: audit.previous_session_id,
            last_login_at: profile?.last_login_at || audit.created_at
          };
        });

        setDuplicateLogins(combinedData);
      } else {
        setDuplicateLogins([]);
      }
    } catch (error) {
      console.error('Error fetching duplicate logins:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = duplicateLogins;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(login =>
        login.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        login.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        login.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter === "recent") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      filtered = filtered.filter(login => new Date(login.last_login_at) > oneHourAgo);
    }

    setFilteredLogins(filtered);
  };

  const forceLogoutUser = async (userId: string, userName: string) => {
    try {
      // Clear user's session in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ session_id: null })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Log the force logout action
      await supabase.rpc('log_audit_event', {
        p_user_id: userId,
        p_action: 'force_logout',
        p_resource_type: 'user_session',
        p_resource_id: userId,
        p_details: { forced_by_organizer: true }
      });

      toast({
        title: "User Logged Out",
        description: `${userName} has been forcefully logged out from all sessions`
      });

      // Refresh the list
      fetchDuplicateLogins();
    } catch (error) {
      console.error('Error forcing logout:', error);
      toast({
        title: "Error",
        description: "Failed to logout user",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Duplicate Login Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5" />
          <span>Duplicate Login Monitor</span>
          <Badge variant="secondary">{duplicateLogins.length} incidents</Badge>
        </CardTitle>
        
        {/* Filters */}
        <div className="flex space-x-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, email, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="recent">Last Hour</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLogins.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Session Info</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogins.map((login, index) => (
                <TableRow key={`${login.user_id}-${index}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{login.name}</div>
                      <div className="text-sm text-muted-foreground">{login.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{login.position}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Duplicate Session
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1 text-sm">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(login.last_login_at).toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Current: {login.session_id.substring(0, 8)}...</div>
                      {login.previous_session_id && (
                        <div className="text-muted-foreground">
                          Previous: {login.previous_session_id.substring(0, 8)}...
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => forceLogoutUser(login.user_id, login.name)}
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Force Logout
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No duplicate login incidents detected.</p>
            <p className="text-sm mt-1">This monitor tracks users with multiple active sessions.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};