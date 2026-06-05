'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGame } from '@/context/GameContext'
import { getAllGames, joinGameWithCode, createGame } from '@/lib/db'
import { Game } from '@/types'
import { useRouter } from 'next/navigation'
import { Disc, Plus, LogIn, Edit2, Trash2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function GamesPage() {
  const { user } = useAuth()
  const { setCurrentGameId } = useGame()
  const router = useRouter()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [newInviteCode, setNewInviteCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingGame, setEditingGame] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')

  const isSuperAdmin = user?.isSuperAdmin

  const load = async () => {
    const all = await getAllGames()
    const myGames = isSuperAdmin ? all : all.filter(g => user?.games?.includes(g.id))
    setGames(myGames)
    setLoading(false)
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  const handleJoin = async () => {
    if (!user || !joinCode.trim()) return
    setJoining(true)
    try {
      const game = await joinGameWithCode(user.uid, joinCode.trim())
      toast.success(`Joined ${game.name}!`)
      setJoinCode('')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setJoining(false)
    }
  }

  const handleCreate = async () => {
    if (!user || !newGameName.trim() || !newInviteCode.trim()) return
    setCreating(true)
    try {
      await createGame(newGameName.trim(), newInviteCode.trim(), user.uid)
      toast.success(`${newGameName} created!`)
      setNewGameName('')
      setNewInviteCode('')
      setShowCreate(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleEnter = (game: Game) => {
    setCurrentGameId(game.id)
    router.push('/')
  }

  const handleSaveEdit = async (gameId: string) => {
    const { updateGame } = await import('@/lib/db')
    await updateGame(gameId, { name: editName, inviteCode: editCode })
    toast.success('Game updated')
    setEditingGame(null)
    load()
  }

  const handleDelete = async (gameId: string, gameName: string) => {
    if (!confirm(`Delete "${gameName}"? This cannot be undone.`)) return
    const { deleteGame } = await import('@/lib/db')
    await deleteGame(gameId)
    toast.success('Game deleted')
    load()
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Disc className="w-10 h-10 text-accent animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <h1 className="text-3xl font-bold">Frisbee Exchange</h1>
          <p className="text-muted mt-2 text-sm">Select a game to enter</p>
        </div>

        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm bg-card border border-border rounded-xl">
              You haven't joined any games yet. Enter an invite code below.
            </div>
          ) : (
            games.map(game => (
              <div key={game.id} className="bg-card border border-border rounded-xl p-4">
                {editingGame === game.id ? (
                  <div className="space-y-3">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent" placeholder="Game name" />
                    <input value={editCode} onChange={e => setEditCode(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent" placeholder="Invite code" />
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(game.id)} className="flex-1 bg-accent text-background py-2 rounded-lg text-sm font-semibold"><Check className="w-4 h-4 inline mr-1" />Save</button>
                      <button onClick={() => setEditingGame(null)} className="flex-1 bg-surface text-muted py-2 rounded-lg text-sm"><X className="w-4 h-4 inline mr-1" />Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-text">{game.name}</p>
                      {isSuperAdmin && <p className="text-xs text-muted mt-0.5">Code: <span className="font-mono text-accent">{game.inviteCode}</span></p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <>
                          <button onClick={() => { setEditingGame(game.id); setEditName(game.name); setEditCode(game.inviteCode) }} className="text-muted hover:text-accent transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(game.id, game.name)} className="text-muted hover:text-red transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                      <button onClick={() => handleEnter(game)} className="bg-accent text-background px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">Enter</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-text mb-3 flex items-center gap-2"><LogIn className="w-4 h-4 text-accent" /> Join a Game</p>
          <div className="flex gap-2">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter invite code..." className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent" />
            <button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="bg-accent text-background px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">{joining ? '...' : 'Join'}</button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="bg-card border border-border rounded-xl p-4">
            <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 text-sm font-semibold text-accent w-full"><Plus className="w-4 h-4" /> Create New Game</button>
            {showCreate && (
              <div className="mt-3 space-y-3">
                <input value={newGameName} onChange={e => setNewGameName(e.target.value)} placeholder="Game name (e.g. WOOF 2026)" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent" />
                <input value={newInviteCode} onChange={e => setNewInviteCode(e.target.value)} placeholder="Invite code (e.g. woof2026)" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent" />
                <button onClick={handleCreate} disabled={creating || !newGameName.trim() || !newInviteCode.trim()} className="w-full bg-accent text-background py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">{creating ? 'Creating...' : 'Create Game'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
