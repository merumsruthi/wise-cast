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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── LOGIN ───
    if (action === "login") {
      const { roll_number, phone } = body;

      if (!roll_number || !phone) {
        return jsonResponse({ error: "Roll number and phone number are required" }, 400);
      }

      // Validate credentials against profiles table
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("roll_number", roll_number)
        .eq("phone", phone)
        .single();

      if (profileError || !profile) {
        return jsonResponse({ error: "Invalid roll number or phone number. Please check your credentials." }, 401);
      }

      // Fetch roles
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      // Sign in with synthetic credentials
      const syntheticEmail = `${roll_number.toLowerCase().replace(/[^a-z0-9]/g, "")}@campusvote.local`;
      const syntheticPassword = `cv_${phone}_${roll_number}`;

      const supabaseClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
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
        roles: roles?.map((r) => r.role) ?? [],
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

      if (!callerRoles?.some((r) => r.role === "admin")) {
        return jsonResponse({ error: "Admin access required" }, 403);
      }

      const { name, roll_number, phone, role, user_class } = body;

      if (!name || !roll_number || !phone || !role) {
        return jsonResponse({ error: "Name, roll number, phone, and role are required" }, 400);
      }

      // Check for duplicate roll number
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("roll_number", roll_number)
        .single();

      if (existing) {
        return jsonResponse({ error: "A user with this roll number already exists" }, 409);
      }

      // Create auth user with synthetic credentials
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

      // Update profile with roll_number, phone, class
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          roll_number,
          phone,
          class: user_class || null,
          full_name: name,
        })
        .eq("user_id", newUser.user.id);

      if (profileError) {
        console.error("Profile update error:", profileError.message);
      }

      // Set user role (delete default 'student' if different)
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

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Edge function error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
