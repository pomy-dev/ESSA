import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // Setup: allowed only when no essa_admin exists yet — no auth required
    if (action === "setup_essa_admin") {
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("role", "essa_admin")
        .limit(1)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "ESSA admin already exists. Contact your administrator." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { essaEmail, essaPassword, essaName } = body;
      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: essaEmail,
        password: essaPassword,
        email_confirm: true,
      });

      if (userError) {
        return new Response(JSON.stringify({ error: userError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("profiles").insert({
        id: newUser.user.id,
        full_name: essaName,
        email: essaEmail,
        role: "essa_admin",
        must_change_password: false,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!callerProfile || !["essa_admin", "school_admin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_school_with_admin") {
      const { schoolName, code, region, address, phone, email, adminName, adminEmail, adminPassword } = body;

      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

      if (userError) {
        return new Response(JSON.stringify({ error: userError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminUserId = newUser.user.id;

      const { data: school, error: schoolError } = await adminClient
        .from("schools")
        .insert({
          name: schoolName,
          code: code.toUpperCase(),
          region,
          address: address || "",
          phone: phone || "",
          email: email || "",
          admin_id: null,
        })
        .select()
        .single();

      if (schoolError) {
        await adminClient.auth.admin.deleteUser(adminUserId);
        return new Response(JSON.stringify({ error: schoolError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: adminUserId,
        full_name: adminName,
        email: adminEmail,
        role: "school_admin",
        school_id: school.id,
        must_change_password: true,
      });

      if (profileError) {
        await adminClient.auth.admin.deleteUser(adminUserId);
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("schools").update({ admin_id: adminUserId }).eq("id", school.id);

      return new Response(JSON.stringify({ success: true, schoolId: school.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_teacher") {
      const { teacherName, teacherEmail, teacherPassword, schoolId } = body;

      const targetSchoolId = callerProfile.role === "school_admin" ? callerProfile.school_id : schoolId;
      if (!targetSchoolId) {
        return new Response(JSON.stringify({ error: "School ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: teacherEmail,
        password: teacherPassword,
        email_confirm: true,
      });

      if (userError) {
        return new Response(JSON.stringify({ error: userError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: newUser.user.id,
        full_name: teacherName,
        email: teacherEmail,
        role: "teacher",
        school_id: targetSchoolId,
        must_change_password: true,
      });

      if (profileError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
