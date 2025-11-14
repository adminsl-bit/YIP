import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Shield, Newspaper, Trash2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type RoleType = 'jury' | 'admin' | 'journalist';

interface RoleConfig {
  type: RoleType;
  label: string;
  icon: typeof UserPlus;
  color: string;
  defaultPassword: string;
  userType: 'jury' | 'student';
  appRole?: 'admin_student' | 'journalist';
  position: string;
  serialStart: number;
  emailDomain: string;
}

const roleConfigs: Record<RoleType, RoleConfig> = {
  jury: {
    type: 'jury',
    label: 'Jury',
    icon: UserPlus,
    color: 'text-blue-600',
    defaultPassword: 'jury2025',
    userType: 'jury',
    position: 'Senior Evaluator',
    serialStart: 1001,
    emailDomain: '@yip.com',
  },
  admin: {
    type: 'admin',
    label: 'Admin Student',
    icon: Shield,
    color: 'text-purple-600',
    defaultPassword: 'admin2025',
    userType: 'student',
    appRole: 'admin_student',
    position: 'Admin Student',
    serialStart: 9001,
    emailDomain: '@yip.com',
  },
  journalist: {
    type: 'journalist',
    label: 'Journalist',
    icon: Newspaper,
    color: 'text-green-600',
    defaultPassword: 'journalist2025',
    userType: 'student',
    appRole: 'journalist',
    position: 'Journalist',
    serialStart: 8001,
    emailDomain: '@yip.com',
  },
};

interface ExistingUser {
  user_id: string;
  name: string;
  email: string;
  serial_number: number;
  user_type: string;
}

