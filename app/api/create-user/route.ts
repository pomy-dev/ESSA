import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

interface CreateSchoolBody {
  action: 'create_school_with_admin'
  schoolName: string
  code: string
  region: string
  address?: string
  phone?: string
  email?: string
  adminName: string
  adminEmail: string
  adminPassword: string
}

interface CreateTeacherBody {
  action: 'create_teacher'
  teacherName: string
  teacherEmail: string
  teacherPassword: string
  schoolId?: string
}

interface SetupEssaAdminBody {
  action: 'setup_essa_admin'
  essaName: string
  essaEmail: string
  essaPassword: string
}

interface CreateEssaMemberBody {
  action: 'create_essa_member'
  memberName: string
  memberEmail: string
  memberPassword: string
  phone?: string
}

type RequestBody = CreateSchoolBody | CreateTeacherBody | SetupEssaAdminBody | CreateEssaMemberBody

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status })
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on the server.',
      client: null,
      supabaseUrl,
    }
  }

  return {
    error: null,
    client: createClient(supabaseUrl, serviceRoleKey),
    supabaseUrl,
  }
}

async function getCallerProfile(req: Request, supabaseUrl: string) {
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authHeader = req.headers.get('Authorization')

  if (!publicKey || !authHeader) {
    return { error: 'Unauthorized', profile: null }
  }

  const callerClient = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user } } = await callerClient.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized', profile: null }
  }

  const { client: adminClient } = createAdminClient()
  if (!adminClient) {
    return { error: 'Server Supabase admin client is not configured.', profile: null }
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['essa_admin', 'school_admin'].includes(profile.role)) {
    return { error: 'Forbidden', profile: null }
  }

  return { error: null, profile }
}

export async function POST(req: Request) {
  try {
    const { error: adminError, client: adminClient, supabaseUrl } = createAdminClient()
    if (adminError || !adminClient || !supabaseUrl) {
      return json({ error: adminError }, 500)
    }

    const body = await req.json() as RequestBody

    if (body.action === 'setup_essa_admin') {
      const { data: existing } = await adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'essa_admin')
        .limit(1)
        .maybeSingle()

      if (existing) {
        return json({ error: 'ESSA admin already exists. Contact your administrator.' }, 400)
      }

      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: body.essaEmail,
        password: body.essaPassword,
        email_confirm: true,
      })

      if (userError) {
        return json({ error: userError.message }, 400)
      }

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: newUser.user.id,
        full_name: body.essaName,
        email: body.essaEmail,
        role: 'essa_admin',
        must_change_password: false,
      })

      if (profileError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id)
        return json({ error: profileError.message }, 400)
      }

      return json({ success: true })
    }

    const { error: callerError, profile: callerProfile } = await getCallerProfile(req, supabaseUrl)
    if (callerError || !callerProfile) {
      return json({ error: callerError }, callerError === 'Forbidden' ? 403 : 401)
    }

    if (body.action === 'create_school_with_admin') {
      if (callerProfile.role !== 'essa_admin') {
        return json({ error: 'Only ESSA admins can create schools.' }, 403)
      }

      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: body.adminEmail,
        password: body.adminPassword,
        email_confirm: true,
      })

      if (userError) {
        return json({ error: userError.message }, 400)
      }

      const adminUserId = newUser.user.id

      const { data: school, error: schoolError } = await adminClient
        .from('schools')
        .insert({
          name: body.schoolName,
          code: body.code.toUpperCase(),
          region: body.region,
          address: body.address || '',
          phone: body.phone || '',
          email: body.email || '',
          admin_id: null,
        })
        .select()
        .single()

      if (schoolError) {
        await adminClient.auth.admin.deleteUser(adminUserId)
        return json({ error: schoolError.message }, 400)
      }

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: adminUserId,
        full_name: body.adminName,
        email: body.adminEmail,
        role: 'school_admin',
        school_id: school.id,
        must_change_password: true,
      })

      if (profileError) {
        await adminClient.from('schools').delete().eq('id', school.id)
        await adminClient.auth.admin.deleteUser(adminUserId)
        return json({ error: profileError.message }, 400)
      }

      const { error: updateError } = await adminClient
        .from('schools')
        .update({ admin_id: adminUserId })
        .eq('id', school.id)

      if (updateError) {
        return json({ error: updateError.message }, 400)
      }

      return json({ success: true, schoolId: school.id })
    }

    if (body.action === 'create_teacher') {
      const targetSchoolId =
        callerProfile.role === 'school_admin' ? callerProfile.school_id : body.schoolId

      if (!targetSchoolId) {
        return json({ error: 'School ID required' }, 400)
      }

      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: body.teacherEmail,
        password: body.teacherPassword,
        email_confirm: true,
      })

      if (userError) {
        return json({ error: userError.message }, 400)
      }

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: newUser.user.id,
        full_name: body.teacherName,
        email: body.teacherEmail,
        role: 'teacher',
        school_id: targetSchoolId,
        must_change_password: true,
      })

      if (profileError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id)
        return json({ error: profileError.message }, 400)
      }

      return json({ success: true, userId: newUser.user.id })
    }

    if (body.action === 'create_essa_member') {
      if (callerProfile.role !== 'essa_admin') {
        return json({ error: 'Only ESSA admins can create ESSA members.' }, 403)
      }

      const { data: newUser, error: userError } = await adminClient.auth.admin.createUser({
        email: body.memberEmail,
        password: body.memberPassword,
        email_confirm: true,
      })

      if (userError) {
        return json({ error: userError.message }, 400)
      }

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: newUser.user.id,
        full_name: body.memberName,
        email: body.memberEmail,
        phone: body.phone || '',
        role: 'essa_admin',
        must_change_password: true,
      })

      if (profileError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id)
        return json({ error: profileError.message }, 400)
      }

      return json({ success: true, userId: newUser.user.id })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return json({ error: message }, 500)
  }
}
