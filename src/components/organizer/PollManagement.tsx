import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Trash, Play, Pause, MoreVertical, ExternalLink, Eye } from "lucide-react";
import { LiveVotingStats } from "@/components/student/LiveVotingStats";
import { PostVotingAnalysis } from "@/components/student/PostVotingAnalysis";
import { DetailedPollResults } from "@/components/student/DetailedPollResults";
import { toast } from "@/hooks/use-toast";

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  is_active: boolean;
  show_results_publicly: boolean;
  show_post_analysis: boolean;
  created_at: string;
  starts_at?: string;
  ends_at?: string;
}

interface PollVote {
  option_id: string;
  count: number;
}

export const PollManagement = () => {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [pollResults, setPollResults] = useState<Record<string, PollVote[]>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showPostVotingAnalysis, setShowPostVotingAnalysis] = useState<string | null>(null);
  const [showDetailedResults, setShowDetailedResults] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    options: ["", ""]
  });

  useEffect(() => {
    fetchPolls();
  }, []);

  useEffect(() => {
    // Fetch results for all polls
    polls.forEach(poll => {
      fetchPollResults(poll.id);
    });
  }, [polls]);

  // Realtime subscriptions: keep votes and poll list in sync without refresh
  useEffect(() => {
    const channel = supabase
      .channel('organizer_poll_management')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        (payload) => {
          const pollId = (payload as any)?.new?.poll_id || (payload as any)?.old?.poll_id;
          if (pollId) {
            fetchPollResults(pollId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          fetchPolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPolls = async () => {
    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolls((data || []) as Poll[]);
    } catch (error) {
      console.error('Error fetching polls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPollResults = async (pollId: string) => {
    try {
      const { data, error } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', pollId);

      if (error) throw error;

      // Count votes for each option
      const voteCounts: Record<string, number> = {};
      data?.forEach(vote => {
        voteCounts[vote.option_id] = (voteCounts[vote.option_id] || 0) + 1;
      });

      const results: PollVote[] = Object.entries(voteCounts).map(([option_id, count]) => ({
        option_id,
        count
      }));

      setPollResults(prev => ({ ...prev, [pollId]: results }));
    } catch (error) {
      console.error('Error fetching poll results:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      options: ["", ""]
    });
  };

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, ""]
    }));
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      setFormData(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
  };

  const createPoll = async () => {
    if (!user || !formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const validOptions = formData.options.filter(opt => opt.trim()).map(opt => opt.trim());
    if (validOptions.length < 2) {
      toast({
        title: "Error",
        description: "Please provide at least 2 options",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('polls')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim(),
          options: validOptions,
          created_by: user.id
        });

      if (error) throw error;

      await supabase.rpc('log_audit_event', {
        p_user_id: user.id,
        p_action: 'poll_created',
        p_resource_type: 'poll',
        p_details: { title: formData.title, options_count: validOptions.length }
      });

      toast({
        title: "Poll Created",
        description: "New poll has been created successfully"
      });

      resetForm();
      setIsCreateDialogOpen(false);
      fetchPolls();
    } catch (error) {
      console.error('Error creating poll:', error);
      toast({
        title: "Error",
        description: "Failed to create poll",
        variant: "destructive"
      });
    }
  };

  const togglePollStatus = async (poll: Poll) => {
    try {
      const newStatus = !poll.is_active;
      
      // When starting a poll, automatically make results public
      // When stopping a poll, enable post-analysis
      const updates: any = { is_active: newStatus };
      if (newStatus) {
        updates.show_results_publicly = true;
      } else {
        updates.show_post_analysis = true;
      }
      
      const { error } = await supabase
        .from('polls')
        .update(updates)
        .eq('id', poll.id);

      if (error) throw error;

      await supabase.rpc('log_audit_event', {
        p_user_id: user?.id,
        p_action: newStatus ? 'poll_activated' : 'poll_deactivated',
        p_resource_type: 'poll',
        p_resource_id: poll.id
      });

      toast({
        title: newStatus ? "Poll Started" : "Poll Stopped",
        description: newStatus 
          ? `"${poll.title}" is now accepting votes` 
          : `"${poll.title}" voting has ended and results are visible`
      });

      fetchPolls();
    } catch (error) {
      console.error('Error toggling poll status:', error);
      toast({
        title: "Error",
        description: "Failed to update poll status",
        variant: "destructive"
      });
    }
  };

  const deletePoll = async (poll: Poll) => {
    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', poll.id);

      if (error) throw error;

      toast({
        title: "Poll Deleted",
        description: "Poll has been permanently deleted"
      });

      setPollToDelete(null);
      fetchPolls();
    } catch (error) {
      console.error('Error deleting poll:', error);
      toast({
        title: "Error",
        description: "Failed to delete poll",
        variant: "destructive"
      });
    }
  };

  const getTotalVotes = (pollId: string) => {
    const results = pollResults[pollId] || [];
    return results.reduce((total, result) => total + result.count, 0);
  };

  const openStageView = () => {
    const stageUrl = '/display/polls';
    console.log('Opening poll stage view at:', stageUrl);
    const newWindow = window.open(stageUrl, '_blank', 'width=1200,height=800,fullscreen=yes');
    if (!newWindow) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups and try again, or manually navigate to /display/polls",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Stage View Opened",
        description: "Poll display opened in new window"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Poll Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activePolls = polls.filter(poll => poll.is_active);

  return (
    <div className="space-y-6">
      {/* Live Statistics for Active Polls */}
      {activePolls.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Live Voting Statistics</h3>
            <p className="text-slate-600">Real-time voting data for active polls</p>
          </div>
          {activePolls.map((poll) => (
            <div key={poll.id} className="space-y-6">
              <LiveVotingStats key={poll.id} pollId={poll.id} />
              
              {/* Post-Voting Analysis */}
              {showPostVotingAnalysis === poll.id && (
                <PostVotingAnalysis pollId={poll.id} pollTitle={poll.title} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Poll Management Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Poll Management</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Poll
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Poll</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Title *</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter poll title"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Options *</label>
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2 mt-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                        />
                        {formData.options.length > 2 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeOption(index)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      className="mt-2"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                  <div className="flex space-x-2 pt-4">
                    <Button onClick={createPoll} className="flex-1">
                      Create Poll
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poll</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Votes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polls.map((poll) => [
                <TableRow key={poll.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{poll.title}</div>
                      {poll.description && (
                        <div className="text-sm text-muted-foreground mt-1">{poll.description}</div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(Array.isArray(poll.options) ? poll.options : []).map((option: any, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {typeof option === 'string' ? option : option.text}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={poll.is_active ? "default" : "secondary"}>
                      {poll.is_active ? "Live" : "Ended"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{getTotalVotes(poll.id)} votes</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end items-center gap-2">
                      {/* Primary Action: Start/Stop Poll */}
                      <Button
                        variant={poll.is_active ? "destructive" : "default"}
                        size="sm"
                        onClick={() => togglePollStatus(poll)}
                      >
                        {poll.is_active ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Start
                          </>
                        )}
                      </Button>
                      
                      {/* View Results Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDetailedResults(showDetailedResults === poll.id ? null : poll.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Results
                      </Button>
                      
                      {/* More Options Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={openStageView}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open Stage Display
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setPollToDelete(poll)}
                            className="text-destructive"
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete Poll
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>,
                ...(showDetailedResults === poll.id ? [
                  <TableRow key={`${poll.id}-details`}>
                    <TableCell colSpan={6} className="p-0">
                      <div className="p-4 bg-gray-50/50 max-h-[600px] overflow-hidden">
                        <DetailedPollResults 
                          pollId={poll.id} 
                          pollTitle={poll.title} 
                          options={Array.isArray(poll.options) ? poll.options.map((opt: any) => 
                            typeof opt === 'string' ? { id: opt, text: opt } : opt
                          ) : []} 
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ] : [])
              ]).flat()}
            </TableBody>
          </Table>

          {polls.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No polls created yet. Create your first poll to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!pollToDelete} onOpenChange={() => setPollToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Poll?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{pollToDelete?.title}"? This action cannot be undone and will permanently remove all votes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => pollToDelete && deletePoll(pollToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};