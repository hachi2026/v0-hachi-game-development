'use client'

import { useState } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { FOOD_PACKS, WATER_COST, MEMBERSHIP_CONFIG, formatNumber, RANKING_POINTS } from '@/lib/game-config'
import { 
  ShoppingBag, 
  Zap, 
  Clock, 
  Sparkles, 
  Gift,
  CheckCircle2,
  Droplets,
  UtensilsCrossed,
  Crown,
  Coins,
  CircleDollarSign,
  Percent
} from 'lucide-react'

export function TiendaTab() {
  const { user, refreshUser, updateBalance, updateRankingPoints } = useHachi()
  const [purchasing, setPurchasing] = useState<string | null>(null)

  const supabase = createClient()

  if (!user) return null

  const { profile, hachi, energyDaysRemaining, canWater } = user
  const hasMembership = profile.has_membership

  // Check if water is needed (24h cooldown)
  const lastWater = hachi.last_water_at ? new Date(hachi.last_water_at) : null
  const now = new Date()
  const needsWater = !lastWater || (now.getTime() - lastWater.getTime()) >= 24 * 60 * 60 * 1000

  const handlePurchaseWater = async () => {
    if (profile.hachi_balance < WATER_COST) {
      alert('No tienes suficiente HACHI')
      return
    }
    
    setPurchasing('water')

    try {
      // Deduct HACHI for water
      await supabase
        .from('profiles')
        .update({ hachi_balance: profile.hachi_balance - WATER_COST })
        .eq('id', profile.id)

      // Update last water time
      await supabase
        .from('hachis')
        .update({ last_water_at: new Date().toISOString() })
        .eq('id', hachi.id)

      updateBalance(-WATER_COST)
      updateRankingPoints(RANKING_POINTS.feedCat)
      await refreshUser()
    } catch (error) {
      console.error('Error purchasing water:', error)
    } finally {
      setPurchasing(null)
    }
  }

  const handlePurchaseFoodPack = async (packIndex: number) => {
    const pack = FOOD_PACKS[packIndex]
    setPurchasing(`food-${pack.days}`)

    try {
      const expiresAt = new Date()
      
      // If already has energy, extend from that date
      if (hachi.energy_expires_at && new Date(hachi.energy_expires_at) > new Date()) {
        expiresAt.setTime(new Date(hachi.energy_expires_at).getTime())
      }
      expiresAt.setDate(expiresAt.getDate() + pack.days)

      // Calculate KOBAN production (value - 20% / days)
      const totalKoban = pack.kobanValue
      const dailyKoban = Math.floor((totalKoban * 0.8) / pack.days)

      // Insert food purchase
      await supabase
        .from('food_purchases')
        .insert({
          user_id: profile.id,
          hachi_id: hachi.id,
          days_purchased: pack.days,
          wld_cost: pack.wldCost,
          total_koban: totalKoban,
          daily_koban: dailyKoban,
          koban_claimed: 0,
          expires_at: expiresAt.toISOString(),
        })

      // Update hachi energy
      const newEnergyDays = energyDaysRemaining + pack.days
      await supabase
        .from('hachis')
        .update({
          energy_days: newEnergyDays,
          energy_expires_at: expiresAt.toISOString(),
        })
        .eq('id', hachi.id)

      // Update profile WLD spent
      await supabase
        .from('profiles')
        .update({ wld_spent: profile.wld_spent + pack.wldCost })
        .eq('id', profile.id)

      updateRankingPoints(RANKING_POINTS.feedCat)
      await refreshUser()
    } catch (error) {
      console.error('Error purchasing food pack:', error)
    } finally {
      setPurchasing(null)
    }
  }

  const handlePurchaseMembership = async () => {
    if (hasMembership) {
      alert('Ya tienes una membresia activa')
      return
    }

    setPurchasing('membership')

    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + MEMBERSHIP_CONFIG.durationDays)

      // Calculate HACHI return (60% of value at current price)
      const hachiReturnTotal = MEMBERSHIP_CONFIG.wldCost * MEMBERSHIP_CONFIG.hachiReturnPercent * 1000 // Mock rate
      const hachiReturnDaily = Math.floor(hachiReturnTotal / MEMBERSHIP_CONFIG.durationDays)

      // Create membership record
      await supabase
        .from('memberships')
        .insert({
          user_id: profile.id,
          wld_paid: MEMBERSHIP_CONFIG.wldCost,
          hachi_return_total: hachiReturnTotal,
          hachi_return_daily: hachiReturnDaily,
          hachi_claimed: 0,
          expires_at: expiresAt.toISOString(),
        })

      // Update profile
      await supabase
        .from('profiles')
        .update({
          has_membership: true,
          membership_expires_at: expiresAt.toISOString(),
          wld_spent: profile.wld_spent + MEMBERSHIP_CONFIG.wldCost,
        })
        .eq('id', profile.id)

      await refreshUser()
    } catch (error) {
      console.error('Error purchasing membership:', error)
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <div className="px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <ShoppingBag className="w-6 h-6 text-primary" />
          Tienda
        </h2>
        <p className="text-sm text-muted-foreground">
          Alimento, agua y membresia
        </p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium">Agua</span>
            </div>
            <p className={`text-lg font-bold ${needsWater ? 'text-destructive' : 'text-blue-500'}`}>
              {needsWater ? 'Necesita!' : 'OK'}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-hachi-green/10 to-hachi-green/5 border-hachi-green/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-hachi-green" />
              <span className="text-sm font-medium">Energia</span>
            </div>
            <p className={`text-lg font-bold ${energyDaysRemaining > 0 ? 'text-hachi-green' : 'text-destructive'}`}>
              {energyDaysRemaining} dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balances */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-sm">HACHI:</span>
              <span className="font-bold">{formatNumber(profile.hachi_balance)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-amber-500" />
              <span className="text-sm">KOBAN:</span>
              <span className="font-bold">{formatNumber(profile.hachi_koban_balance || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="esenciales" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="esenciales">Esenciales</TabsTrigger>
          <TabsTrigger value="alimento">Alimento</TabsTrigger>
          <TabsTrigger value="membresia">Membresia</TabsTrigger>
        </TabsList>

        {/* Esenciales - Agua diaria */}
        <TabsContent value="esenciales" className="space-y-4 mt-4">
          <Card className={`${needsWater ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30' : 'bg-card'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Droplets className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold">Agua Diaria</h3>
                    <p className="text-sm text-muted-foreground">Indispensable para tu gato</p>
                  </div>
                </div>
                {!needsWater && (
                  <Badge variant="outline" className="text-hachi-green">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Hidratado
                  </Badge>
                )}
              </div>

              <div className="p-3 bg-background/50 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground">
                  Tu gato necesita agua cada 24 horas para poder reclamar recompensas.
                  Sin agua, no podras hacer el claim diario.
                </p>
              </div>

              <Button
                className="w-full"
                variant={needsWater ? 'default' : 'outline'}
                disabled={purchasing === 'water' || !needsWater || profile.hachi_balance < WATER_COST}
                onClick={handlePurchaseWater}
              >
                {purchasing === 'water' ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : needsWater ? (
                  <>
                    <Droplets className="w-4 h-4 mr-2" />
                    Dar Agua ({formatNumber(WATER_COST)} HACHI)
                  </>
                ) : (
                  'Agua OK - Vuelve manana'
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4 text-sm">
              <p className="font-medium mb-2">Sistema de Necesidades:</p>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>- <b>Agua:</b> 100 HACHI/dia (obligatorio)</li>
                <li>- <b>Alimento:</b> Packs WLD que producen KOBAN</li>
                <li>- Sin agua = No puedes reclamar</li>
                <li>- Sin alimento = No produces KOBAN extra</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alimento - Packs WLD que producen KOBAN */}
        <TabsContent value="alimento" className="space-y-4 mt-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 text-sm">
              <p className="font-medium mb-2">Packs de Alimento (Producen KOBAN)</p>
              <p className="text-xs text-muted-foreground">
                Compra un pack con WLD. El valor se convierte en KOBAN que recibes diariamente durante los dias del pack (menos 20% fee).
              </p>
            </CardContent>
          </Card>

          {FOOD_PACKS.map((pack, index) => {
            const dailyKoban = Math.floor((pack.kobanValue * 0.8) / pack.days)
            const isPopular = pack.days === 90
            
            return (
              <Card 
                key={pack.days} 
                className={`${isPopular ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/30' : 'bg-card'}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${isPopular ? 'bg-amber-500/20' : 'bg-muted'}`}>
                        <UtensilsCrossed className={`w-6 h-6 ${isPopular ? 'text-amber-500' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">{pack.label}</h3>
                          {isPopular && <Badge className="bg-amber-500 text-white text-xs">Popular</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{pack.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-2 bg-background/50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="font-bold text-amber-500">{formatNumber(pack.kobanValue)} KOBAN</p>
                    </div>
                    <div className="p-2 bg-background/50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Recibes/dia</p>
                      <p className="font-bold text-hachi-green">+{formatNumber(dailyKoban)} KOBAN</p>
                    </div>
                  </div>

                  <Button
                    className={`w-full ${isPopular ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-90' : ''}`}
                    variant={isPopular ? 'default' : 'secondary'}
                    disabled={purchasing === `food-${pack.days}`}
                    onClick={() => handlePurchaseFoodPack(index)}
                  >
                    {purchasing === `food-${pack.days}` ? (
                      <Sparkles className="w-4 h-4 animate-spin" />
                    ) : (
                      `${pack.wldCost} WLD`
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* Membresia */}
        <TabsContent value="membresia" className="space-y-4 mt-4">
          <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <Crown className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Membresia VIP</h3>
                    <p className="text-sm text-muted-foreground">90 dias de beneficios</p>
                  </div>
                </div>
                {hasMembership && (
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    ACTIVA
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-hachi-green/20 flex items-center justify-center">
                    <Percent className="w-5 h-5 text-hachi-green" />
                  </div>
                  <div>
                    <p className="font-medium">+20% APY en Staking</p>
                    <p className="text-xs text-muted-foreground">Hasta 100% APY total</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium">10% Descuento en Mejoras</p>
                    <p className="text-xs text-muted-foreground">En todas las mejoras de gatos</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">60% Devuelto en HACHI</p>
                    <p className="text-xs text-muted-foreground">Distribuido en 90 dias</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-background/50 rounded-lg mb-4 text-center">
                <p className="text-2xl font-bold text-purple-400">{MEMBERSHIP_CONFIG.wldCost} WLD</p>
                <p className="text-xs text-muted-foreground">Por 90 dias de membresia</p>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                disabled={purchasing === 'membership' || hasMembership}
                onClick={handlePurchaseMembership}
              >
                {purchasing === 'membership' ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : hasMembership ? (
                  'Membresia Activa'
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Obtener Membresia
                  </>
                )}
              </Button>

              {hasMembership && profile.membership_expires_at && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Expira: {new Date(profile.membership_expires_at).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
