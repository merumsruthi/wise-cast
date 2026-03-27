import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Vote, Users, BarChart3, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AdminDashboard = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddUser, setShowAddUser] = useState(false);
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("student");
  const [userClass, setUserClass] = useState("");

  const { data: elections } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data } = await supabase.from("elections").select("*");
      return data ?? [];
    },
  });

  const { data: candidates } = useQuery({
    queryKey: ["all-candidates"],
    queryFn: async () => {
      const { data } = await supabase.from("candidates").select("*");
      return data ?? [];
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: {
          action: "create_user",
          name,
          roll_number: rollNumber,
          phone,
          role,
          user_class: userClass,
        },
      });

      if (error) throw new Error("Failed to create user");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "User Created", description: `${name} has been added to the system.` });
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      setShowAddUser(false);
      setName("");
      setRollNumber("");
      setPhone("");
      setRole("student");
      setUserClass("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage elections, users, and view system overview</p>
        </div>
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" /></div>
              <div><Label>Roll Number</Label><Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="CS2024001" /></div>
              <div><Label>Phone Number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" /></div>
              <div><Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="class_teacher">Class Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Class (optional)</Label><Input value={userClass} onChange={(e) => setUserClass(e.target.value)} placeholder="CS-A" /></div>
              <Button
                onClick={() => createUser.mutate()}
                disabled={!name || !rollNumber || !phone || createUser.isPending}
                className="w-full"
              >
                {createUser.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Elections</CardTitle>
            <Vote className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold">{elections?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Candidates</CardTitle>
            <Users className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold">{candidates?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registered Users</CardTitle>
            <BarChart3 className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading font-bold">{allProfiles?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users list */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Registered Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allProfiles?.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground text-sm">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.roll_number ?? "No roll"} • {p.phone ?? "No phone"} {p.class ? `• ${p.class}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {(!allProfiles || allProfiles.length === 0) && (
              <p className="text-muted-foreground text-sm text-center py-4">No users registered yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
