import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ElectionStatus = Database["public"]["Enums"]["election_status"];

const AdminElections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [electionType, setElectionType] = useState<"council" | "cr">("council");

  const [candName, setCandName] = useState("");
  const [candRole, setCandRole] = useState("");
  const [candManifesto, setCandManifesto] = useState("");

  const { data: elections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createElection = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("elections").insert({
        title,
        description: desc,
        election_type: electionType,
        created_by: user!.id,
        status: "upcoming" as ElectionStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Election Created" });
      queryClient.invalidateQueries({ queryKey: ["elections"] });
      setShowCreate(false);
      setTitle("");
      setDesc("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addCandidate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("candidates").insert({
        election_id: showAddCandidate!,
        name: candName,
        role_title: candRole,
        manifesto: candManifesto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Candidate Added" });
      queryClient.invalidateQueries({ queryKey: ["all-candidates"] });
      setShowAddCandidate(null);
      setCandName("");
      setCandRole("");
      setCandManifesto("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ElectionStatus }) => {
      const { error } = await supabase.from("elections").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elections"] });
      toast({ title: "Status Updated" });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-foreground">Manage Elections</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Election</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">New Election</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Student Council President" /></div>
              <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Election description..." /></div>
              <div><Label>Type</Label>
                <Select value={electionType} onValueChange={(v) => setElectionType(v as "council" | "cr")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="council">Student Council</SelectItem>
                    <SelectItem value="cr">Class Representative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createElection.mutate()} disabled={!title || createElection.isPending} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {elections?.map((e) => (
          <Card key={e.id} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading text-lg">{e.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{e.election_type}</Badge>
                <Select value={e.status} onValueChange={(v) => updateStatus.mutate({ id: e.id, status: v as ElectionStatus })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => setShowAddCandidate(e.id)}>
                <UserPlus className="h-4 w-4 mr-2" />Add Candidate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!showAddCandidate} onOpenChange={() => setShowAddCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={candName} onChange={(e) => setCandName(e.target.value)} placeholder="Candidate name" /></div>
            <div><Label>Role</Label><Input value={candRole} onChange={(e) => setCandRole(e.target.value)} placeholder="President, VP, Secretary..." /></div>
            <div><Label>Manifesto</Label><Textarea value={candManifesto} onChange={(e) => setCandManifesto(e.target.value)} placeholder="Campaign promises..." /></div>
            <Button onClick={() => addCandidate.mutate()} disabled={!candName || !candRole || addCandidate.isPending} className="w-full">Add Candidate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminElections;
