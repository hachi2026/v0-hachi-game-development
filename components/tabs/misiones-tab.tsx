'use client'

import { useState, useEffect } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { REFERRAL_REWARDS, formatNumber, MAX_LEVEL, RANKING_POINTS } from '@/lib/game-config'
import { 
  Target, 
  Users, 
  Gift, 
  CheckCircle2,
  Coins,
  TrendingUp,
  Zap,
  ExternalLink,
  Play,
  Eye
} from 'lucide-react'
import type { Advertisement, AdView } from '@/lib/types'

interface Mission {
  id: string
  title: string
  description: string
  reward: number
  progress: number
  target: number
  completed: boolean
  icon: typeof Target
}

export function MisionesTab() {
  const { user, refreshUser, updateBalance, currentSeason } = useHachi()
  const [ads, setAds] = useState<Advertisement[]>([])
  const [adViews, setAdViews] = useState<AdView[]>([])
  const [loadingAds, setLoadingAds] = useState(true)
  const [watchingAd, setWatchingAd] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchAds()
  }, [user])

  const fetchAds = async () => {
    if (!user) return
    
    try {
      setLoadingAds(true)
      
      // Fetch active ads
      const { data: advertisements } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .gt('views_remaining', 0)
      
      if (advertisements) setAds(advertisements)

      // Fetch user's ad views
      const { data: views } = await supabase
        .from('ad_views')
        .select('*')
        .eq('user_id', user.profile.id)
      
      if (views) setAdViews(views)
    } catch (error) {
      console.error('Error fetching ads:', error)
    } finally {
      setLoadingAds(false)
    }
  }

  const handleWatchAd = async (ad: Advertisement) => {
    if (!user || watchingAd) return
    
    // Check if already watched
    if (adViews.find(v => v.ad_id === ad.id)) {
      alert('Ya has visto este anuncio')
      return
    }

    setWatchingAd(ad.id)
    
    try {
      // Open ad link in new tab
      window.open(ad.link_url, '_blank')
      
      // Wait a bit to simulate watching
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Record ad view
      await supabase.from('ad_views').insert({
        user_id: user.profile.id,
        ad_id: ad.id,
        hachi_earned: ad.hachi_reward
      })
      
      // Decrease views remaining
      await supabase
        .from('advertisements')
        .update({ views_remaining: ad.views_remaining - 1 })
        .eq('id', ad.id)
      
      // Add HACHI to user balance
      await supabase
        .from('profiles')
        .update({ hachi_balance: user.profile.hachi_balance + ad.hachi_reward })
        .eq('id', user.profile.id)
      
      // Update ranking points
      if (currentSeason) {
        await supabase.rpc('increment_ranking_points', {
          p_user_id: user.profile.id,
          p_season_id: currentSeason.id,
          p_points: RANKING_POINTS.adWatch,
          p_field: 'ads_watched'
        }).catch(() => {
          // If function doesn't exist, update directly
          supabase
            .from('rankings')
            .upsert({
              user_id: user.profile.id,
              season_id: currentSeason.id,
              points: RANKING_POINTS.adWatch,
              ads_watched: 1
            }, { onConflict: 'user_id,season_id' })
        })
      }
      
      updateBalance(ad.hachi_reward)
      fetchAds()
      refreshUser()
    } catch (error) {
      console.error('Error watching ad:', error)
    } finally {
      setWatchingAd(null)
    }
  }

  if (!user) return null

  const { profile, hachi } = user

  // Define missions based on user progress
  const dailyMissions: Mission[] = [
    {
      id: 'daily_claim',
      title: 'Reclama tu produccion',
      description: 'Haz tu claim diario',
      reward: 10,
      progress: hachi.last_claim_at && new Date(hachi.last_claim_at).toDateString() === new Date().toDateString() ? 1 : 0,
      target: 1,
      completed: hachi.last_claim_at ? new Date(hachi.last_claim_at).toDateString() === new Date().toDateString() : false,
      icon: Gift,
    },
    {
      id: 'feed_hachi',
      title: 'Alimenta tu Hachi',
      description: 'Manten a tu Hachi con energia',
      reward: 15,
      progress: hachi.energy_expires_at && new Date(hachi.energy_expires_at) > new Date() ? 1 : 0,
      target: 1,
      completed: hachi.energy_expires_at ? new Date(hachi.energy_expires_at) > new Date() : false,
      icon: Zap,
    },
  ]

  const achievementMissions: Mission[] = [
    {
      id: 'level_5',
      title: 'Alcanza nivel 5',
      description: 'Mejora tu Hachi al nivel 5',
      reward: 500,
      progress: Math.min(hachi.level, 5),
      target: 5,
      completed: hachi.level >= 5,
      icon: TrendingUp,
    },
    {
      id: 'level_10',
      title: 'Alcanza nivel 10',
      description: 'Mejora tu Hachi al nivel 10',
      reward: 1500,
      progress: Math.min(hachi.level, 10),
      target: 10,
      completed: hachi.level >= 10,
      icon: TrendingUp,
    },
    {
      id: 'level_20',
      title: 'Nivel Maximo',
      description: 'Alcanza el nivel 20 legendario',
      reward: 5000,
      progress: Math.min(hachi.level, MAX_LEVEL),
      target: MAX_LEVEL,
      completed: hachi.level >= MAX_LEVEL,
      icon: TrendingUp,
    },
    {
      id: 'total_10k',
      title: 'Productor Novato',
      description: 'Produce 10,000 KOBAN en total',
      reward: 500,
      progress: Math.min(hachi.total_production, 10000),
      target: 10000,
      completed: hachi.total_production >= 10000,
      icon: Coins,
    },
    {
      id: 'total_100k',
      title: 'Productor Experto',
      description: 'Produce 100,000 KOBAN en total',
      reward: 2500,
      progress: Math.min(hachi.total_production, 100000),
      target: 100000,
      completed: hachi.total_production >= 100000,
      icon: Coins,
    },
    {
      id: 'referrals_5',
      title: 'Embajador',
      description: 'Invita a 5 amigos',
      reward: 1000,
      progress: Math.min(profile.total_referrals, 5),
      target: 5,
      completed: profile.total_referrals >= 5,
      icon: Users,
    },
  ]

  const MissionCard = ({ mission }: { mission: Mission }) => {
    const Icon = mission.icon
    const progressPercent = (mission.progress / mission.target) * 100

    return (
      <Card className={`border-border/50 ${mission.completed ? 'bg-hachi-green/5 border-hachi-green/30' : 'bg-card/80'}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${mission.completed ? 'bg-hachi-green/20' : 'bg-muted'}`}>
              {mission.completed ? (
                <CheckCircle2 className="w-5 h-5 text-hachi-green" />
              ) : (
                <Icon className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className={`font-medium text-sm ${mission.completed ? 'text-hachi-green' : ''}`}>
                  {mission.title}
                </p>
                <span className="text-xs font-bold text-primary">
                  +{formatNumber(mission.reward)} HACHI
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{mission.description}</p>
              <div className="space-y-1">
                <Progress value={progressPercent} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground text-right">
                  {formatNumber(mission.progress)} / {formatNumber(mission.target)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <Target className="w-6 h-6 text-accent" />
          Misiones
        </h2>
        <p className="text-sm text-muted-foreground">
          Completa misiones para ganar recompensas
        </p>
      </div>

      {/* Sponsored Ads Section */}
      {ads.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />
              Gana HACHI viendo anuncios
              <Badge variant="outline" className="ml-auto text-xs">Patrocinado</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ads.map((ad) => {
              const hasWatched = adViews.find(v => v.ad_id === ad.id)
              
              return (
                <div 
                  key={ad.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${hasWatched ? 'bg-muted/30' : 'bg-background/50'}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {ad.image_url ? (
                      <img src={ad.image_url} alt={ad.advertiser_name} className="w-full h-full object-cover" />
                    ) : (
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ad.advertiser_name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs text-primary">
                        +{ad.hachi_reward} HACHI
                      </Badge>
                      {hasWatched && (
                        <Badge variant="outline" className="text-xs text-hachi-green">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Visto
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!hasWatched ? (
                    <Button
                      size="sm"
                      disabled={watchingAd === ad.id}
                      onClick={() => handleWatchAd(ad)}
                    >
                      {watchingAd === ad.id ? '...' : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Ver
                        </>
                      )}
                    </Button>
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-hachi-green" />
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Daily Missions */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          Misiones Diarias
        </h3>
        <div className="space-y-3">
          {dailyMissions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      </div>

      {/* Achievement Missions */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Logros
        </h3>
        <div className="space-y-3">
          {achievementMissions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      </div>

      {/* Referral Section */}
      <Card className="border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            Recompensas por Referidos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
            <span className="text-xs">Amigo se une</span>
            <span className="text-xs font-bold text-hachi-green">+{REFERRAL_REWARDS.signup} HACHI</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
            <span className="text-xs">Amigo alcanza nivel 5</span>
            <span className="text-xs font-bold text-hachi-green">+{REFERRAL_REWARDS.level_5} HACHI</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
            <span className="text-xs">Amigo alcanza nivel 10</span>
            <span className="text-xs font-bold text-hachi-green">+{REFERRAL_REWARDS.level_10} HACHI</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
