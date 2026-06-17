import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Calendar, ListChecks } from 'lucide-react';

interface SessionItem {
  id: string;
  title: string;
  bill_type: 'private_member_bill' | 'government_bill' | 'committee_report' | 'question_hour' | 'general_discussion';
  description: string | null;
  sort_order: number;
  status: 'pending' | 'active' | 'completed';
  is_active: boolean;
  session_date: string | null;
}

interface SessionSubItem {
  id: string;
  parent_session_id: string;
  title: string;
  description: string | null;
  content: string | null;
  sort_order: number;
}

const BILL_TYPE_LABELS: Record<SessionItem['bill_type'], string> = {
  private_member_bill: "Private Member's Bill",
  government_bill: 'Government Bill',
  committee_report: 'Committee Report',
  question_hour: 'Question Hour',
  general_discussion: 'General Discussion',
};

const BILL_TYPE_BADGE_VARIANTS: Record<SessionItem['bill_type'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  private_member_bill: 'secondary',
  government_bill: 'default',
  committee_report: 'outline',
  question_hour: 'destructive',
  general_discussion: 'secondary',
};

const STATUS_CONFIG: Record<SessionItem['status'], { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  active: { label: 'Active Now', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
};

interface AgendaViewProps {
  /** Render without the page heading — used when embedded inside another tab. */
  embedded?: boolean;
}

export const AgendaView = ({ embedded = false }: AgendaViewProps) => {
  const { profile } = useAuth();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [subItemsByParent, setSubItemsByParent] = useState<Record<string, SessionSubItem[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchAgenda = async () => {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('session_items' as any)
        .select('id, title, bill_type, description, sort_order, status, is_active, session_date')
        .eq('event_id', profile?.event_id ?? '')
        .order('sort_order', { ascending: true });
      if (itemsError) throw itemsError;
      setItems((itemsData as any) || []);

      const { data: subData, error: subError } = await supabase
        .from('session_sub_items' as any)
        .select('id, parent_session_id, title, description, content, sort_order')
        .order('sort_order', { ascending: true });
      if (subError) throw subError;

      const grouped: Record<string, SessionSubItem[]> = {};
      ((subData as any) || []).forEach((sub: SessionSubItem) => {
        (grouped[sub.parent_session_id] ??= []).push(sub);
      });
      setSubItemsByParent(grouped);
    } catch (error) {
      console.error('Error fetching agenda:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgenda();

    const channel = supabase
      .channel('agenda_view_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_items' }, () => fetchAgenda())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_sub_items' }, () => fetchAgenda())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const content = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-outline-variant/10 shadow-sm p-12 text-center">
          <Calendar className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="font-body text-on-surface-variant font-medium">No agenda items published yet.</p>
          <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.3em] mt-2 font-headline">Check back closer to session time</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const subItems = subItemsByParent[item.id] || [];
            const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border shadow-sm p-6 lg:p-8 transition-all ${
                  item.status === 'active' ? 'border-primary/30 ring-2 ring-primary/10' : 'border-outline-variant/10'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={BILL_TYPE_BADGE_VARIANTS[item.bill_type]}>{BILL_TYPE_LABELS[item.bill_type]}</Badge>
                    <Badge variant={status.variant} className={item.status === 'active' ? 'animate-pulse' : ''}>{status.label}</Badge>
                  </div>
                  {item.session_date && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 font-headline flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-extrabold font-headline text-on-surface tracking-tight">{item.title}</h3>
                {item.description && (
                  <p className="font-body text-on-surface-variant text-sm mt-2 leading-relaxed">{item.description}</p>
                )}

                {subItems.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-outline-variant/10 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 font-headline flex items-center gap-2">
                      <ListChecks className="w-3 h-3" />
                      Agenda Items
                    </p>
                    {subItems.map((sub) => (
                      <div key={sub.id} className="bg-surface-container rounded-2xl p-4">
                        <h4 className="font-bold font-headline text-on-surface text-sm">{sub.title}</h4>
                        {sub.description && (
                          <p className="font-body text-on-surface-variant text-xs mt-1 leading-relaxed">{sub.description}</p>
                        )}
                        {sub.content && (
                          <p className="font-body text-on-surface-variant/80 text-xs mt-2 leading-relaxed whitespace-pre-wrap">{sub.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
          Parliamentary <span className="text-secondary">Agenda</span>
        </h1>
        <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-headline">
          <Calendar className="w-3 h-3" />
          Schedule & Order of Business
        </p>
      </header>
      {content}
    </div>
  );
};
