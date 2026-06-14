import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Gavel } from "lucide-react";

interface BillDoc {
  id: string;
  user_id: string;
  file_name: string;
  discussion_order: number | null;
  is_discussing: boolean;
}

interface ProfileLite {
  name?: string;
  party_name?: string | null;
  committee?: string | null;
  constituency?: string | null;
}

export const BillsDisplay = () => {
  const [bills, setBills] = useState<BillDoc[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from('student_documents' as any)
      .select('id, user_id, file_name, discussion_order, is_discussing')
      .eq('is_selected', true)
      .order('discussion_order', { ascending: true });

    if (!error) {
      const docs = (data as any as BillDoc[]) || [];
      setBills(docs);

      const userIds = [...new Set(docs.map(d => d.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, party_name, committee, constituency')
          .in('user_id', userIds);
        const map: Record<string, ProfileLite> = {};
        (profilesData || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBills();
    const channel = supabase
      .channel('display_bills_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_documents' }, fetchBills)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-50">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
          <Gavel className="w-10 h-10 text-primary/20" />
        </div>
        <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-400">
          No Bills Selected For Discussion
        </p>
      </div>
    );
  }

  const currentIndex = bills.findIndex(b => b.is_discussing);
  const current = currentIndex !== -1 ? bills[currentIndex] : null;
  const currentProfile = current ? profiles[current.user_id] : null;

  return (
    <div className="flex flex-col items-center h-full bg-slate-50 px-8 md:px-20 py-10 gap-8 overflow-y-auto">
      {/* Current bill */}
      {current ? (
        <div className="w-full max-w-5xl flex flex-col items-center gap-6">
          <span className="px-5 py-2 rounded-full bg-secondary text-white text-xs font-black uppercase tracking-[0.2em] font-headline shadow-lg shadow-secondary/20 animate-pulse">
            Now Discussing
          </span>
          <div className="bg-white rounded-[2.5rem] border border-outline-variant/10 shadow-2xl shadow-primary/5 p-10 md:p-16 w-full text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Bill #{currentIndex + 1}</p>
            <p className="text-2xl md:text-4xl font-bold font-headline text-on-surface leading-relaxed">
              {current.file_name}
            </p>
          </div>
          <div className="flex items-center gap-5 bg-white rounded-3xl border border-outline-variant/10 shadow-sm px-8 py-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl shrink-0">
              {(currentProfile?.name || '?').charAt(0)}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Moved By</p>
              <p className="text-xl font-extrabold font-headline text-on-surface">{currentProfile?.name || 'Unknown Delegate'}</p>
              <p className="text-sm font-bold text-primary/70 mt-0.5">
                {currentProfile?.party_name || currentProfile?.committee || currentProfile?.constituency || ''}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-5xl flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
            <Gavel className="w-10 h-10 text-primary/20" />
          </div>
          <p className="text-[10px] font-headline font-black uppercase tracking-[0.4em] text-slate-400">
            Awaiting Next Bill
          </p>
        </div>
      )}

      {/* Full selected bills list */}
      <div className="w-full max-w-5xl space-y-2 pb-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Discussion Order</p>
        {bills.map((bill, idx) => {
          const p = profiles[bill.user_id];
          const label = bill.is_discussing ? 'Discussing' : idx < currentIndex ? 'Done' : idx === currentIndex + 1 ? 'Up Next' : 'Queued';
          const cls = bill.is_discussing
            ? 'bg-secondary/15 text-secondary'
            : idx < currentIndex
            ? 'bg-surface-variant text-on-surface-variant'
            : 'bg-primary/10 text-primary';
          return (
            <div
              key={bill.id}
              className={`flex items-center gap-4 px-5 py-3 rounded-2xl bg-white border ${bill.is_discussing ? 'border-secondary/20' : 'border-outline-variant/10'}`}
            >
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold font-headline text-on-surface text-sm truncate">{bill.file_name}</p>
                <p className="text-[10px] text-on-surface-variant/60 font-black uppercase tracking-widest font-headline mt-0.5">
                  {p?.name || 'Unknown'} {p?.party_name ? `· ${p.party_name}` : p?.committee ? `· ${p.committee}` : ''}
                </p>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full font-headline shrink-0 ${cls}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
