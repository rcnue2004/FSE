'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Disc } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName)
      }
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created! You start with $10,000.')
      router.push('/')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Disc className="w-10 h-10 text-accent animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <h1 className="text-3xl font-bold">Frisbee Exchange</h1>
          <p className="text-muted mt-2 text-sm">Fantasy stock market for ultimate frisbee</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex bg-surface rounded-xl p-1 mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  mode === m ? 'bg-accent text-background' : 'text-muted hover:text-text'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs text-muted block mb-1.5">Player Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  placeholder="Your in-game name"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-background py-3 rounded-xl font-semibold text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'register' && (
            <p className="text-xs text-muted text-center mt-4">
              Everyone starts with <span className="text-accent">$10,000</span> in fake cash
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
