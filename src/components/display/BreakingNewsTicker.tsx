import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const BreakingNewsTicker = () => {
  const { data: activeNews } = useQuery({
    queryKey: ['active-breaking-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('breaking_news')
        .select('*, journalist_name')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  if (!activeNews || activeNews.length === 0) return null;

  const items = activeNews.map((news, i) => (
    <span key={news.id} className="inline-flex items-center gap-3 mx-8 text-sm font-medium">
      <span className="material-symbols-outlined text-[14px] opacity-60" style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span>
      <span className="font-bold opacity-80 italic">{news.journalist_name}:</span>
      <span>{news.headline}</span>
    </span>
  ));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-primary via-[#1a237e] to-primary text-white shadow-2xl">
      <div className="flex items-center gap-4 py-2.5 px-5 overflow-hidden">
        <div className="flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full shrink-0">
          <span className="material-symbols-outlined text-[16px] animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
          <span className="font-black text-[10px] uppercase tracking-widest font-headline">Breaking</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {/* Content duplicated for seamless loop (animation goes -50%) */}
          <div className="animate-marquee whitespace-nowrap inline-block">
            {items}
            {items}
          </div>
        </div>
      </div>
    </div>
  );
};
