import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vote, AlertCircle, Phone, ArrowLeft, Loader2, CheckCircle2, UserCircle, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const roleDashboardMap: Record<string, string> = {
  student: "/dashboard",
  admin: "/dashboard/admin",
  class_teacher: "/dashboard/teacher",
};

const roleLabels: Record<string, string> = {
  student: "Student",
  admin: "Admin",
  class_teacher: "Class Teacher",
};

type Step = "credentials" | "otp";

const Login = () => {
  const [role, setRole] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState("");
  const navigate = useNavigate();
  const { setSessionFromOtp } = useAuth();

  const handleValidateAndSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!role) {
      setError("Please select your role.");
      return;
    }
    if (!rollNumber.trim()) {
      setError("Please enter your Roll Number / ID.");
      return;
    }
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);

    try {
      // First validate credentials exist in DB
      const { data: validateData, error: valError } = await supabase.functions.invoke("auth-login", {
        body: { action: "validate_credentials", roll_number: rollNumber, phone, role },
      });

      if (valError || validateData?.error) {
        setError(validateData?.error || "Invalid credentials. Please check and try again.");
        setLoading(false);
        return;
      }

      // Credentials valid, now send OTP
      const { data, error: fnError } = await supabase.functions.invoke("auth-login", {
        body: { action: "send_otp", phone },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Failed to send OTP. Please try again.");
      } else {
        setStep("otp");
        if (data?.otp_debug) {
          setDebugOtp(data.otp_debug);
          toast.info(`Test OTP: ${data.otp_debug}`, { duration: 30000 });
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("auth-login", {
        body: { action: "verify_otp", phone, otp, role },
      });

      if (fnError || data?.error) {
        setError(data?.error || "OTP verification failed.");
      } else if (data?.session) {
        await setSessionFromOtp(data.session, role);
        navigate(roleDashboardMap[role] || "/dashboard");
      } else {
        setError("Unexpected error. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
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
            <CardTitle className="font-heading text-2xl">
              {step === "credentials" ? "Welcome Back" : "Verify OTP"}
            </CardTitle>
            <CardDescription>
              {step === "credentials"
                ? "Select your role and enter your credentials to login"
                : `Enter the 6-digit code sent to your phone ending ${phone.slice(-4)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "credentials" ? (
              <form onSubmit={handleValidateAndSendOtp} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="role">Select Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Choose your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">🎓 Student</SelectItem>
                      <SelectItem value="admin">🛡️ Admin</SelectItem>
                      <SelectItem value="class_teacher">📚 Class Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rollNumber">Roll Number / ID</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="rollNumber"
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g. CS2024001"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {debugOtp && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent text-accent-foreground text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Test OTP: <strong>{debugOtp}</strong></span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Enter OTP</Label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Login"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("credentials");
                    setOtp("");
                    setError("");
                    setDebugOtp("");
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Credentials
                </Button>
              </form>
            )}

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
