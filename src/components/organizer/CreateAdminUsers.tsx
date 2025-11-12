import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";
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

export const CreateAdminUsers = () => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateAdminUsers = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-admin-users');

      if (error) throw error;

      const successCount = data?.results?.filter((r: any) => r.success).length || 0;
      const failCount = data?.results?.filter((r: any) => !r.success).length || 0;

      toast({
        title: "Admin Users Created",
        description: `Successfully created ${successCount} admin users. ${failCount > 0 ? `Failed: ${failCount}` : ''}`,
      });
    } catch (error) {
      console.error('Error creating admin users:', error);
      toast({
        title: "Error",
        description: "Failed to create admin users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Shield className="w-4 h-4" />
          Create Admin 1-4
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create Admin Student Accounts?</AlertDialogTitle>
          <AlertDialogDescription>
            This will create 4 admin student accounts with elevated privileges:
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Admin 1 (admin1 / admin2025)</li>
              <li>Admin 2 (admin2 / admin2025)</li>
              <li>Admin 3 (admin3 / admin2025)</li>
              <li>Admin 4 (admin4 / admin2025)</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreateAdminUsers} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Admin Users"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
