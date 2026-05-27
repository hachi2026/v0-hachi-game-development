'use client'

import { useState, useEffect } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Package, 
  Gift, 
  Glasses, 
  Crown, 
  Shirt, 
  Sparkles, 
  Box, 
  Home,
  CircleDollarSign,
  Coins,
  Check,
  Eye,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar
} from 'lucide-react'
import { formatNumber, getRarityColor, getRarityBgColor, CHEST_CONFIGS, RANKING_POINTS } from '@/lib/game-config'
import type { Accessory, Chest, ChestDeposit, UserAccessory } from '@/lib/types'

const ACCESSORY_ICONS: Record<string, React.ReactNode> = {
  gafas: <Glasses className="w-5 h-5" />,
  gorro: <Crown className="w-5 h-5" />,
  pantalon: <Shirt className="w-5 h-5" />,
  peine: <Sparkles className="w-5 h-5" />,
  arenero: <Box className="w-5 h-5" />,
  casa: <Home className="w-5 h-5" />,
}

const INSTALLMENTS_TOTAL = 5 // 5 cuotas
const REVEAL_DAYS = 5 // 5 dias para revelar

export function AccesoriosTab() {
  const { user, refreshUser, updateBalance, updateRankingPoints } = useHachi()
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [userAccessories, setUserAccessories] = useState<UserAccessory[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [deposits, setDeposits] = useState<ChestDeposit[]>([])
  const [loading, setLoading] = useState(true)
  const [depositing, setDepositing] = useState<string | null>(null)
  const [equipping, setEquipping] = useState<string | null>(null)
  const [revealing, setRevealing] = useState<string | null>(null)
  const [expandedChest, setExpandedChest] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const { data: accs } = await supabase
        .from('accessories')
        .select('*')
        .order('type')
        .order('tier')
      
      if (accs) setAccessories(accs)

      if (user) {
        const { data: userAccs } = await supabase
          .from('user_accessories')
          .select(`*, accessory:accessories(*)`)
          .eq('user_id', user.profile.id)
        
        if (userAccs) setUserAccessories(userAccs)
      }

      const { data: ch } = await supabase
        .from('chests')
        .select('*')
        .order('hachi_cost')
      
      if (ch) setChests(ch)

      if (user) {
        const { data: deps } = await supabase
          .from('chest_deposits')
          .select(`*, chest:chests(*), accessory:accessories(*)`)
          .eq('user_id', user.profile.id)
          .eq('revealed', false)
        
        if (deps) setDeposits(deps)
      }
    } catch (error) {
      console.error('Error fetching accessories:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAccessoriesForTier = (tier: string) => {
    return accessories.filter(a => a.tier === tier)
  }

  // Pay one installment (daily task)
  const handlePayInstallment = async (chest: Chest) => {
    if (!user || depositing) return
    
    const config = CHEST_CONFIGS.find(c => c.tier === chest.tier)
    const installmentAmount = Math.ceil(chest.hachi_cost / INSTALLMENTS_TOTAL)
    
    if (user.profile.hachi_balance < installmentAmount) {
      alert(`Necesitas ${formatNumber(installmentAmount)} HACHI para esta cuota`)
      return
    }

    setDepositing(chest.id)
    
    try {
      let existingDeposit = deposits.find(d => d.chest_id === chest.id && !d.completed)
      const currentInstallments = existingDeposit?.installments_paid || 0
      
      if (currentInstallments >= INSTALLMENTS_TOTAL) {
        alert('Ya completaste todas las cuotas de este cofre')
        return
      }

      const newInstallments = currentInstallments + 1
      const newTotal = newInstallments * installmentAmount
      const isCompleting = newInstallments >= INSTALLMENTS_TOTAL
      
      if (existingDeposit) {
        // Update existing deposit
        const updateData: any = {
          hachi_deposited: newTotal,
          installments_paid: newInstallments
        }
        
        if (isCompleting) {
          updateData.completed = true
          // Set reveal date 5 days from now
          const revealsAt = new Date()
          revealsAt.setDate(revealsAt.getDate() + REVEAL_DAYS)
          updateData.reveals_at = revealsAt.toISOString()
        }
        
        await supabase
          .from('chest_deposits')
          .update(updateData)
          .eq('id', existingDeposit.id)
      } else {
        // Create new deposit
        const insertData: any = {
          user_id: user.profile.id,
          chest_id: chest.id,
          hachi_deposited: installmentAmount,
          installments_paid: 1,
          started_at: new Date().toISOString()
        }
        
        if (newInstallments >= INSTALLMENTS_TOTAL) {
          insertData.completed = true
          const revealsAt = new Date()
          revealsAt.setDate(revealsAt.getDate() + REVEAL_DAYS)
          insertData.reveals_at = revealsAt.toISOString()
        }
        
        await supabase.from('chest_deposits').insert(insertData)
      }
      
      // Deduct HACHI
      await supabase
        .from('profiles')
        .update({ hachi_balance: user.profile.hachi_balance - installmentAmount })
        .eq('id', user.profile.id)
      
      updateBalance(-installmentAmount)
      updateRankingPoints(RANKING_POINTS.depositToChest)
      
      fetchData()
      refreshUser()
    } catch (error) {
      console.error('Error paying installment:', error)
    } finally {
      setDepositing(null)
    }
  }

  // Reveal chest after 5 days
  const handleReveal = async (deposit: ChestDeposit) => {
    if (!user || revealing) return
    
    const revealsAt = new Date(deposit.reveals_at || '')
    if (revealsAt > new Date()) {
      alert('Aun no puedes revelar este cofre')
      return
    }

    setRevealing(deposit.id)
    
    try {
      const chest = chests.find(c => c.id === deposit.chest_id)
      if (!chest) return
      
      // Get random accessory from tier
      const { data: tierAccessories } = await supabase
        .from('accessories')
        .select('*')
        .eq('tier', chest.tier)
      
      if (tierAccessories && tierAccessories.length > 0) {
        const randomAccessory = tierAccessories[Math.floor(Math.random() * tierAccessories.length)]
        
        // Mark as revealed and assign accessory
        await supabase
          .from('chest_deposits')
          .update({
            revealed: true,
            accessory_won: randomAccessory.id
          })
          .eq('id', deposit.id)
        
        // Add accessory to user
        await supabase
          .from('user_accessories')
          .upsert({
            user_id: user.profile.id,
            accessory_id: randomAccessory.id
          }, { onConflict: 'user_id,accessory_id' })
        
        updateRankingPoints(RANKING_POINTS.openChest)
        
        alert(`Felicidades! Ganaste: ${randomAccessory.name}`)
        fetchData()
        refreshUser()
      }
    } catch (error) {
      console.error('Error revealing:', error)
    } finally {
      setRevealing(null)
    }
  }

  const handleEquip = async (userAccessory: UserAccessory) => {
    if (!user || equipping) return
    
    setEquipping(userAccessory.id)
    
    try {
      const isEquipped = userAccessory.hachi_id !== null
      
      await supabase
        .from('user_accessories')
        .update({ hachi_id: isEquipped ? null : user.hachi.id })
        .eq('id', userAccessory.id)
      
      if (!isEquipped) {
        updateRankingPoints(RANKING_POINTS.equipAccessory)
      }
      
      fetchData()
      refreshUser()
    } catch (error) {
      console.error('Error equipping:', error)
    } finally {
      setEquipping(null)
    }
  }

  const getDaysUntilReveal = (revealsAt: string) => {
    const revealDate = new Date(revealsAt)
    const now = new Date()
    const diff = revealDate.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const totalAccessoryProduction = userAccessories
    .filter(ua => ua.hachi_id && ua.accessory)
    .reduce((sum, ua) => sum + (ua.accessory?.daily_production || 0), 0)

  // Separate pending reveals from active deposits
  const pendingReveals = deposits.filter(d => d.completed && !d.revealed)
  const activeDeposits = deposits.filter(d => !d.completed)

  return (
    <div className="space-y-6 pb-24">
      {/* Production Summary */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Produccion de Accesorios</p>
              <div className="flex items-center gap-2 mt-1">
                <CircleDollarSign className="w-5 h-5 text-amber-500" />
                <span className="text-2xl font-bold text-amber-500">
                  +{totalAccessoryProduction}
                </span>
                <span className="text-sm text-muted-foreground">KOBAN/dia</span>
              </div>
            </div>
            <Package className="w-12 h-12 text-amber-500/30" />
          </div>
        </CardContent>
      </Card>

      {/* Pending Reveals */}
      {pendingReveals.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              Cofres por Revelar
            </h3>
            {pendingReveals.map(deposit => {
              const chest = chests.find(c => c.id === deposit.chest_id)
              const daysLeft = getDaysUntilReveal(deposit.reveals_at || '')
              const canReveal = daysLeft === 0
              
              return (
                <div key={deposit.id} className="p-4 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-purple-400" />
                      <span className="font-medium">{chest?.name}</span>
                    </div>
                    {canReveal ? (
                      <Badge className="bg-hachi-green text-white">Listo!</Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {daysLeft} dias
                      </Badge>
                    )}
                  </div>
                  
                  <Button
                    className={`w-full ${canReveal ? 'bg-gradient-to-r from-purple-500 to-pink-500' : ''}`}
                    variant={canReveal ? 'default' : 'outline'}
                    disabled={!canReveal || revealing === deposit.id}
                    onClick={() => handleReveal(deposit)}
                  >
                    {revealing === deposit.id ? (
                      'Revelando...'
                    ) : canReveal ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Revelar Premio!
                      </>
                    ) : (
                      `Espera ${daysLeft} dias para revelar`
                    )}
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="cofres" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cofres" className="gap-2">
            <Gift className="w-4 h-4" />
            Cofres
          </TabsTrigger>
          <TabsTrigger value="inventario" className="gap-2">
            <Package className="w-4 h-4" />
            Inventario
          </TabsTrigger>
        </TabsList>

        {/* Cofres Tab */}
        <TabsContent value="cofres" className="space-y-4 mt-4">
          {/* System explanation */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 text-sm space-y-2">
              <p className="font-medium">Sistema de Cofres (5 cuotas)</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>1. Paga 1 cuota diaria (tarea diaria = puntos ranking)</li>
                <li>2. Completa 5 cuotas para llenar el cofre</li>
                <li>3. Espera 5 dias para revelar tu premio</li>
                <li>4. Recibe un accesorio aleatorio del tier!</li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
            <span className="text-sm">Tu Balance HACHI</span>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-primary" />
              <span className="font-bold">{formatNumber(user?.profile.hachi_balance || 0)}</span>
            </div>
          </div>
          
          {chests.map((chest) => {
            const deposit = activeDeposits.find(d => d.chest_id === chest.id)
            const installmentsPaid = deposit?.installments_paid || 0
            const installmentAmount = Math.ceil(chest.hachi_cost / INSTALLMENTS_TOTAL)
            const progress = (installmentsPaid / INSTALLMENTS_TOTAL) * 100
            const config = CHEST_CONFIGS.find(c => c.tier === chest.tier)
            const tierAccessories = getAccessoriesForTier(chest.tier)
            const isExpanded = expandedChest === chest.id
            const canPay = user && user.profile.hachi_balance >= installmentAmount && installmentsPaid < INSTALLMENTS_TOTAL
            
            return (
              <Card key={chest.id} className={`${getRarityBgColor(config?.rarity || 'common')} border-0`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${getRarityBgColor(config?.rarity || 'common')}`}>
                        <Gift className={`w-6 h-6 ${getRarityColor(config?.rarity || 'common')}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{chest.name}</h3>
                        <Badge variant="outline" className={getRarityColor(config?.rarity || 'common')}>
                          {chest.tier.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-primary" />
                        <span className="font-bold">{formatNumber(chest.hachi_cost)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">HACHI total</span>
                    </div>
                  </div>

                  {/* Installment Progress */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>Cuotas pagadas</span>
                      <span className="font-bold">{installmentsPaid} / {INSTALLMENTS_TOTAL}</span>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(INSTALLMENTS_TOTAL)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 h-3 rounded ${i < installmentsPaid ? 'bg-primary' : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cuota: {formatNumber(installmentAmount)} HACHI
                    </p>
                  </div>

                  {/* Pay Installment Button */}
                  <Button
                    className="w-full mb-3"
                    disabled={depositing === chest.id || !canPay}
                    onClick={() => handlePayInstallment(chest)}
                  >
                    {depositing === chest.id ? 'Procesando...' : installmentsPaid >= INSTALLMENTS_TOTAL ? (
                      'Cofre completo - Esperando revelar'
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Pagar Cuota #{installmentsPaid + 1} ({formatNumber(installmentAmount)} HACHI)
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mb-3">
                    +{RANKING_POINTS.depositToChest} puntos de ranking por cuota
                  </p>

                  {/* View possible prizes */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setExpandedChest(isExpanded ? null : chest.id)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver premios posibles
                    {isExpanded ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                  </Button>

                  {/* Possible prizes list */}
                  {isExpanded && (
                    <div className="mt-4 p-3 bg-background/50 rounded-lg space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        Premios disponibles ({tierAccessories.length} items):
                      </p>
                      {tierAccessories.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-2">
                            {ACCESSORY_ICONS[acc.type]}
                            <span className="text-sm">{acc.name}</span>
                          </div>
                          <span className="text-xs text-amber-500">+{acc.daily_production} KOBAN/dia</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* Inventario Tab */}
        <TabsContent value="inventario" className="space-y-4 mt-4">
          {userAccessories.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No tienes accesorios aun</p>
                <p className="text-sm text-muted-foreground">Completa cofres para conseguirlos</p>
              </CardContent>
            </Card>
          ) : (
            userAccessories.map((ua) => {
              const accessory = ua.accessory
              if (!accessory) return null
              
              const isEquipped = ua.hachi_id !== null
              
              return (
                <Card 
                  key={ua.id} 
                  className={`${getRarityBgColor(accessory.rarity)} border-0 ${isEquipped ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${getRarityBgColor(accessory.rarity)}`}>
                          {ACCESSORY_ICONS[accessory.type]}
                        </div>
                        <div>
                          <h3 className="font-semibold">{accessory.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getRarityColor(accessory.rarity)}>
                              {accessory.tier.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-amber-500">
                              +{accessory.daily_production} KOBAN/dia
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        variant={isEquipped ? "default" : "outline"}
                        size="sm"
                        disabled={equipping === ua.id}
                        onClick={() => handleEquip(ua)}
                      >
                        {equipping === ua.id ? '...' : isEquipped ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Equipado
                          </>
                        ) : 'Equipar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
