import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Vote, User } from "lucide-react";

const statusColors: Record<string, string> = {
  upcoming: "bg-warning/10 text-warning border-warning/20",
  active: "bg-accent/10 text-accent border-accent/20",
  completed: "bg-muted text-muted-foreground border-border",
};

const Elections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedElection, setSelectedElection] = useState<string | null>(null);

  const { data: elections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: candidates } = useQuery({
    queryKey: ["candidates", selectedElection],
    queryFn: async () => {
      if (!selectedElection) return [];
      const { data } = await supabase.from("candidates").select("*").eq("election_id", selectedElection);
      return data ?? [];
    },
    enabled: !!selectedElection,
  });

  const { data: myVotes } = useQuery({
    queryKey: ["my-votes"],
    queryFn: async () => {
      const { data } = await supabase.from("votes").select("election_id");
      return data ?? [];
    },
  });

  const votedElections = new Set(myVotes?.map((v) => v.election_id));

  const voteMutation = useMutation({
    mutationFn: async ({ candidateId, electionId }: { candidateId: string; electionId: string }) => {
      const { error } = await supabase.from("votes").insert({
        user_id: user!.id,
        candidate_id: candidateId,
        election_id: electionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vote Cast!", description: "Your vote has been recorded successfully." });
      queryClient.invalidateQueries({ queryKey: ["my-votes"] });
      setSelectedElection(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const hasVoted = selectedElection ? votedElections.has(selectedElection) : false;
  const currentElection = elections?.find((e) => e.id === selectedElection);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-heading text-2xl font-bold text-foreground">Elections</h1>
      <p className="text-muted-foreground text-sm">View and participate in active elections</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {elections?.map((election) => (
          <Card key={election.id} className="glass-card hover:shadow-xl transition-shadow cursor-pointer" onClick={() => setSelectedElection(election.id)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={statusColors[election.status] ?? ""}>
                  {election.status}
                </Badge>
                <Badge variant="secondary">{election.election_type === "council" ? "Student Council" : "CR Election"}</Badge>
              </div>
              <CardTitle className="font-heading text-lg mt-2">{election.title}</CardTitle>
              <CardDescription>{election.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {election.class && <span className="text-xs text-muted-foreground">Class: {election.class}</span>}
                {votedElections.has(election.id) && (
                  <Badge className="bg-accent/10 text-accent border-accent/20" variant="outline">Voted ✓</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {elections?.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">No elections available yet.</p>
        )}
      </div>

      <Dialog open={!!selectedElection} onOpenChange={() => setSelectedElection(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{currentElection?.title}</DialogTitle>
            <DialogDescription>{currentElection?.description}</DialogDescription>
          </DialogHeader>
          {hasVoted ? (
            <p className="text-center py-4 text-accent font-medium">✓ You have already voted in this election.</p>
          ) : currentElection?.status !== "active" ? (
            <p className="text-center py-4 text-muted-foreground">This election is not currently active.</p>
          ) : (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">Select a candidate to cast your vote:</p>
              {candidates?.map((c) => (
                <Card key={c.id} className="glass-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.role_title}{c.class ? ` • ${c.class}` : ""}</p>
                        {c.manifesto && <p className="text-xs text-muted-foreground mt-1 italic">"{c.manifesto}"</p>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => voteMutation.mutate({ candidateId: c.id, electionId: selectedElection! })}
                      disabled={voteMutation.isPending}
                    >
                      <Vote className="h-4 w-4 mr-1" /> Vote
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {candidates?.length === 0 && <p className="text-muted-foreground text-center py-4">No candidates yet.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Elections;
