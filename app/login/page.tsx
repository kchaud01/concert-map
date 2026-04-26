'use client'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        scopes: 'user-follow-read',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '24px', background: '#191414' }}>
      <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '500' }}>Concert Map</h1>
      <p style={{ color: '#aaa' }}>See where your Spotify artists are playing</p>
      <button onClick={handleLogin} style={{ background: '#1DB954', color: 'white', border: 'none', padding: '14px 32px', borderRadius: '50px', fontSize: '16px', cursor: 'pointer', fontWeight: '600' }}>
        Login with Spotify
      </button>
    </main>
  )
}
