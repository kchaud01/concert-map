import { createServerSupabaseClient } from '@/utils/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  return NextResponse.json({
    hasSession: !!session,
    hasProviderToken: !!session?.provider_token,
    userId: session?.user?.id,
    provider: session?.user?.app_metadata?.provider,
  })
}
