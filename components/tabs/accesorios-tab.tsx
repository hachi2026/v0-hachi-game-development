'use client'

import { useState, useEffect } from 'react'
import { useHachi } from '@/lib/hachi-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Check
} from 'lucide-react'
import { formatNumber, getRarityColor, getRarityBgColor, CHEST_CONFIGS } from '@/lib/game-config'
import type { Accessory, Chest, ChestDeposit, UserAccessory } from '@/lib/types'

const ACCESSORY_ICONS: Record<string, React.ReactNode> = {
  gafas: <Glasses className="w-5 h-5" />,
  gorro: <Crown className="w-5 h-5" />,
  pantalon: <Shirt className="w-5 h-5" />,
  peine: <Sparkles className="w-5 h-5" />,
  arenero: <Box className="w-5 h-5" />,
  casa: <Home className="w-5 h-5" />,
}

export function AccesoriosTab() {
  const { user, refreshUser, updateBalance } = useHachi()
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [userAccessories, setUserAccessories] = useState<UserAccessory[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [deposits, setDeposits] = useState<ChestDeposit[]>([])
  const [loading, setLoading] = useState(true)
  const [depositing, setDepositing] = useState<string | null>(null)
  const [equipping, setEquipping] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch all accessories
      const { data: accs } = await supabase
        .from('accessories')
        .select('*')
        .order('type')
        .order('tier')
      
      if (accs) setAccessories(accs)

      // Fetch user's accessories
      if (user) {
        const { data: userAccs } = await supabase
          .from('user_accessories')
          .select(`*, accessory:accessories(*)`)
          .eq('user_id', user.profile.id)
        
        if (userAccs) setUserAccessories(userAccs)
      }

      // Fetch chests
      const { data: ch } = await supabase
        .from('chests')
        .select('*')
        .order('hachi_cost')
      
      if (ch) setChests(ch)

      // Fetch user's chest deposits
      if (user) {
        const { data: deps } = await supabase
          .from('chest_deposits')
          .select(`*, chest:chests(*), accessory:accessories(*)`)
          .eq('user_id', user.profile.id)
          .eq('completed', false)
        
        if (deps) setDeposits(deps)
      }
    } catch (error) {
      console.error('Error fetching accessories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async (chest: Chest, depositAmount: number) => {
    if (!user || depositing) return
    
    if (user.profile.hachi_balance < depositAmount) {
      alert('No tienes suficiente HACHI')
      return
    }

    setDepositing(chest.id)
    
    try {
      // Find existing deposit for this chest
      let existingDeposit = deposits.find(d => d.chest_id === chest.id)
      
      if (existingDeposit) {
        // Update existing deposit
        const newTotal = existingDeposit.hachi_deposited + depositAmount
        
        if (newTotal >= chest.hachi_cost) {
          // Complete the chest - award random accessory
          const { data: tierAccessories } = await supabase
            .from('accessories')
            .select('*')
            .eq('tier', chest.tier)
          
          if (tierAccessories && tierAccessories.length > 0) {
            // Pick random accessory
            const randomAccessory = tierAccessories[Math.floor(Math.random() * tierAccessories.length)]
            
            // Update deposit as completed
            await supabase
              .from('chest_deposits')
              .update({
                hachi_deposited: newTotal,
                completed: true,
                accessory_won: randomAccessory.id,
                completed_at: new Date().toISOString()
              })
              .eq('id', existingDeposit.id)
            
            // Add accessory to user
            await supabase
              .from('user_accessories')
              .insert({
                user_id: user.profile.id,
                accessory_id: randomAccessory.id
              })
            
            // Deduct HACHI
            await supabase
              .from('profiles')
              .update({ hachi_balance: user.profile.hachi_balance - depositAmount })
              .eq('id', user.profile.id)
            
            updateBalance(-depositAmount)
            alert(`Felicidades! Ganaste: ${randomAccessory.name}`)
          }
        } else {
          // Just add to deposit
          await supabase
            .from('chest_deposits')
            .update({ hachi_deposited: newTotal })
            .eq('id', existingDeposit.id)
          
          // Deduct HACHI
          await supabase
            .from('profiles')
            .update({ hachi_balance: user.profile.hachi_balance - depositAmount })
            .eq('id', user.profile.id)
          
          updateBalance(-depositAmount)
        }
      } else {
        // Create new deposit
        const newDeposit = {
          user_id: user.profile.id,
          chest_id: chest.id,
          hachi_deposited: depositAmount
        }
        
        if (depositAmount >= chest.hachi_cost) {
          // Instant complete
          const { data: tierAccessories } = await supabase
            .from('accessories')
            .select('*')
            .eq('tier', chest.tier)
          
          if (tierAccessories && tierAccessories.length > 0) {
            const randomAccessory = tierAccessories[Math.floor(Math.random() * tierAccessories.length)]
            
            await supabase
              .from('chest_deposits')
              .insert({
                ...newDeposit,
                completed: true,
                accessory_won: randomAccessory.id,
                completed_at: new Date().toISOString()
              })
            
            await supabase
              .from('user_accessories')
              .insert({
                user_id: user.profile.id,
                accessory_id: randomAccessory.id
              })
            
            await supabase
              .from('profiles')
              .update({ hachi_balance: user.profile.hachi_balance - depositAmount })
              .eq('id', user.profile.id)
            
            updateBalance(-depositAmount)
            alert(`Felicidades! Ganaste: ${randomAccessory.name}`)
          }
        } else {
          await supabase.from('chest_deposits').insert(newDeposit)
          
          await supabase
            .from('profiles')
            .update({ hachi_balance: user.profile.hachi_balance - depositAmount })
            .eq('id', user.profile.id)
          
          updateBalance(-depositAmount)
        }
      }
      
      fetchData()
      refreshUser()
    } catch (error) {
      console.error('Error depositing:', error)
    } finally {
      setDepositing(null)
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
      
      fetchData()
      refreshUser()
    } catch (error) {
      console.error('Error equipping:', error)
    } finally {
      setEquipping(null)
    }
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
          <p className="text-sm text-muted-foreground text-center">
            Deposita HACHI para abrir cofres y ganar accesorios aleatorios
          </p>
          
          {chests.map((chest) => {
            const deposit = deposits.find(d => d.chest_id === chest.id)
            const deposited = deposit?.hachi_deposited || 0
            const progress = (deposited / chest.hachi_cost) * 100
            const config = CHEST_CONFIGS.find(c => c.tier === chest.tier)
            
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
                      <span className="text-xs text-muted-foreground">HACHI</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span>{formatNumber(deposited)} / {formatNumber(chest.hachi_cost)}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Deposit buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 50, 100].map(percent => {
                      const amount = Math.floor(chest.hachi_cost * (percent / 100))
                      const remaining = chest.hachi_cost - deposited
                      const depositAmount = Math.min(amount, remaining)
                      
                      return (
                        <Button
                          key={percent}
                          variant="outline"
                          size="sm"
                          disabled={depositing === chest.id || !user || user.profile.hachi_balance < depositAmount || remaining <= 0}
                          onClick={() => handleDeposit(chest, depositAmount)}
                        >
                          {depositing === chest.id ? '...' : `+${formatNumber(depositAmount)}`}
                        </Button>
                      )
                    })}
                  </div>
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
                <p className="text-sm text-muted-foreground">Abre cofres para conseguirlos</p>
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
