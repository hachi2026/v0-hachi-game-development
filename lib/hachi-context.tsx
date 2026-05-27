'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Hachi, UserData, TabType, UserAccessory, Season, Ranking } from '@/lib/types'
import { getDailyProduction, FOOD_PACKS } from '@/lib/game-config'

interface HachiContextType {
  user: UserData | null
  loading: boolean
  error: string | null
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  refreshUser: () => Promise<void>
  updateBalance: (amount: number, token?: 'hachi' | 'koban') => void
  updateRankingPoints: (points: number) => void
  signOut: () => Promise<void>
  currentSeason: Season | null
  userRanking: Ranking | null
}

const HachiContext = createContext<HachiContextType | undefined>(undefined)

export function HachiProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('home')
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
  const [userRanking, setUserRanking] = useState<Ranking | null>(null)
  
  const supabase = createClient()

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        setUser(null)
        setLoading(false)
        return
      }

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError) throw profileError

      // Fetch hachi
      const { data: hachi, error: hachiError } = await supabase
        .from('hachis')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .single()

      if (hachiError) throw hachiError

      // Fetch user accessories with accessory details
      const { data: userAccessories } = await supabase
        .from('user_accessories')
        .select(`
          *,
          accessory:accessories(*)
        `)
        .eq('user_id', authUser.id)

      // Calculate accessory production (KOBAN from equipped accessories)
      let accessoryProduction = 0
      if (userAccessories) {
        for (const ua of userAccessories) {
          if (ua.hachi_id && ua.accessory) {
            accessoryProduction += ua.accessory.daily_production
          }
        }
      }

      // Fetch current active season
      const { data: season } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .single()

      if (season) {
        setCurrentSeason(season as Season)

        // Fetch user ranking for current season
        const { data: ranking } = await supabase
          .from('rankings')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('season_id', season.id)
          .single()

        if (ranking) {
          setUserRanking(ranking as Ranking)
        }
      }

      // Calculate if user can claim
      const now = new Date()
      const lastClaim = hachi.last_claim_at ? new Date(hachi.last_claim_at) : null
      const canClaim = !lastClaim || (now.getTime() - lastClaim.getTime()) >= 24 * 60 * 60 * 1000

      // Check energy
      const energyExpires = hachi.energy_expires_at ? new Date(hachi.energy_expires_at) : null
      const hasEnergy = energyExpires && energyExpires > now
      const energyDaysRemaining = hasEnergy 
        ? Math.ceil((energyExpires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : 0

      // Check if user has 90-day food bonus
      const { data: foodPurchases } = await supabase
        .from('food_purchases')
        .select('*')
        .eq('hachi_id', hachi.id)
        .eq('days_purchased', 90)
        .gt('expires_at', now.toISOString())
        .limit(1)

      const hasFoodBonus = foodPurchases && foodPurchases.length > 0

      // Calculate daily production (KOBAN from cat level)
      const dailyProduction = getDailyProduction(hachi.level, hasFoodBonus ?? false)

      // Calculate water days remaining
      const waterDaysRemaining = hachi.water_expires_at 
        ? Math.max(0, Math.ceil((new Date(hachi.water_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0

      // Get active food pack
      const { data: activeFoodPack } = await supabase
        .from('food_purchases')
        .select('*')
        .eq('user_id', profile.id)
        .gt('expires_at', now.toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .single()

      // Get membership
      const { data: membership } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .single()

      // Calculate food production from active pack
      const foodProduction = activeFoodPack?.daily_koban || 0

      setUser({
        profile: {
          ...profile,
          hachi_koban_balance: profile.hachi_koban_balance || 0,
        } as Profile,
        hachi: hachi as Hachi,
        canClaim: !!(canClaim && hasEnergy),
        canWater: waterDaysRemaining > 0,
        dailyProduction,
        foodProduction,
        energyDaysRemaining,
        accessories: (userAccessories || []) as UserAccessory[],
        accessoryProduction,
        membership: membership || null,
        activeFoodPack: activeFoodPack || null,
      })
    } catch (err) {
      console.error('Error fetching user data:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const updateBalance = useCallback((amount: number, token: 'hachi' | 'koban' = 'hachi') => {
    setUser(prev => {
      if (!prev) return prev
      if (token === 'koban') {
        return {
          ...prev,
          profile: {
            ...prev.profile,
            hachi_koban_balance: prev.profile.hachi_koban_balance + amount,
          },
        }
      }
      return {
        ...prev,
        profile: {
          ...prev.profile,
          hachi_balance: prev.profile.hachi_balance + amount,
        },
      }
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setActiveTab('home')
  }, [supabase])

  const updateRankingPoints = useCallback(async (points: number) => {
    if (!user || !currentSeason) return
    
    try {
      // Update ranking points in database
      if (userRanking) {
        await supabase
          .from('rankings')
          .update({ points: userRanking.points + points })
          .eq('id', userRanking.id)
        
        setUserRanking(prev => prev ? { ...prev, points: prev.points + points } : null)
      } else {
        // Create new ranking entry
        const { data } = await supabase
          .from('rankings')
          .insert({
            user_id: user.profile.id,
            season_id: currentSeason.id,
            points: points
          })
          .select()
          .single()
        
        if (data) {
          setUserRanking(data as Ranking)
        }
      }
    } catch (error) {
      console.error('Error updating ranking points:', error)
    }
  }, [user, currentSeason, userRanking, supabase])

  useEffect(() => {
    fetchUserData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchUserData()
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchUserData, supabase.auth])

  return (
    <HachiContext.Provider value={{
      user,
      loading,
      error,
      activeTab,
      setActiveTab,
      refreshUser: fetchUserData,
      updateBalance,
      updateRankingPoints,
      signOut,
      currentSeason,
      userRanking,
    }}>
      {children}
    </HachiContext.Provider>
  )
}

export function useHachi() {
  const context = useContext(HachiContext)
  if (context === undefined) {
    throw new Error('useHachi must be used within a HachiProvider')
  }
  return context
}
