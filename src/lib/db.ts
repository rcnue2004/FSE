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
  writeBatch,
  deleteDoc,
} from 'firebase/firestore'
import { db } from './firebase'
export { db }
import { Player, User, Trade, MarketSettings, WeightConfig, TournamentStats, Game, TournamentEvent } from '@/types'
import { calculatePriceChange, DEFAULT_WEIGHTS, STARTING_CASH, MAX_SHARES_PER_PLAYER } from './pricing'

// ── Helpers ──────────────────────────────────────────────────────────────────

const gamePath = (gameId: string) => `games/${gameId}`
const playersCol = (gameId: string) => collection(db, `games/${gameId}/players`)
const tradesCol = (gameId: string) => collection(db, `games/${gameId}/trades`)
const gameStatsCol = (gameId: string) => collection(db, `games/${gameId}/gameStats`)
const histStatsCol = (gameId: string) => collection(db, `games/${gameId}/historicalStats`)
const settingsDoc = (gameId: string) => doc(db, `games/${gameId}/settings/market`)
const scheduleCol = (gameId: string) => collection(db, `games/${gameId}/schedule`)

// ── Games ─────────────────────────────────────────────────────────────────────

export async function getAllGames(): Promise<Game[]> {
  const snap = await getDocs(collection(db, 'games'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Game))
}

export async function getGame(gameId: string): Promise<Game | null> {
  const snap = await getDoc(doc(db, 'games', gameId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Game
}

export async function createGame(name: string, inviteCode: string, createdBy: string): Promise<string> {
  const ref = await addDoc(collection(db, 'games'), {
    name,
    inviteCode,
    adminUids: [createdBy],
    createdAt: new Date().toISOString(),
    createdBy,
  })
  // Initialize market settings for the game
  await setDoc(doc(db, `games/${ref.id}/settings/market`), {
    isOpen: true,
    startingCash: STARTING_CASH,
    weights: DEFAULT_WEIGHTS,
  })
  return ref.id
}

export async function updateGame(gameId: string, data: Partial<Game>): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), data as Record<string, unknown>)
}

export async function deleteGame(gameId: string): Promise<void> {
  await deleteDoc(doc(db, 'games', gameId))
}

export async function joinGameWithCode(uid: string, inviteCode: string): Promise<Game> {
  const snap = await getDocs(collection(db, 'games'))
  const game = snap.docs.find(d => d.data().inviteCode === inviteCode)
  if (!game) throw new Error('Invalid invite code')
  const gameData = { id: game.id, ...game.data() } as Game

  // Add user to game and create portfolio for this game
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) throw new Error('User not found')
  const user = userSnap.data() as User

  const games = user.games || []
  if (games.includes(game.id)) throw new Error('You are already in this game')

  const settings = await getGameSettings(game.id)

  const batch = writeBatch(db)
  batch.update(userRef, {
    games: [...games, game.id],
  })
  // Create per-game portfolio
  batch.set(doc(db, `games/${game.id}/portfolios/${uid}`), {
    userId: uid,
    holdings: {},
    cash: settings.startingCash,
    totalValue: settings.startingCash,
  })
  await batch.commit()
  return gameData
}

export async function getGamePortfolio(gameId: string, uid: string): Promise<{ holdings: Record<string, number>; cash: number; totalValue: number }> {
  const ref = doc(db, `games/${gameId}/portfolios/${uid}`)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as { holdings: Record<string, number>; cash: number; totalValue: number }

  // Auto-create portfolio with the game's starting cash
  const settings = await getGameSettings(gameId)
  const newPortfolio = { userId: uid, holdings: {}, cash: settings.startingCash, totalValue: settings.startingCash }
  await setDoc(ref, newPortfolio)
  return newPortfolio
}

// ── Players ──────────────────────────────────────────────────────────────────

export async function getAllPlayers(gameId: string): Promise<Player[]> {
  const snap = await getDocs(playersCol(gameId))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Player))
}

export async function getPlayer(gameId: string, id: string): Promise<Player | null> {
  const snap = await getDoc(doc(db, `games/${gameId}/players/${id}`))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Player
}

export async function createPlayer(gameId: string, player: Omit<Player, 'id'>): Promise<string> {
  const ref = await addDoc(playersCol(gameId), player)
  return ref.id
}

export async function updatePlayer(gameId: string, id: string, data: Partial<Player>): Promise<void> {
  await updateDoc(doc(db, `games/${gameId}/players/${id}`), data as Record<string, unknown>)
}

