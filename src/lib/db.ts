import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
export { db }
import { Player, User, Trade, MarketSettings, WeightConfig, TournamentStats } from '@/types'
import { calculatePriceChange, DEFAULT_WEIGHTS, STARTING_CASH, MAX_SHARES_PER_PLAYER } from './pricing'
// ── Players ──────────────────────────────────────────────────────────────────

export async function getAllPlayers(): Promise<Player[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player))
}

export async function getPlayer(id: string): Promise<Player | null> {
  const snap = await getDoc(doc(db, 'players', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Player
}

export async function createPlayer(player: Omit<Player, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'players'), player)
  return ref.id
}

export async function updatePlayer(id: string, data: Partial<Player>): Promise<void> {
  await updateDoc(doc(db, 'players', id), data as Record<string, unknown>)
}

// ── Tournament Stats (Admin) ──────────────────────────────────────────────────

export async function submitTournamentStats(
  playerId: string,
  stats: TournamentStats,
  weights: WeightConfig
): Promise<void> {
  const player = await getPlayer(playerId)
  if (!player) throw new Error('Player not found')

  const priceChange = calculatePriceChange(stats, weights)
  const newPrice = Math.max(1, player.currentPrice + priceChange)

  const updatedStats = [...player.tournamentStats, { ...stats, priceChange }]
  const updatedHistory = [
    ...player.priceHistory,
    { date: stats.date, price: Math.round(newPrice * 100) / 100, tournamentName: stats.tournamentName },
  ]

  await updateDoc(doc(db, 'players', playerId), {
    tournamentStats: updatedStats,
    priceHistory: updatedHistory,
    previousPrice: player.currentPrice,
    currentPrice: Math.round(newPrice * 100) / 100,
  })
}

// ── Market Settings ───────────────────────────────────────────────────────────

export async function getMarketSettings(): Promise<MarketSettings> {
  const snap = await getDoc(doc(db, 'settings', 'market'))
  if (!snap.exists()) {
    const defaults: MarketSettings = {
      isOpen: true,
      startingCash: STARTING_CASH,
      weights: DEFAULT_WEIGHTS,
    }
    await setDoc(doc(db, 'settings', 'market'), defaults)
    return defaults
  }
  return snap.data() as MarketSettings
}

export async function updateMarketSettings(settings: Partial<MarketSettings>): Promise<void> {
  await updateDoc(doc(db, 'settings', 'market'), settings as Record<string, unknown>)
}

// ── Users / Portfolios ────────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as User
}

export async function createUser(uid: string, email: string, displayName: string): Promise<void> {
  const settings = await getMarketSettings()
  const newUser: User = {
    uid,
    email,
    displayName,
    isAdmin: false,
    startingCash: settings.startingCash,
    portfolio: {
      userId: uid,
      holdings: {},
      cash: settings.startingCash,
      totalValue: settings.startingCash,
    },
    trades: [],
  }
  await setDoc(doc(db, 'users', uid), newUser)
}

// ── Trades ────────────────────────────────────────────────────────────────────

export async function executeTrade(
  userId: string,
  playerId: string,
  type: 'buy' | 'sell',
  shares: number
): Promise<void> {
  const [user, player, settings] = await Promise.all([
    getUser(userId),
    getPlayer(playerId),
    getMarketSettings(),
  ])

  if (!user) throw new Error('User not found')
  if (!player) throw new Error('Player not found')
  if (!settings.isOpen) throw new Error('Market is currently closed')

  // No investing in yourself
  if (player.name === user.displayName) throw new Error('You cannot trade your own stock')

  const price = player.currentPrice
  const total = price * shares
  const holdings = user.portfolio.holdings

  if (type === 'buy') {
    if (user.portfolio.cash < total) throw new Error('Insufficient funds')
    if (player.sharesAvailable < shares) throw new Error('Not enough shares available')
    const userHoldings = holdings[playerId] || 0
    if (userHoldings + shares > MAX_SHARES_PER_PLAYER) throw new Error(`Cannot own more than ${MAX_SHARES_PER_PLAYER} shares of one player`)

    const batch = writeBatch(db)
    batch.update(doc(db, 'users', userId), {
      [`portfolio.holdings.${playerId}`]: userHoldings + shares,
      'portfolio.cash': user.portfolio.cash - total,
    })
    batch.update(doc(db, 'players', playerId), {
      sharesAvailable: player.sharesAvailable - shares,
    })
    await batch.commit()
  } else {
    const userHoldings = holdings[playerId] || 0
    if (userHoldings < shares) throw new Error('Not enough shares to sell')

    const batch = writeBatch(db)
    const newHoldings = userHoldings - shares
    if (newHoldings === 0) {
      batch.update(doc(db, 'users', userId), {
        [`portfolio.holdings.${playerId}`]: 0,
        'portfolio.cash': user.portfolio.cash + total,
      })
    } else {
      batch.update(doc(db, 'users', userId), {
        [`portfolio.holdings.${playerId}`]: newHoldings,
        'portfolio.cash': user.portfolio.cash + total,
      })
    }
    batch.update(doc(db, 'players', playerId), {
      sharesAvailable: player.sharesAvailable + shares,
    })
    await batch.commit()
  }

  // Log trade
  const trade: Omit<Trade, 'id'> = {
    userId,
    playerId,
    playerName: player.name,
    userName: user.displayName,
    type,
    shares,
    price,
    total,
    timestamp: new Date().toISOString(),
  }
  await addDoc(collection(db, 'trades'), trade)
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<{ uid: string; displayName: string; totalValue: number }[]> {
  const snap = await getDocs(collection(db, 'users'))
  const users = snap.docs.map((d) => d.data() as User)

  // We'd need all player prices to compute portfolio value accurately
  const players = await getAllPlayers()
  const priceMap: Record<string, number> = {}
  players.forEach((p) => (priceMap[p.id] = p.currentPrice))

  return users
    .map((u) => {
      let stockValue = 0
      for (const [pid, qty] of Object.entries(u.portfolio.holdings)) {
        stockValue += (priceMap[pid] || 0) * qty
      }
      return {
        uid: u.uid,
        displayName: u.displayName,
        totalValue: u.portfolio.cash + stockValue,
      }
    })
    .sort((a, b) => b.totalValue - a.totalValue)
}
