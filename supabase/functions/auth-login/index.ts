import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // ─── SEND OTP ───
    if (action === "send_otp") {
      const { phone } = body;

      if (!phone || phone.length < 10) {
        return jsonResponse({ error: "Please enter a valid phone number" }, 400);
      }

      // Check if phone exists in profiles
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, roll_number")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "No account found with this phone number. Contact your administrator." }, 404);
      }

      // Invalidate any existing unused OTPs for this phone
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("phone", phone)
        .eq("used", false);

      // Generate and store OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      await supabaseAdmin
        .from("otp_codes")
        .insert({ phone, code, expires_at: expiresAt });

      // In production, send SMS via Twilio/etc. For now, log it.
      console.log(`OTP for ${phone}: ${code}`);

      return jsonResponse({
        success: true,
        message: "OTP sent successfully",
        // Include OTP in response for testing (remove in production)
        otp_debug: code,
      });
    }

    // ─── VERIFY OTP ───
    if (action === "verify_otp") {
      const { phone, otp } = body;

      if (!phone || !otp) {
        return jsonResponse({ error: "Phone and OTP are required" }, 400);
      }

      // Find valid OTP
      const { data: otpRecord } = await supabaseAdmin
        .from("otp_codes")
        .select("*")
        .eq("phone", phone)
        .eq("code", otp)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return jsonResponse({ error: "Invalid or expired OTP. Please try again." }, 401);
      }

      // Mark OTP as used
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // Fetch profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "User profile not found" }, 404);
      }

      // Fetch roles
      const { data: userRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      const rolesList = userRoles?.map((r: any) => r.role) ?? [];

      // Sign in using synthetic credentials
      const syntheticEmail = `${profile.roll_number!.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;
      const syntheticPassword = `cv_${phone}_${profile.roll_number}`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: syntheticEmail,
        password: syntheticPassword,
      });

      if (authError) {
        console.error("Auth error:", authError.message);
        return jsonResponse({ error: "Authentication failed. Contact your administrator." }, 401);
      }

      return jsonResponse({
        session: authData.session,
        user: authData.user,
        profile,
        roles: rolesList,
      });
    }

    // ─── LOGIN ───
    if (action === "login") {
      const { roll_number, phone, role } = body;

      if (!roll_number || !phone) {
        return jsonResponse({ error: "Roll number and phone number are required" }, 400);
      }

      if (!role) {
        return jsonResponse({ error: "Please select your role" }, 400);
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("roll_number", roll_number)
        .eq("phone", phone)
        .maybeSingle();

      if (profileError || !profile) {
        return jsonResponse({ error: "Invalid roll number or phone number. Please check your credentials." }, 401);
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
      const syntheticPassword = `cv_${phone}_${roll_number}`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: syntheticEmail,
        password: syntheticPassword,
      });

      if (authError) {
        console.error("Auth error:", authError.message);
        return jsonResponse({ error: "Authentication failed. Contact your administrator." }, 401);
      }

      return jsonResponse({
        session: authData.session,
        user: authData.user,
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

      const { name, roll_number, phone, role, user_class } = body;

      if (!name || !roll_number || !phone || !role) {
        return jsonResponse({ error: "Name, roll number, phone, and role are required" }, 400);
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
      const syntheticPassword = `cv_${phone}_${roll_number}`;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createError) {
        console.error("Create user error:", createError.message);
        return jsonResponse({ error: "Failed to create user: " + createError.message }, 500);
      }

      await supabaseAdmin
        .from("profiles")
        .update({
          roll_number,
          phone,
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

    // ─── SEED USERS (one-time setup) ───
    if (action === "seed_users") {
      const users = [
        { name: "Rahul Sharma", roll: "CS2024001", phone: "9876543001", role: "student", userClass: "CS-A" },
        { name: "Priya Patel", roll: "CS2024002", phone: "9876543002", role: "student", userClass: "CS-B" },
        { name: "Dr. Amit Kumar", roll: "ADMIN001", phone: "1234567890", role: "admin", userClass: null },
        { name: "Prof. Sunita Verma", roll: "TCH001", phone: "9876543100", role: "class_teacher", userClass: "CS-A" },
      ];

      const results = [];

      for (const u of users) {
        const syntheticEmail = `${u.roll.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;
        const syntheticPassword = `cv_${u.phone}_${u.roll}`;

        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("roll_number", u.roll)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("profiles")
            .update({ full_name: u.name, phone: u.phone, class: u.userClass })
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
          .update({ roll_number: u.roll, phone: u.phone, class: u.userClass, full_name: u.name })
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

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Edge function error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
