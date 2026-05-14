import React, { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera, X } from "lucide-react";

interface CoverPhotoUploaderProps {
  className?: string;
  currentCoverUrl?: string | null;
}

export const CoverPhotoUploader: React.FC<CoverPhotoUploaderProps> = ({ 
  className = "",
  currentCoverUrl 
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

      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/cover.${ext}`;

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
        .update({ cover_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      await refreshProfile();

      toast({ 
        title: "Cover photo updated", 
        description: "Your dashboard background has been updated successfuly." 
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

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ cover_url: null })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      await refreshProfile();

      toast({ 
        title: "Cover removed", 
        description: "Your dashboard background has been reset." 
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
    <div className={`${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex gap-2">
        <Button
          onClick={onClick}
          disabled={uploading || removing}
          variant="default"
          size="icon"
          className="w-10 h-10 rounded-full shadow-lg bg-primary hover:bg-primary/90 hover:scale-110 border-2 border-white/20"
          title="Upload Cover Photo"
        >
          {uploading ? (
            <Upload className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
        </Button>
        
        {currentCoverUrl && (
          <Button
            onClick={removePhoto}
            disabled={uploading || removing}
            variant="destructive"
            size="icon"
            className="w-10 h-10 rounded-full shadow-lg hover:scale-110 border-2 border-white/20"
            title="Remove Cover Photo"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
