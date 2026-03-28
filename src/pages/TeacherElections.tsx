import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserPlus, Trash2, Play, Square, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ElectionStatus = Database["public"]["Enums"]["election_status"];

const TeacherElections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [classVal, setClassVal] = useState("");
  const [candName, setCandName] = useState("");
  const [candManifesto, setCandManifesto] = useState("");

  const { data: elections } = useQuery({
    queryKey: ["cr-elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*").eq("election_type", "cr").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: candidates } = useQuery({
    queryKey: ["cr-candidates", showAddCandidate],
    queryFn: async () => {
      if (!showAddCandidate) return [];
      const { data } = await supabase.from("candidates").select("*").eq("election_id", showAddCandidate);
      return data ?? [];
    },
    enabled: !!showAddCandidate,
  });

  const createElection = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("elections").insert({
        title,
        description: desc,
        election_type: "cr" as const,
        class: classVal,
        created_by: user!.id,
        status: "upcoming" as ElectionStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "CR Election Created" });
      queryClient.invalidateQueries({ queryKey: ["cr-elections"] });
      setShowCreate(false);
      setTitle("");
      setDesc("");
      setClassVal("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addCandidate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("candidates").insert({
        election_id: showAddCandidate!,
        name: candName,
        role_title: "Class Representative",
        class: classVal,
        manifesto: candManifesto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Candidate Added" });
      queryClient.invalidateQueries({ queryKey: ["cr-candidates", showAddCandidate] });
      setCandName("");
      setCandManifesto("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeCandidate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cr-candidates", showAddCandidate] });
      toast({ title: "Candidate Removed" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ElectionStatus }) => {
      const { error } = await supabase.from("elections").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast({ title: `Election status set to ${status}` });
      queryClient.invalidateQueries({ queryKey: ["cr-elections"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-foreground">CR Elections</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New CR Election</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">New CR Election</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CR Election - CS 2024" /></div>
              <div><Label>Class</Label><Input value={classVal} onChange={(e) => setClassVal(e.target.value)} placeholder="CS-A, ECE-B..." /></div>
              <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <Button onClick={() => createElection.mutate()} disabled={!title || !classVal || createElection.isPending} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {elections?.map((e) => (
          <Card key={e.id} className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-lg">{e.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{e.class} • {e.status}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setShowAddCandidate(e.id); setClassVal(e.class ?? ""); }}>
                  <UserPlus className="h-4 w-4 mr-2" />Manage Candidates
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {e.status === "upcoming" && (
                  <Button size="sm" onClick={() => updateStatus.mutate({ id: e.id, status: "active" })} disabled={updateStatus.isPending}>
                    <Play className="h-3 w-3 mr-1" />Start Election
                  </Button>
                )}
                {e.status === "active" && (
                  <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: e.id, status: "completed" })} disabled={updateStatus.isPending}>
                    <Square className="h-3 w-3 mr-1" />End Election
                  </Button>
                )}
                {e.status === "completed" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: e.id, status: "upcoming" })} disabled={updateStatus.isPending}>
                    <Clock className="h-3 w-3 mr-1" />Reset to Upcoming
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog open={!!showAddCandidate} onOpenChange={() => setShowAddCandidate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Manage Candidates</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {candidates?.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-foreground">{c.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeCandidate.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <hr className="border-border" />
            <div><Label>Candidate Name</Label><Input value={candName} onChange={(e) => setCandName(e.target.value)} /></div>
            <div><Label>Manifesto</Label><Textarea value={candManifesto} onChange={(e) => setCandManifesto(e.target.value)} /></div>
            <Button onClick={() => addCandidate.mutate()} disabled={!candName || addCandidate.isPending} className="w-full">Add Candidate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherElections;
