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

interface LoginAuditEntry {
  id: string;
  user_id: string;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  is_duplicate_session: boolean;
  previous_session_id?: string;
  login_attempt_at: string;
}

export const SecurityLogsManager = () => {
  const [duplicateLogins, setDuplicateLogins] = useState<DuplicateLogin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loginAuditEntries, setLoginAuditEntries] = useState<LoginAuditEntry[]>([]);
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
          fetchLoginAuditEntries();
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
      fetchActiveUsers(),
      fetchLoginAuditEntries()
    ]);
    setLoading(false);
  };

  const fetchDuplicateLogins = async () => {
    try {
      // First, get all users with active sessions
      const { data: activeSessionUsers, error: activeError } = await supabase
        .from('profiles')
        .select('user_id, name, email, position, session_id, last_login_at')
        .not('session_id', 'is', null)
        .eq('is_active', true);

      if (activeError) throw activeError;

      if (!activeSessionUsers || activeSessionUsers.length === 0) {
        setDuplicateLogins([]);
        return;
      }

      // Now check for recent duplicate login attempts for users with active sessions
      const activeUserIds = activeSessionUsers.map(u => u.user_id);
      
      const { data: recentDuplicates, error: duplicateError } = await supabase
        .from('login_audit')
        .select(`
          user_id,
          is_duplicate_session,
          session_id,
          previous_session_id,
          login_attempt_at,
          ip_address,
          user_agent
        `)
        .in('user_id', activeUserIds)
        .eq('is_duplicate_session', true)
        .gte('login_attempt_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours only
        .order('login_attempt_at', { ascending: false });

      if (duplicateError) throw duplicateError;

      // Only show incidents for users who STILL have active sessions AND had recent duplicates
      const realIncidents: DuplicateLogin[] = [];
      
      if (recentDuplicates && recentDuplicates.length > 0) {
        recentDuplicates.forEach(incident => {
          const activeUser = activeSessionUsers.find(u => u.user_id === incident.user_id);
          if (activeUser) {
            realIncidents.push({
              user_id: incident.user_id,
              name: activeUser.name || 'Unknown',
              email: activeUser.email || 'Unknown',
              position: activeUser.position || 'Unknown',
              is_duplicate_session: incident.is_duplicate_session,
              session_id: incident.session_id,
              previous_session_id: incident.previous_session_id,
              last_login_at: incident.login_attempt_at
            });
          }
        });
      }

      setDuplicateLogins(realIncidents);
    } catch (error) {
      console.error('Error fetching duplicate logins:', error);
      setDuplicateLogins([]);
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

      // Filter for recently active users (within last 4 hours) or those with active sessions
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const recentlyActive = profileData?.filter(user => 
        new Date(user.last_login_at) > fourHoursAgo || user.session_id !== null
      ) || [];

      setActiveUsers(recentlyActive);
    } catch (error) {
      console.error('Error fetching active users:', error);
    }
  };

  const fetchLoginAuditEntries = async () => {
    try {
      const { data: loginData, error: loginError } = await supabase
        .from('login_audit')
        .select(`
          id,
          user_id,
          ip_address,
          user_agent,
          session_id,
          is_duplicate_session,
          previous_session_id,
          login_attempt_at
        `)
        .order('login_attempt_at', { ascending: false })
        .limit(50);

      if (loginError) throw loginError;

      if (loginData && loginData.length > 0) {
        const userIds = [...new Set(loginData.map(item => item.user_id))];
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        if (profileError) throw profileError;

        const combinedData: LoginAuditEntry[] = loginData.map(login => {
          const profile = profileData?.find(p => p.user_id === login.user_id);
          return {
            ...login,
            user_name: profile?.name || 'Unknown User'
          };
        });

        setLoginAuditEntries(combinedData);
      } else {
        setLoginAuditEntries([]);
      }
    } catch (error) {
      console.error('Error fetching login audit entries:', error);
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
        <TabsList className="grid w-full grid-cols-2 gap-1 mb-6 bg-muted p-1 rounded-2xl h-14">
          <TabsTrigger 
            value="audit" 
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:text-foreground"
          >
            <FileText className="w-4 h-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger 
            value="access" 
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:text-foreground"
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
          <div className="grid grid-cols-1 gap-6">
            {/* Login Activity Log */}
            <Card className="bg-white rounded-3xl shadow-lg border border-border/20">
              <CardHeader className="border-b border-border/10">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Activity className="w-5 h-5 text-primary" />
                  Login Activity Log
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{loginAuditEntries.length} entries</Badge>
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Complete log of all user login attempts and session activities
                </p>
              </CardHeader>
              <CardContent className="p-6">
                {loginAuditEntries.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {loginAuditEntries.map((entry) => (
                      <Card key={entry.id} className={`overflow-hidden border transition-all duration-200 hover:shadow-md ${
                        entry.is_duplicate_session 
                          ? 'border-destructive/20 hover:border-destructive/40 bg-gradient-to-r from-destructive/5 to-destructive/10' 
                          : 'border-border/20 hover:border-primary/30 bg-gradient-to-r from-background to-accent/5'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-foreground">{entry.user_name}</span>
                                {entry.is_duplicate_session && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Duplicate Session
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">{new Date(entry.login_attempt_at).toLocaleString()}</span>
                                </div>
                                {entry.ip_address && (
                                  <div className="flex items-center gap-2">
                                    <Shield className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground font-mono text-xs">{entry.ip_address}</span>
                                  </div>
                                )}
                                {entry.session_id && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Session:</span>
                                    <span className="text-xs font-mono text-muted-foreground">{entry.session_id.slice(0, 8)}...</span>
                                  </div>
                                )}
                                {entry.previous_session_id && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-destructive">Previous session:</span>
                                    <span className="text-xs font-mono text-destructive">{entry.previous_session_id.slice(0, 8)}...</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant={entry.is_duplicate_session ? "destructive" : "default"}
                              className={entry.is_duplicate_session ? "" : "bg-green-100 text-green-700 border-green-200"}
                            >
                              {entry.is_duplicate_session ? "Security Alert" : "Normal Login"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-semibold text-muted-foreground mb-2">No login activity</h3>
                    <p className="text-muted-foreground">Login attempts will appear here when they occur</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Users and Security Incidents */}
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
                                  className={user.session_id ? "bg-green-100 text-green-700 border-green-200" : "bg-blue-100 text-blue-700 border-blue-200"}
                                >
                                  {user.session_id ? "Active Session" : "Recent Activity"}
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => forceLogoutUser(user.user_id, user.name)}
                                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 h-8 px-3"
                                >
                                  <LogOut className="w-3 h-3" />
                                </Button>
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
                    Active Security Threats
                    <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">{duplicateLogins.length} live threats</Badge>
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Users currently logged in on multiple devices simultaneously
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
                                Active concurrent session detected
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Last attempt: {new Date(login.last_login_at).toLocaleString()}
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
                    <h3 className="text-xl font-semibold text-muted-foreground mb-2">No active security threats</h3>
                    <p className="text-muted-foreground">Concurrent login attempts will appear here when detected</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};