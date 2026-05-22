'use client'

import { useState, useEffect } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Lock, 
  Unlock,
  Coins,
  TrendingUp,
  Clock,
  Gift,
  Wallet,
  Cat,
  Info,
  Crown,
  CircleDollarSign,
  Sparkles
} from 'lucide-react'
import { formatNumber, STAKING_CONFIG, calculateAPY, RANKING_POINTS } from '@/lib/game-config'
import type { Staking } from '@/lib/types'

export function StakingTab() {
  const { user, refreshUser, updateBalance, updateRankingPoints } = useHachi()
  const [stakes, setStakes] = useState<Staking[]>([])
  const [loading, setLoading] = useState(true)
  const [stakeAmount, setStakeAmount] = useState('')
  const [staking, setStaking] = useState(false)
  const [unstaking, setUnstaking] = useState<string | null>(null)

  const supabase = createClient()

  // Calculate user's APY based on cat level and membership
  const catLevel = user?.hachi?.level || 1
  const hasMembership = user?.profile?.has_membership || false
  const baseAPY = calculateAPY(catLevel)
  const membershipBonus = hasMembership ? STAKING_CONFIG.membershipAPYBonus : 0
  const userAPY = Math.min(baseAPY + membershipBonus, STAKING_CONFIG.maxAPYWithMembership)
  const apyPercent = (userAPY * 100).toFixed(1)

  useEffect(() => {
    fetchStakes()
  }, [user])

  const fetchStakes = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      
      const { data } = await supabase
        .from('staking')
        .select('*')
        .eq('user_id', user.profile.id)
        .order('locked_at', { ascending: false })
      
      if (data) setStakes(data as Staking[])
    } catch (error) {
      console.error('Error fetching stakes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStake = async () => {
    if (!user || staking) return
    
    const amount = parseInt(stakeAmount)
    if (isNaN(amount) || amount < STAKING_CONFIG.minLock) {
      alert(`Minimo ${formatNumber(STAKING_CONFIG.minLock)} KOBAN para hacer stake`)
      return
    }
    
    if (amount > (user.profile.hachi_koban_balance || 0)) {
      alert('No tienes suficiente KOBAN')
      return
    }

    setStaking(true)
    
    try {
      await supabase.from('staking').insert({
        user_id: user.profile.id,
        koban_locked: amount
      })
      
      await supabase
        .from('profiles')
        .update({ hachi_koban_balance: (user.profile.hachi_koban_balance || 0) - amount })
        .eq('id', user.profile.id)
      
      updateBalance(-amount, 'koban')
      
      // Add ranking points for staking (per 1000 KOBAN)
      const stakingPoints = Math.floor(amount / 1000) * RANKING_POINTS.stakingDeposit
      updateRankingPoints(stakingPoints)
      
      setStakeAmount('')
      fetchStakes()
      refreshUser()
    } catch (error) {
      console.error('Error staking:', error)
    } finally {
      setStaking(false)
    }
  }

  const handleUnstake = async (stake: Staking) => {
    if (!user || unstaking) return
    
    const lockedAt = new Date(stake.locked_at)
    const now = new Date()
    const daysLocked = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24))
    
    // Calculate proportional reward based on days locked (annual APY)
    const proportionalAPY = (daysLocked / 365) * userAPY
    const reward = Math.floor(stake.koban_locked * (1 + proportionalAPY))

    setUnstaking(stake.id)
    
    try {
      await supabase
        .from('staking')
        .update({
          is_active: false,
          unlocked_at: new Date().toISOString(),
          reward_claimed: reward - stake.koban_locked
        })
        .eq('id', stake.id)
      
      await supabase
        .from('profiles')
        .update({ hachi_koban_balance: (user.profile.hachi_koban_balance || 0) + reward })
        .eq('id', user.profile.id)
      
      updateBalance(reward, 'koban')
      fetchStakes()
      refreshUser()
    } catch (error) {
      console.error('Error unstaking:', error)
    } finally {
      setUnstaking(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const activeStakes = stakes.filter(s => s.is_active)
  const totalLocked = activeStakes.reduce((sum, s) => sum + (s.koban_locked || 0), 0)
  
  // Calculate estimated annual reward
  const estimatedSeasonReward = Math.floor(totalLocked * userAPY)

  return (
    <div className="space-y-6 pb-24">
      {/* APY Info Card */}
      <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 border-amber-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Tu APY Actual</h2>
              <p className="text-3xl font-bold text-amber-500">{apyPercent}%</p>
              <p className="text-sm text-muted-foreground">Anual (proporcional al tiempo)</p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cat className="w-5 h-5" />
                <span>Nivel {catLevel}</span>
              </div>
              {hasMembership && (
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
                  <Crown className="w-3 h-3 mr-1" />
                  MEMBER
                </Badge>
              )}
            </div>
          </div>

          {/* APY explanation */}
          <div className="p-3 bg-background/50 rounded-lg text-sm space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="w-4 h-4" />
              <span>Como funciona el APY:</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6">
              <li>Base: {(STAKING_CONFIG.baseAPY * 100)}% anual</li>
              <li>Gato nivel 11+: +2% por cada nivel</li>
              <li>Sin membresia: max {(STAKING_CONFIG.maxAPY * 100)}%</li>
              <li className="text-amber-500 font-medium">Con membresia: +20% bonus, max {(STAKING_CONFIG.maxAPYWithMembership * 100)}%</li>
              <li>Retira cuando quieras (ganancia proporcional)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Membership Banner */}
      {!hasMembership && (
        <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Crown className="w-8 h-8 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">Hazte Miembro</h3>
                <p className="text-sm text-muted-foreground">
                  +20% APY extra (hasta 100%), 10% descuento mejoras
                </p>
                <p className="text-xs text-purple-400 mt-1">
                  10 WLD - Recupera 60% en HACHI en 90 dias
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staking Overview */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Staking KOBAN</h2>
              <p className="text-sm text-muted-foreground">
                Bloquea KOBAN y gana recompensas (retira cuando quieras)
              </p>
            </div>
            <Lock className="w-10 h-10 text-amber-500/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Bloqueado</p>
              <p className="text-lg font-bold text-amber-500">
                {formatNumber(totalLocked)}
              </p>
              <p className="text-xs text-muted-foreground">KOBAN</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Ganancia Anual Est.</p>
              <p className="text-lg font-bold text-hachi-green">
                +{formatNumber(estimatedSeasonReward)}
              </p>
              <p className="text-xs text-muted-foreground">KOBAN</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stake Form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" />
            Hacer Stake
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm">Tu Balance KOBAN</span>
            <div className="flex items-center gap-1">
              <CircleDollarSign className="w-4 h-4 text-amber-500" />
              <span className="font-bold">{formatNumber(user?.profile.hachi_koban_balance || 0)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              type="number"
              placeholder={`Min. ${formatNumber(STAKING_CONFIG.minLock)} KOBAN`}
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {[25, 50, 75, 100].map(percent => (
                <Button
                  key={percent}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setStakeAmount(String(Math.floor((user?.profile.hachi_koban_balance || 0) * (percent / 100))))}
                >
                  {percent}%
                </Button>
              ))}
            </div>
          </div>

          {/* Preview reward */}
          {stakeAmount && parseInt(stakeAmount) >= STAKING_CONFIG.minLock && (
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-500">Ganancia Estimada (1 ano)</span>
              </div>
              <p className="text-lg font-bold text-amber-500">
                +{formatNumber(Math.floor(parseInt(stakeAmount) * userAPY))} KOBAN
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Con tu APY de {apyPercent}% {hasMembership ? '(incluye bonus member)' : ''}. Retira cuando quieras.
              </p>
            </div>
          )}

          <Button 
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90" 
            disabled={staking || !stakeAmount || parseInt(stakeAmount) < STAKING_CONFIG.minLock}
            onClick={handleStake}
          >
            {staking ? 'Procesando...' : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Bloquear KOBAN
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            +{RANKING_POINTS.stakingDeposit} puntos de ranking por cada 1,000 KOBAN
          </p>
        </CardContent>
      </Card>

      {/* Active Stakes */}
      {activeStakes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-hachi-green" />
              Stakes Activos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeStakes.map((stake) => {
              const lockedAt = new Date(stake.locked_at)
              const now = new Date()
              const daysLocked = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24))
              const proportionalAPY = (daysLocked / 365) * userAPY
              const currentReward = Math.floor((stake.koban_locked || 0) * proportionalAPY)
              const annualReward = Math.floor((stake.koban_locked || 0) * userAPY)
              const progressPercent = Math.min((daysLocked / 365) * 100, 100)
              
              return (
                <div 
                  key={stake.id}
                  className="p-4 bg-muted/30 rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span className="font-bold">{formatNumber(stake.koban_locked || 0)}</span>
                      <span className="text-sm text-muted-foreground">KOBAN</span>
                    </div>
                    <Badge variant="outline">{daysLocked} dias</Badge>
                  </div>

                  <Progress value={progressPercent} className="h-2" />
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Ganancia actual</p>
                      <p className="font-bold text-hachi-green">+{formatNumber(currentReward)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ganancia anual est.</p>
                      <p className="font-bold text-amber-500">+{formatNumber(annualReward)}</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={unstaking === stake.id}
                    onClick={() => handleUnstake(stake)}
                  >
                    {unstaking === stake.id ? 'Procesando...' : (
                      <>
                        <Unlock className="w-4 h-4 mr-2" />
                        Retirar ({formatNumber((stake.koban_locked || 0) + currentReward)} KOBAN)
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Upgrade Cat Tip */}
      {catLevel < 20 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Cat className="w-8 h-8 text-amber-500" />
              <div>
                <p className="font-medium">Mejora tu Hachi para mayor APY</p>
                <p className="text-sm text-muted-foreground">
                  Nivel 11+ aumenta tu APY. Nivel 20 = {(STAKING_CONFIG.maxAPY * 100)}% (o {(STAKING_CONFIG.maxAPYWithMembership * 100)}% con membresia)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Stakes */}
      {stakes.filter(s => !s.is_active).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stakes.filter(s => !s.is_active).map((stake) => (
              <div 
                key={stake.id}
                className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
              >
                <div>
                  <span className="text-sm">{formatNumber(stake.koban_locked || 0)} KOBAN</span>
                  <Badge variant="outline" className="ml-2 text-xs text-hachi-green">
                    +{formatNumber(stake.reward_claimed)} ganado
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(stake.unlocked_at || '').toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
