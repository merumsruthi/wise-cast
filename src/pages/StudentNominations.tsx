import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, CheckCircle, XCircle, Upload, CalendarDays, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";

interface NominationElection {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
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
  status: string;
}

const ALLOWED_DOMAIN = "gnits.ac.in";

function CountdownTimer({ endDate }: { endDate: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const end = new Date(endDate);
  if (now >= end) return <span className="text-destructive font-medium">Deadline passed</span>;

  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  const mins = differenceInMinutes(end, now) % 60;

  return (
    <span className="text-sm font-medium tabular-nums">
      {days > 0 && `${days}d `}{hours}h {mins}m remaining
    </span>
  );
}

const StudentNominations = () => {
  const { user, profile } = useAuth();
  const [elections, setElections] = useState<NominationElection[]>([]);
  const [roles, setRoles] = useState<NominationRole[]>([]);
  const [myApps, setMyApps] = useState<NominationApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Apply form
  const [applyDialog, setApplyDialog] = useState(false);
  const [selectedElection, setSelectedElection] = useState<NominationElection | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [formName, setFormName] = useState("");
  const [formRoll, setFormRoll] = useState("");
  const [formClass, setFormClass] = useState("");
  const [formYear, setFormYear] = useState("");
  const [formAchievements, setFormAchievements] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [elRes, roleRes, appRes] = await Promise.all([
      supabase.from("nomination_elections").select("*").eq("is_active", true).order("end_date", { ascending: true }),
      supabase.from("nomination_roles").select("*"),
      user ? supabase.from("nomination_applications").select("id, election_id, role_id, status").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    if (elRes.data) setElections(elRes.data as NominationElection[]);
    if (roleRes.data) setRoles(roleRes.data as NominationRole[]);
    if (appRes.data) setMyApps(appRes.data as NominationApplication[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openApplyDialog = (election: NominationElection) => {
    setSelectedElection(election);
    setSelectedRoleId("");
    setFormName(profile?.full_name || "");
    setFormRoll(profile?.roll_number || "");
    setFormClass(profile?.class || "");
    setFormYear("");
    setFormAchievements("");
    setFormMessage("");
    setFormPhoto(null);
    setApplyDialog(true);
  };

  const hasApplied = (electionId: string, roleId: string) =>
    myApps.some(a => a.election_id === electionId && a.role_id === roleId);

  const hasAppliedToElection = (electionId: string) =>
    myApps.some(a => a.election_id === electionId);

  const isDeadlinePassed = (endDate: string) => new Date() >= new Date(endDate);
  const isNotStarted = (startDate: string) => new Date() < new Date(startDate);

  const handleSubmit = async () => {
    if (!selectedElection || !selectedRoleId || !user) return;

    if (!formName.trim() || !formRoll.trim() || !formClass.trim() || !formYear.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (hasApplied(selectedElection.id, selectedRoleId)) {
      toast.error("You have already applied for this role.");
      return;
    }

    setSubmitting(true);

    let photoUrl: string | null = null;
    if (formPhoto) {
      const ext = formPhoto.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("nomination-photos").upload(path, formPhoto);
      if (uploadErr) {
        toast.error("Photo upload failed. Submitting without photo.");
      } else {
        const { data: urlData } = supabase.storage.from("nomination-photos").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("nomination_applications").insert({
      election_id: selectedElection.id,
      role_id: selectedRoleId,
      user_id: user.id,
      student_name: formName.trim(),
      roll_number: formRoll.trim(),
      class: formClass.trim(),
      year: formYear.trim(),
      photo_url: photoUrl,
      achievements: formAchievements.trim() || null,
      message: formMessage.trim() || null,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") toast.error("You have already applied for this role.");
      else toast.error("Failed to submit application.");
    } else {
      toast.success("Application submitted successfully!");
      setApplyDialog(false);
      fetchData();
    }
    setSubmitting(false);
  };

  const electionRoles = (elId: string) => roles.filter(r => r.election_id === elId);

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
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Election Nominations</h1>
        <p className="text-muted-foreground mt-1">View open elections and apply for leadership roles</p>
      </div>

      {/* My Applications */}
      {myApps.length > 0 && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> My Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myApps.map(app => {
                const el = elections.find(e => e.id === app.election_id);
                const role = roles.find(r => r.id === app.role_id);
                return (
                  <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium text-sm">{el?.title || "Election"}</span>
                      <span className="text-muted-foreground text-sm"> — {role?.role_name || "Role"}</span>
                    </div>
                    {statusBadge(app.status)}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Elections */}
      {elections.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No active elections right now.</p>
            <p className="text-sm">Check back later for nomination opportunities.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {elections.map(el => {
            const eRoles = electionRoles(el.id);
            const deadlinePassed = isDeadlinePassed(el.end_date);
            const notStarted = isNotStarted(el.start_date);
            const canApply = !deadlinePassed && !notStarted;

            return (
              <Card key={el.id} className="glass-card hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{el.title}</CardTitle>
                    {deadlinePassed ? (
                      <Badge variant="secondary">Closed</Badge>
                    ) : notStarted ? (
                      <Badge variant="outline">Upcoming</Badge>
                    ) : (
                      <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Open</Badge>
                    )}
                  </div>
                  {el.description && <CardDescription>{el.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>{format(new Date(el.start_date), "MMM d")} — {format(new Date(el.end_date), "MMM d, yyyy")}</span>
                  </div>

                  {canApply && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 text-primary">
                      <Clock className="h-4 w-4" />
                      <CountdownTimer endDate={el.end_date} />
                    </div>
                  )}

                  {notStarted && (
                    <p className="text-sm text-muted-foreground italic">Applications open on {format(new Date(el.start_date), "MMM d, yyyy")}</p>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Available Roles:</p>
                    <div className="flex flex-wrap gap-2">
                      {eRoles.map(role => {
                        const applied = hasApplied(el.id, role.id);
                        return (
                          <Badge key={role.id} variant={applied ? "default" : "outline"} className="py-1">
                            {role.role_name} {applied && "✓"}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full gap-2"
                    disabled={!canApply}
                    onClick={() => openApplyDialog(el)}
                  >
                    {deadlinePassed ? "Deadline Passed" : notStarted ? "Not Yet Open" : <><Send className="h-4 w-4" /> Apply Now</>}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Application Form Dialog */}
      <Dialog open={applyDialog} onOpenChange={setApplyDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for {selectedElection?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {selectedElection && electionRoles(selectedElection.id).map(r => (
                    <SelectItem key={r.id} value={r.id} disabled={hasApplied(selectedElection.id, r.id)}>
                      {r.role_name} {hasApplied(selectedElection.id, r.id) ? "(Already Applied)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Roll Number *</Label>
                <Input value={formRoll} onChange={e => setFormRoll(e.target.value)} readOnly className="bg-muted" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class / Section *</Label>
                <Input value={formClass} onChange={e => setFormClass(e.target.value)} placeholder="e.g. CSE-A" />
              </div>
              <div className="space-y-2">
                <Label>Year of Study *</Label>
                <Select value={formYear} onValueChange={setFormYear}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("photo-upload")?.click()} className="gap-1">
                  <Upload className="h-4 w-4" /> {formPhoto ? "Change Photo" : "Upload Photo"}
                </Button>
                {formPhoto && <span className="text-sm text-muted-foreground truncate max-w-[200px]">{formPhoto.name}</span>}
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setFormPhoto(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Achievements</Label>
              <Textarea value={formAchievements} onChange={e => setFormAchievements(e.target.value)} placeholder="List your achievements, extracurriculars, leadership experience..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Message to Students / Manifesto</Label>
              <Textarea value={formMessage} onChange={e => setFormMessage(e.target.value)} placeholder="What would you do if elected? Your vision..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !selectedRoleId}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentNominations;
