'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getUser, getAllPlayers } from '@/lib/db'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/db'
import { User, Player, Trade } from '@/types'
import { formatPrice, calcPercentChange, formatPercent } from '@/lib/pricing'
import { ArrowLeft, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import Link from 'next/link'

export default function UserProfilePage() {
  const { uid } = useParams<{ uid: string }>()
  const router = useRouter()
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [players, setPlayers] = useState<Record<string, Player>>({})
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [showTrades, setShowTrades] = useState(false)

  useEffect(() => {
    async function load() {
      const [u, ps] = await Promise.all([getUser(uid), getAllPlayers()])
      const map: Record<string, Player> = {}
      ps.forEach(p => map[p.id] = p)
      setPlayers(map)
      setProfileUser(u)

      // Get trade history for this user
      const tradesSnap = await getDocs(
        query(collection(db, 'trades'),
          where('userId', '==', uid),
          orderBy('timestamp', 'desc')
        )
      )
      setTrades(tradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trade)))
      setLoading(false)
    }
    load()
  }, [uid])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!profileUser) return <div className="text-center py-24 text-muted">User not found</div>

  const holdings = Object.entries(profileUser.portfolio.holdings).filter(([, qty]) => qty > 0)
  const portfolioStockValue = holdings.reduce((sum, [pid, qty]) => {
    return sum + (players[pid]?.currentPrice || 0) * qty
  }, 0)
  const totalValue = profileUser.portfolio.cash + portfolioStockValue
  const totalPnl = totalValue - profileUser.startingCash
  const totalPct = ((totalPnl / profileUser.startingCash) * 100).toFixed(2)

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-muted hover:text-text transition-colors mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">{profileUser.displayName}</h1>
            <p className="text-muted text-sm mt-1">{trades.length} total trades</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold font-mono text-accent">{formatPrice(totalValue)}</p>
            <p className={clsx(
              'text-sm font-mono mt-1',
              totalPnl >= 0 ? 'text-green' : 'text-red'
            )}>
              {totalPnl >= 0 ? '+' : ''}{formatPrice(totalPnl)} ({totalPct}%)
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Cash', val: formatPrice(profileUser.portfolio.cash), color: 'text-text' },
          { label: 'Stock Value', val: formatPrice(portfolioStockValue), color: 'text-text' },
          { label: 'Total P&L', val: `${totalPnl >= 0 ? '+' : ''}${formatPrice(totalPnl)}`, color: totalPnl >= 0 ? 'text-green' : 'text-red' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted mb-1">{label}</p>
            <p className={clsx('font-mono font-bold', color)}>{val}</p>
          </div>
        ))}
      </div>

      {/* Holdings */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-muted mb-4">Holdings</h2>
        {holdings.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">No positions yet</p>
        ) : (
          <div className="space-y-2">
            {holdings.map(([pid, qty]) => {
              const p = players[pid]
              if (!p) return null
              const pct = calcPercentChange(p.currentPrice, p.previousPrice)
              const value = p.currentPrice * qty
              return (
                <Link key={pid} href={`/player/${pid}`}>
                  <div className="flex items-center justify-between bg-surface rounded-lg px-4 py-3 hover:border-accent/30 border border-transparent transition-colors">
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

      {/* Trade History Dropdown */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTrades(!showTrades)}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-surface transition-colors"
        >
          <h2 className="text-sm font-semibold text-muted">Trade History ({trades.length})</h2>
          {showTrades ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>

        {showTrades && (
          <div className="border-t border-border">
            {trades.length === 0 ? (
              <p className="text-muted text-sm text-center py-6">No trades yet</p>
            ) : (
              <div className="divide-y divide-border">
                {trades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        'text-xs font-bold px-2 py-0.5 rounded-full',
                        trade.type === 'buy' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'
                      )}>
                        {trade.type.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-text">{trade.playerName}</p>
                        <p className="text-xs text-muted">{format(new Date(trade.timestamp), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-text">{formatPrice(trade.total)}</p>
                      <p className="text-xs text-muted">{trade.shares} share{trade.shares > 1 ? 's' : ''} · {formatPrice(trade.price)}/ea</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}