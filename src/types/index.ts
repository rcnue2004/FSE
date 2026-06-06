export interface TournamentStats {
  tournamentId: string
  tournamentName: string
  date: string
  goals: number
  assists: number
  ds: number
  turns: number
  priceChange: number
}

export interface PricePoint {
  date: string
  price: number
  tournamentName?: string
}

export interface Player {
  id: string
  name: string
  team?: string
  position: string
  currentPrice: number
  previousPrice: number
  priceHistory: PricePoint[]
  tournamentStats: TournamentStats[]
  sharesAvailable: number
  totalShares: number
  createdAt: string
  warning?: string
}

export interface WeightConfig {
  goals: number
  assists: number
  ds: number
  turns: number
}

export interface Portfolio {
  userId: string
  holdings: { [playerId: string]: number }
  cash: number
  totalValue: number
}

export interface Trade {
  id: string
  userId: string
  userName: string
  playerId: string
  playerName: string
  type: 'buy' | 'sell'
  shares: number
  price: number
  total: number
  timestamp: string
}

export interface User {
  uid: string
  email: string
  displayName: string
  isAdmin: boolean
  isSuperAdmin?: boolean
  startingCash: number
  portfolio: Portfolio
  trades: Trade[]
  games?: string[]
}

export interface MarketSettings {
  isOpen: boolean
  startingCash: number
  weights: WeightConfig
  activeTournament?: string
}

export interface Game {
  id: string
  name: string
  inviteCode: string
  adminUids: string[]
  createdAt: string
  createdBy: string
}
