import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, School, Users, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface EventSchool {
  id: string;
  event_id: string;
  name: string;
  display_order: number;
}

interface SchoolsManagerProps {
  eventId?: string | null;
}

export const SchoolsManager = ({ eventId }: SchoolsManagerProps) => {
  const { profile } = useAuth();
  const effectiveEventId = eventId ?? (profile as any)?.event_id ?? null;
  const [schools, setSchools] = useState<EventSchool[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  const fetchSchools = async () => {
    if (!effectiveEventId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('event_schools' as any)
      .select('*')
      .eq('event_id', effectiveEventId)
      .order('display_order');
    if (!error) setSchools((data as any) || []);
    setLoading(false);
  };

  const fetchStudentCounts = async () => {
    if (!effectiveEventId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('school')
      .eq('event_id', effectiveEventId)
      .eq('user_type', 'student');
    if (error) return;
    const rows = (data as any[]) || [];
    const counts: Record<string, number> = {};
    rows.forEach(row => {
      const school = row.school?.toString().trim();
      if (school) counts[school] = (counts[school] || 0) + 1;
    });
    setStudentCounts(counts);
    setTotalStudents(rows.length);
  };

  useEffect(() => {
    fetchSchools();
    fetchStudentCounts();
    if (!effectiveEventId) return;

    const channel = supabase
      .channel(`event_schools:${effectiveEventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_schools', filter: `event_id=eq.${effectiveEventId}` }, () => fetchSchools())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `event_id=eq.${effectiveEventId}` }, () => fetchStudentCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveEventId]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || !effectiveEventId) return;
    setAdding(true);
    try {
      const nextOrder = schools.length > 0 ? Math.max(...schools.map(s => s.display_order)) + 1 : 0;
      const { error } = await supabase
        .from('event_schools' as any)
        .insert({ event_id: effectiveEventId, name, display_order: nextOrder });
      if (error) throw error;
      setNewName('');
      toast.success('School added');
      fetchSchools();
    } catch (err: any) {
      toast.error(err.message || 'Could not add school');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('event_schools' as any).delete().eq('id', id);
      if (error) throw error;
      setSchools(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Could not remove school');
    }
  };

  const downloadTemplate = () => {
    const template = [{ 'School Name': 'Delhi Public School' }, { 'School Name': "St. Xavier's School" }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schools');
    XLSX.writeFile(wb, 'school_list_template.xlsx');
  };

  const handleBulkUpload = async (file: File) => {
    if (!effectiveEventId) return;
    setIsBulkUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

      const names = rows
        .map(row => {
          const keys = Object.keys(row);
          const key = keys.find(k => k.toString().trim().toLowerCase().includes('school'))
            ?? keys.find(k => k.toString().trim().toLowerCase() === 'name')
            ?? keys[0];
          return key ? row[key]?.toString().trim() : '';
        })
        .filter(Boolean);

      if (names.length === 0) {
        toast.error('No school names found in the file');
        return;
      }

      const existingLower = new Set(schools.map(s => s.name.toLowerCase()));
      let nextOrder = schools.length > 0 ? Math.max(...schools.map(s => s.display_order)) + 1 : 0;

      const seen = new Set<string>();
      const toInsert = names
        .filter(name => {
          const lower = name.toLowerCase();
          if (existingLower.has(lower) || seen.has(lower)) return false;
          seen.add(lower);
          return true;
        })
        .map(name => ({ event_id: effectiveEventId, name, display_order: nextOrder++ }));

      if (toInsert.length === 0) {
        toast.info('All schools in the file already exist');
        return;
      }

      const { error } = await supabase.from('event_schools' as any).insert(toInsert);
      if (error) throw error;

      toast.success(`Added ${toInsert.length} school${toInsert.length === 1 ? '' : 's'}`);
      fetchSchools();
    } catch (err: any) {
      toast.error(err.message || 'Could not process file');
    } finally {
      setIsBulkUploading(false);
    }
  };

  if (!effectiveEventId) {
    return (
      <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-12 text-center">
        <p className="font-body text-on-surface-variant font-medium">No event selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <School className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-on-surface font-headline">{schools.length}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Schools</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-on-surface font-headline">{totalStudents}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant font-body">Students Enrolled</p>
          </div>
        </div>
      </div>

      {/* Add + bulk upload */}
      <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-8 space-y-6">
        <div>
          <h2 className="text-lg font-extrabold font-headline text-on-surface mb-1">Add a school</h2>
          <p className="font-body text-on-surface-variant text-sm mb-4">
            Schools added here appear in the student onboarding dropdown for this event. They're also auto-added when a bulk student import includes a new school name.
          </p>
          <div className="flex gap-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Delhi Public School, R.K. Puram"
              className="flex-1 bg-surface-container-low border-none rounded-2xl px-6 py-4 text-sm font-body focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all outline-none placeholder:text-outline/50"
            />
            <Button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="bg-primary hover:bg-primary/90 text-white font-bold px-6 rounded-2xl shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        <div className="pt-6 border-t border-outline-variant/10">
          <h3 className="text-sm font-extrabold font-headline text-on-surface mb-1">Bulk upload schools</h3>
          <p className="font-body text-on-surface-variant text-xs mb-4">
            Upload an Excel file with a "School Name" column. New schools are added; existing ones are skipped.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="rounded-2xl font-bold border-outline-variant/30"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <label className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl cursor-pointer font-bold text-sm transition-all font-body ${isBulkUploading ? 'bg-surface-container text-on-surface-variant cursor-wait' : 'bg-primary text-white hover:bg-primary/90 active:scale-95'}`}>
              <Upload className="w-4 h-4" />
              {isBulkUploading ? 'Uploading…' : 'Upload Excel'}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={isBulkUploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleBulkUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : schools.length === 0 ? (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-12 text-center">
          <School className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="font-body text-on-surface-variant font-medium">No schools added yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
          {schools.map((school, idx) => (
            <div
              key={school.id}
              className={`flex items-center gap-4 px-6 py-4 ${idx !== schools.length - 1 ? 'border-b border-outline-variant/10' : ''}`}
            >
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                {idx + 1}
              </span>
              <p className="flex-1 font-bold font-headline text-on-surface text-sm">{school.name}</p>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-full shrink-0 font-body">
                {studentCounts[school.name] || 0} student{(studentCounts[school.name] || 0) === 1 ? '' : 's'}
              </span>
              <Button variant="ghost" size="icon" className="rounded-xl text-error hover:text-error" onClick={() => handleDelete(school.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
