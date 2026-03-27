import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vote, AlertCircle, GraduationCap, Shield, BookOpen } from "lucide-react";

const roleOptions = [
  { value: "student", label: "Student", icon: GraduationCap, desc: "Vote in elections" },
  { value: "admin", label: "Admin", icon: Shield, desc: "Manage elections & users" },
  { value: "class_teacher", label: "Class Teacher", icon: BookOpen, desc: "Manage CR elections" },
];

const roleDashboardMap: Record<string, string> = {
  student: "/dashboard",
  admin: "/dashboard/admin",
  class_teacher: "/dashboard/teacher",
};

const Login = () => {
  const [rollNumber, setRollNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginWithRollNumber } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!role) {
      setError("Please select your role.");
      return;
    }

    setLoading(true);

    const result = await loginWithRollNumber(rollNumber, phone, role);

    if (result.error) {
      setError(result.error);
    } else {
      navigate(roleDashboardMap[role] || "/dashboard");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Vote className="h-8 w-8 text-primary" />
          <span className="font-heading text-2xl font-bold text-foreground">CampusVote</span>
        </Link>
        <Card className="glass-card">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-2xl">Welcome Back</CardTitle>
            <CardDescription>Select your role and enter your credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Login As</Label>
                <div className="grid grid-cols-3 gap-2">
                  {roleOptions.map((r) => {
                    const isSelected = role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <r.icon className={`h-5 w-5 ${isSelected ? "text-primary" : ""}`} />
                        <span className="text-xs font-medium">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input
                  id="rollNumber"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. CS2024001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Logging in..." : "Log In"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Contact your administrator if you don't have login credentials.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
