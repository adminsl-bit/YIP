import React from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GripVertical, Play, Pause, Square, RotateCcw, CheckCircle, BarChart, Clock, Eye, Pencil, Trash2, ChevronDown, Activity, PlayCircle } from "lucide-react";
import { SessionSubItems } from "./SessionSubItems";

interface SessionItem {
  id: string;
  title: string;
  bill_type: 'private_member_bill' | 'government_bill' | 'committee_report' | 'question_hour' | 'general_discussion';
  description: string | null;
  sort_order: number;
  timer_id: string | null;
  poll_id: string | null;
  status: 'pending' | 'active' | 'completed';
  is_active: boolean;
  session_date: string | null;
  created_at: string;
}

interface TimerSession {
  id: string;
  title: string;
  status: string;
  remaining_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

interface Poll {
  id: string;
  title: string;
  is_active: boolean;
  show_results_publicly: boolean;
}

interface SortableSessionItemProps {
  item: SessionItem;
  index: number;
  availableTimers: TimerSession[];
  availablePolls: Poll[];
  loading: boolean;
  expandedAccordions: Record<string, string>;
  onExpandChange: (itemId: string, value: string) => void;
  onTimerControl: (timerId: string | null, action: 'start' | 'pause' | 'stop' | 'reset') => void;
  onPollToggle: (pollId: string | null, currentActive: boolean) => void;
  onPollResultsToggle: (pollId: string | null, currentStatus: boolean) => void;
  onEditSession: (session: SessionItem) => void;
  onDeleteSession: (sessionId: string) => void;
  onActivateItem: (itemId: string, currentActive: boolean) => void;
  onCompleteItem: (itemId: string) => void;
  getBillTypeBadge: (type: string) => JSX.Element;
  getStatusBadge: (status: string) => JSX.Element;
  formatTime: (seconds: number) => string;
  isAdminStudent?: boolean;
  getDisplayedRemaining: (timer: TimerSession | undefined) => number;
}

export const SortableSessionItem = React.memo(({
  item,
  index,
  availableTimers,
  availablePolls,
  loading,
  expandedAccordions,
  onExpandChange,
  onTimerControl,
  onPollToggle,
  onPollResultsToggle,
  onEditSession,
  onDeleteSession,
  onActivateItem,
  onCompleteItem,
  getBillTypeBadge,
  getStatusBadge,
  formatTime,
  isAdminStudent = false,
    getDisplayedRemaining,
  }: SortableSessionItemProps) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const getBillTypeLabel = (type: string) => {
      switch (type) {
        case 'government_bill': return 'Govt Bill';
        case 'private_member_bill': return 'Private Bill';
        case 'committee_report': return 'Committee';
        case 'question_hour': return 'Question';
        case 'general_discussion': return 'Discussion';
        default: return type;
      }
    };

  const linkedTimer = availableTimers.find(t => t.id === item.timer_id);
  const linkedPoll = availablePolls.find(p => p.id === item.poll_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-visible transition-all duration-300 ${isDragging ? 'z-50' : 'z-0'}`}
    >
      <div className={`
        relative bg-white rounded-3xl p-6 shadow-sm border-l-4 transition-all duration-300
        ${item.is_active ? 'border-[#13298f] shadow-md -translate-x-1' : 'border-transparent'}
        ${item.status === 'completed' ? 'opacity-70 grayscale-[0.2]' : 'opacity-100'}
        hover:shadow-md hover:border-[#13298f]/20
      `}>
        {/* Play Icon Badge for Active Items */}
        {item.is_active && (
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 size-6 bg-[#13298f] rounded-full flex items-center justify-center text-white ring-4 ring-[#f2f4f6] z-10 animate-in zoom-in duration-500">
            <span className="material-symbols-outlined text-[12px] font-black">play_arrow</span>
          </div>
        )}

        <div className="flex justify-between items-start">
          <div className="flex-1 ml-2">
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                item.is_active ? 'text-[#13298f]' : 
                item.status === 'completed' ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                {item.is_active ? 'Ongoing Debate' : 
                 item.status === 'completed' ? 'Session Complete' : 'Up Next'}
              </span>
              <span className="text-slate-300 font-bold text-[10px] uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">
                {getBillTypeLabel(item.bill_type)}
              </span>
            </div>

            <Accordion 
              type="single" 
              collapsible 
              value={expandedAccordions[item.id] || ""}
              onValueChange={(value) => onExpandChange(item.id, value)}
              className="border-none"
            >
              <AccordionItem value="session-details" className="border-none">
                <AccordionTrigger className="hover:no-underline py-0 flex-none [&[data-state=open]>svg]:rotate-180 group/trigger">
                  <h3 className="text-xl font-black text-[#191c1e] tracking-tight group-hover/trigger:text-[#13298f] transition-colors">{item.title}</h3>
                </AccordionTrigger>

                <AccordionContent className="pt-4 border-none">
                  {item.description && (
                    <p className="text-sm font-bold text-[#454653] mb-6 leading-relaxed opacity-80">{item.description}</p>
                  )}
                  <SessionSubItems sessionId={item.id} isSessionActive={item.is_active} isAdminStudent={isAdminStudent} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Feature Badges & Controls */}
            <div className="flex flex-wrap gap-3 mt-4">
              {linkedTimer && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  linkedTimer.status === 'running' ? 'bg-[#fe6f42]/10 text-[#ac3509] border border-[#fe6f42]/20' : 'bg-slate-50 text-slate-500 border border-slate-100'
                }`}>
                  <span className="material-symbols-outlined text-sm font-black">timer</span>
                  {formatTime(getDisplayedRemaining(linkedTimer))}
                  {item.is_active && (
                    <div className="flex gap-1.5 border-l border-current ml-2 pl-2">
                      {linkedTimer.status === 'running' ? (
                        <button onClick={() => onTimerControl(item.timer_id, 'pause')} className="hover:scale-110"><Pause className="w-3 h-3" /></button>
                      ) : (
                        <button onClick={() => onTimerControl(item.timer_id, 'start')} className="hover:scale-110"><Play className="w-3 h-3" /></button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {linkedPoll && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  linkedPoll.is_active ? 'bg-[#42d59a]/10 text-[#005236] border border-[#42d59a]/20' : 'bg-slate-50 text-slate-500 border border-slate-100'
                }`}>
                  <span className="material-symbols-outlined text-sm font-black">how_to_vote</span>
                  Poll {linkedPoll.is_active ? 'Active' : 'Closed'}
                  {item.is_active && (
                    <button onClick={() => onPollToggle(item.poll_id, linkedPoll.is_active)} className="ml-1 opacity-60 hover:opacity-100">
                       <span className="material-symbols-outlined text-xs">{linkedPoll.is_active ? 'close' : 'check'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons for Pending Items */}
              {!item.is_active && item.status !== 'completed' && (
                <>
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#454653] hover:bg-slate-50 transition-all">
                    <span className="material-symbols-outlined text-sm">add_alarm</span> Link Timer
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#454653] hover:bg-slate-50 transition-all">
                    <span className="material-symbols-outlined text-sm">poll</span> Attach Poll
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
             {/* DRAG HANDLE / ACTION MENU */}
             <div className="flex items-center gap-2">
                {!isAdminStudent && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditSession(item)} className="p-2 text-slate-400 hover:text-[#13298f] hover:bg-slate-50 rounded-lg">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => onDeleteSession(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                )}
                <button
                  {...attributes}
                  {...listeners}
                  className="p-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
                >
                  <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                </button>
             </div>

             <div className="mt-auto">
                {item.status !== 'completed' ? (
                  <button 
                    onClick={() => onActivateItem(item.id, item.is_active)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${
                      item.is_active 
                      ? 'bg-[#ffdbd0] text-[#852300] hover:bg-[#ffb59f]' 
                      : 'bg-[#13298f] text-white hover:shadow-lg hover:shadow-blue-900/20 active:scale-95'
                    }`}
                  >
                    {item.is_active ? 'Deactivate' : 'Activate Session'}
                  </button>
                ) : (
                  <button className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default">
                    Completed
                  </button>
                )}
                {!item.is_active && item.status === 'active' && (
                   <button onClick={() => onCompleteItem(item.id)} className="ml-2 p-2 bg-emerald-500/10 text-emerald-600 rounded-xl group-hover:bg-emerald-500/20">
                     <CheckCircle className="w-4 h-4" />
                   </button>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
});

SortableSessionItem.displayName = "SortableSessionItem";
