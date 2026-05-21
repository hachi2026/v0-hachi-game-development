'use client'

import { useHachi } from '@/lib/hachi-context'
import { formatNumber, getRarityColor } from '@/lib/game-config'
import { Coins, Zap, CircleDollarSign } from 'lucide-react'

export function Header() {
  const { user } = useHachi()

  if (!user) return null

  const { profile, hachi, energyDaysRemaining } = user

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">
                {profile.username?.charAt(0).toUpperCase() || 'H'}
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm">{profile.username || 'HachiLover'}</p>
              <div className="flex items-center gap-1">
                <span className={`text-xs font-medium ${getRarityColor(hachi.rarity)}`}>
                  Nivel {hachi.level}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2">
            {/* Energy */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-1">
              <Zap className={`w-3.5 h-3.5 ${energyDaysRemaining > 0 ? 'text-hachi-green' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium">
                {energyDaysRemaining > 0 ? `${energyDaysRemaining}d` : '0d'}
              </span>
            </div>

            {/* HACHI Balance */}
            <div className="flex items-center gap-1 bg-primary/10 rounded-full px-2 py-1">
              <Coins className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">
                {formatNumber(profile.hachi_balance)}
              </span>
            </div>

            {/* HACHI KOBAN Balance */}
            <div className="flex items-center gap-1 bg-amber-500/10 rounded-full px-2 py-1">
              <CircleDollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-amber-500">
                {formatNumber(profile.hachi_koban_balance || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
