'use client'

import { useState } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { CatAvatar } from '@/components/cat-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  formatNumber, 
  getLevelConfig, 
  getUpgradeCost, 
  getRarityColor,
  getRarityBgColor,
  LEVEL_CONFIGS,
  MAX_LEVEL,
  RANKING_POINTS,
  SEASON_DURATION_DAYS
} from '@/lib/game-config'
import { 
  Coins, 
  Zap, 
  TrendingUp, 
  Gift, 
  ArrowRight, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  CircleDollarSign,
  Droplets
} from 'lucide-react'

export function HachiTab() {
  const { user, refreshUser, updateBalance } = useHachi()
  const [claiming, setClaiming] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [buyingWater, setBuyingWater] = useState(false)

  const supabase = createClient()

  // Water cost for full season (90 days) - 25% discount
  const SEASON_WATER_COST = 6750 // 100 * 90 * 0.75

  if (!user) return null

  const { profile, hachi, dailyProduction, energyDaysRemaining, canClaim, accessoryProduction } = user
  const levelConfig = getLevelConfig(hachi.level)
  const nextLevelConfig = hachi.level < MAX_LEVEL ? getLevelConfig(hachi.level + 1) : null
  const upgradeCost = getUpgradeCost(hachi.level)
  const totalKobanProduction = dailyProduction + (accessoryProduction || 0)

  // Calculate water days remaining
  const waterDaysRemaining = hachi.water_expires_at 
    ? Math.max(0, Math.ceil((new Date(hachi.water_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  const handleBuyWater = async () => {
    if (profile.hachi_balance < SEASON_WATER_COST) {
      alert('No tienes suficiente HACHI')
      return
    }

    setBuyingWater(true)

    try {
      const expiresAt = new Date()
      
      // If already has water, extend from that date
      if (hachi.water_expires_at && new Date(hachi.water_expires_at) > new Date()) {
        expiresAt.setTime(new Date(hachi.water_expires_at).getTime())
      }
      expiresAt.setDate(expiresAt.getDate() + SEASON_DURATION_DAYS)

      // Deduct HACHI
      await supabase
        .from('profiles')
        .update({ hachi_balance: profile.hachi_balance - SEASON_WATER_COST })
        .eq('id', profile.id)

      // Update water expiration
      await supabase
        .from('hachis')
        .update({ 
          water_expires_at: expiresAt.toISOString(),
          last_water_at: new Date().toISOString()
        })
        .eq('id', hachi.id)

      updateBalance(-SEASON_WATER_COST)
      await refreshUser()
    } catch (error) {
      console.error('Error buying water:', error)
    } finally {
      setBuyingWater(false)
    }
  }

  const handleClaim = async () => {
    if (!canClaim) return
    setClaiming(true)

    try {
      // Insert claim record
      const { error: claimError } = await supabase
        .from('daily_claims')
        .insert({
          user_id: profile.id,
          hachi_id: hachi.id,
          base_amount: 110,
          level_bonus: dailyProduction - 110,
          total_claimed: dailyProduction,
        })

      if (claimError) throw claimError

      // Update hachi last_claim_at and total_production
      const { error: hachiError } = await supabase
        .from('hachis')
        .update({
          last_claim_at: new Date().toISOString(),
          total_production: hachi.total_production + totalKobanProduction,
        })
        .eq('id', hachi.id)

      if (hachiError) throw hachiError

      // Update profile KOBAN balance
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          hachi_koban_balance: (profile.hachi_koban_balance || 0) + totalKobanProduction,
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      updateBalance(totalKobanProduction, 'koban')
      await refreshUser()
    } catch (error) {
      console.error('Error claiming:', error)
    } finally {
      setClaiming(false)
    }
  }

  const handleUpgrade = async () => {
    if (hachi.level >= MAX_LEVEL) return
    setUpgrading(true)

    try {
      // In production, this would verify WLD payment first
      // For now, we'll just update the level (mockup)
      
      const newLevel = hachi.level + 1
      const newRarity = LEVEL_CONFIGS[newLevel - 1].rarity

      // Insert upgrade record
      const { error: upgradeError } = await supabase
        .from('upgrade_purchases')
        .insert({
          user_id: profile.id,
          hachi_id: hachi.id,
          from_level: hachi.level,
          to_level: newLevel,
          wld_cost: upgradeCost,
          daily_bonus_gained: nextLevelConfig?.dailyBonus || 0,
        })

      if (upgradeError) throw upgradeError

      // Update hachi
      const { error: hachiError } = await supabase
        .from('hachis')
        .update({
          level: newLevel,
          rarity: newRarity,
          cat_image_index: newLevel,
        })
        .eq('id', hachi.id)

      if (hachiError) throw hachiError

      // Update profile wld_spent
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          wld_spent: profile.wld_spent + upgradeCost,
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      await refreshUser()
      setShowUpgradeModal(false)
    } catch (error) {
      console.error('Error upgrading:', error)
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div className="px-4 py-6 pb-24 space-y-6">
      {/* Hachi Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold">Mi Hachi</h2>
        <p className="text-sm text-muted-foreground">
          Cuida y mejora a tu mascota
        </p>
      </div>

      {/* Main Hachi Card */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-muted/30 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            {/* Cat Avatar with Rarity Glow */}
            <div className="relative">
              <CatAvatar level={hachi.level} rarity={hachi.rarity} size="xl" />
            </div>

            {/* Stats */}
            <div className="w-full mt-6 space-y-4">
              {/* Production */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="w-5 h-5 text-amber-500" />
                  <span className="text-sm">Produccion diaria</span>
                </div>
                <span className="font-bold text-amber-500">{formatNumber(totalKobanProduction)} KOBAN</span>
              </div>

              {/* Level Bonus */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  <span className="text-sm">Bonus por nivel</span>
                </div>
                <span className="font-bold text-accent">+{levelConfig.totalDailyProduction - 100}</span>
              </div>

              {/* Energy Status */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${energyDaysRemaining > 0 ? 'text-hachi-green' : 'text-muted-foreground'}`} />
                  <span className="text-sm">Días alimentado</span>
                </div>
                <span className={`font-bold ${energyDaysRemaining > 0 ? 'text-hachi-green' : 'text-destructive'}`}>
                  {energyDaysRemaining} días
                </span>
              </div>

              {/* Water Status */}
              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Droplets className={`w-5 h-5 ${waterDaysRemaining > 0 ? 'text-blue-500' : 'text-destructive'}`} />
                  <span className="text-sm">Dias de agua</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${waterDaysRemaining > 0 ? 'text-blue-500' : 'text-destructive'}`}>
                    {waterDaysRemaining} dias
                  </span>
                  <Button 
                    size="sm" 
                    variant={waterDaysRemaining === 0 ? "default" : "outline"}
                    className={`h-7 text-xs ${waterDaysRemaining === 0 ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                    onClick={handleBuyWater}
                    disabled={buyingWater || profile.hachi_balance < SEASON_WATER_COST}
                  >
                    {buyingWater ? '...' : `+90 dias (${formatNumber(SEASON_WATER_COST)})`}
                  </Button>
                </div>
              </div>
            </div>

            {/* Claim Section */}
            <div className="w-full mt-6 p-4 bg-gradient-to-r from-amber-500/10 to-amber-600/10 rounded-xl border border-amber-500/20">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Tu produccion diaria</p>
                <p className="text-3xl font-bold text-amber-500">{formatNumber(totalKobanProduction)} <span className="text-lg">KOBAN</span></p>
              </div>

              {energyDaysRemaining === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <p className="text-sm text-destructive">
                    Sin energia, no producira KOBAN
                  </p>
                </div>
              ) : canClaim ? (
                <Button 
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-white"
                  onClick={handleClaim}
                  disabled={claiming}
                >
                  {claiming ? (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 animate-spin" />
                      Reclamando...
                    </span>
                  ) : (
                    <>
                      <CircleDollarSign className="w-5 h-5 mr-2" />
                      CLAIM DIARIO
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-hachi-green" />
                  <p className="text-sm text-muted-foreground">Ya reclamaste hoy. Vuelve mañana.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Section */}
      {hachi.level < MAX_LEVEL && nextLevelConfig && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Mejorar Nivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{hachi.level}</p>
                <p className="text-xs text-muted-foreground">Nivel actual</p>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">{hachi.level + 1}</p>
                <p className="text-xs text-muted-foreground">Siguiente</p>
              </div>
            </div>

            <div className="space-y-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Produccion diaria</span>
                <span>
                  {formatNumber(dailyProduction)} <ArrowRight className="inline w-3 h-3" /> <span className="text-hachi-green font-bold">{formatNumber(nextLevelConfig.totalDailyProduction)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bonus adicional</span>
                <span className="text-hachi-green font-bold">+{nextLevelConfig.dailyBonus} KOBAN/dia</span>
              </div>
            </div>

            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowUpgradeModal(true)}
            >
              <span className="flex items-center gap-2">
                Mejorar por {upgradeCost} WLD
              </span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && nextLevelConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-accent/50">
            <CardHeader>
              <CardTitle className="text-center">Confirmar Mejora</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Nivel {hachi.level} <ArrowRight className="inline w-4 h-4" /> Nivel {hachi.level + 1}
                </p>
                <p className="text-2xl font-bold text-accent">
                  +{nextLevelConfig.dailyBonus} KOBAN/dia
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Costo de mejora</p>
                <p className="text-xl font-bold">{upgradeCost} WLD</p>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                (Mockup - En producción se conectará con World ID para el pago)
              </p>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 bg-accent hover:bg-accent/90"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                >
                  {upgrading ? 'Mejorando...' : 'Confirmar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
