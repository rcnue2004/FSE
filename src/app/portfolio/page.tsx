'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getAllPlayers, getLeaderboard } from '@/lib/db'
import { Player } from '@/types'
import { formatPrice, calcPercentChange, formatPercent } from '@/lib/pricing'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Trophy, Briefcase } from 'lucide-react'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [leaderboard, setLeaderboard] = useState<{ uid: string; displayName: string; totalValue: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [user, authLoading])

  useEffect(() => {
    if (!user) return
    Promise.all([getAllPlayers(), getLeaderboard()]).then(([ps, lb]) => {
      const map: Record<string, Player> = {}
      ps.forEach(p => map[p.id] = p)
      setPlayers(map)
      setLeaderboard(lb)
      setLoading(false)
    })
  }, [user])

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return null

  const holdings = Object.entries(user.portfolio.holdings).filter(([, qty]) => qty > 0)
  const portfolioStockValue = holdings.reduce((sum, [pid, qty]) => {
    return sum + (players[pid]?.currentPrice || 0) * qty
  }, 0)
  const totalValue = user.portfolio.cash + portfolioStockValue
  const startingCash = user.startingCash
  const totalPnl = totalValue - startingCash
  const totalPct = ((totalPnl / startingCash) * 100).toFixed(2)

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold mb-8">Portfolio</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Value', val: formatPrice(totalValue), color: 'text-accent' },
          { label: 'Cash', val: formatPrice(user.portfolio.cash), color: 'text-text' },
          { label: 'Stocks', val: formatPrice(portfolioStockValue), color: 'text-text' },
          { label: 'P&L', val: `${totalPnl >= 0 ? '+' : ''}${formatPrice(totalPnl)} (${totalPct}%)`, color: totalPnl >= 0 ? 'text-green' : 'text-red' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">{label}</p>
            <p className={clsx('font-mono font-bold text-lg', color)}>{val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-muted" /> Holdings
          </h2>
          {holdings.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
              <p>No positions yet.</p>
              <Link href="/" className="text-accent text-sm mt-2 inline-block hover:underline">Browse the market →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {holdings.map(([pid, qty]) => {
                const p = players[pid]
                if (!p) return null
                const pct = calcPercentChange(p.currentPrice, p.previousPrice)
                const value = p.currentPrice * qty
                return (
                  <Link key={pid} href={`/player/${pid}`}>
                    <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between hover:border-accent/30 transition-colors">
                      <div>
                        <p className="font-semibold text-text">{p.name}</p>
                        <p className="text-xs text-muted">{qty} share{qty > 1 ? 's' : ''} · {p.team}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">{formatPrice(value)}</p>
                        <div className={clsx(
                          'flex items-center gap-1 justify-end text-sm',
                          pct >= 0 ? 'text-green' : 'text-red'
                        )}>
                          {pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatPercent(pct)}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Leaderboard
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {leaderboard.slice(0, 10).map((entry, i) => (
              <div
                key={entry.uid}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3',
                  i > 0 && 'border-t border-border',
                  entry.uid === user.uid && 'bg-accent/5'
                )}
              >
                <span className={clsx(
                  'text-sm font-bold w-6 text-center',
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-muted'
                )}>
                  {i + 1}
                </span>
                <span className={clsx('flex-1 text-sm font-medium', entry.uid === user.uid ? 'text-accent' : 'text-text')}>
                  {entry.displayName}
                </span>
                <span className="font-mono text-sm text-text">{formatPrice(entry.totalValue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
