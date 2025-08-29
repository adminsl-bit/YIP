import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, LogOut, Filter, Search, Clock, FileText, Eye, Activity, Shield } from "lucide-react";
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

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: any;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  user_name?: string;
}

interface ActiveUser {
  user_id: string;
  name: string;
  email: string;
  position: string;
  user_type: string;
  last_login_at: string;
  session_id?: string;
  is_active: boolean;
}

export const SecurityLogsManager = () => {
  const [duplicateLogins, setDuplicateLogins] = useState<DuplicateLogin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("audit");

  useEffect(() => {
    fetchAllData();
    
    // Set up real-time subscriptions
    const loginSubscription = supabase
      .channel('login_audit_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'login_audit' },
        () => {
          fetchDuplicateLogins();
          fetchActiveUsers();
        }
      )
      .subscribe();

    const auditSubscription = supabase
      .channel('audit_logs_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        () => {
          fetchAuditLogs();
        }
      )
      .subscribe();

    return () => {
      loginSubscription.unsubscribe();
      auditSubscription.unsubscribe();
    };
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDuplicateLogins(),
      fetchAuditLogs(),
      fetchActiveUsers()
    ]);
    setLoading(false);
  };

  const fetchDuplicateLogins = async () => {
    try {
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
        .order('created_at', { ascending: false })
        .limit(50);

      if (auditError) throw auditError;

      if (auditData && auditData.length > 0) {
        const userIds = [...new Set(auditData.map(item => item.user_id))];
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, name, email, position, last_login_at')
          .in('user_id', userIds);

        if (profileError) throw profileError;

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
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select(`
          id,
          user_id,
          action,
          resource_type,
          resource_id,
          details,
          created_at,
          ip_address,
          user_agent
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (auditError) throw auditError;

      if (auditData && auditData.length > 0) {
        const userIds = [...new Set(auditData.map(item => item.user_id).filter(Boolean))];
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        if (profileError) throw profileError;

        const combinedData: AuditLogEntry[] = auditData.map(audit => {
          const profile = profileData?.find(p => p.user_id === audit.user_id);
          return {
            ...audit,
            user_name: profile?.name || 'System'
          };
        });

        setAuditLogs(combinedData);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const fetchActiveUsers = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          name,
          email,
          position,
          user_type,
          last_login_at,
          session_id,
          is_active
        `)
        .eq('is_active', true)
        .not('last_login_at', 'is', null)
        .order('last_login_at', { ascending: false });

      if (profileError) throw profileError;

      // Filter for recently active users (within last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentlyActive = profileData?.filter(user => 
        new Date(user.last_login_at) > oneDayAgo
      ) || [];

      setActiveUsers(recentlyActive);
    } catch (error) {
      console.error('Error fetching active users:', error);
    }
  };

  const forceLogoutUser = async (userId: string, userName: string) => {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ session_id: null })
        .eq('user_id', userId);

      if (profileError) throw profileError;

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

      fetchActiveUsers();
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
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="relative inline-block mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400/40 rounded-full animate-bounce"></div>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">Security & Logs</h3>
        <p className="text-slate-600 font-medium">Monitor system activity and user access</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-2 mb-6 bg-white rounded-2xl border border-border/20 p-2 shadow-md">
          <TabsTrigger 
            value="audit" 
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg"
          >
            <FileText className="w-4 h-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger 
            value="access" 
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-white/30 data-[state=active]:shadow-lg"
          >
            <Eye className="w-4 h-4" />
            Access Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>System Audit Logs</span>
                <Badge variant="secondary">{auditLogs.length} entries</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-white/20">
                              {log.action}
                            </Badge>
                            <Badge variant="secondary" className="bg-white/20">
                              {log.resource_type}
                            </Badge>
                          </div>
                          <div className="text-sm space-y-1">
                            <div><strong>User:</strong> {log.user_name}</div>
                            <div><strong>Time:</strong> {new Date(log.created_at).toLocaleString()}</div>
                            {log.resource_id && <div><strong>Resource ID:</strong> {log.resource_id}</div>}
                            {log.ip_address && <div><strong>IP:</strong> {log.ip_address}</div>}
                          </div>
                        </div>
                        <Activity className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No audit logs available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Users */}
            <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Active Users</span>
                  <Badge variant="secondary">{activeUsers.length} online</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeUsers.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {activeUsers.map((user) => (
                      <div key={user.user_id} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.position}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Last login: {new Date(user.last_login_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={user.session_id ? "default" : "secondary"}
                              className="bg-green-500/20 text-green-700"
                            >
                              {user.session_id ? "Active" : "Offline"}
                            </Badge>
                            {user.session_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => forceLogoutUser(user.user_id, user.name)}
                                className="bg-white/20 border-white/30"
                              >
                                <LogOut className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active users found.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Duplicate Login Monitor */}
            <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Security Incidents</span>
                  <Badge variant="destructive">{duplicateLogins.length} alerts</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {duplicateLogins.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {duplicateLogins.map((login, index) => (
                      <div key={`${login.user_id}-${index}`} className="bg-red-500/10 backdrop-blur-sm rounded-lg p-3 border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{login.name}</div>
                            <div className="text-sm text-muted-foreground">{login.position}</div>
                            <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              Duplicate session detected
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(login.last_login_at).toLocaleString()}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => forceLogoutUser(login.user_id, login.name)}
                            className="bg-red-500/20 border-red-500/30 text-red-700"
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            Force Logout
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No security incidents detected.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};