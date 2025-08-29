import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PartyBadge } from "@/components/ui/party-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Save, X, MapPin, Hash, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  email?: string;
  user_type: string;
  is_active?: boolean;
}

interface StudentEditDialogProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const StudentEditDialog = ({ student, isOpen, onClose, onSave }: StudentEditDialogProps) => {
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleOpen = (open: boolean) => {
    if (open && student) {
      setFormData({ ...student });
    } else {
      setFormData({});
      onClose();
    }
  };

  // Pre-populate form data when student changes
  useEffect(() => {
    if (student && isOpen) {
      setFormData({ ...student });
    }
  }, [student, isOpen]);

  const handleSave = async () => {
    if (!student || !formData.name?.trim()) {
      toast({
        title: "Error",
        description: "Student name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name.trim(),
          position: formData.position,
          party_number: formData.party_number,
          serial_number: formData.serial_number,
          constituency: formData.constituency?.trim() || null,
          state: formData.state?.trim() || null,
          city: formData.city?.trim() || null,
          email: formData.email?.trim() || null,
        })
        .eq('user_id', student.user_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student details updated successfully",
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating student:', error);
      toast({
        title: "Error",
        description: "Failed to update student details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!student) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${student.user_id}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('student-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('user_id', student.user_id);

      if (updateError) throw updateError;

      setFormData(prev => ({ ...prev, photo_url: publicUrl }));

      toast({
        title: "Success",
        description: "Photo updated successfully",
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadPhoto(file);
    }
  };

  if (!student) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            Edit Student Details
          </DialogTitle>
          <DialogDescription>
            Update student information and profile details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Section */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                    <AvatarImage 
                      src={formData.photo_url} 
                      alt={formData.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold">
                      {formData.name?.split(' ').map(n => n[0]).join('') || 'ST'}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors">
                    <Camera className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-white border-blue-300 text-blue-700">
                      #{formData.serial_number}
                    </Badge>
                    <PartyBadge partyNumber={formData.party_number || 1} size="sm" />
                    {formData.party_name && (
                      <Badge variant="secondary" className="bg-white/80 text-slate-700 text-xs">
                        {formData.party_name}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{formData.name}</h3>
                  <p className="text-slate-600 font-medium">{formData.position}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                Full Name *
              </Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="position" className="text-sm font-medium text-slate-700">
                Position
              </Label>
              <Select 
                value={formData.position || ''} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, position: value }))}
              >
                <SelectTrigger id="position" className="mt-1">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Speaker">Speaker</SelectItem>
                  <SelectItem value="Deputy Speaker">Deputy Speaker</SelectItem>
                  <SelectItem value="Member of Parliament">Member of Parliament</SelectItem>
                  <SelectItem value="Minister">Minister</SelectItem>
                  <SelectItem value="Opposition Leader">Opposition Leader</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="serial" className="text-sm font-medium text-slate-700">
                Serial Number
              </Label>
              <div className="relative mt-1">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="serial"
                  type="number"
                  value={formData.serial_number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, serial_number: parseInt(e.target.value) || 0 }))}
                  placeholder="Serial number"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="party" className="text-sm font-medium text-slate-700">
                Party Number
              </Label>
              <Select 
                value={formData.party_number?.toString() || ''} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, party_number: parseInt(value) }))}
              >
                <SelectTrigger id="party" className="mt-1">
                  <SelectValue placeholder="Select party" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <SelectItem key={num} value={num.toString()}>Party {num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="constituency" className="text-sm font-medium text-slate-700">
                Constituency
              </Label>
              <Input
                id="constituency"
                value={formData.constituency || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, constituency: e.target.value }))}
                placeholder="Enter constituency"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="state" className="text-sm font-medium text-slate-700">
                State
              </Label>
              <Input
                id="state"
                value={formData.state || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                placeholder="Enter state"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="city" className="text-sm font-medium text-slate-700">
                Home City
              </Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="city"
                  value={formData.city || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Enter home city"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};