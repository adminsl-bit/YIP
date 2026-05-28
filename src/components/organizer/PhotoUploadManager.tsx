import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import heic2any from 'heic2any';

interface Student {
  id: string;
  serial_number: number;
  name: string;
  photo_url?: string;
  updated_at?: string;
}

const PhotoUploadManager = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.serial_number.toString().includes(searchTerm)
      );
      setFilteredStudents(filtered);
    }
  }, [students, searchTerm]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, serial_number, name, photo_url, updated_at')
        .eq('user_type', 'student')
        .order('serial_number');
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch students', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, studentId: string, serialNumber: number) => {
    try {
      let processedFile = file;
      let fileName = `${serialNumber}.jpg`;

      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        toast({ title: 'Converting HEIC', description: 'Converting HEIC image to JPEG format…' });
        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 }) as Blob;
        processedFile = new File([convertedBlob], fileName, { type: 'image/jpeg' });
      }

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(fileName, processedFile, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('student-photos').getPublicUrl(fileName);
      const updatedUrl = `${publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: updatedUrl })
        .eq('id', studentId)
        .select();
      if (updateError) throw updateError;

      toast({ title: 'Success', description: `Photo uploaded for student ${serialNumber}` });
      await fetchStudents();
    } catch (error: any) {
      toast({ title: 'Error', description: `Failed to upload photo: ${error.message}`, variant: 'destructive' });
    }
  };

  React.useEffect(() => { fetchStudents(); }, []);

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Search + Refresh bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant/50">search</span>
          <input
            type="text"
            placeholder="Search by name or serial number…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-12 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl pl-11 pr-5 text-sm font-body text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        <button
          onClick={fetchStudents}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors font-semibold text-sm font-body disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
          Refresh
        </button>
        {searchTerm && (
          <p className="text-xs text-on-surface-variant font-body shrink-0">
            {filteredStudents.length} result{filteredStudents.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Students table */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(19,41,143,0.1)] overflow-hidden">
        <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>photo_library</span>
          </div>
          <div>
            <h3 className="font-headline font-extrabold text-on-surface">Student Photos</h3>
            <p className="text-xs text-on-surface-variant font-body">{students.length} student{students.length !== 1 ? 's' : ''} · upload or replace profile photos</p>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>
              {searchTerm ? 'search_off' : 'photo_library'}
            </span>
            <p className="text-sm text-on-surface-variant/50 font-body">
              {searchTerm ? 'No students match your search.' : 'No students available.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {filteredStudents.map(student => (
              <div key={student.id} className="px-8 py-5 flex items-center gap-5 hover:bg-primary-container/[0.02] transition-colors group">
                {/* Avatar */}
                <div className="relative w-14 h-14 rounded-2xl bg-surface-container overflow-hidden border-2 border-primary/10 shrink-0">
                  {student.photo_url ? (
                    <>
                      <img
                        src={`${student.photo_url}${student.photo_url.includes('?') ? '&' : '?'}cb=${student.updated_at ? new Date(student.updated_at).getTime() : ''}`}
                        data-src={student.photo_url}
                        alt={student.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={e => {
                          const t = e.currentTarget as HTMLImageElement;
                          const orig = t.getAttribute('data-src') || t.src;
                          if (!t.getAttribute('data-retried')) {
                            t.setAttribute('data-retried', 'true');
                            t.src = `${orig}${orig.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                          } else {
                            t.style.display = 'none';
                          }
                        }}
                      />
                      <div className="fallback-icon hidden absolute inset-0 items-center justify-center bg-error/10">
                        <span className="material-symbols-outlined text-[20px] text-error">broken_image</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-headline font-bold text-sm text-on-surface-variant">{initials(student.name)}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-on-surface truncate">{student.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full font-body">
                      #{student.serial_number}
                    </span>
                    {student.photo_url && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-body ${student.photo_url.includes('drive.google.com') ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary-fixed-dim'}`}>
                        {student.photo_url.includes('drive.google.com') ? 'Google Drive' : 'Supabase'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Upload */}
                <div className="relative shrink-0">
                  <input
                    type="file"
                    accept="image/*,.heic,.HEIC"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, student.id, student.serial_number);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    id={`photo-${student.id}`}
                  />
                  <label
                    htmlFor={`photo-${student.id}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-bold text-sm font-body shadow-[0_4px_12px_rgba(19,41,143,0.25)] hover:shadow-[0_6px_16px_rgba(19,41,143,0.35)] transition-all cursor-pointer group-hover:scale-[1.02]"
                  >
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    {student.photo_url ? 'Replace' : 'Upload'}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoUploadManager;
