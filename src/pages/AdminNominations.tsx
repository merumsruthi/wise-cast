import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CalendarIcon, Trash2, CheckCircle, XCircle, Clock, Loader2, Users, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface NominationElection {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  target_election_id: string | null;
}

interface VotingElection {
  id: string;
  title: string;
  election_type: string;
  class: string | null;
}

interface NominationRole {
  id: string;
  election_id: string;
  role_name: string;
}

interface NominationApplication {
  id: string;
  election_id: string;
  role_id: string;
  user_id: string;
  student_name: string;
  roll_number: string;
  class: string;
  year: string;
  photo_url: string | null;
  achievements: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

const AdminNominations = () => {
  const { user } = useAuth();
  const [elections, setElections] = useState<NominationElection[]>([]);
  const [votingElections, setVotingElections] = useState<VotingElection[]>([]);
  const [roles, setRoles] = useState<NominationRole[]>([]);
  const [applications, setApplications] = useState<NominationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedElection, setSelectedElection] = useState<string | null>(null);

  // Create election form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState<Date | undefined>();
  const [newEndDate, setNewEndDate] = useState<Date | undefined>();
  const [newRoles, setNewRoles] = useState<string[]>([""]);

  const fetchAll = async () => {
    setLoading(true);
    const [elRes, roleRes, appRes, votingRes] = await Promise.all([
      supabase.from("nomination_elections").select("*").order("created_at", { ascending: false }),
      supabase.from("nomination_roles").select("*"),
      supabase.from("nomination_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("elections").select("id, title, election_type, class").order("created_at", { ascending: false }),
    ]);
    if (elRes.data) setElections(elRes.data as NominationElection[]);
    if (roleRes.data) setRoles(roleRes.data as NominationRole[]);
    if (appRes.data) setApplications(appRes.data as NominationApplication[]);
    if (votingRes.data) setVotingElections(votingRes.data as VotingElection[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreateElection = async () => {
    if (!newTitle.trim() || !newStartDate || !newEndDate) {
      toast.error("Please fill in title, start date, and end date.");
      return;
    }
    const validRoles = newRoles.filter(r => r.trim());
    if (validRoles.length === 0) {
      toast.error("Please add at least one role.");
      return;
    }

    setCreating(true);
    const { data: elData, error: elErr } = await supabase.from("nomination_elections").insert({
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      start_date: newStartDate.toISOString(),
      end_date: newEndDate.toISOString(),
      is_active: true,
      created_by: user?.id,
    }).select().single();

    if (elErr || !elData) {
      toast.error("Failed to create election.");
      setCreating(false);
      return;
    }

    const roleInserts = validRoles.map(r => ({ election_id: elData.id, role_name: r.trim() }));
    const { error: roleErr } = await supabase.from("nomination_roles").insert(roleInserts);
    if (roleErr) {
      toast.error("Election created but failed to add roles.");
    } else {
      toast.success("Election created successfully!");
    }

    setShowCreate(false);
    setNewTitle("");
    setNewDescription("");
    setNewStartDate(undefined);
    setNewEndDate(undefined);
    setNewRoles([""]);
    setCreating(false);
    fetchAll();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("nomination_elections").update({ is_active: !current }).eq("id", id);
    if (error) toast.error("Failed to update status.");
    else {
      toast.success(current ? "Applications disabled." : "Applications enabled.");
      fetchAll();
    }
  };

  const updateApplicationStatus = async (appId: string, status: string) => {
    const { error } = await supabase.from("nomination_applications").update({ status }).eq("id", appId);
    if (error) toast.error("Failed to update application.");
    else {
      toast.success(`Application ${status}.`);
      fetchAll();
    }
  };

  const deleteElection = async (id: string) => {
    const { error } = await supabase.from("nomination_elections").delete().eq("id", id);
    if (error) toast.error("Failed to delete election.");
    else {
      toast.success("Election deleted.");
      if (selectedElection === id) setSelectedElection(null);
      fetchAll();
    }
  };

  const electionRoles = (elId: string) => roles.filter(r => r.election_id === elId);
  const electionApps = (elId: string) => applications.filter(a => a.election_id === elId);
  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.role_name || "Unknown";

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Nomination Management</h1>
          <p className="text-muted-foreground mt-1">Create elections, define roles, and review applications</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Election</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Nomination Election</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Student Council Elections 2026" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Brief description..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Application Start</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left", !newStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newStartDate ? format(newStartDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={newStartDate} onSelect={setNewStartDate} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Application Deadline</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left", !newEndDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newEndDate ? format(newEndDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={newEndDate} onSelect={setNewEndDate} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                {newRoles.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={r}
                      onChange={e => {
                        const updated = [...newRoles];
                        updated[i] = e.target.value;
                        setNewRoles(updated);
                      }}
                      placeholder={`e.g. ${["President", "Vice President", "Secretary", "Cultural Secretary"][i] || "Role name"}`}
                    />
                    {newRoles.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setNewRoles(newRoles.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewRoles([...newRoles, ""])} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Role
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateElection} disabled={creating}>
                {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Election"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={selectedElection || "overview"} onValueChange={v => setSelectedElection(v === "overview" ? null : v)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {elections.map(el => (
            <TabsTrigger key={el.id} value={el.id} className="max-w-[200px] truncate">{el.title}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {elections.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No nomination elections yet.</p>
                <p className="text-sm">Create your first election to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {elections.map(el => {
                const apps = electionApps(el.id);
                const eRoles = electionRoles(el.id);
                const now = new Date();
                const isOpen = el.is_active && new Date(el.start_date) <= now && new Date(el.end_date) > now;
                return (
                  <Card key={el.id} className="glass-card hover:shadow-xl transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{el.title}</CardTitle>
                        <Badge variant={isOpen ? "default" : "secondary"}>{isOpen ? "Open" : el.is_active ? "Scheduled" : "Closed"}</Badge>
                      </div>
                      {el.description && <CardDescription>{el.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>📅 {format(new Date(el.start_date), "MMM d")} — {format(new Date(el.end_date), "MMM d, yyyy")}</p>
                        <p>🎭 {eRoles.length} roles: {eRoles.map(r => r.role_name).join(", ")}</p>
                        <p>📋 {apps.length} applications</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={el.is_active} onCheckedChange={() => toggleActive(el.id, el.is_active)} />
                        <span className="text-sm text-muted-foreground">{el.is_active ? "Active" : "Disabled"}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedElection(el.id)}>
                        <Users className="h-4 w-4 mr-1" /> View Applications
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteElection(el.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {elections.map(el => (
          <TabsContent key={el.id} value={el.id} className="mt-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Applications for {el.title}
                </CardTitle>
                <CardDescription>
                  {electionApps(el.id).length} total | {electionApps(el.id).filter(a => a.status === "pending").length} pending
                </CardDescription>
              </CardHeader>
              <CardContent>
                {electionApps(el.id).length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No applications received yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Photo</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Roll No.</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {electionApps(el.id).map(app => (
                          <TableRow key={app.id}>
                            <TableCell>
                              {app.photo_url ? (
                                <img src={app.photo_url} alt={app.student_name} className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                                  {app.student_name.charAt(0)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{app.student_name}</TableCell>
                            <TableCell>{app.roll_number}</TableCell>
                            <TableCell>{app.class}</TableCell>
                            <TableCell>{app.year}</TableCell>
                            <TableCell>{getRoleName(app.role_id)}</TableCell>
                            <TableCell>{statusBadge(app.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="text-[hsl(var(--success))] h-8 px-2"
                                  onClick={() => updateApplicationStatus(app.id, "approved")}
                                  disabled={app.status === "approved"}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive h-8 px-2"
                                  onClick={() => updateApplicationStatus(app.id, "rejected")}
                                  disabled={app.status === "rejected"}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Expandable details for each application */}
                <div className="mt-6 space-y-4">
                  {electionApps(el.id).filter(a => a.achievements || a.message).map(app => (
                    <Card key={app.id} className="border border-border/50">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {app.student_name} — {getRoleName(app.role_id)} {statusBadge(app.status)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 space-y-2 text-sm">
                        {app.achievements && (
                          <div><span className="font-medium text-muted-foreground">Achievements:</span><p>{app.achievements}</p></div>
                        )}
                        {app.message && (
                          <div><span className="font-medium text-muted-foreground">Manifesto:</span><p>{app.message}</p></div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminNominations;
