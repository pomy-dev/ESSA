import { createClient } from '../lib/supabase/client'

export async function callEdgeFunction(action: string, body: Record<string, unknown>) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    return { error: 'You must be signed in to perform this action.' }
  }

  let resp: Response
  try {
    resp = await fetch('/api/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...body }),
    })
  } catch {
    return { error: 'Could not reach the user-management API route.' }
  }

  const result = await resp.json().catch(() => ({}))

  if (!resp.ok) {
    return { error: result.error ?? 'User-management API request failed.' }
  }

  return result
}