export const DynamicRoleCreator = () => {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<RoleType>('jury');
  const [count, setCount] = useState<number>(1);
  const [password, setPassword] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [existingUsers, setExistingUsers] = useState<{
    jury: ExistingUser[];
    admin: ExistingUser[];
    journalist: ExistingUser[];
    students: ExistingUser[];
    organizers: ExistingUser[];
  }>({ jury: [], admin: [], journalist: [], students: [], organizers: [] });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const config = roleConfigs[selectedRole];
  const Icon = config.icon;

  const fetchExistingUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Fetch jury users
      const { data: juryData } = await supabase
        .from('profiles')
        .select('user_id, name, email, serial_number, user_type')
        .eq('user_type', 'jury')
        .order('serial_number');

      // Fetch organizer users
      const { data: organizerData } = await supabase
        .from('profiles')
        .select('user_id, name, email, serial_number, user_type')
        .eq('user_type', 'organizer')
        .order('serial_number');

      // Fetch admin and journalist students
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const { data: studentData } = await supabase
        .from('profiles')
        .select('user_id, name, email, serial_number, user_type')
        .eq('user_type', 'student')
        .order('serial_number');

      // Categorize students by their role
      const adminUsers: ExistingUser[] = [];
      const journalistUsers: ExistingUser[] = [];
      const regularStudents: ExistingUser[] = [];

      studentData?.forEach(student => {
        const userRole = rolesData?.find(r => r.user_id === student.user_id);
        if (userRole?.role === 'admin_student') {
          adminUsers.push(student);
        } else if (userRole?.role === 'journalist') {
          journalistUsers.push(student);
        } else if (!userRole) {
          // Regular students without special roles (like demo@student.yip)
          regularStudents.push(student);
        }
      });

      setExistingUsers({
        jury: juryData || [],
        admin: adminUsers,
        journalist: journalistUsers,
        students: regularStudents,
        organizers: organizerData || [],
      });
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchExistingUsers();
  }, []);

  const handleDeleteUser = async (userId: string, userName: string) => {
    setDeletingUserId(userId);
    try {
      // Delete user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Delete auth user (service role required - will fail gracefully if not authorized)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`https://ybxktwmpxdnpkfeewrpe.supabase.co/functions/v1/delete-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
      }

      toast({
        title: "User Deleted",
        description: `${userName} has been deleted successfully.`,
      });

      // Refresh the list
      fetchExistingUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleCreateUsers = async () => {
    if (count < 1 || count > 50) {
      toast({
        title: "Invalid Count",
        description: "Please enter a number between 1 and 50",
        variant: "destructive",
      });
      return;
    }

    const finalPassword = password.trim() || config.defaultPassword;

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-role-users', {
        body: { 
          roleType: selectedRole,
          count: count,
          password: finalPassword,
        }
      });

      if (error) throw error;

      const successCount = data?.results?.filter((r: any) => r.success).length || 0;
      const failCount = data?.results?.filter((r: any) => !r.success).length || 0;

      toast({
        title: "Users Created",
        description: `Successfully created ${successCount} ${config.label} users. ${failCount > 0 ? `Failed: ${failCount}` : ''}`,
      });

      setIsDialogOpen(false);
      setPassword('');
      setCount(1);
      
      // Refresh the user list
      fetchExistingUsers();
    } catch (error) {
      console.error('Error creating users:', error);
      toast({
        title: "Error",
        description: `Failed to create ${config.label} users. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getUserList = () => {
    const items = [];
    for (let i = 1; i <= count; i++) {
      items.push(
        <li key={i}>
          {config.label} {i} ({selectedRole}{i}{config.emailDomain} / {password.trim() || config.defaultPassword})
        </li>
      );
    }
    return items;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Dynamic Role Creator
          </CardTitle>
          <CardDescription>
            Create multiple user accounts for any role with customizable count and password
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Role Type</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as RoleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jury">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Jury Members
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Admin Students
                  </div>
                </SelectItem>
                <SelectItem value="journalist">
                  <div className="flex items-center gap-2">
                    <Newspaper className="h-4 w-4" />
                    Journalists
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Number of Users</Label>
            <Input
              type="number"
              min="1"
              max="50"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              placeholder="Enter count"
            />
          </div>

          <div className="space-y-2">
            <Label>Password (Optional)</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={config.defaultPassword}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button className="flex-1 gap-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                Create {count} {config.label} {count > 1 ? 'Users' : 'User'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>Create {config.label} Users?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create {count} {config.label} account{count > 1 ? 's' : ''}:
                  <ul className="mt-2 space-y-1 list-disc list-inside max-h-60 overflow-y-auto">
                    {getUserList()}
                  </ul>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Existing users will be updated with the new password and settings.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCreateUsers} disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Users"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Separator className="my-6" />

        {/* Existing Users List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Existing Users</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchExistingUsers}
              disabled={isLoadingUsers}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {isLoadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading users...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Jury Users */}
              {existingUsers.jury.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                    <h4 className="font-semibold text-sm">Jury Members ({existingUsers.jury.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {existingUsers.jury.map(user => (
                      <div
                        key={user.user_id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingUserId === user.user_id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this jury account and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.user_id, user.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Users */}
              {existingUsers.admin.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-600" />
                    <h4 className="font-semibold text-sm">Admin Students ({existingUsers.admin.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {existingUsers.admin.map(user => (
                      <div
                        key={user.user_id}
                        className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingUserId === user.user_id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this admin account and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.user_id, user.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Journalist Users */}
              {existingUsers.journalist.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Newspaper className="h-4 w-4 text-green-600" />
                    <h4 className="font-semibold text-sm">Journalists ({existingUsers.journalist.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {existingUsers.journalist.map(user => (
                      <div
                        key={user.user_id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingUserId === user.user_id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this journalist account and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.user_id, user.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Students */}
              {existingUsers.students.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-gray-600" />
                    <h4 className="font-semibold text-sm">Regular Students ({existingUsers.students.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {existingUsers.students.map(user => (
                      <div
                        key={user.user_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingUserId === user.user_id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this student account and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.user_id, user.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Organizers */}
              {existingUsers.organizers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-600" />
                    <h4 className="font-semibold text-sm">Organizers ({existingUsers.organizers.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {existingUsers.organizers.map(user => (
                      <div
                        key={user.user_id}
                        className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingUserId === user.user_id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this organizer account and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.user_id, user.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingUsers.jury.length === 0 && existingUsers.admin.length === 0 && existingUsers.journalist.length === 0 && existingUsers.students.length === 0 && existingUsers.organizers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No users found. Create some users to get started.
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
