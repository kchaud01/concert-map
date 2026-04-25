'use client'
import { createClient } from '@/utils/supabase'

export default function LoginPage() {
  const supabase = createClient()

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        scopes: 'user-follow-read',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '500' }}>Concert Map</h1>
      <p style={{ color: '#666' }}>See where your Spotify artists are playing</p>
      <button onClick={handleLogin} style={{ background: '#1DB954', color: 'white', border: 'none', padding: '14px 32px', borderRadius: '50px', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>
        Login with Spotify
      </button>
    </main>
  )
}
