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
  Wallet
} from 'lucide-react'
import { formatNumber, STAKING_CONFIG } from '@/lib/game-config'
import type { Staking } from '@/lib/types'

export function StakingTab() {
  const { user, currentSeason, refreshUser, updateBalance } = useHachi()
  const [stakes, setStakes] = useState<Staking[]>([])
  const [loading, setLoading] = useState(true)
  const [stakeAmount, setStakeAmount] = useState('')
  const [staking, setStaking] = useState(false)
  const [unstaking, setUnstaking] = useState<string | null>(null)

  const supabase = createClient()

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
      // Create stake record
      await supabase.from('staking').insert({
        user_id: user.profile.id,
        season_id: currentSeason.id,
        hachi_locked: amount
      })
      
      // Deduct from balance
      await supabase
        .from('profiles')
        .update({ hachi_balance: user.profile.hachi_balance - amount })
        .eq('id', user.profile.id)
      
      updateBalance(-amount)
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
    
    // Check if season has ended
    const seasonEnded = currentSeason && new Date(currentSeason.ends_at) < new Date()
    
    if (!seasonEnded) {
      alert('Solo puedes retirar al finalizar la temporada')
      return
    }

    setUnstaking(stake.id)
    
    try {
      // Calculate reward (50% bonus for full season)
      const reward = Math.floor(stake.hachi_locked * STAKING_CONFIG.rewardMultiplier)
      
      // Update stake as unlocked
      await supabase
        .from('staking')
        .update({
          is_active: false,
          unlocked_at: new Date().toISOString(),
          reward_claimed: reward - stake.hachi_locked
        })
        .eq('id', stake.id)
      
      // Add to balance (original + reward)
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
  const estimatedReward = Math.floor(totalLocked * (STAKING_CONFIG.rewardMultiplier - 1))

  const seasonEndsIn = currentSeason 
    ? Math.max(0, Math.ceil((new Date(currentSeason.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0
  
  const seasonProgress = currentSeason
    ? Math.min(100, ((STAKING_CONFIG.seasonDuration - seasonEndsIn) / STAKING_CONFIG.seasonDuration) * 100)
    : 0

  return (
    <div className="space-y-6 pb-24">
      {/* Staking Overview */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Staking HACHI</h2>
              <p className="text-sm text-muted-foreground">
                Bloquea tus HACHI y gana recompensas
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
              <p className="text-xs text-muted-foreground">Recompensa Estimada</p>
              <p className="text-lg font-bold text-hachi-green">
                +{formatNumber(estimatedReward)}
              </p>
              <p className="text-xs text-muted-foreground">HACHI</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Season Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Progreso de Temporada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{currentSeason?.name || 'Temporada Actual'}</span>
              <span>{seasonEndsIn} dias restantes</span>
            </div>
            <Progress value={seasonProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Las recompensas se distribuyen al finalizar la temporada
            </p>
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

          <div className="p-3 bg-hachi-green/10 rounded-lg border border-hachi-green/20">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-hachi-green" />
              <span className="text-sm font-medium text-hachi-green">Bonus de Temporada</span>
            </div>
            <p className="text-xs text-muted-foreground">
              +{((STAKING_CONFIG.rewardMultiplier - 1) * 100).toFixed(0)}% de recompensa al mantener el stake durante toda la temporada
            </p>
          </div>

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
              const reward = Math.floor(stake.hachi_locked * (STAKING_CONFIG.rewardMultiplier - 1))
              const canUnstake = currentSeason && new Date(currentSeason.ends_at) < new Date()
              
              return (
                <div 
                  key={stake.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <span className="font-bold">{formatNumber(stake.hachi_locked)}</span>
                      <span className="text-sm text-muted-foreground">HACHI</span>
                    </div>
                    <p className="text-xs text-hachi-green mt-1">
                      +{formatNumber(reward)} recompensa estimada
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canUnstake || unstaking === stake.id}
                    onClick={() => handleUnstake(stake)}
                  >
                    {unstaking === stake.id ? '...' : (
                      <>
                        <Unlock className="w-4 h-4 mr-1" />
                        {canUnstake ? 'Retirar' : 'Bloqueado'}
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
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
                  <Badge variant="outline" className="ml-2 text-xs">
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
