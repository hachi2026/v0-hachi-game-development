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
  Info
} from 'lucide-react'
import { formatNumber, STAKING_CONFIG, calculateAPY, RANKING_POINTS } from '@/lib/game-config'
import type { Staking } from '@/lib/types'

export function StakingTab() {
  const { user, currentSeason, refreshUser, updateBalance, updateRankingPoints } = useHachi()
  const [stakes, setStakes] = useState<Staking[]>([])
  const [loading, setLoading] = useState(true)
  const [stakeAmount, setStakeAmount] = useState('')
  const [staking, setStaking] = useState(false)
  const [unstaking, setUnstaking] = useState<string | null>(null)

  const supabase = createClient()

  // Calculate user's APY based on cat level
  const catLevel = user?.hachi?.level || 1
  const userAPY = calculateAPY(catLevel)
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
    if (!user || !currentSeason || staking) return
    
    const amount = parseInt(stakeAmount)
    if (isNaN(amount) || amount < STAKING_CONFIG.minLock) {
      alert(`Minimo ${formatNumber(STAKING_CONFIG.minLock)} HACHI para hacer stake`)
      return
    }
    
    if (amount > user.profile.hachi_balance) {
      alert('No tienes suficiente HACHI')
      return
    }

    setStaking(true)
    
    try {
      await supabase.from('staking').insert({
        user_id: user.profile.id,
        season_id: currentSeason.id,
        hachi_locked: amount
      })
      
      await supabase
        .from('profiles')
        .update({ hachi_balance: user.profile.hachi_balance - amount })
        .eq('id', user.profile.id)
      
      updateBalance(-amount)
      
      // Add ranking points for staking (per 1000 HACHI)
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
    
    // For annual staking, calculate based on time locked
    const lockedAt = new Date(stake.locked_at)
    const now = new Date()
    const daysLocked = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24))
    
    // Calculate proportional reward based on days locked (annual APY)
    const proportionalAPY = (daysLocked / 365) * userAPY
    const reward = Math.floor(stake.hachi_locked * (1 + proportionalAPY))

    setUnstaking(stake.id)
    
    try {
      await supabase
        .from('staking')
        .update({
          is_active: false,
          unlocked_at: new Date().toISOString(),
          reward_claimed: reward - stake.hachi_locked
        })
        .eq('id', stake.id)
      
      await supabase
        .from('profiles')
        .update({ hachi_balance: user.profile.hachi_balance + reward })
        .eq('id', user.profile.id)
      
      updateBalance(reward)
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
  const totalLocked = activeStakes.reduce((sum, s) => sum + s.hachi_locked, 0)
  
  // Calculate estimated annual reward
  const estimatedAnnualReward = Math.floor(totalLocked * userAPY)

  return (
    <div className="space-y-6 pb-24">
      {/* APY Info Card */}
      <Card className="bg-gradient-to-br from-hachi-green/20 to-hachi-green/5 border-hachi-green/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Tu APY Actual</h2>
              <p className="text-3xl font-bold text-hachi-green">{apyPercent}%</p>
              <p className="text-sm text-muted-foreground">Anual</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cat className="w-5 h-5" />
                <span>Nivel {catLevel}</span>
              </div>
            </div>
          </div>

          {/* APY explanation */}
          <div className="p-3 bg-background/50 rounded-lg text-sm space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="w-4 h-4" />
              <span>Como funciona el APY:</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6">
              <li>Base: {(STAKING_CONFIG.baseAPY * 100)}% APY anual</li>
              <li>Gato nivel 11+: +1.5% por cada nivel</li>
              <li>Maximo: {(STAKING_CONFIG.maxAPY * 100)}% APY anual</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Staking Overview */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Staking HACHI</h2>
              <p className="text-sm text-muted-foreground">
                Bloquea tus HACHI y gana recompensas anuales
              </p>
            </div>
            <Lock className="w-10 h-10 text-primary/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Bloqueado</p>
              <p className="text-lg font-bold text-primary">
                {formatNumber(totalLocked)}
              </p>
              <p className="text-xs text-muted-foreground">HACHI</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Ganancia Anual Est.</p>
              <p className="text-lg font-bold text-hachi-green">
                +{formatNumber(estimatedAnnualReward)}
              </p>
              <p className="text-xs text-muted-foreground">HACHI</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stake Form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Hacer Stake
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm">Tu Balance</span>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-primary" />
              <span className="font-bold">{formatNumber(user?.profile.hachi_balance || 0)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              type="number"
              placeholder={`Min. ${formatNumber(STAKING_CONFIG.minLock)} HACHI`}
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
                  onClick={() => setStakeAmount(String(Math.floor((user?.profile.hachi_balance || 0) * (percent / 100))))}
                >
                  {percent}%
                </Button>
              ))}
            </div>
          </div>

          {/* Preview reward */}
          {stakeAmount && parseInt(stakeAmount) >= STAKING_CONFIG.minLock && (
            <div className="p-3 bg-hachi-green/10 rounded-lg border border-hachi-green/20">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-hachi-green" />
                <span className="text-sm font-medium text-hachi-green">Ganancia Estimada</span>
              </div>
              <p className="text-lg font-bold text-hachi-green">
                +{formatNumber(Math.floor(parseInt(stakeAmount) * userAPY))} HACHI/año
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Con tu APY de {apyPercent}% (Nivel {catLevel})
              </p>
            </div>
          )}

          <Button 
            className="w-full" 
            disabled={staking || !stakeAmount || parseInt(stakeAmount) < STAKING_CONFIG.minLock}
            onClick={handleStake}
          >
            {staking ? 'Procesando...' : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Bloquear HACHI
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            +{RANKING_POINTS.stakingDeposit} puntos de ranking por cada 1,000 HACHI
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
              const currentReward = Math.floor(stake.hachi_locked * proportionalAPY)
              const annualReward = Math.floor(stake.hachi_locked * userAPY)
              
              return (
                <div 
                  key={stake.id}
                  className="p-4 bg-muted/30 rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <span className="font-bold">{formatNumber(stake.hachi_locked)}</span>
                      <span className="text-sm text-muted-foreground">HACHI</span>
                    </div>
                    <Badge variant="outline">{daysLocked} dias</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Ganancia actual</p>
                      <p className="font-bold text-hachi-green">+{formatNumber(currentReward)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ganancia anual</p>
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
                        Retirar ({formatNumber(stake.hachi_locked + currentReward)} HACHI)
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
                  Nivel 11+ aumenta tu APY. Nivel 20 = {(STAKING_CONFIG.maxAPY * 100)}% APY maximo
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
                  <span className="text-sm">{formatNumber(stake.hachi_locked)} HACHI</span>
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
