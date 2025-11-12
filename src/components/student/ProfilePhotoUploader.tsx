import React, { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera } from "lucide-react";

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

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      // Store in user's own folder: {user_id}/profile.{ext}
      const path = `${user.id}/profile.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true, // Replace existing photo
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

      toast({ 
        title: "Photo updated", 
        description: "Your profile picture has been updated successfully." 
      });
    } catch (err: any) {
      console.error("Upload error", err);
      toast({ 
        title: "Upload failed", 
        description: err?.message || "Please try again.", 
        variant: "destructive" 
      });
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
        size="sm"
        className="gap-2"
        aria-label="Upload profile photo"
      >
        {uploading ? (
          <>
            <Upload className="w-4 h-4 animate-pulse" />
            Uploading...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            Upload Photo
          </>
        )}
      </Button>
    </div>
  );
};
