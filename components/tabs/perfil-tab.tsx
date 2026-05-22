'use client'

import { useState } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatNumber, REFERRAL_REWARDS } from '@/lib/game-config'
import { 
  User, 
  Copy, 
  Check,
  Users,
  Coins,
  TrendingUp,
  LogOut,
  Globe,
  Share2,
  Gift
} from 'lucide-react'

export function PerfilTab() {
  const { user, signOut } = useHachi()
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  if (!user) return null

  const { profile, hachi } = user

  const referralLink = `https://hachihub.app/ref/${profile.referral_code}`

  const copyCode = async () => {
    await navigator.clipboard.writeText(profile.referral_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const shareReferral = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a Hachi Hub',
          text: `¡Únete a Hachi Hub con mi código ${profile.referral_code} y gana tokens HACHI!`,
          url: referralLink,
        })
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      copyLink()
    }
  }

  return (
    <div className="px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <User className="w-6 h-6 text-primary" />
          Perfil
        </h2>
      </div>

      {/* Profile Card */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-muted/30">
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-primary-foreground">
                {profile.username?.charAt(0).toUpperCase() || 'H'}
              </span>
            </div>

            {/* Username */}
            <h3 className="text-xl font-bold">{profile.username || 'HachiLover'}</h3>
            <p className="text-sm text-muted-foreground">Miembro desde {new Date(profile.created_at).toLocaleDateString()}</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 w-full mt-6">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Coins className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{formatNumber(profile.hachi_balance)}</p>
                <p className="text-[10px] text-muted-foreground">HACHI</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <TrendingUp className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-lg font-bold">{hachi.level}</p>
                <p className="text-[10px] text-muted-foreground">Nivel</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Users className="w-5 h-5 mx-auto mb-1 text-hachi-green" />
                <p className="text-lg font-bold">{profile.total_referrals}</p>
                <p className="text-[10px] text-muted-foreground">Referidos</p>
              </div>
            </div>

            {/* World ID Status */}
            <div className="w-full mt-4 p-3 bg-muted/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">World ID</span>
              </div>
              <span className="text-xs text-muted-foreground">No verificado</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Section */}
      <Card className="border-accent/30 bg-gradient-to-r from-accent/5 to-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            Invita Amigos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral Code */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Tu código de referido</p>
            <div className="flex gap-2">
              <Input 
                value={profile.referral_code} 
                readOnly 
                className="bg-muted/50 font-mono text-center text-lg tracking-wider"
              />
              <Button 
                variant="secondary" 
                size="icon"
                onClick={copyCode}
              >
                {copied ? <Check className="w-4 h-4 text-hachi-green" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Referral Link */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Tu link de referido</p>
            <div className="flex gap-2">
              <Input 
                value={referralLink} 
                readOnly 
                className="bg-muted/50 text-xs"
              />
              <Button 
                variant="secondary" 
                size="icon"
                onClick={copyLink}
              >
                {copiedLink ? <Check className="w-4 h-4 text-hachi-green" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Share Button */}
          <Button 
            className="w-full bg-gradient-to-r from-accent to-primary hover:opacity-90"
            onClick={shareReferral}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </Button>

          {/* Rewards Info */}
          <div className="pt-4 border-t border-border/50 space-y-2">
            <p className="text-xs font-medium">Recompensas por referido:</p>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Amigo se une</span>
                <span className="font-bold text-hachi-green flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  +1,000 HACHI
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Alcanza nivel 5</span>
                <span className="font-bold text-hachi-green flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  +5,000 HACHI
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Alcanza nivel 10</span>
                <span className="font-bold text-hachi-green flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  +10,000 HACHI
                </span>
              </div>
            </div>
          </div>

          {/* Referral Stats */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Referidos</p>
                <p className="text-xs text-muted-foreground">Total invitados</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{profile.total_referrals}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button 
        variant="outline" 
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={signOut}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Cerrar Sesión
      </Button>
    </div>
  )
}
