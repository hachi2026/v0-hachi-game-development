'use client'

import { useState, useEffect } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Sparkles,
  Timer
} from 'lucide-react'
import { 
  formatNumber, 
  STAKING_CONFIG, 
  HACHI_LOCK_CONFIG,
  calculateAPY, 
  calculateHachiLockAPY,
  getStakingPoints 
} from '@/lib/game-config'
import type { Staking } from '@/lib/types'

interface HachiLock {
  id: string
  user_id: string
  hachi_locked: number
  locked_at: string
  last_claim_at: string | null
  is_active: boolean
  total_claimed: number
}

export function StakingTab() {
  const { user, refreshUser, updateBalance, updateRankingPoints } = useHachi()
  const [stakes, setStakes] = useState<Staking[]>([])
  const [hachiLocks, setHachiLocks] = useState<HachiLock[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('koban')
  
  // KOBAN staking state
  const [stakeAmount, setStakeAmount] = useState('')
  const [staking, setStaking] = useState(false)
  const [unstaking, setUnstaking] = useState<string | null>(null)
  
  // HACHI lock state
  const [lockAmount, setLockAmount] = useState('')
  const [locking, setLocking] = useState(false)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)

  const supabase = createClient()

  // Calculate user's KOBAN APY
  const catLevel = user?.hachi?.level || 1
  const hasMembership = user?.profile?.has_membership || false
  const kobanAPY = calculateAPY(catLevel, hasMembership)
  const kobanApyPercent = (kobanAPY * 100).toFixed(1)
  
  // Calculate user's HACHI Lock APY
  const hachiLockAPY = calculateHachiLockAPY(catLevel, hasMembership)
  const hachiApyPercent = (hachiLockAPY * 100).toFixed(1)

  useEffect(() => {
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    if (!user) return
    setLoading(true)
    
    try {
      // Fetch KOBAN stakes
      const { data: stakesData } = await supabase
        .from('staking')
        .select('*')
        .eq('user_id', user.profile.id)
        .order('locked_at', { ascending: false })
      
      if (stakesData) setStakes(stakesData as Staking[])
      
      // Fetch HACHI locks
      const { data: locksData } = await supabase
        .from('hachi_locks')
        .select('*')
        .eq('user_id', user.profile.id)
        .order('locked_at', { ascending: false })
      
      if (locksData) setHachiLocks(locksData as HachiLock[])
    } catch (error) {
      console.error('Error fetching:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check if 24h cooldown passed
  const canClaim = (lastClaimAt: string | null, lockedAt: string): boolean => {
    const referenceTime = lastClaimAt ? new Date(lastClaimAt) : new Date(lockedAt)
    const now = new Date()
    const hoursPassed = (now.getTime() - referenceTime.getTime()) / (1000 * 60 * 60)
    return hoursPassed >= 24
  }

  const getTimeUntilClaim = (lastClaimAt: string | null, lockedAt: string): string => {
    const referenceTime = lastClaimAt ? new Date(lastClaimAt) : new Date(lockedAt)
    const nextClaim = new Date(referenceTime.getTime() + 24 * 60 * 60 * 1000)
    const now = new Date()
    const diff = nextClaim.getTime() - now.getTime()
    
    if (diff <= 0) return 'Disponible'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  // KOBAN Staking handlers
  const handleStake = async () => {
    if (!user || staking) return
    
    const amount = parseInt(stakeAmount)
    if (isNaN(amount) || amount < STAKING_CONFIG.minLock) {
      alert(`Minimo ${formatNumber(STAKING_CONFIG.minLock)} KOBAN`)
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
      setStakeAmount('')
      fetchAll()
      refreshUser()
    } catch (error) {
      console.error('Error staking:', error)
    } finally {
      setStaking(false)
    }
  }

  const handleUnstake = async (stake: Staking) => {
    if (!user || unstaking) return
    
    // Check 24h cooldown
    if (!canClaim(stake.last_claim_at || null, stake.locked_at)) {
      alert('Debes esperar 24 horas entre retiros')
      return
    }
    
    const lockedAt = new Date(stake.locked_at)
    const now = new Date()
    const daysLocked = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24))
    
    const proportionalAPY = (daysLocked / 365) * kobanAPY
    const reward = Math.floor(stake.koban_locked * (1 + proportionalAPY))
    
    // Ranking points only after 24h staked
    const rankingPoints = daysLocked >= 1 ? getStakingPoints(stake.koban_locked) : 0

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
      if (rankingPoints > 0) updateRankingPoints(rankingPoints)
      fetchAll()
      refreshUser()
    } catch (error) {
      console.error('Error unstaking:', error)
    } finally {
      setUnstaking(null)
    }
  }

  // HACHI Lock handlers
  const handleLock = async () => {
    if (!user || locking) return
    
    const amount = parseInt(lockAmount)
    if (isNaN(amount) || amount < HACHI_LOCK_CONFIG.minLock) {
      alert(`Minimo ${formatNumber(HACHI_LOCK_CONFIG.minLock)} HACHI`)
      return
    }
    
    if (amount > (user.profile.hachi_balance || 0)) {
      alert('No tienes suficiente HACHI')
      return
    }

    setLocking(true)
    
    try {
      await supabase.from('hachi_locks').insert({
        user_id: user.profile.id,
        hachi_locked: amount
      })
      
      await supabase
        .from('profiles')
        .update({ hachi_balance: (user.profile.hachi_balance || 0) - amount })
        .eq('id', user.profile.id)
      
      updateBalance(-amount)
      setLockAmount('')
      fetchAll()
      refreshUser()
    } catch (error) {
      console.error('Error locking:', error)
    } finally {
      setLocking(false)
    }
  }

  const handleClaimHachi = async (lock: HachiLock) => {
    if (!user || claiming) return
    
    if (!canClaim(lock.last_claim_at, lock.locked_at)) {
      alert('Debes esperar 24 horas entre reclamos')
      return
    }
    
    // Calculate daily reward
    const dailyReward = Math.floor(lock.hachi_locked * (hachiLockAPY / 365))

    setClaiming(lock.id)
    
    try {
      await supabase
        .from('hachi_locks')
        .update({
          last_claim_at: new Date().toISOString(),
          total_claimed: (lock.total_claimed || 0) + dailyReward
        })
        .eq('id', lock.id)
      
      await supabase
        .from('profiles')
        .update({ hachi_balance: (user.profile.hachi_balance || 0) + dailyReward })
        .eq('id', user.profile.id)
      
      updateBalance(dailyReward)
      fetchAll()
      refreshUser()
    } catch (error) {
      console.error('Error claiming:', error)
    } finally {
      setClaiming(null)
    }
  }

  const handleUnlock = async (lock: HachiLock) => {
    if (!user || unlocking) return
    
    if (!canClaim(lock.last_claim_at, lock.locked_at)) {
      alert('Debes esperar 24 horas entre retiros')
      return
    }
    
    const lockedAt = new Date(lock.locked_at)
    const now = new Date()
    const daysLocked = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24))
    
    // Ranking points only after 24h
    const rankingPoints = daysLocked >= 1 ? getStakingPoints(lock.hachi_locked) : 0

    setUnlocking(lock.id)
    
    try {
      await supabase
        .from('hachi_locks')
        .update({ is_active: false })
        .eq('id', lock.id)
      
      await supabase
        .from('profiles')
        .update({ hachi_balance: (user.profile.hachi_balance || 0) + lock.hachi_locked })
        .eq('id', user.profile.id)
      
      updateBalance(lock.hachi_locked)
      if (rankingPoints > 0) updateRankingPoints(rankingPoints)
      fetchAll()
      refreshUser()
    } catch (error) {
      console.error('Error unlocking:', error)
    } finally {
      setUnlocking(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const activeKobanStakes = stakes.filter(s => s.is_active)
  const totalKobanLocked = activeKobanStakes.reduce((sum, s) => sum + (s.koban_locked || 0), 0)
  
  const activeHachiLocks = hachiLocks.filter(l => l.is_active)
  const totalHachiLocked = activeHachiLocks.reduce((sum, l) => sum + (l.hachi_locked || 0), 0)

  return (
    <div className="space-y-4 pb-24">
      {/* Tabs for KOBAN/HACHI */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="koban" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <CircleDollarSign className="w-4 h-4 mr-1" />
            KOBAN ({kobanApyPercent}%)
          </TabsTrigger>
          <TabsTrigger value="hachi" className="data-[state=active]:bg-hachi-green data-[state=active]:text-white">
            <Coins className="w-4 h-4 mr-1" />
            HACHI ({hachiApyPercent}%)
          </TabsTrigger>
        </TabsList>

        {/* KOBAN Staking Tab */}
        <TabsContent value="koban" className="space-y-4 mt-4">
          {/* Active Stakes First */}
          {activeKobanStakes.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    Stakes Activos
                  </span>
                  <Badge variant="outline" className="text-amber-500">
                    {formatNumber(totalKobanLocked)} KOBAN
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeKobanStakes.map((stake) => {
                  const lockedAt = new Date(stake.locked_at)
                  const now = new Date()
                  const daysLocked = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24))
                  const proportionalAPY = (daysLocked / 365) * kobanAPY
                  const currentReward = Math.floor((stake.koban_locked || 0) * proportionalAPY)
                  const canWithdraw = canClaim(stake.last_claim_at || null, stake.locked_at)
                  
                  return (
                    <div key={stake.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{formatNumber(stake.koban_locked || 0)}</span>
                          <span className="text-xs text-muted-foreground">KOBAN</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{daysLocked}d</Badge>
                          <span className="text-hachi-green text-sm font-bold">+{formatNumber(currentReward)}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={unstaking === stake.id || !canWithdraw}
                          onClick={() => handleUnstake(stake)}
                        >
                          {unstaking === stake.id ? '...' : !canWithdraw ? (
                            <><Timer className="w-3 h-3 mr-1" />{getTimeUntilClaim(stake.last_claim_at || null, stake.locked_at)}</>
                          ) : (
                            <><Unlock className="w-3 h-3 mr-1" />Retirar {formatNumber((stake.koban_locked || 0) + currentReward)}</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Stake Form */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-500" />
                Hacer Stake KOBAN
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                <span>Balance</span>
                <span className="font-bold">{formatNumber(user?.profile.hachi_koban_balance || 0)} KOBAN</span>
              </div>

              <Input
                type="number"
                placeholder={`Min. ${STAKING_CONFIG.minLock}`}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
              
              <div className="flex gap-2">
                {[25, 50, 75, 100].map(p => (
                  <Button key={p} variant="outline" size="sm" className="flex-1"
                    onClick={() => setStakeAmount(String(Math.floor((user?.profile.hachi_koban_balance || 0) * (p / 100))))}>
                    {p}%
                  </Button>
                ))}
              </div>

              <Button 
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600" 
                disabled={staking || !stakeAmount || parseInt(stakeAmount) < STAKING_CONFIG.minLock}
                onClick={handleStake}
              >
                {staking ? '...' : <><Lock className="w-4 h-4 mr-2" />Bloquear KOBAN</>}
              </Button>
            </CardContent>
          </Card>

          {/* APY Info - Moved to bottom */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">APY KOBAN: {kobanApyPercent}%</span>
                {hasMembership && <Badge className="bg-amber-500 text-xs">+20% Member</Badge>}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Base: 60% anual | Nivel 11+: +2% por nivel</li>
                <li>Max: 80% (100% con membresia)</li>
                <li>Retiros/claims cada 24 horas</li>
                <li>Puntos ranking solo despues de 24h stakeado</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HACHI Lock Tab */}
        <TabsContent value="hachi" className="space-y-4 mt-4">
          {/* Active Locks First */}
          {activeHachiLocks.length > 0 && (
            <Card className="border-hachi-green/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-hachi-green" />
                    HACHI Bloqueado
                  </span>
                  <Badge variant="outline" className="text-hachi-green">
                    {formatNumber(totalHachiLocked)} HACHI
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeHachiLocks.map((lock) => {
                  const lockedAt = new Date(lock.locked_at)
                  const now = new Date()
                  const daysLocked = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24))
                  const dailyReward = Math.floor(lock.hachi_locked * (hachiLockAPY / 365))
                  const canClaimNow = canClaim(lock.last_claim_at, lock.locked_at)
                  
                  return (
                    <div key={lock.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{formatNumber(lock.hachi_locked)}</span>
                          <span className="text-xs text-muted-foreground">HACHI</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{daysLocked}d</Badge>
                          <span className="text-hachi-green text-sm font-bold">+{formatNumber(lock.total_claimed || 0)}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 bg-hachi-green hover:bg-hachi-green/90"
                          disabled={claiming === lock.id || !canClaimNow}
                          onClick={() => handleClaimHachi(lock)}
                        >
                          {claiming === lock.id ? '...' : !canClaimNow ? (
                            <><Timer className="w-3 h-3 mr-1" />{getTimeUntilClaim(lock.last_claim_at, lock.locked_at)}</>
                          ) : (
                            <><Gift className="w-3 h-3 mr-1" />Reclamar +{formatNumber(dailyReward)}</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unlocking === lock.id || !canClaimNow}
                          onClick={() => handleUnlock(lock)}
                        >
                          {unlocking === lock.id ? '...' : <Unlock className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Lock Form */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-hachi-green" />
                Bloquear HACHI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                <span>Balance</span>
                <span className="font-bold">{formatNumber(user?.profile.hachi_balance || 0)} HACHI</span>
              </div>

              <Input
                type="number"
                placeholder={`Min. ${HACHI_LOCK_CONFIG.minLock}`}
                value={lockAmount}
                onChange={(e) => setLockAmount(e.target.value)}
              />
              
              <div className="flex gap-2">
                {[25, 50, 75, 100].map(p => (
                  <Button key={p} variant="outline" size="sm" className="flex-1"
                    onClick={() => setLockAmount(String(Math.floor((user?.profile.hachi_balance || 0) * (p / 100))))}>
                    {p}%
                  </Button>
                ))}
              </div>

              <Button 
                className="w-full bg-gradient-to-r from-hachi-green to-green-600" 
                disabled={locking || !lockAmount || parseInt(lockAmount) < HACHI_LOCK_CONFIG.minLock}
                onClick={handleLock}
              >
                {locking ? '...' : <><Lock className="w-4 h-4 mr-2" />Bloquear HACHI</>}
              </Button>
            </CardContent>
          </Card>

          {/* APY Info - Moved to bottom */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">APY HACHI: {hachiApyPercent}%</span>
                {hasMembership && <Badge className="bg-hachi-green text-xs">Modo Member</Badge>}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Base: 5% anual</li>
                {hasMembership ? (
                  <li>Con membresia: +7% por cada nivel (max 70%)</li>
                ) : (
                  <li>Sin membresia: +5% cada 2 niveles (max 50%)</li>
                )}
                <li>Tu nivel: {catLevel} = {hachiApyPercent}% APY</li>
                <li>Reclama cada 24 horas</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Membership Banner */}
      {!hasMembership && (
        <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-purple-400" />
              <div className="flex-1">
                <p className="font-bold text-sm">Membresia Premium</p>
                <p className="text-xs text-muted-foreground">
                  KOBAN: +20% APY (max 100%) | HACHI: +7%/nivel (max 70%)
                </p>
              </div>
              <Badge className="bg-purple-500">10 WLD</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
