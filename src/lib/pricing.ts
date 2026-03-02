import { WeightConfig, TournamentStats, PricePoint } from '@/types'

export const DEFAULT_WEIGHTS: WeightConfig = {
  goals: 2.5,
  assists: 2.0,
  ds: 1.5,
  turns: -1.0,
}

export const STARTING_CASH = 10000
export const MAX_SHARES_PER_PLAYER = 10
export const DEFAULT_STARTING_PRICE = 100

/**
 * Calculate price change from a single tournament's stats
 */
export function calculatePriceChange(
  stats: { goals: number; assists: number; ds: number; turns: number },
  weights: WeightConfig
): number {
  const change =
    stats.goals * weights.goals +
    stats.assists * weights.assists +
    stats.ds * weights.ds +
    stats.turns * weights.turns // turns weight should be negative

  return Math.round(change * 100) / 100
}

/**
 * Recalculate a player's price from scratch using all tournament history
 */
export function recalculatePriceFromHistory(
  basePrice: number,
  tournamentStats: TournamentStats[],
  weights: WeightConfig
): { currentPrice: number; priceHistory: PricePoint[] } {
  let price = basePrice
  const priceHistory: PricePoint[] = [
    { date: tournamentStats[0]?.date || new Date().toISOString(), price: basePrice, tournamentName: 'Starting Price' },
  ]

  const sorted = [...tournamentStats].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const stat of sorted) {
    const change = calculatePriceChange(stat, weights)
    price = Math.max(1, price + change) // floor at $1
    priceHistory.push({
      date: stat.date,
      price: Math.round(price * 100) / 100,
      tournamentName: stat.tournamentName,
    })
  }

  return { currentPrice: Math.round(price * 100) / 100, priceHistory }
}

/**
 * Format price with $ sign
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`
}

/**
 * Calculate % change between two prices
 */
export function calcPercentChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return Math.round(((current - previous) / previous) * 10000) / 100
}

/**
 * Format percent change with sign
 */
export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}
