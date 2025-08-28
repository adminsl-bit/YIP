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
import { Plus, Edit, Trash, Play, Pause, BarChart3, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  is_active: boolean;
  show_results_publicly: boolean;
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
  const [loading, setLoading] = useState(true);

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
      
      const { error } = await supabase
        .from('polls')
        .update({ is_active: newStatus })
        .eq('id', poll.id);

      if (error) throw error;

      await supabase.rpc('log_audit_event', {
        p_user_id: user?.id,
        p_action: newStatus ? 'poll_activated' : 'poll_deactivated',
        p_resource_type: 'poll',
        p_resource_id: poll.id
      });

      toast({
        title: `Poll ${newStatus ? 'Activated' : 'Deactivated'}`,
        description: `"${poll.title}" is now ${newStatus ? 'active' : 'inactive'}`
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

  const toggleResultsVisibility = async (poll: Poll) => {
    try {
      const newVisibility = !poll.show_results_publicly;
      
      const { error } = await supabase
        .from('polls')
        .update({ show_results_publicly: newVisibility })
        .eq('id', poll.id);

      if (error) throw error;

      toast({
        title: `Results ${newVisibility ? 'Public' : 'Hidden'}`,
        description: `Poll results are now ${newVisibility ? 'visible to everyone' : 'hidden from public'}`
      });

      fetchPolls();
    } catch (error) {
      console.error('Error toggling results visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update results visibility",
        variant: "destructive"
      });
    }
  };

  const deletePoll = async (pollId: string) => {
    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId);

      if (error) throw error;

      toast({
        title: "Poll Deleted",
        description: "Poll has been permanently deleted"
      });

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

  return (
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
              <TableHead>Title</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Votes</TableHead>
              <TableHead>Results</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {polls.map((poll) => (
              <TableRow key={poll.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{poll.title}</div>
                    {poll.description && (
                      <div className="text-sm text-muted-foreground">{poll.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {poll.options.map((option, index) => (
                      <div key={index} className="text-sm">
                        {option}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={poll.is_active ? "default" : "secondary"}>
                    {poll.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="font-medium">{getTotalVotes(poll.id)} votes</div>
                    <div className="text-muted-foreground">
                      {poll.options.length} options
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={poll.show_results_publicly ? "default" : "outline"}>
                    {poll.show_results_publicly ? "Public" : "Hidden"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePollStatus(poll)}
                    >
                      {poll.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleResultsVisibility(poll)}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openStageView}
                      title="Open Stage View"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePoll(poll.id)}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {polls.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No polls created yet. Create your first poll to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};