'use client'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { Disc, TrendingUp, LayoutDashboard, Briefcase, Shield, LogOut, LogIn, Menu, X } from 'lucide-react'
import { formatPrice } from '@/lib/pricing'

export default function Navbar() {
  const { user, logout, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-accent">
            <Disc className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
            <span className="hidden sm:block">Frisbee<span className="text-text">Exchange</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted">
            <Link href="/" className="flex items-center gap-1.5 hover:text-text transition-colors">
              <LayoutDashboard className="w-4 h-4" /> Market
            </Link>
            {user && (
              <Link href="/portfolio" className="flex items-center gap-1.5 hover:text-text transition-colors">
                <Briefcase className="w-4 h-4" /> Portfolio
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" className="flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300 transition-colors">
                <Shield className="w-4 h-4" /> Admin
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-4">
            {!loading && user ? (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted">{user.displayName}</p>
                  <p className="text-sm font-mono text-accent">{formatPrice(user.portfolio.cash)}</p>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-red transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                className="flex items-center gap-1.5 bg-accent text-background px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent-dim transition-colors"
              >
                <LogIn className="w-4 h-4" /> Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden text-muted" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border px-4 py-4 flex flex-col gap-4 text-sm">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-muted hover:text-text">
            <LayoutDashboard className="w-4 h-4" /> Market
          </Link>
          {user && (
            <Link href="/portfolio" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-muted hover:text-text">
              <Briefcase className="w-4 h-4" /> Portfolio
            </Link>
          )}
          {user?.isAdmin && (
            <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-yellow-400">
              <Shield className="w-4 h-4" /> Admin
            </Link>
          )}
          {user ? (
            <button onClick={logout} className="flex items-center gap-2 text-red text-left">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          ) : (
            <Link href="/auth" onClick={() => setMenuOpen(false)} className="text-accent font-semibold">
              Sign In / Register
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
