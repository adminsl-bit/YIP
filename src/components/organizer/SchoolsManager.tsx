import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, School } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

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

  useEffect(() => {
    fetchSchools();
    if (!effectiveEventId) return;

    const channel = supabase
      .channel(`event_schools:${effectiveEventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_schools', filter: `event_id=eq.${effectiveEventId}` }, () => fetchSchools())
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

  if (!effectiveEventId) {
    return (
      <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-12 text-center">
        <p className="font-body text-on-surface-variant font-medium">No event selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-8">
        <h2 className="text-lg font-extrabold font-headline text-on-surface mb-1">Add a school</h2>
        <p className="font-body text-on-surface-variant text-sm mb-4">
          Schools added here appear in the student onboarding dropdown for this event.
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
