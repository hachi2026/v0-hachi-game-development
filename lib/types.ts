// Hachi Hub Types

export interface Profile {
  id: string
  username: string | null
  referral_code: string
  referred_by: string | null
  hachi_balance: number
  wld_spent: number
  total_referrals: number
  created_at: string
  updated_at: string
}

export interface Hachi {
  id: string
  user_id: string
  name: string
  level: number
  cat_image_index: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  energy_days: number
  energy_expires_at: string | null
  last_claim_at: string | null
  total_production: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FoodPurchase {
  id: string
  user_id: string
  hachi_id: string
  days_purchased: 30 | 60 | 90
  wld_cost: number
  bonus_tokens: number
  purchased_at: string
  expires_at: string
}

export interface UpgradePurchase {
  id: string
  user_id: string
  hachi_id: string
  from_level: number
  to_level: number
  wld_cost: number
  daily_bonus_gained: number
  purchased_at: string
}

export interface DailyClaim {
  id: string
  user_id: string
  hachi_id: string
  base_amount: number
  level_bonus: number
  food_bonus: number
  total_claimed: number
  claimed_at: string
}

export interface ReferralReward {
  id: string
  referrer_id: string
  referred_id: string
  reward_type: 'signup' | 'level_5' | 'level_10'
  hachi_reward: number
  rewarded_at: string
}

export interface UserData {
  profile: Profile
  hachi: Hachi
  canClaim: boolean
  dailyProduction: number
  energyDaysRemaining: number
}

export type TabType = 'home' | 'hachi' | 'tienda' | 'misiones' | 'perfil'
