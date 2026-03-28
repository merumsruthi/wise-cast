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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus, Pencil, Trash2, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ElectionStatus = Database["public"]["Enums"]["election_status"];
type ElectionType = Database["public"]["Enums"]["election_type"];

const AdminElections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState<string | null>(null);
  const [editCandidate, setEditCandidate] = useState<any | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  // Election form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [electionType, setElectionType] = useState<ElectionType>("council");
  const [electionClass, setElectionClass] = useState("");

  // Candidate form
  const [candName, setCandName] = useState("");
  const [candRole, setCandRole] = useState("");
  const [candClass, setCandClass] = useState("");
  const [candManifesto, setCandManifesto] = useState("");

  const { data: elections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: allCandidates } = useQuery({
    queryKey: ["all-candidates"],
    queryFn: async () => {
      const { data } = await supabase.from("candidates").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const candidatesForElection = allCandidates?.filter((c) => c.election_id === showCandidates) ?? [];

  const createElection = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("elections").insert({
        title,
        description: desc,
        election_type: electionType,
        created_by: user!.id,
        status: "upcoming" as ElectionStatus,
        class: electionType === "cr" ? electionClass : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Election Created" });
      queryClient.invalidateQueries({ queryKey: ["elections"] });
      setShowCreate(false);
      setTitle("");
      setDesc("");
      setElectionClass("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addCandidate = useMutation({
    mutationFn: async () => {
      const election = elections?.find((e) => e.id === showAddCandidate);
      const { error } = await supabase.from("candidates").insert({
        election_id: showAddCandidate!,
        name: candName,
        role_title: candRole,
        class: election?.election_type === "cr" ? candClass : null,
        manifesto: candManifesto || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Candidate Added" });
      queryClient.invalidateQueries({ queryKey: ["all-candidates"] });
      setShowAddCandidate(null);
      resetCandForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateCandidateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("candidates").update({
        name: candName,
        role_title: candRole,
        class: candClass || null,
        manifesto: candManifesto || null,
      }).eq("id", editCandidate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Candidate Updated" });
      queryClient.invalidateQueries({ queryKey: ["all-candidates"] });
      setEditCandidate(null);
      resetCandForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteCandidateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Candidate Deleted" });
      queryClient.invalidateQueries({ queryKey: ["all-candidates"] });
      setDeleteCandidate(null);
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

  const resetCandForm = () => {
    setCandName("");
    setCandRole("");
    setCandClass("");
    setCandManifesto("");
  };

  const openEditCandidate = (c: any) => {
    setEditCandidate(c);
    setCandName(c.name);
    setCandRole(c.role_title);
    setCandClass(c.class ?? "");
    setCandManifesto(c.manifesto ?? "");
  };

  const statusColor: Record<string, string> = {
    upcoming: "bg-warning/10 text-warning",
    active: "bg-accent/10 text-accent",
    completed: "bg-muted text-muted-foreground",
  };

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
                <Select value={electionType} onValueChange={(v) => setElectionType(v as ElectionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="council">Student Council</SelectItem>
                    <SelectItem value="cr">Class Representative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {electionType === "cr" && (
                <div><Label>Class</Label><Input value={electionClass} onChange={(e) => setElectionClass(e.target.value)} placeholder="CS-A" /></div>
              )}
              <Button onClick={() => createElection.mutate()} disabled={!title || createElection.isPending} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Elections list */}
      <div className="space-y-4">
        {elections?.map((e) => (
          <Card key={e.id} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading text-lg">{e.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary">{e.election_type === "council" ? "Student Council" : "CR"}</Badge>
                  {e.class && <Badge variant="outline">{e.class}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColor[e.status] ?? ""}>{e.status}</Badge>
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
            <CardContent className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowAddCandidate(e.id); resetCandForm(); }}>
                <UserPlus className="h-4 w-4 mr-2" />Add Candidate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCandidates(showCandidates === e.id ? null : e.id)}>
                <Users className="h-4 w-4 mr-2" />
                {showCandidates === e.id ? "Hide" : "View"} Candidates ({allCandidates?.filter((c) => c.election_id === e.id).length ?? 0})
              </Button>
            </CardContent>
            {/* Candidate table inline */}
            {showCandidates === e.id && (
              <CardContent className="pt-0">
                {candidatesForElection.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No candidates yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Manifesto</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidatesForElection.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.role_title}</TableCell>
                          <TableCell>{c.class ?? "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{c.manifesto ?? "—"}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditCandidate(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteCandidate(c.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Add Candidate Dialog */}
      <Dialog open={!!showAddCandidate} onOpenChange={() => setShowAddCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={candName} onChange={(e) => setCandName(e.target.value)} placeholder="Candidate name" /></div>
            <div><Label>Role</Label>
              <Select value={candRole} onValueChange={setCandRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="President">President</SelectItem>
                  <SelectItem value="Vice President">Vice President</SelectItem>
                  <SelectItem value="Secretary">Secretary</SelectItem>
                  <SelectItem value="Joint Secretary">Joint Secretary</SelectItem>
                  <SelectItem value="Class Representative">Class Representative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {elections?.find((e) => e.id === showAddCandidate)?.election_type === "cr" && (
              <div><Label>Class</Label><Input value={candClass} onChange={(e) => setCandClass(e.target.value)} placeholder="CS-A" /></div>
            )}
            <div><Label>Manifesto</Label><Textarea value={candManifesto} onChange={(e) => setCandManifesto(e.target.value)} placeholder="Campaign promises..." /></div>
            <Button onClick={() => addCandidate.mutate()} disabled={!candName || !candRole || addCandidate.isPending} className="w-full">Add Candidate</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Dialog */}
      <Dialog open={!!editCandidate} onOpenChange={() => { setEditCandidate(null); resetCandForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={candName} onChange={(e) => setCandName(e.target.value)} /></div>
            <div><Label>Role</Label>
              <Select value={candRole} onValueChange={setCandRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="President">President</SelectItem>
                  <SelectItem value="Vice President">Vice President</SelectItem>
                  <SelectItem value="Secretary">Secretary</SelectItem>
                  <SelectItem value="Joint Secretary">Joint Secretary</SelectItem>
                  <SelectItem value="Class Representative">Class Representative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Class</Label><Input value={candClass} onChange={(e) => setCandClass(e.target.value)} /></div>
            <div><Label>Manifesto</Label><Textarea value={candManifesto} onChange={(e) => setCandManifesto(e.target.value)} /></div>
            <Button onClick={() => updateCandidateMut.mutate()} disabled={!candName || !candRole || updateCandidateMut.isPending} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The candidate will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCandidate && deleteCandidateMut.mutate(deleteCandidate)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminElections;
