import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';

interface Student {
  id: string;
  user_id: string;
  name: string;
  position: string;
  party_number: number;
  party_name?: string;
  committee?: string;
  serial_number: number;
  constituency?: string;
  state?: string;
  city?: string;
  photo_url?: string;
  email?: string;
  user_type: string;
  is_active?: boolean;
}

const PARTY_LETTERS = ['A','B','C','D','E','F','G','H','I','J'] as const;

interface StudentEditDialogProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Derived from live student data: [party_number, party_name | null][] */
  parties?: [number, string | null][];
  constituencies?: string[];
  committees?: string[];
  partyNames?: string[];
}

export const StudentEditDialog = ({ student, isOpen, onClose, onSave, parties = [], constituencies = [], committees = [], partyNames = [] }: StudentEditDialogProps) => {
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
          party_name: formData.party_name?.trim() || null,
          committee: formData.committee?.trim() || null,
          serial_number: formData.serial_number,
          constituency: formData.constituency?.trim() || null,
          state: formData.state?.trim() || null,
          city: formData.city?.trim() || null,
          email: formData.email?.trim() || null,
        })
        .eq('user_id', student.user_id);

      if (error) throw error;

      // Log the action for administrative audit
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE_STUDENT_PROFILE',
          resource_type: 'profiles',
          resource_id: student.user_id,
          details: {
            student_name: student.name,
            changes: {
              name: formData.name !== student.name ? formData.name : undefined,
              position: formData.position !== student.position ? formData.position : undefined,
              party_number: formData.party_number !== student.party_number ? formData.party_number : undefined,
              party_name: formData.party_name !== student.party_name ? formData.party_name : undefined,
              committee: formData.committee !== student.committee ? formData.committee : undefined,
              serial_number: formData.serial_number !== student.serial_number ? formData.serial_number : undefined,
              constituency: formData.constituency !== student.constituency ? formData.constituency : undefined,
              state: formData.state !== student.state ? formData.state : undefined,
              city: formData.city !== student.city ? formData.city : undefined,
            }
          }
        });
      }

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
      <DialogContent className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-surface-container-lowest max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-primary-container rounded-t-[2.5rem]" />

        {/* Compact header */}
        <div className="flex items-center gap-4 px-8 pt-8 pb-5">
          <div className="relative shrink-0">
            <Avatar className="w-14 h-14 rounded-2xl ring-4 ring-surface-container">
              <AvatarImage src={formData.photo_url} alt={formData.name} className="object-cover" />
              <AvatarFallback className="bg-primary-fixed/30 text-primary font-black rounded-2xl font-headline text-lg">
                {formData.name?.split(' ').map(n => n[0]).join('') || 'ST'}
              </AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/80 transition-colors">
              <Camera className="w-3 h-3 text-white" />
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-on-surface font-headline truncate">{formData.name || 'Edit Student'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10px] font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">#{(formData.serial_number ?? 0).toString().padStart(3, '0')}</span>
              <span className="text-[10px] font-bold text-on-surface-variant font-body truncate">{formData.position || 'Delegate'}</span>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3 px-8 pb-2">

          {/* Row 1: Name (full width) */}
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Full Name *</label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
              className="h-11 bg-surface-container border-none rounded-2xl font-bold px-4 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Row 2: Role + Login ID */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Role</label>
            <Select value={formData.position || ''} onValueChange={(v) => setFormData(prev => ({ ...prev, position: v }))}>
              <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-bold px-4 focus:ring-2 focus:ring-primary/20 text-sm">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-lowest border-none rounded-2xl shadow-elevated z-50 max-h-64 overflow-y-auto">
                <SelectGroup>
                  <SelectLabel className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 px-3 pt-2 pb-1">Default</SelectLabel>
                  <SelectItem value="Member of Parliament">Member of Parliament</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 px-3 pt-2 pb-1">Presiding Officers</SelectLabel>
                  <SelectItem value="Speaker">Speaker <span className="text-on-surface-variant/40 text-[10px] ml-1">(max 1)</span></SelectItem>
                  <SelectItem value="Deputy Speaker">Deputy Speaker <span className="text-on-surface-variant/40 text-[10px] ml-1">(max 2)</span></SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 px-3 pt-2 pb-1">Cabinet — Ruling Party</SelectLabel>
                  <SelectItem value="Minister of Road Transport & Highways">Minister of Road Transport & Highways</SelectItem>
                  <SelectItem value="Minister of Finance">Minister of Finance</SelectItem>
                  <SelectItem value="Minister of Defence">Minister of Defence</SelectItem>
                  <SelectItem value="Minister of Social Justice & Empowerment">Minister of Social Justice & Empowerment</SelectItem>
                  <SelectItem value="Minister of Women & Child Development">Minister of Women & Child Development</SelectItem>
                  <SelectItem value="Minister of Tourism & Culture">Minister of Tourism & Culture</SelectItem>
                  <SelectItem value="Minister of Labour & Employment">Minister of Labour & Employment</SelectItem>
                  <SelectItem value="Minister of Information and Broadcasting">Minister of Information and Broadcasting</SelectItem>
                  <SelectItem value="Minister of Youth Affairs & Sports">Minister of Youth Affairs & Sports</SelectItem>
                  <SelectItem value="Minister of Home Affairs">Minister of Home Affairs</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 px-3 pt-2 pb-1">Shadow Cabinet — Opposition</SelectLabel>
                  <SelectItem value="Shadow Minister of Road Transport & Highways">Shadow Minister of Road Transport & Highways</SelectItem>
                  <SelectItem value="Shadow Minister of Finance">Shadow Minister of Finance</SelectItem>
                  <SelectItem value="Shadow Minister of Defence">Shadow Minister of Defence</SelectItem>
                  <SelectItem value="Shadow Minister of Social Justice & Empowerment">Shadow Minister of Social Justice & Empowerment</SelectItem>
                  <SelectItem value="Shadow Minister of Women & Child Development">Shadow Minister of Women & Child Development</SelectItem>
                  <SelectItem value="Shadow Minister of Tourism & Culture">Shadow Minister of Tourism & Culture</SelectItem>
                  <SelectItem value="Shadow Minister of Labour & Employment">Shadow Minister of Labour & Employment</SelectItem>
                  <SelectItem value="Shadow Minister of Information and Broadcasting">Shadow Minister of Information and Broadcasting</SelectItem>
                  <SelectItem value="Shadow Minister of Youth Affairs & Sports">Shadow Minister of Youth Affairs & Sports</SelectItem>
                  <SelectItem value="Shadow Minister of Home Affairs">Shadow Minister of Home Affairs</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 px-3 pt-2 pb-1">Special Roles</SelectLabel>
                  <SelectItem value="Journalist">Journalist</SelectItem>
                  <SelectItem value="Admin Student">Admin Student</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Login ID</label>
            <Input
              value={formData.email?.split('@')[0] || ''}
              onChange={(e) => {
                const domain = formData.email?.includes('@') ? formData.email.split('@')[1] : 'yip.parliament';
                setFormData(prev => ({ ...prev, email: `${e.target.value}@${domain}` }));
              }}
              placeholder="login.id"
              className="h-11 bg-surface-container border-none rounded-2xl font-bold px-4 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Row 3: Party + Party Name */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Party</label>
            <Select value={formData.party_number?.toString() || '0'} onValueChange={(v) => setFormData(prev => ({ ...prev, party_number: parseInt(v) }))}>
              <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-bold px-4 focus:ring-2 focus:ring-primary/20 text-sm">
                <SelectValue placeholder="Select party" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-lowest border-none rounded-2xl shadow-elevated z-50">
                <SelectItem value="0">No Party</SelectItem>
                {parties.length > 0
                  ? parties.map(([num, name]) => {
                      const letter = PARTY_LETTERS[num - 1] ?? num.toString();
                      return <SelectItem key={num} value={num.toString()}>{name ? `${name} (${letter})` : `Party ${letter}`}</SelectItem>;
                    })
                  : PARTY_LETTERS.map((letter, idx) => (
                      <SelectItem key={letter} value={(idx + 1).toString()}>Party {letter}</SelectItem>
                    ))
                }
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Party Name</label>
            <input
              list="edit-party-names"
              value={formData.party_name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, party_name: e.target.value }))}
              placeholder="Type or select"
              className="w-full h-11 bg-surface-container border-none rounded-2xl font-bold px-4 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
            />
            <datalist id="edit-party-names">{partyNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>

          {/* Row 4: Committee + Constituency */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Committee</label>
            <Select value={formData.committee || ''} onValueChange={(v) => setFormData(prev => ({ ...prev, committee: v }))}>
              <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-bold px-4 focus:ring-2 focus:ring-primary/20 text-sm">
                <SelectValue placeholder="Select committee" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-lowest border-none rounded-2xl shadow-elevated z-50">
                {committees.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">Constituency</label>
            <input
              list="edit-constituencies"
              value={formData.constituency || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, constituency: e.target.value }))}
              placeholder="Type or select constituency"
              className="w-full h-11 bg-surface-container border-none rounded-2xl font-bold px-4 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 font-body"
            />
            <datalist id="edit-constituencies">{constituencies.map(c => <option key={c} value={c} />)}</datalist>
          </div>

          {/* Row 5: State + City */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">State</label>
            <Select value={formData.state || ''} onValueChange={(v) => setFormData(prev => ({ ...prev, state: v }))}>
              <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-bold px-4 focus:ring-2 focus:ring-primary/20 text-sm">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-lowest border-none rounded-2xl shadow-elevated z-50 max-h-56 overflow-y-auto">
                {["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Ladakh","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Jammu and Kashmir","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 font-body">City</label>
            <Select value={formData.city || ''} onValueChange={(v) => setFormData(prev => ({ ...prev, city: v }))}>
              <SelectTrigger className="h-11 bg-surface-container border-none rounded-2xl font-bold px-4 focus:ring-2 focus:ring-primary/20 text-sm">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-lowest border-none rounded-2xl shadow-elevated z-50 max-h-56 overflow-y-auto">
                {["Agartala","Agra","Ahmedabad","Aizawl","Ajmer","Akola","Aligarh","Alwar","Ambala","Amravati","Amritsar","Anantapur","Asansol","Aurangabad","Bareilly","Belgaum","Bengaluru","Bhopal","Bhubaneswar","Bikaner","Bilaspur","Bokaro","Bongaigaon","Chandigarh","Chennai","Coimbatore","Cuttack","Dahod","Davangere","Dehradun","Dhanbad","Dharwad","Dibrugarh","Durgapur","Erode","Faridabad","Fatehpur","Gandhinagar","Gaya","Ghaziabad","Gorakhpur","Gulbarga","Guntur","Gurgaon","Guwahati","Gwalior","Howrah","Hubli","Hyderabad","Imphal","Indore","Itanagar","Jabalpur","Jaipur","Jalandhar","Jammu","Jamnagar","Jamshedpur","Jhansi","Jodhpur","Jorhat","Kakinada","Kalyan-Dombivli","Kanpur","Karimnagar","Karnal","Kochi","Kohima","Kolhapur","Kolkata","Kollam","Kota","Kozhikode","Kurnool","Latur","Lucknow","Ludhiana","Madurai","Mangalore","Meerut","Moradabad","Mumbai","Mysore","Nagpur","Nanded","Nashik","Navi Mumbai","New Delhi","Noida","Panaji","Patna","Pimpri-Chinchwad","Port Blair","Puducherry","Pune","Raipur","Rajahmundry","Rajkot","Ranchi","Rohtak","Salem","Shillong","Shimla","Siliguri","Silvassa","Solapur","Srinagar","Surat","Surendranagar","Thane","Thiruvananthapuram","Thrissur","Tiruchirapalli","Tirunelveli","Tirupati","Tirupur","Tumkur","Udaipur","Ujjain","Ulhasnagar","Vadodara","Varanasi","Vasai-Virar","Vijayawada","Visakhapatnam","Warangal"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Actions */}
        <div className="flex gap-3 px-8 py-6">
          <button type="button" onClick={onClose} className="flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-3.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_8px_24px_rgba(19,41,143,0.25)] hover:scale-[1.02] active:scale-95 transition-all font-body disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};