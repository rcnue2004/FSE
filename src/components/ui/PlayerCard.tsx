'use client'
import Link from 'next/link'
import { Player } from '@/types'
import { formatPrice, calcPercentChange, formatPercent } from '@/lib/pricing'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

interface Props {
  player: Player
}

export default function PlayerCard({ player }: Props) {
  const pct = calcPercentChange(player.currentPrice, player.previousPrice)
  const isUp = pct > 0
  const isDown = pct < 0
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (isUp) setFlash('up')
    else if (isDown) setFlash('down')
    const t = setTimeout(() => setFlash(null), 800)
    return () => clearTimeout(t)
  }, [player.currentPrice])

  return (
    <Link href={`/player/${player.id}`}>
      <div
        className={clsx(
          'rounded-xl p-4 border bg-card hover:border-accent/40 transition-all duration-200 cursor-pointer hover:scale-[1.01]',
          player.currentPrice < 0 ? 'border-red/50' : 'border-border',
          flash === 'up' && 'price-up',
          flash === 'down' && 'price-down'
        )}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-text">{player.name}</h3>
              {player.warning && (
                <div className="relative group">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 cursor-help" />
                  <div className="absolute left-0 top-6 z-50 hidden group-hover:block bg-card border border-yellow-400/40 rounded-lg px-3 py-2 text-xs text-text w-48 shadow-xl">
                    <p className="font-semibold text-yellow-400 mb-1">⚠️ Warning</p>
                    <p>{player.warning}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">{player.team}</p>
          </div>
          <div className="text-right">
            <p className="font-mono font-bold text-lg text-text">{formatPrice(player.currentPrice)}</p>
            <div
              className={clsx(
                'flex items-center gap-1 justify-end text-sm font-medium',
                isUp ? 'text-green' : isDown ? 'text-red' : 'text-muted'
              )}
            >
              {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {formatPercent(pct)}
            </div>
          </div>
        </div>

        {/* Mini stats */}
        {player.tournamentStats.length > 0 && (() => {
          const last = player.tournamentStats[player.tournamentStats.length - 1]
          return (
            <div className="grid grid-cols-4 gap-1 text-center mt-2">
              {[
                { label: 'G', val: last.goals, color: 'text-green' },
                { label: 'A', val: last.assists, color: 'text-accent' },
                { label: 'D', val: last.ds, color: 'text-yellow' },
                { label: 'T', val: last.turns, color: 'text-red' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-surface rounded-md py-1">
                  <p className={clsx('text-sm font-bold font-mono', color)}>{val}</p>
                  <p className="text-[10px] text-muted">{label}</p>
                </div>
              ))}
            </div>
          )
        })()}

        <div className="flex justify-between items-center mt-3 text-xs text-muted">
          <span className={player.sharesAvailable === 0 ? 'text-red' : 'text-green'}>
  {player.sharesAvailable}/{player.totalShares} shares left
</span>
          <span>{player.tournamentStats.length} tournaments</span>
        </div>
      </div>
    </Link>
  )
}
