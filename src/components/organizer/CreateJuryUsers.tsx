import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus } from "lucide-react";
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

export const CreateJuryUsers = () => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateJuryUsers = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-jury-users');

      if (error) throw error;

      const successCount = data?.results?.filter((r: any) => r.success).length || 0;
      const failCount = data?.results?.filter((r: any) => !r.success).length || 0;

      toast({
        title: "Jury Users Created",
        description: `Successfully created ${successCount} jury users. ${failCount > 0 ? `Failed: ${failCount}` : ''}`,
      });
    } catch (error) {
      console.error('Error creating jury users:', error);
      toast({
        title: "Error",
        description: "Failed to create jury users. Please try again.",
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
          <UserPlus className="w-4 h-4" />
          Create Jury 4, 5, 6
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create New Jury Users?</AlertDialogTitle>
          <AlertDialogDescription>
            This will create 3 new jury accounts:
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Jury 4 (jury4@yip.com / jury4@123)</li>
              <li>Jury 5 (jury5@yip.com / jury5@123)</li>
              <li>Jury 6 (jury6@yip.com / jury6@123)</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreateJuryUsers} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Users"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
