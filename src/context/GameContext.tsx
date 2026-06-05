'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Game } from '@/types'
import { getGame } from '@/lib/db'

interface GameContextValue {
  currentGame: Game | null
  currentGameId: string | null
  setCurrentGameId: (id: string | null) => void
  loading: boolean
}

const GameContext = createContext<GameContextValue>({
  currentGame: null,
  currentGameId: null,
  setCurrentGameId: () => {},
  loading: true,
})

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentGameId, setCurrentGameIdState] = useState<string | null>(null)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(false)

  const setCurrentGameId = (id: string | null) => {
    setCurrentGameIdState(id)
    if (id) localStorage.setItem('currentGameId', id)
    else localStorage.removeItem('currentGameId')
  }

  useEffect(() => {
    const saved = localStorage.getItem('currentGameId')
    if (saved) setCurrentGameIdState(saved)
  }, [])

  useEffect(() => {
    if (!currentGameId) { setCurrentGame(null); return }
    setLoading(true)
    getGame(currentGameId).then(g => {
      setCurrentGame(g)
      setLoading(false)
    })
  }, [currentGameId])

  return (
    <GameContext.Provider value={{ currentGame, currentGameId, setCurrentGameId, loading }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
