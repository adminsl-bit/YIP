import React, { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload } from "lucide-react";

interface ProfilePhotoUploaderProps {
  className?: string;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({ className = "" }) => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const onClick = () => {
    inputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in to upload a photo.", variant: "destructive" });
      return;
    }

    try {
      setUploading(true);

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `jury/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("student-photos").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ photo_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      await refreshProfile();

      toast({ title: "Photo updated", description: "Your profile picture has been updated successfully." });
    } catch (err: any) {
      console.error("Upload error", err);
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        onClick={onClick}
        disabled={uploading}
        variant="outline"
        className="bg-white/80 backdrop-blur-sm border-white/40 hover:bg-white text-slate-800 font-semibold"
        aria-label="Upload profile photo"
      >
        <Upload className="w-4 h-4 mr-2" />
        {uploading ? "Uploading..." : "Upload Photo"}
      </Button>
    </div>
  );
};