// ── Tournament Stats ──────────────────────────────────────────────────────────

export async function submitTournamentStats(
  gameId: string,
  playerId: string,
  stats: TournamentStats,
  weights: WeightConfig
): Promise<void> {
  const player = await getPlayer(gameId, playerId)
  if (!player) throw new Error('Player not found')

  const priceChange = calculatePriceChange(stats, weights)
  const newPrice = player.currentPrice + priceChange

  const updatedStats = [...player.tournamentStats, { ...stats, priceChange }]
  const updatedHistory = [
    ...player.priceHistory,
    { date: stats.date, price: Math.round(newPrice * 100) / 100, tournamentName: stats.tournamentName },
  ]

  await updateDoc(doc(db, `games/${gameId}/players/${playerId}`), {
    tournamentStats: updatedStats,
    priceHistory: updatedHistory,
    previousPrice: player.currentPrice,
    currentPrice: Math.round(newPrice * 100) / 100,
  })
}

// ── Market Settings ───────────────────────────────────────────────────────────

export async function getGameSettings(gameId: string): Promise<MarketSettings> {
  const snap = await getDoc(settingsDoc(gameId))
  if (!snap.exists()) {
    const defaults: MarketSettings = {
      isOpen: true,
      startingCash: STARTING_CASH,
      weights: DEFAULT_WEIGHTS,
    }
    await setDoc(settingsDoc(gameId), defaults)
    return defaults
  }
  return snap.data() as MarketSettings
}

export async function updateGameSettings(gameId: string, settings: Partial<MarketSettings>): Promise<void> {
  await updateDoc(settingsDoc(gameId), settings as Record<string, unknown>)
}

// Keep old name as alias for compatibility
export const getMarketSettings = getGameSettings
export const updateMarketSettings = updateGameSettings

// ── Users / Portfolios ────────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as User
}

export async function createUser(uid: string, email: string, displayName: string): Promise<void> {
  const newUser: User = {
    uid,
    email,
    displayName,
    isAdmin: false,
    isSuperAdmin: false,
    startingCash: STARTING_CASH,
    portfolio: {
      userId: uid,
      holdings: {},
      cash: STARTING_CASH,
      totalValue: STARTING_CASH,
    },
    trades: [],
    games: [],
  }
  await setDoc(doc(db, 'users', uid), newUser)
}

// ── Trades ────────────────────────────────────────────────────────────────────

