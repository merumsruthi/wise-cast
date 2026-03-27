import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Vote, User, CheckCircle, Loader2, Trophy } from "lucide-react";

const statusColors: Record<string, string> = {
  upcoming: "bg-warning/10 text-warning border-warning/20",
  active: "bg-accent/10 text-accent border-accent/20",
  completed: "bg-muted text-muted-foreground border-border",
};

interface Candidate {
  id: string;
  name: string;
  role_title: string;
  class: string | null;
  manifesto: string | null;
  photo_url: string | null;
  election_id: string;
}

interface Election {
  id: string;
  title: string;
  description: string | null;
  election_type: string;
  status: string;
  class: string | null;
}

const Elections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedElection, setSelectedElection] = useState<string | null>(null);
  const [confirmVote, setConfirmVote] = useState<{ candidateId: string; candidateName: string; role: string } | null>(null);

  const { data: elections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("elections")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Election[];
    },
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ["candidates", selectedElection],
    queryFn: async () => {
      if (!selectedElection) return [];
      const { data } = await supabase
        .from("candidates")
        .select("*")
        .eq("election_id", selectedElection);
      return (data ?? []) as Candidate[];
    },
    enabled: !!selectedElection,
  });

  const { data: myVotes, isLoading: votesLoading } = useQuery({
    queryKey: ["my-votes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("votes")
        .select("election_id, role_title, candidate_id");
      return data ?? [];
    },
  });

  // Results for completed elections
  const currentElection = elections?.find((e) => e.id === selectedElection);
  const { data: results } = useQuery({
    queryKey: ["election-results", selectedElection],
    queryFn: async () => {
      if (!selectedElection) return [];
      const { data } = await supabase.rpc("get_election_results", {
        p_election_id: selectedElection,
      });
      return data ?? [];
    },
    enabled: !!selectedElection && currentElection?.status === "completed",
  });

  // Group candidates by role
  const candidatesByRole = (candidates ?? []).reduce<Record<string, Candidate[]>>((acc, c) => {
    if (!acc[c.role_title]) acc[c.role_title] = [];
    acc[c.role_title].push(c);
    return acc;
  }, {});

  // Role ordering
  const roleOrder = ["President", "Vice President", "Secretary", "Joint Secretary"];
  const sortedRoles = Object.keys(candidatesByRole).sort((a, b) => {
    const ai = roleOrder.indexOf(a);
    const bi = roleOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Track voted roles for selected election
  const votedRolesMap = new Map<string, string>(); // role_title -> candidate_id
  myVotes
    ?.filter((v) => v.election_id === selectedElection)
    .forEach((v) => {
      if (v.role_title) votedRolesMap.set(v.role_title, v.candidate_id);
    });

  // Elections the user has voted in (any role)
  const votedElectionIds = new Set(myVotes?.map((v) => v.election_id));

  // Results grouped by role
  const resultsByRole = (results ?? []).reduce<Record<string, typeof results>>((acc, r) => {
    const role = r.role_title as string;
    if (!acc[role]) acc[role] = [];
    acc[role].push(r);
    return acc;
  }, {});

  const voteMutation = useMutation({
    mutationFn: async ({
      candidateId,
      electionId,
      roleTitle,
    }: {
      candidateId: string;
      electionId: string;
      roleTitle: string;
    }) => {
      const { error } = await supabase.from("votes").insert({
        user_id: user!.id,
        candidate_id: candidateId,
        election_id: electionId,
        role_title: roleTitle,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "✓ Vote Cast Successfully!",
        description: `Your vote for ${confirmVote?.role} has been recorded.`,
      });
      queryClient.invalidateQueries({ queryKey: ["my-votes"] });
      setConfirmVote(null);
    },
    onError: (err: any) => {
      toast({
        title: "Voting Error",
        description: err.message?.includes("duplicate")
          ? "You have already voted for this role."
          : err.message,
        variant: "destructive",
      });
      setConfirmVote(null);
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Elections</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View and participate in active elections
        </p>
      </div>

      {/* Election cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {elections?.map((election) => {
          const hasVoted = votedElectionIds.has(election.id);
          return (
            <Card
              key={election.id}
              className="glass-card hover:shadow-xl transition-shadow cursor-pointer group"
              onClick={() => setSelectedElection(election.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={statusColors[election.status] ?? ""}
                  >
                    {election.status}
                  </Badge>
                  <Badge variant="secondary">
                    {election.election_type === "council"
                      ? "Student Council"
                      : "CR Election"}
                  </Badge>
                </div>
                <CardTitle className="font-heading text-lg mt-2 group-hover:text-primary transition-colors">
                  {election.title}
                </CardTitle>
                <CardDescription>{election.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {election.class && (
                    <span className="text-xs text-muted-foreground">
                      Class: {election.class}
                    </span>
                  )}
                  {hasVoted && (
                    <Badge
                      className="bg-accent/10 text-accent border-accent/20"
                      variant="outline"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Voted
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {elections?.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">
            No elections available yet.
          </p>
        )}
      </div>

      {/* Election detail dialog */}
      <Dialog
        open={!!selectedElection}
        onOpenChange={() => setSelectedElection(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {currentElection?.title}
            </DialogTitle>
            <DialogDescription>{currentElection?.description}</DialogDescription>
            {currentElection && (
              <Badge
                variant="outline"
                className={`w-fit mt-1 ${statusColors[currentElection.status] ?? ""}`}
              >
                {currentElection.status}
              </Badge>
            )}
          </DialogHeader>

          {candidatesLoading || votesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : currentElection?.status === "completed" ? (
            /* ── RESULTS VIEW ── */
            <div className="space-y-6 mt-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Trophy className="h-4 w-4" />
                <span>Election has ended. Final results:</span>
              </div>
              {Object.entries(resultsByRole).map(([role, roleCandidates]) => {
                const maxVotes = Math.max(
                  ...(roleCandidates?.map((r) => Number(r.vote_count)) ?? [0]),
                  1
                );
                return (
                  <div key={role}>
                    <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Vote className="h-4 w-4 text-primary" />
                      {role}
                    </h3>
                    <div className="space-y-2">
                      {roleCandidates?.map((r, i) => (
                        <div
                          key={r.candidate_id}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            i === 0 ? "bg-accent/5 border border-accent/20" : "bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 shrink-0">
                            {i === 0 ? (
                              <Trophy className="h-4 w-4 text-warning" />
                            ) : (
                              <span className="font-heading font-bold text-xs text-muted-foreground">
                                {i + 1}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">
                              {r.candidate_name}
                              {i === 0 && (
                                <span className="ml-2 text-xs text-accent font-semibold">
                                  Winner
                                </span>
                              )}
                            </p>
                            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full gradient-primary transition-all duration-500"
                                style={{
                                  width: `${(Number(r.vote_count) / maxVotes) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                          <Badge variant="secondary" className="font-heading">
                            {String(r.vote_count)} votes
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(resultsByRole).length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No results available.
                </p>
              )}
            </div>
          ) : currentElection?.status === "upcoming" ? (
            <p className="text-center py-8 text-muted-foreground">
              This election hasn't started yet. Check back later.
            </p>
          ) : (
            /* ── VOTING VIEW ── */
            <div className="space-y-6 mt-2">
              {sortedRoles.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  No candidates registered yet.
                </p>
              )}
              {sortedRoles.map((role) => {
                const roleCandidates = candidatesByRole[role];
                const hasVotedForRole = votedRolesMap.has(role);
                const votedCandidateId = votedRolesMap.get(role);

                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
                        <Vote className="h-4 w-4 text-primary" />
                        {role}
                      </h3>
                      {hasVotedForRole && (
                        <Badge
                          variant="outline"
                          className="bg-accent/10 text-accent border-accent/20 text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          You have already voted for this role
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {roleCandidates.map((candidate) => {
                        const isVotedCandidate = votedCandidateId === candidate.id;
                        return (
                          <Card
                            key={candidate.id}
                            className={`transition-all ${
                              isVotedCandidate
                                ? "border-accent/40 bg-accent/5 shadow-md"
                                : "glass-card"
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                  {candidate.photo_url ? (
                                    <img
                                      src={candidate.photo_url}
                                      alt={candidate.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <User className="h-6 w-6 text-primary" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground">
                                    {candidate.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {candidate.role_title}
                                    {candidate.class
                                      ? ` • ${candidate.class}`
                                      : ""}
                                  </p>
                                  {candidate.manifesto && (
                                    <p className="text-xs text-muted-foreground mt-2 italic leading-relaxed line-clamp-3">
                                      "{candidate.manifesto}"
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3">
                                {isVotedCandidate ? (
                                  <div className="flex items-center gap-1 text-accent text-sm font-medium">
                                    <CheckCircle className="h-4 w-4" />
                                    Your vote
                                  </div>
                                ) : hasVotedForRole ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="w-full opacity-50"
                                  >
                                    Vote Submitted
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() =>
                                      setConfirmVote({
                                        candidateId: candidate.id,
                                        candidateName: candidate.name,
                                        role: candidate.role_title,
                                      })
                                    }
                                  >
                                    <Vote className="h-4 w-4 mr-1" /> Vote
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!confirmVote}
        onOpenChange={() => setConfirmVote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Confirm Your Vote
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to vote for{" "}
              <span className="font-semibold text-foreground">
                {confirmVote?.candidateName}
              </span>{" "}
              for the role of{" "}
              <span className="font-semibold text-foreground">
                {confirmVote?.role}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmVote && selectedElection) {
                  voteMutation.mutate({
                    candidateId: confirmVote.candidateId,
                    electionId: selectedElection,
                    roleTitle: confirmVote.role,
                  });
                }
              }}
              disabled={voteMutation.isPending}
            >
              {voteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Confirm Vote"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Elections;
