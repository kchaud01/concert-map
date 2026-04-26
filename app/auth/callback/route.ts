import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Use the forwarded host header to get the public URL, fallback to request origin
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const origin = `${proto}://${host}`

  console.log('Auth callback hit:', { code: !!code, error, errorDescription, origin })

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const response = NextResponse.redirect(`${origin}/map`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
  console.log('Session exchange result:', { user: data?.user?.id, error: sessionError })

  return response
}
