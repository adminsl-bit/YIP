import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Shield, Newspaper } from "lucide-react";
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

export const DynamicRoleCreator = () => {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<RoleType>('jury');
  const [count, setCount] = useState<number>(1);
  const [password, setPassword] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const config = roleConfigs[selectedRole];
  const Icon = config.icon;

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
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Dynamic Role Creator
        </CardTitle>
        <CardDescription>
          Create multiple user accounts for any role with customizable count and password
        </CardDescription>
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

        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button className="w-full gap-2">
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
      </CardContent>
    </Card>
  );
};
