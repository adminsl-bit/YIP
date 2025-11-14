import React from "react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GripVertical, Play, Pause, Square, RotateCcw, CheckCircle, BarChart, Clock, Eye, Pencil, Trash2 } from "lucide-react";
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
}

interface Poll {
  id: string;
  title: string;
  is_active: boolean;
  show_results_publicly: boolean;
}

interface SortableSessionItemProps {
  item: SessionItem;
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
}

export const SortableSessionItem = React.memo(({
  item,
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

  const linkedTimer = availableTimers.find(t => t.id === item.timer_id);
  const linkedPoll = availablePolls.find(p => p.id === item.poll_id);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${item.is_active ? 'border-primary shadow-md' : ''} ${isDragging ? 'shadow-lg' : ''}`}
    >
      <Accordion 
        type="single" 
        collapsible 
        className="w-full"
        value={expandedAccordions[item.id] || ""}
        onValueChange={(value) => onExpandChange(item.id, value)}
      >
        <AccordionItem value="session-details" className="border-none">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <button
                className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded-md transition-colors mt-1"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </button>

              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <AccordionTrigger className="hover:no-underline py-0 flex-none [&[data-state=open]>svg]:rotate-180">
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                  </AccordionTrigger>
                  {getBillTypeBadge(item.bill_type)}
                  {getStatusBadge(item.status)}
                  {item.is_active && (
                    <Badge className="bg-primary">
                      Live on Display
                    </Badge>
                  )}
                </div>

                {item.description && (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                )}

            <div className="flex items-center gap-4 flex-wrap">
              {linkedTimer && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-mono">{formatTime(linkedTimer.remaining_seconds)}</span>
                  <div className="flex gap-1">
                    {linkedTimer.status === 'running' ? (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => onTimerControl(item.timer_id, 'pause')} 
                        title="Pause"
                        className="transition-all duration-200 hover:scale-105"
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => onTimerControl(item.timer_id, 'start')} 
                        title="Play"
                        className="transition-all duration-200 hover:scale-105"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => onTimerControl(item.timer_id, 'stop')} 
                      title="Stop"
                      className="transition-all duration-200 hover:scale-105"
                    >
                      <Square className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => onTimerControl(item.timer_id, 'reset')} 
                      title="Reset"
                      className="transition-all duration-200 hover:scale-105"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {linkedPoll && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md flex-wrap">
                  <BarChart className="h-4 w-4" />
                  <span className="text-sm">{linkedPoll.title}</span>
                  <Button 
                    size="sm" 
                    variant={linkedPoll.is_active ? "default" : "outline"}
                    onClick={() => onPollToggle(item.poll_id, linkedPoll.is_active)}
                    className="transition-all duration-200"
                  >
                    {linkedPoll.is_active ? 'Close' : 'Open'} Voting
                  </Button>
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Public Results</span>
                    <Switch
                      checked={linkedPoll.show_results_publicly}
                      onCheckedChange={() => onPollResultsToggle(item.poll_id, linkedPoll.show_results_publicly)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAdminStudent && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditSession(item)}
                  disabled={loading}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteSession(item.id)}
                  disabled={loading}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                
                <div className="h-6 w-px bg-border mx-1" />
              </>
            )}
            
            <Button
              size="sm"
              variant={item.is_active ? "default" : "outline"}
              onClick={() => onActivateItem(item.id, item.is_active)}
              disabled={loading}
            >
              {item.is_active ? 'Deactivate' : 'Activate'}
            </Button>

            {item.status !== 'completed' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCompleteItem(item.id)}
                disabled={loading}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <AccordionContent forceMount className="px-4 pb-4 pt-0 data-[state=open]:animate-none data-[state=closed]:animate-none">
        <SessionSubItems sessionId={item.id} isSessionActive={item.is_active} />
      </AccordionContent>
    </AccordionItem>
    </Accordion>
  </Card>
  );
});

SortableSessionItem.displayName = "SortableSessionItem";
