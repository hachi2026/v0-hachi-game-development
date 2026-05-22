'use client'

import { useState, useEffect } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Users, 
  Copy, 
  Check,
  Coins,
  Trophy,
  TrendingUp,
  Star,
  Gift
} from 'lucide-react'
import { formatNumber, REFERRAL_RANKS, RANKING_POINTS } from '@/lib/game-config'

export function ReferidosTab() {
  const { user, refreshUser, updateBalance, updateRankingPoints } = useHachi()
  const [referrals, setReferrals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchReferrals()
  }, [user])

  const fetchReferrals = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      
      const { data } = await supabase
        .from('profiles')
        .select('id, username, created_at')
        .eq('referred_by', user.profile.referral_code)
        .order('created_at', { ascending: false })
      
      if (data) setReferrals(data)
    } catch (error) {
      console.error('Error fetching referrals:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyReferralCode = () => {
    if (!user) return
    
    const referralLink = `${window.location.origin}?ref=${user.profile.referral_code}`
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getCurrentRank = () => {
    const totalReferrals = user?.profile.total_referrals || 0
    let currentRank = REFERRAL_RANKS[0]
    
    for (const rank of REFERRAL_RANKS) {
      if (totalReferrals >= rank.referrals_needed) {
        currentRank = rank
      }
    }
    
    return currentRank
  }

  const getNextRank = () => {
    const totalReferrals = user?.profile.total_referrals || 0
    
    for (const rank of REFERRAL_RANKS) {
      if (totalReferrals < rank.referrals_needed) {
        return rank
      }
    }
    
    return null // Max rank reached
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const totalReferrals = user?.profile.total_referrals || 0
  const currentRank = getCurrentRank()
  const nextRank = getNextRank()
  const referralsToNext = nextRank ? nextRank.referrals_needed - totalReferrals : 0
  const totalEarned = totalReferrals * 1000 + (currentRank.bonus_hachi || 0)

  return (
    <div className="space-y-6 pb-24">
      {/* Referral Summary */}
      <Card className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Programa de Referidos</h2>
              <p className="text-sm text-muted-foreground">
                Gana 1,000 HACHI por cada amigo
              </p>
            </div>
            <Users className="w-10 h-10 text-pink-500/50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Referidos</p>
              <p className="text-2xl font-bold text-pink-500">{totalReferrals}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">HACHI Ganado</p>
              <p className="text-2xl font-bold text-hachi-green">{formatNumber(totalEarned)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Rank */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tu Rango</p>
                <p className="font-bold text-lg">{currentRank.name}</p>
              </div>
            </div>
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
              Rango {currentRank.rank}
            </Badge>
          </div>

          {nextRank && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Siguiente: {nextRank.name}</span>
                <span>{totalReferrals} / {nextRank.referrals_needed}</span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full">
                <div 
                  className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full"
                  style={{ width: `${(totalReferrals / nextRank.referrals_needed) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {referralsToNext} referidos mas para bonus de {formatNumber(nextRank.bonus_hachi)} HACHI
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-3 p-2 bg-background/50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 font-bold">1</div>
            <div>
              <p className="font-medium">Comparte tu codigo</p>
              <p className="text-xs text-muted-foreground">Envia tu link a amigos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-background/50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 font-bold">2</div>
            <div>
              <p className="font-medium">Tu amigo se registra</p>
              <p className="text-xs text-muted-foreground">Usando tu codigo de referido</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-background/50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-hachi-green/20 flex items-center justify-center text-hachi-green font-bold">3</div>
            <div>
              <p className="font-medium">Ambos ganan 1,000 HACHI!</p>
              <p className="text-xs text-muted-foreground">Tu y tu amigo reciben recompensa</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share Code */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tu Codigo de Referido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={user?.profile.referral_code || ''} 
              readOnly 
              className="font-mono text-center text-lg"
            />
            <Button onClick={copyReferralCode}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          <Button 
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90"
            onClick={copyReferralCode}
          >
            {copied ? 'Link Copiado!' : 'Copiar Link de Referido'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            +{RANKING_POINTS.referral} puntos de ranking por cada referido
          </p>
        </CardContent>
      </Card>

      {/* Rank Rewards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Bonos por Rango
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {REFERRAL_RANKS.map((rank) => {
            const isCurrentRank = rank.rank === currentRank.rank
            const isAchieved = totalReferrals >= rank.referrals_needed
            
            return (
              <div 
                key={rank.rank}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isCurrentRank ? 'bg-amber-500/20 border border-amber-500/30' : 
                  isAchieved ? 'bg-hachi-green/10' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    isAchieved ? 'bg-hachi-green/20 text-hachi-green' : 'bg-muted text-muted-foreground'
                  }`}>
                    {rank.rank}
                  </div>
                  <div>
                    <p className="font-medium">{rank.name}</p>
                    <p className="text-xs text-muted-foreground">{rank.referrals_needed} referidos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isAchieved ? 'text-hachi-green' : 'text-muted-foreground'}`}>
                    +{formatNumber(rank.bonus_hachi)}
                  </p>
                  <p className="text-xs text-muted-foreground">HACHI</p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Referral List */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tus Referidos ({referrals.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {referrals.map((ref, index) => (
              <div 
                key={ref.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{ref.username || 'Usuario'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-hachi-green">
                  +1,000 HACHI
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
