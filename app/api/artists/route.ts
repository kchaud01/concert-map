import { createServerSupabaseClient } from '@/utils/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const accessToken = session.provider_token

  let artists: any[] = []
  let url = 'https://api.spotify.com/v1/me/following?type=artist&limit=50'

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const data = await res.json()
    artists = [...artists, ...data.artists.items]
    url = data.artists.next
  }

  return NextResponse.json({ artists })
}
