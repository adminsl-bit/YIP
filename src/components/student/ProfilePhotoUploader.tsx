import React, { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera, X } from "lucide-react";

interface ProfilePhotoUploaderProps {
  className?: string;
  currentPhotoUrl?: string | null;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({ 
  className = "",
  currentPhotoUrl 
}) => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

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

  const removePhoto = async () => {
    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in to remove your photo.", variant: "destructive" });
      return;
    }

    try {
      setRemoving(true);

      // Clear the photo_url in the profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ photo_url: null })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Try to delete the file from storage (optional - file may not exist)
      const path = `${user.id}/profile`;
      await supabase.storage
        .from("student-photos")
        .remove([`${path}.jpg`, `${path}.jpeg`, `${path}.png`, `${path}.webp`]);

      await refreshProfile();

      toast({ 
        title: "Photo removed", 
        description: "Your profile picture has been removed successfully." 
      });
    } catch (err: any) {
      console.error("Remove error", err);
      toast({ 
        title: "Remove failed", 
        description: err?.message || "Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setRemoving(false);
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
        disabled={uploading || removing}
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
      
      {currentPhotoUrl && (
        <Button
          onClick={removePhoto}
          disabled={uploading || removing}
          variant="outline"
          size="sm"
          className="gap-2 text-destructive hover:bg-destructive/10"
          aria-label="Remove profile photo"
        >
          {removing ? (
            <>
              <X className="w-4 h-4 animate-pulse" />
              Removing...
            </>
          ) : (
            <>
              <X className="w-4 h-4" />
              Remove Photo
            </>
          )}
        </Button>
      )}
    </div>
  );
};
