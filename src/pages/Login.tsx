import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vote, AlertCircle, Mail, ArrowLeft, Loader2, CheckCircle2, Hash, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const roleDashboardMap: Record<string, string> = {
  student: "/dashboard",
  admin: "/dashboard/admin",
  class_teacher: "/dashboard/teacher",
};

const ALLOWED_EMAIL_DOMAIN = "gnits.ac.in";

type LoginMode = "password" | "otp";
type Step = "credentials" | "otp" | "set_password";

const Login = () => {
  const [mode, setMode] = useState<LoginMode>("password");
  const [role, setRole] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState("");
  const navigate = useNavigate();
  const { setSessionFromOtp } = useAuth();

  const validateEmailDomain = (email: string): boolean => {
    return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!role) { setError("Please select your role."); return; }
    if (!rollNumber.trim()) { setError("Please enter your Roll Number / ID."); return; }
    if (!password) { setError("Please enter your password."); return; }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("auth-login", {
        body: { action: "password_login", roll_number: rollNumber, password, role },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Login failed. Please try again.");
      } else if (data?.session) {
        await setSessionFromOtp(data.session, role);
        navigate(roleDashboardMap[role] || "/dashboard");
      } else {
        setError("Unexpected error occurred.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleOtpStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!role) { setError("Please select your role."); return; }
    if (!rollNumber.trim()) { setError("Please enter your Roll Number / ID."); return; }
    if (!email.trim()) { setError("Please enter your college email."); return; }
    if (!validateEmailDomain(email)) {
      setError(`Invalid email domain. Only @${ALLOWED_EMAIL_DOMAIN} emails are allowed.`);
      return;
    }

    setLoading(true);
    try {
      const { data: validateData, error: valError } = await supabase.functions.invoke("auth-login", {
        body: { action: "validate_credentials", roll_number: rollNumber, email, role },
      });

      if (valError || validateData?.error) {
        setError(validateData?.error || "Invalid credentials.");
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("auth-login", {
        body: { action: "send_otp", email },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Failed to send OTP.");
      } else {
        setStep("otp");
        toast.success("OTP sent to your email!");
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

    if (otp.length !== 6) { setError("Please enter the 6-digit OTP."); return; }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("auth-login", {
        body: { action: "verify_otp", email, otp, role },
      });

      if (fnError || data?.error) {
        setError(data?.error || "OTP verification failed.");
      } else if (data?.needs_password) {
        setStep("set_password");
        toast.success("OTP verified! Please create your password.");
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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("auth-login", {
        body: { action: "set_password", email, roll_number: rollNumber, password: newPassword, role },
      });

      if (fnError || data?.error) {
        setError(data?.error || "Failed to set password.");
      } else if (data?.session) {
        toast.success("Password set successfully! Welcome to CampusVote.");
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

  const resetToStart = () => {
    setStep("credentials");
    setOtp("");
    setError("");
    setDebugOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const renderError = () =>
    error ? (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    ) : null;

  const renderRoleSelect = () => (
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
  );

  const renderRollNumberInput = () => (
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
  );

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
              {step === "credentials" && mode === "password" && "Login"}
              {step === "credentials" && mode === "otp" && "Verify with OTP"}
              {step === "otp" && "Enter OTP"}
              {step === "set_password" && "Create Password"}
            </CardTitle>
            <CardDescription>
              {step === "credentials" && mode === "password" && "Enter your credentials to login"}
              {step === "credentials" && mode === "otp" && "Verify your identity with email OTP"}
              {step === "otp" && `Enter the 6-digit code sent to ${email}`}
              {step === "set_password" && "Create a secure password for future logins"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* ─── PASSWORD LOGIN ─── */}
            {step === "credentials" && mode === "password" && (
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                {renderError()}
                {renderRoleSelect()}
                {renderRollNumberInput()}

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Logging in...</> : "Login"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => { setMode("otp"); setError(""); }}
                  >
                    First time? Verify with OTP
                  </button>
                </div>
              </form>
            )}

            {/* ─── OTP CREDENTIALS ─── */}
            {step === "credentials" && mode === "otp" && (
              <form onSubmit={handleOtpStart} className="space-y-5">
                {renderError()}
                {renderRoleSelect()}
                {renderRollNumberInput()}

                <div className="space-y-2">
                  <Label htmlFor="email">College Email ID</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={`e.g. name@${ALLOWED_EMAIL_DOMAIN}`}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Only @{ALLOWED_EMAIL_DOMAIN} emails are accepted</p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Validating...</> : "Send OTP"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => { setMode("password"); setError(""); }}
                  >
                    Already have a password? Login
                  </button>
                </div>
              </form>
            )}

            {/* ─── OTP VERIFICATION ─── */}
            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {renderError()}

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
                  <p className="text-xs text-muted-foreground text-center">OTP expires in 5 minutes</p>
                </div>

                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify OTP"}
                </Button>

                <Button type="button" variant="ghost" className="w-full" onClick={resetToStart}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              </form>
            )}

            {/* ─── SET PASSWORD ─── */}
            {step === "set_password" && (
              <form onSubmit={handleSetPassword} className="space-y-5">
                {renderError()}

                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent text-accent-foreground text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>OTP verified! Create a password for future logins.</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting password...</> : "Set Password & Login"}
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
