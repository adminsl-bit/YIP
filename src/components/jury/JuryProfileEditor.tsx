import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  onSaved?: () => void;
}

export const JuryProfileEditor = ({ onSaved }: Props = {}) => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    position: profile?.position || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: formData.name, position: formData.position })
        .eq("user_id", profile?.user_id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Profile updated" });
      onSaved?.();
    } catch (err) {
      console.error("Error updating profile:", err);
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="jury-name" className="text-[10px] font-bold uppercase text-on-surface-variant/60 tracking-widest font-body">
          Full Name
        </Label>
        <Input
          id="jury-name"
          value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          placeholder="Your name"
          required
          className="bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm font-body focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="jury-position" className="text-[10px] font-bold uppercase text-on-surface-variant/60 tracking-widest font-body">
          Position / Role
        </Label>
        <Input
          id="jury-position"
          value={formData.position}
          onChange={e => setFormData(p => ({ ...p, position: e.target.value }))}
          placeholder="e.g. Senior Parliamentary Evaluator"
          required
          className="bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm font-body focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-full font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />}
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
};