export async function executeTrade(
  gameId: string,
  userId: string,
  playerId: string,
  type: 'buy' | 'sell',
  shares: number
): Promise<void> {
  const [user, player, settings] = await Promise.all([
    getUser(userId),
    getPlayer(gameId, playerId),
    getGameSettings(gameId),
  ])

  if (!user) throw new Error('User not found')
  if (!player) throw new Error('Player not found')
  if (!settings.isOpen) throw new Error('Market is currently closed')
  if (player.name === user.displayName) throw new Error('You cannot trade your own stock')

  // Get per-game portfolio (auto-creates if not found)
  const portfolio = await getGamePortfolio(gameId, userId)

  const price = player.currentPrice
  const total = price * shares
  const holdings = portfolio.holdings

  if (type === 'buy') {
    if (player.currentPrice < 0) throw new Error('Cannot buy a stock with a negative price')
    if (portfolio.cash < total) throw new Error('Insufficient funds')
    if (player.sharesAvailable < shares) throw new Error('Not enough shares available')
    const userHoldings = holdings[playerId] || 0
    if (userHoldings + shares > MAX_SHARES_PER_PLAYER) throw new Error(`Cannot own more than ${MAX_SHARES_PER_PLAYER} shares of one player`)

    const batch = writeBatch(db)
    batch.update(doc(db, `games/${gameId}/portfolios/${userId}`), {
      [`holdings.${playerId}`]: userHoldings + shares,
      cash: portfolio.cash - total,
    })
    batch.update(doc(db, `games/${gameId}/players/${playerId}`), {
      sharesAvailable: player.sharesAvailable - shares,
    })
    await batch.commit()
  } else {
    const userHoldings = holdings[playerId] || 0
    if (userHoldings < shares) throw new Error('Not enough shares to sell')

    const batch = writeBatch(db)
    batch.update(doc(db, `games/${gameId}/portfolios/${userId}`), {
      [`holdings.${playerId}`]: userHoldings - shares,
      cash: portfolio.cash + total,
    })
    batch.update(doc(db, `games/${gameId}/players/${playerId}`), {
      sharesAvailable: player.sharesAvailable + shares,
    })
    await batch.commit()
  }

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
  await addDoc(tradesCol(gameId), trade)
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function getLeaderboard(gameId: string): Promise<{ uid: string; displayName: string; totalValue: number }[]> {
  const players = await getAllPlayers(gameId)
  const priceMap: Record<string, number> = {}
  players.forEach(p => (priceMap[p.id] = p.currentPrice))

  const portfoliosSnap = await getDocs(collection(db, `games/${gameId}/portfolios`))
  const portfolios = portfoliosSnap.docs.map(d => ({ uid: d.id, ...d.data() as { holdings: Record<string, number>; cash: number } }))

  return Promise.all(portfolios.map(async p => {
    const user = await getUser(p.uid)
    let stockValue = 0
    for (const [pid, qty] of Object.entries(p.holdings)) {
      stockValue += (priceMap[pid] || 0) * qty
    }
    return {
      uid: p.uid,
      displayName: user?.displayName || 'Unknown',
      totalValue: p.cash + stockValue,
    }
  })).then(results => results.sort((a, b) => b.totalValue - a.totalValue))
}

export async function adminUpdateHolding(
  gameId: string,
  userId: string,
  playerId: string,
  newShares: number
): Promise<void> {
  const [portfolio, player] = await Promise.all([
    getGamePortfolio(gameId, userId),
    getPlayer(gameId, playerId),
  ])
  if (!portfolio || !player) throw new Error('Portfolio or player not found')

  const currentShares = portfolio.holdings[playerId] || 0
  const difference = newShares - currentShares
  const cashAdjustment = difference * player.currentPrice
  const newCash = portfolio.cash - cashAdjustment
  const newSharesAvailable = player.sharesAvailable - difference

  const batch = writeBatch(db)
  batch.update(doc(db, `games/${gameId}/portfolios/${userId}`), {
    [`holdings.${playerId}`]: newShares,
    cash: newCash,
  })
  batch.update(doc(db, `games/${gameId}/players/${playerId}`), {
    sharesAvailable: newSharesAvailable,
  })
  await batch.commit()
}

export const undoTournamentStats = async (gameId: string, playerId: string, tournamentId: string) => {
  const player = await getPlayer(gameId, playerId)
  if (!player) throw new Error('Player not found')

  const stat = player.tournamentStats.find(s => s.tournamentId === tournamentId)
  if (!stat) throw new Error('Stat not found')

  const newStats = player.tournamentStats.filter(s => s.tournamentId !== tournamentId)
  const newPrice = player.currentPrice - stat.priceChange
  const newHistory = player.priceHistory.filter(p => p.tournamentName !== stat.tournamentName || p.tournamentName === 'IPO')

  await updateDoc(doc(db, `games/${gameId}/players/${playerId}`), {
    tournamentStats: newStats,
    currentPrice: Math.round(newPrice * 100) / 100,
    previousPrice: Math.round(newPrice * 100) / 100,
    priceHistory: newHistory,
  })
}

export const deleteGameStats = async (gameId: string, tournamentName: string, opponent?: string) => {
  const col = opponent
    ? query(gameStatsCol(gameId), where('tournamentName', '==', tournamentName), where('opponent', '==', opponent))
    : query(gameStatsCol(gameId), where('tournamentName', '==', tournamentName))
  const snap = await getDocs(col)
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

// ── Tournament Schedule ───────────────────────────────────────────────────────

export async function getTournamentSchedule(gameId: string): Promise<TournamentEvent[]> {
  const q = query(scheduleCol(gameId), orderBy('startDate', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TournamentEvent))
}

export async function addTournamentEvent(gameId: string, event: Omit<TournamentEvent, 'id'>): Promise<void> {
  const cleanEvent = Object.fromEntries(
    Object.entries(event).filter(([_, v]) => v !== undefined)
  )
  await addDoc(scheduleCol(gameId), cleanEvent)
}

export async function deleteTournamentEvent(gameId: string, eventId: string): Promise<void> {
  await deleteDoc(doc(db, `games/${gameId}/schedule/${eventId}`))
}

export async function updateTournamentEvent(gameId: string, eventId: string, data: Partial<TournamentEvent>): Promise<void> {
  await updateDoc(doc(db, `games/${gameId}/schedule/${eventId}`), data as Record<string, unknown>)
}

export { gameStatsCol, histStatsCol }
