'use client'

import { useState } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FOOD_PACKS, DAILY_FOOD, formatNumber } from '@/lib/game-config'
import { 
  ShoppingBag, 
  Zap, 
  Clock, 
  Sparkles, 
  Gift,
  CheckCircle2
} from 'lucide-react'

export function TiendaTab() {
  const { user, refreshUser } = useHachi()
  const [purchasing, setPurchasing] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'wld' | 'hachi'>('wld')

  const supabase = createClient()

  if (!user) return null

  const { profile, hachi, energyDaysRemaining } = user

  const handlePurchaseFood = async (days: 30 | 60 | 90, wldCost: number, bonusTokens: number) => {
    setPurchasing(days)

    try {
      const expiresAt = new Date()
      
      // If already has energy, extend from that date
      if (hachi.energy_expires_at && new Date(hachi.energy_expires_at) > new Date()) {
        expiresAt.setTime(new Date(hachi.energy_expires_at).getTime())
      }
      expiresAt.setDate(expiresAt.getDate() + days)

      // Insert food purchase
      const { error: purchaseError } = await supabase
        .from('food_purchases')
        .insert({
          user_id: profile.id,
          hachi_id: hachi.id,
          days_purchased: days,
          wld_cost: wldCost,
          bonus_tokens: bonusTokens,
          expires_at: expiresAt.toISOString(),
        })

      if (purchaseError) throw purchaseError

      // Update hachi energy
      const newEnergyDays = energyDaysRemaining + days
      const { error: hachiError } = await supabase
        .from('hachis')
        .update({
          energy_days: newEnergyDays,
          energy_expires_at: expiresAt.toISOString(),
        })
        .eq('id', hachi.id)

      if (hachiError) throw hachiError

      // Update profile (add bonus tokens if 90-day pack)
      if (bonusTokens > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            hachi_balance: profile.hachi_balance + bonusTokens,
            wld_spent: profile.wld_spent + wldCost,
          })
          .eq('id', profile.id)

        if (profileError) throw profileError
      } else {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            wld_spent: profile.wld_spent + wldCost,
          })
          .eq('id', profile.id)

        if (profileError) throw profileError
      }

      await refreshUser()
    } catch (error) {
      console.error('Error purchasing food:', error)
    } finally {
      setPurchasing(null)
    }
  }

  const handlePurchaseDailyFood = async () => {
    if (profile.hachi_balance < DAILY_FOOD.hachiCost) return
    setPurchasing(1)

    try {
      const expiresAt = new Date()
      if (hachi.energy_expires_at && new Date(hachi.energy_expires_at) > new Date()) {
        expiresAt.setTime(new Date(hachi.energy_expires_at).getTime())
      }
      expiresAt.setDate(expiresAt.getDate() + 1)

      // Update hachi energy
      const { error: hachiError } = await supabase
        .from('hachis')
        .update({
          energy_days: energyDaysRemaining + 1,
          energy_expires_at: expiresAt.toISOString(),
        })
        .eq('id', hachi.id)

      if (hachiError) throw hachiError

      // Deduct HACHI balance
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          hachi_balance: profile.hachi_balance - DAILY_FOOD.hachiCost,
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      await refreshUser()
    } catch (error) {
      console.error('Error purchasing daily food:', error)
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
          Compra alimento para tu Hachi
        </p>
      </div>

      {/* Current Energy Status */}
      <Card className="border-border/50 bg-gradient-to-r from-hachi-green/10 to-transparent">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${energyDaysRemaining > 0 ? 'bg-hachi-green/20' : 'bg-destructive/20'}`}>
              <Zap className={`w-6 h-6 ${energyDaysRemaining > 0 ? 'text-hachi-green' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Energía actual</p>
              <p className={`text-lg font-bold ${energyDaysRemaining > 0 ? 'text-hachi-green' : 'text-destructive'}`}>
                {energyDaysRemaining} días
              </p>
            </div>
          </div>
          {energyDaysRemaining > 0 && (
            <CheckCircle2 className="w-6 h-6 text-hachi-green" />
          )}
        </CardContent>
      </Card>

      {/* Payment Method Tabs */}
      <Tabs defaultValue="wld" onValueChange={(v) => setPaymentMethod(v as 'wld' | 'hachi')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="wld">Con WLD</TabsTrigger>
          <TabsTrigger value="hachi">Con HACHI</TabsTrigger>
        </TabsList>

        <TabsContent value="wld" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground text-center">
            Packs de Alimentación (Comida + Agua)
          </p>

          {FOOD_PACKS.map((pack) => (
            <Card 
              key={pack.days} 
              className={`border-border/50 ${pack.days === 90 ? 'bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30' : 'bg-card/80'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pack.days === 90 ? 'bg-primary/20' : 'bg-muted'}`}>
                      <Clock className={`w-6 h-6 ${pack.days === 90 ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-bold">{pack.label}</p>
                      <p className="text-xs text-muted-foreground">{pack.description}</p>
                      {pack.bonusTokens > 0 && (
                        <p className="text-xs text-hachi-green flex items-center gap-1 mt-1">
                          <Gift className="w-3 h-3" />
                          +{formatNumber(pack.bonusTokens)} HACHI bonus
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handlePurchaseFood(pack.days, pack.wldCost, pack.bonusTokens)}
                    disabled={purchasing === pack.days}
                    className={pack.days === 90 ? 'bg-primary hover:bg-primary/90' : ''}
                    variant={pack.days === 90 ? 'default' : 'secondary'}
                  >
                    {purchasing === pack.days ? (
                      <Sparkles className="w-4 h-4 animate-spin" />
                    ) : (
                      `${pack.wldCost} WLD`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <p className="text-xs text-muted-foreground text-center">
            (Mockup - Los pagos en WLD se conectarán con World Chain)
          </p>
        </TabsContent>

        <TabsContent value="hachi" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground text-center">
            Compra alimento diario con tus tokens HACHI
          </p>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted">
                    <Zap className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-bold">{DAILY_FOOD.label}</p>
                    <p className="text-xs text-muted-foreground">{DAILY_FOOD.description}</p>
                  </div>
                </div>
                <Button
                  onClick={handlePurchaseDailyFood}
                  disabled={purchasing === 1 || profile.hachi_balance < DAILY_FOOD.hachiCost}
                  variant="secondary"
                >
                  {purchasing === 1 ? (
                    <Sparkles className="w-4 h-4 animate-spin" />
                  ) : (
                    `${DAILY_FOOD.hachiCost} HACHI`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-center">
              Tu balance: <span className="font-bold text-primary">{formatNumber(profile.hachi_balance)} HACHI</span>
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Info Section */}
      <Card className="border-border/50 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" />
            ¿Por qué alimentar?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>• Tu Hachi necesita energía para producir HACHI tokens</p>
          <p>• Sin energía, no podrás hacer el claim diario</p>
          <p>• El pack de 90 días incluye bonus de 200,000 HACHI</p>
          <p>• Puedes extender la energía en cualquier momento</p>
        </CardContent>
      </Card>
    </div>
  )
}
