'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Game } from '@/types'
import { getGame } from '@/lib/db'

interface GameContextValue {
  currentGame: Game | null
  currentGameId: string | null
  setCurrentGameId: (id: string | null) => void
  loading: boolean
  hydrated: boolean
}

const GameContext = createContext<GameContextValue>({
  currentGame: null,
  currentGameId: null,
  setCurrentGameId: () => {},
  loading: true,
  hydrated: false,
})

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentGameId, setCurrentGameIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('currentGameId')
    return null
  })
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(false)
  const hydrated = true  // always ready since we read localStorage in useState initializer

  const setCurrentGameId = (id: string | null) => {
    setCurrentGameIdState(id)
    if (id) localStorage.setItem('currentGameId', id)
    else localStorage.removeItem('currentGameId')
  }

  useEffect(() => {
    if (!currentGameId) { setCurrentGame(null); return }
    setLoading(true)
    getGame(currentGameId).then(g => {
      setCurrentGame(g)
      setLoading(false)
    })
  }, [currentGameId])

  return (
    <GameContext.Provider value={{ currentGame, currentGameId, setCurrentGameId, loading, hydrated }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
