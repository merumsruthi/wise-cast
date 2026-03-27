import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { secret_key } = await req.json();
    
    // Simple protection - only allow with a known key
    if (secret_key !== "setup-campusvote-2026") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin user
    const adminRoll = "ADMIN001";
    const adminPhone = "1234567890";
    const syntheticEmail = `${adminRoll.toLowerCase()}@campusvote.local`;
    const syntheticPassword = `cv_${adminPhone}_${adminRoll}`;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: { full_name: "System Admin" },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile
    await supabaseAdmin
      .from("profiles")
      .update({ roll_number: adminRoll, phone: adminPhone, full_name: "System Admin" })
      .eq("user_id", newUser.user.id);

    // Set admin role
    await supabaseAdmin
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", newUser.user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created. Login with Roll: ADMIN001, Phone: 1234567890",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
