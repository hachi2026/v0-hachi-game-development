'use client'

import { useState, useEffect } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Trophy, 
  Medal, 
  Crown,
  Star,
  TrendingUp,
  Clock,
  Gift,
  Info,
  Coins,
  Cat,
  Package,
  Users,
  Lock,
  Eye,
  CheckCircle
} from 'lucide-react'
import { formatNumber, getRarityColor, RANKING_POINTS } from '@/lib/game-config'
import type { Ranking, Profile } from '@/lib/types'

interface RankingWithProfile extends Ranking {
  profile: Profile
}

export function RankingTab() {
  const { user, currentSeason, userRanking } = useHachi()
  const [rankings, setRankings] = useState<RankingWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [userPosition, setUserPosition] = useState<number | null>(null)
  const [localSeason, setLocalSeason] = useState<any>(currentSeason)

  const supabase = createClient()

  useEffect(() => {
    initializeAndFetch()
  }, [currentSeason])

  const initializeAndFetch = async () => {
    try {
      setLoading(true)
      
      let season = currentSeason
      
      // If no season exists, create one
      if (!season) {
        const { data: existingSeason } = await supabase
          .from('seasons')
          .select('*')
          .eq('is_active', true)
          .single()
        
        if (existingSeason) {
          season = existingSeason
        } else {
          // Create a new season
          const now = new Date()
          const endsAt = new Date(now)
          endsAt.setDate(endsAt.getDate() + 90)
          
          const { data: newSeason } = await supabase
            .from('seasons')
            .insert({
              id: `season_${Date.now()}`,
              name: 'Temporada 1',
              starts_at: now.toISOString(),
              ends_at: endsAt.toISOString(),
              is_active: true,
              total_reward_pool: 1000000
            })
            .select()
            .single()
          
          if (newSeason) {
            season = newSeason
          }
        }
      }
      
      setLocalSeason(season)
      
      if (season) {
        await fetchRankings(season.id)
      }
    } catch (error) {
      console.error('Error initializing season:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRankings = async (seasonId: string) => {
    try {
      const { data } = await supabase
        .from('rankings')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('season_id', seasonId)
        .order('points', { ascending: false })
        .limit(100)
      
      if (data) {
        setRankings(data as RankingWithProfile[])
        
        // Find user position
        if (user) {
          const position = data.findIndex(r => r.user_id === user.profile.id)
          setUserPosition(position >= 0 ? position + 1 : null)
        }
      }
    } catch (error) {
      console.error('Error fetching rankings:', error)
    }
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-5 h-5 text-amber-400" />
      case 2: return <Medal className="w-5 h-5 text-gray-400" />
      case 3: return <Medal className="w-5 h-5 text-amber-600" />
      default: return <span className="text-sm font-bold text-muted-foreground">#{position}</span>
    }
  }

  const getRewardTier = (position: number) => {
    if (position === 1) return { reward: '200,000 HACHI', accessory: 'Exclusivo', color: 'text-amber-400' }
    if (position <= 5) return { reward: '37,500 HACHI', accessory: 'Premium', color: 'text-purple-400' }
    if (position <= 20) return { reward: '6,666 HACHI', accessory: 'Avanzado', color: 'text-blue-400' }
    if (position <= 100) return { reward: '625 HACHI', accessory: null, color: 'text-gray-400' }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const seasonEndsIn = localSeason 
    ? Math.max(0, Math.ceil((new Date(localSeason.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="space-y-6 pb-24">
      {/* Season Info */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{localSeason?.name || 'Temporada Actual'}</h2>
              <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{seasonEndsIn} dias restantes</span>
              </div>
            </div>
            <Trophy className="w-10 h-10 text-primary/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Pool de Premios</p>
              <p className="text-lg font-bold text-primary">
                {formatNumber(localSeason?.total_reward_pool || 1000000)}
              </p>
              <p className="text-xs text-muted-foreground">HACHI</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Participantes</p>
              <p className="text-lg font-bold">{rankings.length}</p>
              <p className="text-xs text-muted-foreground">jugadores</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Stats */}
      {userRanking && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Tu Posicion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  {userPosition ? getRankIcon(userPosition) : <TrendingUp className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold">
                    {userPosition ? `#${userPosition}` : 'Sin clasificar'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(userRanking.points)} puntos
                  </p>
                </div>
              </div>
              {userPosition && getRewardTier(userPosition) && (
                <div className="text-right">
                  <Badge variant="outline" className={getRewardTier(userPosition)?.color}>
                    {getRewardTier(userPosition)?.reward}
                  </Badge>
                  {getRewardTier(userPosition)?.accessory && (
                    <p className="text-xs text-muted-foreground mt-1">
                      + Accesorio {getRewardTier(userPosition)?.accessory}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold">{userRanking.claims_count}</p>
                <p className="text-xs text-muted-foreground">Claims</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold">{userRanking.missions_completed}</p>
                <p className="text-xs text-muted-foreground">Misiones</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold">{userRanking.ads_watched}</p>
                <p className="text-xs text-muted-foreground">Anuncios</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold">{userRanking.referrals_count}</p>
                <p className="text-xs text-muted-foreground">Referidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How to earn points */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Como ganar puntos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>Claim diario</span>
            </div>
            <Badge variant="secondary">+{RANKING_POINTS.dailyClaim}</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Cat className="w-4 h-4 text-primary" />
              <span>Food Pack 7/30/90 dias</span>
            </div>
            <Badge variant="secondary">+25/100/300</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" />
              <span>Abrir cofre (segun tier)</span>
            </div>
            <Badge variant="secondary">+50-1000</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-500" />
              <span>Depositar en cofre (segun tier)</span>
            </div>
            <Badge variant="secondary">+10-100</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-hachi-green" />
              <span>Completar mision</span>
            </div>
            <Badge variant="secondary">+{RANKING_POINTS.missionComplete}</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-500" />
              <span>Ver anuncio</span>
            </div>
            <Badge variant="secondary">+{RANKING_POINTS.adWatch}</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <span>Mejorar gato</span>
            </div>
            <Badge variant="secondary">+{RANKING_POINTS.catUpgrade}</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-500" />
              <span>Staking (segun cantidad)</span>
            </div>
            <Badge variant="secondary">+5-5000</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-pink-500" />
              <span>Referir amigo</span>
            </div>
            <Badge variant="secondary">+{RANKING_POINTS.referral}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Rewards Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-500" />
            Premios por Temporada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm">Top 1</span>
            </div>
            <span className="text-sm font-medium text-amber-400">200,000 HACHI + Exclusivo</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Medal className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Top 2-5</span>
            </div>
            <span className="text-sm font-medium text-purple-400">37,500 HACHI + Premium</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Medal className="w-4 h-4 text-blue-400" />
              <span className="text-sm">Top 6-20</span>
            </div>
            <span className="text-sm font-medium text-blue-400">6,666 HACHI + Avanzado</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Top 21-100</span>
            </div>
            <span className="text-sm font-medium text-gray-400">625 HACHI</span>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Clasificacion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rankings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay participantes aun
            </p>
          ) : (
            rankings.slice(0, 20).map((ranking, index) => {
              const position = index + 1
              const isCurrentUser = user && ranking.user_id === user.profile.id
              
              return (
                <div 
                  key={ranking.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {getRankIcon(position)}
                    </div>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {ranking.profile?.username?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className={`text-sm font-medium ${isCurrentUser ? 'text-primary' : ''}`}>
                        {ranking.profile?.username || 'Usuario'}
                        {isCurrentUser && ' (Tu)'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatNumber(ranking.points)}</p>
                    <p className="text-xs text-muted-foreground">puntos</p>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
