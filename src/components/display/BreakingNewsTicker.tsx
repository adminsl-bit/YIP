import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Newspaper } from 'lucide-react';

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
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (!activeNews || activeNews.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white shadow-2xl">
      <div className="flex items-center gap-3 sm:gap-6 py-4 sm:py-6 px-4 sm:px-8 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 bg-white/20 px-4 sm:px-6 py-2 sm:py-3 rounded-full flex-shrink-0">
          <Newspaper className="w-6 h-6 sm:w-8 sm:h-8 animate-pulse" />
          <span className="font-black text-base sm:text-xl uppercase tracking-wider">Breaking News</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap inline-block">
            {activeNews.map((news, index) => (
              <span key={news.id} className="inline-block mx-6 sm:mx-12 text-lg sm:text-2xl font-medium">
                <span className="font-bold">{news.journalist_name}:</span> {news.headline}
                {index < activeNews.length - 1 && (
                  <span className="mx-6 text-white/60">•</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
