import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const ALLOWED_EMAIL_DOMAIN = "gnits.ac.in"; // Configurable domain

async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gmailUser || !gmailPass) {
    console.error("Gmail SMTP credentials not configured");
    return false;
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPass,
        },
      },
    });

    await client.send({
      from: gmailUser,
      to: email,
      subject: "CampusVote - Your OTP Verification Code",
      content: `auto`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a2e; text-align: center;">CampusVote</h2>
          <p style="color: #333;">Your one-time verification code is:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f0f0f0; padding: 12px 24px; border-radius: 8px; color: #1a1a2e;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });

    await client.close();
    return true;
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── VALIDATE CREDENTIALS (check if user exists with email + roll_number + role) ───
    if (action === "validate_credentials") {
      const { roll_number, email, role } = body;

      if (!roll_number || !email || !role) {
        return jsonResponse({ error: "Roll number, email, and role are required" }, 400);
      }

      // Validate email domain
      if (!email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
        return jsonResponse({ error: `Invalid email domain. Only @${ALLOWED_EMAIL_DOMAIN} emails are allowed.` }, 400);
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, user_id, full_name, roll_number, email, is_verified")
        .eq("roll_number", roll_number)
        .eq("email", email)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "Invalid credentials. No account found with this roll number and email." }, 401);
      }

      const { data: userRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      const rolesList = userRoles?.map((r: any) => r.role) ?? [];

      if (!rolesList.includes(role)) {
        return jsonResponse({
          error: `You are not registered as a ${role.replace('_', ' ')}. Please select the correct role.`
        }, 403);
      }

      return jsonResponse({
        success: true,
        message: "Credentials validated",
        is_verified: profile.is_verified,
      });
    }

    // ─── SEND OTP (via email) ───
    if (action === "send_otp") {
      const { email } = body;

      if (!email) {
        return jsonResponse({ error: "Please enter a valid email address" }, 400);
      }

      if (!email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
        return jsonResponse({ error: `Invalid email domain. Only @${ALLOWED_EMAIL_DOMAIN} emails are allowed.` }, 400);
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, roll_number")
        .eq("email", email)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "No account found with this email. Contact your administrator." }, 404);
      }

      // Invalidate previous OTPs for this email
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("email", email)
        .eq("used", false);

      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabaseAdmin
        .from("otp_codes")
        .insert({ email, phone: email, code, expires_at: expiresAt });

      console.log(`OTP for ${email}: ${code}`);

      // Send OTP via email
      const emailSent = await sendOTPEmail(email, code);

      return jsonResponse({
        success: true,
        message: emailSent ? "OTP sent to your email successfully" : "OTP generated (email delivery pending)",
        otp_debug: emailSent ? undefined : code, // Only show debug OTP if email fails
      });
    }

    // ─── VERIFY OTP ───
    if (action === "verify_otp") {
      const { email, otp, role } = body;

      if (!email || !otp) {
        return jsonResponse({ error: "Email and OTP are required" }, 400);
      }

      const { data: otpRecord } = await supabaseAdmin
        .from("otp_codes")
        .select("*")
        .eq("email", email)
        .eq("code", otp)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return jsonResponse({ error: "Invalid or expired OTP. Please try again." }, 401);
      }

      // Mark OTP as used (prevent reuse)
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpRecord.id);

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "User profile not found" }, 404);
      }

      // Check if user is already verified — if so, just sign them in
      if (profile.is_verified) {
        const syntheticEmail = `${profile.roll_number!.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;
        const syntheticPassword = `cv_${email}_${profile.roll_number}`;

        const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
          email: syntheticEmail,
          password: syntheticPassword,
        });

        if (authError) {
          return jsonResponse({ error: "Authentication failed. Contact your administrator." }, 401);
        }

        const { data: userRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id);

        return jsonResponse({
          session: authData.session,
          profile,
          roles: userRoles?.map((r: any) => r.role) ?? [],
          selectedRole: role,
          needs_password: false,
        });
      }

      // Not verified — OTP passed, now user needs to set password
      return jsonResponse({
        success: true,
        needs_password: true,
        otp_verified: true,
        email,
        roll_number: profile.roll_number,
        user_id: profile.user_id,
      });
    }

    // ─── SET PASSWORD (first-time setup after OTP) ───
    if (action === "set_password") {
      const { email, roll_number, password } = body;

      if (!email || !roll_number || !password) {
        return jsonResponse({ error: "Email, roll number, and password are required" }, 400);
      }

      if (password.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("roll_number", roll_number)
        .eq("email", email)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "Profile not found" }, 404);
      }

      if (profile.is_verified) {
        return jsonResponse({ error: "Account already verified. Please login with your password." }, 400);
      }

      const syntheticEmail = `${roll_number.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        password: password,
      });

      if (updateError) {
        console.error("Set password error:", updateError.message);
        return jsonResponse({ error: "Failed to set password. Please try again." }, 500);
      }

      // Mark as verified
      await supabaseAdmin
        .from("profiles")
        .update({ is_verified: true })
        .eq("user_id", profile.user_id);

      // Sign in with new password
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: syntheticEmail,
        password: password,
      });

      if (authError) {
        return jsonResponse({ error: "Password set but login failed. Try logging in with your password." }, 500);
      }

      const { data: userRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      return jsonResponse({
        session: authData.session,
        profile: { ...profile, is_verified: true },
        roles: userRoles?.map((r: any) => r.role) ?? [],
        selectedRole: body.role,
      });
    }

    // ─── PASSWORD LOGIN (returning users) ───
    if (action === "password_login") {
      const { roll_number, password, role } = body;

      if (!roll_number || !password || !role) {
        return jsonResponse({ error: "Roll number, password, and role are required" }, 400);
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("roll_number", roll_number)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "Invalid roll number. No account found." }, 401);
      }

      if (!profile.is_verified) {
        return jsonResponse({ error: "Account not verified. Please use OTP verification first." }, 403);
      }

      const { data: userRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      const rolesList = userRoles?.map((r: any) => r.role) ?? [];

      if (!rolesList.includes(role)) {
        return jsonResponse({
          error: `You are not registered as a ${role.replace('_', ' ')}. Please select the correct role.`
        }, 403);
      }

      const syntheticEmail = `${roll_number.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: syntheticEmail,
        password: password,
      });

      if (authError) {
        return jsonResponse({ error: "Invalid password. Please try again." }, 401);
      }

      return jsonResponse({
        session: authData.session,
        profile,
        roles: rolesList,
        selectedRole: role,
      });
    }

    // ─── CREATE USER (admin only) ───
    if (action === "create_user") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ error: "Authorization required" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
      if (!caller) return jsonResponse({ error: "Invalid token" }, 401);

      const { data: callerRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id);

      if (!callerRoles?.some((r: any) => r.role === "admin")) {
        return jsonResponse({ error: "Admin access required" }, 403);
      }

      const { name, roll_number, email, role, user_class } = body;

      if (!name || !roll_number || !email || !role) {
        return jsonResponse({ error: "Name, roll number, email, and role are required" }, 400);
      }

      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("roll_number", roll_number)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ error: "A user with this roll number already exists" }, 409);
      }

      const syntheticEmail = `${roll_number.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;
      const syntheticPassword = `cv_${email}_${roll_number}`;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createError) {
        return jsonResponse({ error: "Failed to create user: " + createError.message }, 500);
      }

      await supabaseAdmin
        .from("profiles")
        .update({
          roll_number,
          email,
          phone: null,
          class: user_class || null,
          full_name: name,
        })
        .eq("user_id", newUser.user.id);

      if (role !== "student") {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", newUser.user.id);

        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });
      }

      return jsonResponse({ success: true, user_id: newUser.user.id });
    }

    // ─── SEED USERS ───
    if (action === "seed_users") {
      const users = [
        { name: "Rahul Sharma", roll: "CS2024001", email: "rahul.sharma@gnits.ac.in", role: "student", userClass: "CS-A" },
        { name: "Priya Patel", roll: "CS2024002", email: "priya.patel@gnits.ac.in", role: "student", userClass: "CS-B" },
        { name: "Dr. Amit Kumar", roll: "ADMIN001", email: "admin@gnits.ac.in", role: "admin", userClass: null },
        { name: "Prof. Sunita Verma", roll: "TCH001", email: "sunita.verma@gnits.ac.in", role: "class_teacher", userClass: "CS-A" },
      ];

      const results = [];

      for (const u of users) {
        const syntheticEmail = `${u.roll.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;
        const syntheticPassword = `cv_${u.email}_${u.roll}`;

        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("roll_number", u.roll)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("profiles")
            .update({ full_name: u.name, email: u.email, class: u.userClass })
            .eq("roll_number", u.roll);
          results.push({ roll: u.roll, status: "already_exists_updated" });
          continue;
        }

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: { full_name: u.name },
        });

        if (createError) {
          results.push({ roll: u.roll, status: "error", message: createError.message });
          continue;
        }

        await supabaseAdmin
          .from("profiles")
          .update({ roll_number: u.roll, email: u.email, class: u.userClass, full_name: u.name })
          .eq("user_id", newUser.user.id);

        if (u.role !== "student") {
          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", newUser.user.id);

          await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: newUser.user.id, role: u.role });
        }

        results.push({ roll: u.roll, status: "created" });
      }

      return jsonResponse({ success: true, results });
    }

    return jsonResponse({ error: "Unknown action: " + action }, 400);
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
