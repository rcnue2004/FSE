'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getPlayer } from '@/lib/db'
import { executeTrade } from '@/lib/db'
import { Player } from '@/types'
import PriceChart from '@/components/charts/PriceChart'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice, calcPercentChange, formatPercent } from '@/lib/pricing'
import { TrendingUp, TrendingDown, ArrowLeft, Target, Zap, Shield, AlertTriangle, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { format } from 'date-fns'

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [tradeShares, setTradeShares] = useState(1)
  const [trading, setTrading] = useState(false)

  useEffect(() => {
    getPlayer(id).then(p => { setPlayer(p); setLoading(false) })
  }, [id])

  const userShares = user?.portfolio.holdings[id] || 0
  const pct = player ? calcPercentChange(player.currentPrice, player.previousPrice) : 0

  const handleTrade = async (type: 'buy' | 'sell') => {
    if (!user || !player) return
    setTrading(true)
    try {
      await executeTrade(user.uid, player.id, type, tradeShares)
      await refreshUser()
      const p = await getPlayer(id)
      setPlayer(p)
      toast.success(`${type === 'buy' ? 'Bought' : 'Sold'} ${tradeShares} share${tradeShares > 1 ? 's' : ''} of ${player.name}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTrading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!player) return <div className="text-center py-24 text-muted">Player not found</div>

  const totalGoals = player.tournamentStats.reduce((s, t) => s + t.goals, 0)
  const totalAssists = player.tournamentStats.reduce((s, t) => s + t.assists, 0)
  const totalDs = player.tournamentStats.reduce((s, t) => s + t.ds, 0)
  const totalTurns = player.tournamentStats.reduce((s, t) => s + t.turns, 0)

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-muted hover:text-text transition-colors mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Market
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-text">{player.name}</h1>
            {player.warning && (
              <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-1">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-yellow-400 text-sm">{player.warning}</p>
              </div>
            )}
          </div>
          <p className="text-muted mt-1">{player.team} · {player.position}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl font-bold text-text">{formatPrice(player.currentPrice)}</p>
          <div className={clsx(
            'flex items-center gap-1 justify-end text-lg font-medium mt-1',
            pct >= 0 ? 'text-green' : 'text-red'
          )}>
            {pct >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {formatPercent(pct)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6" style={{ height: 280 }}>
        <h2 className="text-sm font-medium text-muted mb-3">Price History</h2>
        <div style={{ height: 220 }}>
          {player.priceHistory.length > 1 ? (
            <PriceChart priceHistory={player.priceHistory} color={pct >= 0 ? '#00c896' : '#ff4757'} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted text-sm">No price history yet</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* Career totals */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-medium text-muted mb-4">Career Totals</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Goals', val: totalGoals, icon: <Target className="w-4 h-4" />, color: 'text-green' },
                { label: 'Assists', val: totalAssists, icon: <Zap className="w-4 h-4" />, color: 'text-accent' },
                { label: 'Ds', val: totalDs, icon: <Shield className="w-4 h-4" />, color: 'text-yellow-400' },
                { label: 'Turns', val: totalTurns, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red' },
              ].map(({ label, val, icon, color }) => (
                <div key={label} className="bg-surface rounded-xl p-3 text-center">
                  <div className={clsx('flex justify-center mb-1', color)}>{icon}</div>
                  <p className={clsx('text-2xl font-bold font-mono', color)}>{val}</p>
                  <p className="text-xs text-muted mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tournament breakdown */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-medium text-muted mb-4">Tournament History</h2>
            {player.tournamentStats.length === 0 ? (
              <p className="text-muted text-sm text-center py-6">No tournament data yet</p>
            ) : (
              <div className="space-y-2">
                {[...player.tournamentStats].reverse().map((stat, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2.5">
                    <div>
                      <p className="font-medium text-sm text-text">{stat.tournamentName}</p>
                      <p className="text-xs text-muted">{format(new Date(stat.date), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex gap-3 text-center text-xs">
                      <div><p className="text-green font-mono font-bold">{stat.goals}</p><p className="text-muted">G</p></div>
                      <div><p className="text-accent font-mono font-bold">{stat.assists}</p><p className="text-muted">A</p></div>
                      <div><p className="text-yellow-400 font-mono font-bold">{stat.ds}</p><p className="text-muted">D</p></div>
                      <div><p className="text-red font-mono font-bold">{stat.turns}</p><p className="text-muted">T</p></div>
                    </div>
                    <div className={clsx(
                      'text-sm font-mono font-bold',
                      stat.priceChange >= 0 ? 'text-green' : 'text-red'
                    )}>
                      {stat.priceChange >= 0 ? '+' : ''}{stat.priceChange.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trade panel */}
        <div className="bg-card border border-border rounded-xl p-4 h-fit">
          <h2 className="text-sm font-medium text-muted mb-4">Trade</h2>
          {!user ? (
            <p className="text-sm text-muted text-center py-4">Sign in to trade</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-surface rounded-lg p-3 text-sm">
                <div className="flex justify-between text-muted mb-1">
                  <span>Your cash</span>
                  <span className="font-mono text-text">{formatPrice(user.portfolio.cash)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Your shares</span>
                  <span className="font-mono text-text">{userShares}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Available</span>
                  <span className="font-mono text-text">{player.sharesAvailable}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1.5">Shares</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={tradeShares}
                  onChange={e => setTradeShares(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                />
              </div>

              <div className="bg-surface rounded-lg p-2.5 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Total</span>
                  <span className="font-mono text-text font-bold">{formatPrice(player.currentPrice * tradeShares)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleTrade('buy')}
                  disabled={trading || player.sharesAvailable === 0}
                  className="bg-green text-background py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {trading ? '...' : 'Buy'}
                </button>
                <button
                  onClick={() => handleTrade('sell')}
                  disabled={trading || userShares === 0}
                  className="bg-red text-background py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {trading ? '...' : 'Sell'}
                </button>
              </div>

              <p className="text-xs text-muted text-center">
                Max 10 shares per player. No shorting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
