'use client'

import { useHachi } from '@/lib/hachi-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { REFERRAL_REWARDS, formatNumber } from '@/lib/game-config'
import { 
  Target, 
  Users, 
  Gift, 
  CheckCircle2,
  Lock,
  Coins,
  TrendingUp,
  Zap
} from 'lucide-react'

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
  const { user } = useHachi()

  if (!user) return null

  const { profile, hachi } = user

  // Define missions based on user progress
  const dailyMissions: Mission[] = [
    {
      id: 'daily_claim',
      title: 'Reclama tu producción',
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
      description: 'Mantén a tu Hachi con energía',
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
      title: 'Alcanza nivel 20',
      description: 'Mejora tu Hachi al nivel 20',
      reward: 5000,
      progress: Math.min(hachi.level, 20),
      target: 20,
      completed: hachi.level >= 20,
      icon: TrendingUp,
    },
    {
      id: 'level_30',
      title: 'Nivel Máximo',
      description: 'Alcanza el nivel 30 legendario',
      reward: 20000,
      progress: Math.min(hachi.level, 30),
      target: 30,
      completed: hachi.level >= 30,
      icon: TrendingUp,
    },
    {
      id: 'total_10k',
      title: 'Productor Novato',
      description: 'Produce 10,000 HACHI en total',
      reward: 500,
      progress: Math.min(hachi.total_production, 10000),
      target: 10000,
      completed: hachi.total_production >= 10000,
      icon: Coins,
    },
    {
      id: 'total_100k',
      title: 'Productor Experto',
      description: 'Produce 100,000 HACHI en total',
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
