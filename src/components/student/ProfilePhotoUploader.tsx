import React, { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera, X, Check, Minus, Plus } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

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
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);

  const onClick = () => {
    inputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Profile photo must be under 2 MB.", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    setFileType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setShowCropper(true);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleApplyCrop = async () => {
    if (!imgRef.current || !imageToCrop || !user) return;

    try {
      setUploading(true);
      
      const canvas = document.createElement('canvas');
      const size = 400; // Final crop resolution
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imgRef.current;
      const rect = img.getBoundingClientRect();
      
      // Calculate how much of the original image is within the circular mask (centered)
      // The mask is 320px in the UI, we want to map that to our 400px canvas
      const scale = size / 320; 
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // We remove the circular clip here so the full square is saved.
      // This prevents black corners when saved as JPEG and allows the 
      // dashboard's CSS to handle the final display shape.

      // We need to draw the image centered and scaled
      // Initial centered position in 320px container
      const containerSize = 320;
      // baseScale makes the image fill the 320px container
      const baseScale = Math.max(containerSize / img.naturalWidth, containerSize / img.naturalHeight);
      const currentScale = baseScale * zoom;
      
      const drawWidth = img.naturalWidth * currentScale * scale;
      const drawHeight = img.naturalHeight * currentScale * scale;
      
      // Center + Manual offset (position.x/y are relative to center)
      const dx = (size - drawWidth) / 2 + (position.x * scale);
      const dy = (size - drawHeight) / 2 + (position.y * scale);

      ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const uploadFileType = 'image/png';
        const file = new File([blob], fileName.replace(/\.[^/.]+$/, "") + ".png", { type: uploadFileType });
        
        const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/profile_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("student-photos")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: fileType,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("student-photos").getPublicUrl(path);
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ photo_url: data.publicUrl })
          .eq("user_id", user.id);

        if (updateError) throw updateError;

        await refreshProfile();
        setShowCropper(false);
        toast({ title: "Photo updated", description: "Your profile picture has been cropped and updated." });
        setUploading(false);
      }, 'image/png');

    } catch (err: any) {
      console.error("Crop/Upload error", err);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setUploading(false);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imgRef.current) return;
    
    const img = imgRef.current;
    const containerSize = 320;
    const baseScale = Math.max(containerSize / img.naturalWidth, containerSize / img.naturalHeight);
    const currentScale = baseScale * zoom;
    
    const currentWidth = img.naturalWidth * currentScale;
    const currentHeight = img.naturalHeight * currentScale;
    
    // Calculate boundaries (how much we can shift from center)
    const maxX = Math.max(0, (currentWidth - containerSize) / 2);
    const maxY = Math.max(0, (currentHeight - containerSize) / 2);
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY))
    });
  };

  const onMouseUp = () => setIsDragging(false);

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
        variant="default"
        size="icon"
        className="w-8 h-8 rounded-full shadow-lg bg-primary hover:bg-primary/90 hover:scale-110 border-2 border-white"
        title="Upload Photo"
      >
        {uploading ? (
          <Upload className="w-3 h-3 animate-spin" />
        ) : (
          <Camera className="w-3 h-3" />
        )}
      </Button>
      
      {currentPhotoUrl && (
        <Button
          onClick={removePhoto}
          disabled={uploading || removing}
          variant="destructive"
          size="icon"
          className="w-8 h-8 rounded-full shadow-lg hover:scale-110 border-2 border-white"
          title="Remove Photo"
        >
          <X className="w-3 h-3" />
        </Button>
      )}

      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="responsive-text-xl font-black text-slate-800 tracking-tight">Adjust Profile Photo</DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-8">
            <div 
              className="relative w-full aspect-square bg-slate-900 rounded-[2rem] overflow-hidden cursor-move touch-none select-none border-4 border-slate-50 shadow-inner"
              onMouseMove={onMouseMove}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {/* Circular Mask Overlay */}
              <div className="absolute inset-0 pointer-events-none z-10 border-[40px] border-black/40">
                <div className="w-full h-full rounded-full border-2 border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
              </div>

              {imageToCrop && (
                <img 
                  ref={imgRef}
                  src={imageToCrop}
                  alt="To Crop"
                  className="absolute left-1/2 top-1/2 max-w-none transition-transform duration-75"
                  style={{
                    // base scale to cover the container (320px)
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(calc(${zoom} * max(320 / ${imgRef.current?.naturalWidth || 1}, 320 / ${imgRef.current?.naturalHeight || 1})))`,
                    transformOrigin: 'center center'
                  }}
                  onLoad={(e) => {
                    setPosition({ x: 0, y: 0 });
                  }}
                  draggable={false}
                />
              )}
            </div>

            <div className="space-y-4 px-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="flex items-center gap-2">
                  <Minus className="w-3 h-3" />
                  <span>Zoom</span>
                </div>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <Slider 
                value={[zoom]} 
                min={1} 
                max={4} 
                step={0.01} 
                onValueChange={([val]) => {
                  setZoom(val);
                  // When zooming out, we might need to adjust position to stay within boundaries
                  setPosition(prev => {
                    if (!imgRef.current) return prev;
                    const img = imgRef.current;
                    const containerSize = 320;
                    const baseScale = Math.max(containerSize / img.naturalWidth, containerSize / img.naturalHeight);
                    const currentScale = baseScale * val;
                    const maxX = Math.max(0, (img.naturalWidth * currentScale - containerSize) / 2);
                    const maxY = Math.max(0, (img.naturalHeight * currentScale - containerSize) / 2);
                    return {
                      x: Math.max(-maxX, Math.min(maxX, prev.x)),
                      y: Math.max(-maxY, Math.min(maxY, prev.y))
                    };
                  });
                }}
                className="py-4"
              />
            </div>
          </div>

          <DialogFooter className="p-8 pt-0 flex gap-4">
            <Button 
              variant="ghost" 
              className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest"
              onClick={() => setShowCropper(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
              onClick={handleApplyCrop}
              disabled={uploading}
            >
              {uploading ? "Applying..." : "Save Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
