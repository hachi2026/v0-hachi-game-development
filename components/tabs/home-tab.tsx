'use client'

import { useHachi } from '@/lib/hachi-context'
import { CatAvatar, CatAvatarPlaceholder } from '@/components/cat-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatNumber, getLevelConfig, BASE_DAILY_CLAIM } from '@/lib/game-config'
import { Coins, Zap, TrendingUp, Gift, AlertCircle } from 'lucide-react'

export function HomeTab() {
  const { user, setActiveTab } = useHachi()

  if (!user) return null

  const { profile, hachi, dailyProduction, energyDaysRemaining, canClaim } = user
  const levelConfig = getLevelConfig(hachi.level)
  const nextLevelConfig = hachi.level < 30 ? getLevelConfig(hachi.level + 1) : null

  // XP progress (simplified as percentage to next level)
  const xpProgress = ((hachi.total_production % 5000) / 5000) * 100

  return (
    <div className="px-4 py-6 pb-24 space-y-6">
      {/* Welcome Section */}
      <div className="text-center">
        <h2 className="text-xl font-bold mb-1">
          ¡Hola, {profile.username || 'HachiLover'}!
        </h2>
        <p className="text-sm text-muted-foreground">
          Tu Hachi te espera para producir tokens
        </p>
      </div>

      {/* Hachi Card */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-muted/30 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            {/* Cat Avatar */}
            <div className="relative mb-4">
              <CatAvatar level={hachi.level} rarity={hachi.rarity} size="xl" />
              
              {/* Level Badge */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent px-4 py-1 rounded-full">
                <span className="text-sm font-bold text-primary-foreground">
                  Nivel {hachi.level}
                </span>
              </div>
            </div>

            {/* Hachi Name */}
            <h3 className="text-lg font-bold mt-4">{hachi.name}</h3>

            {/* XP Progress */}
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>XP</span>
                <span>{formatNumber(hachi.total_production)} / 5,000</span>
              </div>
              <Progress value={xpProgress} className="h-2" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 w-full mt-6">
              {/* Daily Production */}
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                  <Coins className="w-4 h-4" />
                  <span className="text-xs font-medium">Producción diaria</span>
                </div>
                <p className="text-xl font-bold">{formatNumber(dailyProduction)}</p>
                <p className="text-xs text-muted-foreground">HACHI</p>
              </div>

              {/* Energy */}
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-hachi-green mb-1">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-medium">Energía</span>
                </div>
                <p className="text-xl font-bold">
                  {energyDaysRemaining > 0 ? `${energyDaysRemaining}` : '0'}
                </p>
                <p className="text-xs text-muted-foreground">días restantes</p>
              </div>
            </div>

            {/* Energy Warning */}
            {energyDaysRemaining === 0 && (
              <div className="w-full mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-xs text-destructive">
                  Tu Hachi no tiene energía. ¡Cómprale alimento para que produzca HACHI!
                </p>
              </div>
            )}

            {/* Claim Button */}
            <Button 
              className="w-full mt-6 h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-50"
              onClick={() => setActiveTab('hachi')}
              disabled={!canClaim}
            >
              <Gift className="w-5 h-5 mr-2" />
              {canClaim ? `Reclamar ${formatNumber(dailyProduction)} HACHI` : 'Ya reclamaste hoy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Earned */}
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Total producido</span>
            </div>
            <p className="text-lg font-bold">{formatNumber(hachi.total_production)}</p>
            <p className="text-xs text-muted-foreground">HACHI</p>
          </CardContent>
        </Card>

        {/* Balance */}
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Coins className="w-4 h-4" />
              <span className="text-xs">Tu balance</span>
            </div>
            <p className="text-lg font-bold text-primary">{formatNumber(profile.hachi_balance)}</p>
            <p className="text-xs text-muted-foreground">HACHI</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Level Preview */}
      {nextLevelConfig && (
        <Card className="border-border/50 bg-gradient-to-r from-accent/10 to-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Siguiente nivel</p>
                <p className="text-xs text-muted-foreground">
                  +{formatNumber(nextLevelConfig.dailyBonus)} HACHI/día
                </p>
              </div>
              <Button 
                size="sm"
                variant="secondary"
                onClick={() => setActiveTab('hachi')}
              >
                Mejorar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
