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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-2 mb-6 bg-accent/50 p-2 rounded-2xl">
          <TabsTrigger 
            value="audit" 
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-md"
          >
            <FileText className="w-4 h-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger 
            value="access" 
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-md"
          >
            <Eye className="w-4 h-4" />
            Access Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
            <CardHeader className="border-b border-border/10">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <FileText className="w-6 h-6 text-primary" />
                System Audit Logs
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{auditLogs.length} entries</Badge>
              </CardTitle>
              <p className="text-muted-foreground">
                Monitor all system activities and administrative actions
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {auditLogs.length > 0 ? (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <Card key={log.id} className="overflow-hidden border border-border/20 hover:border-primary/30 transition-all duration-200 hover:shadow-md bg-gradient-to-r from-background to-accent/5">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-medium">
                                {log.action}
                              </Badge>
                              <Badge variant="secondary" className="border-muted text-muted-foreground bg-muted/50">
                                {log.resource_type}
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground min-w-16">User:</span>
                                <span className="text-muted-foreground">{log.user_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground min-w-16">Time:</span>
                                <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                              {log.resource_id && (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground min-w-16">Resource:</span>
                                  <span className="text-muted-foreground font-mono text-xs">{log.resource_id}</span>
                                </div>
                              )}
                              {log.ip_address && (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground min-w-16">IP:</span>
                                  <span className="text-muted-foreground font-mono">{log.ip_address}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Activity className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold text-muted-foreground mb-2">No audit logs available</h3>
                  <p className="text-muted-foreground">System activity will appear here when available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Users */}
            <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
              <CardHeader className="border-b border-border/10">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Eye className="w-5 h-5 text-primary" />
                  Active Users
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">{activeUsers.length} online</Badge>
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Users currently logged into the system
                </p>
              </CardHeader>
              <CardContent className="p-6">
                {activeUsers.length > 0 ? (
                  <div className="space-y-3">
                    {activeUsers.map((user) => (
                      <Card key={user.user_id} className="overflow-hidden border border-border/20 hover:border-primary/30 transition-all duration-200 hover:shadow-md bg-gradient-to-r from-background to-accent/5">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-foreground">{user.name}</div>
                              <div className="text-sm text-muted-foreground">{user.position}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                                <Clock className="w-3 h-3" />
                                Last login: {new Date(user.last_login_at).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={user.session_id ? "default" : "secondary"}
                                className={user.session_id ? "bg-green-100 text-green-700 border-green-200" : ""}
                              >
                                {user.session_id ? "Active" : "Offline"}
                              </Badge>
                              {user.session_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => forceLogoutUser(user.user_id, user.name)}
                                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 h-8 px-3"
                                >
                                  <LogOut className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-semibold text-muted-foreground mb-2">No active users</h3>
                    <p className="text-muted-foreground">Active users will appear here when available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Incidents */}
            <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
              <CardHeader className="border-b border-border/10">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Security Incidents
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">{duplicateLogins.length} alerts</Badge>
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Duplicate sessions and security violations
                </p>
              </CardHeader>
              <CardContent className="p-6">
                {duplicateLogins.length > 0 ? (
                  <div className="space-y-3">
                    {duplicateLogins.map((login, index) => (
                      <Card key={`${login.user_id}-${index}`} className="overflow-hidden border border-destructive/20 hover:border-destructive/40 transition-all duration-200 hover:shadow-md bg-gradient-to-r from-destructive/5 to-destructive/10">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-foreground">{login.name}</div>
                              <div className="text-sm text-muted-foreground">{login.position}</div>
                              <div className="text-xs text-destructive flex items-center gap-1 mt-2 font-medium">
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
                              className="bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 h-8 px-3 font-semibold"
                            >
                              <LogOut className="w-3 h-3 mr-1" />
                              Force Logout
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-semibold text-muted-foreground mb-2">No security incidents</h3>
                    <p className="text-muted-foreground">Security alerts will appear here when detected</p>
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