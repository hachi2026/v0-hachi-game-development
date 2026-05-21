// Hachi Hub Types

export interface Profile {
  id: string
  username: string | null
  referral_code: string
  referred_by: string | null
  hachi_balance: number
  hachi_koban_balance: number
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

export interface Accessory {
  id: string
  name: string
  type: 'gafas' | 'gorro' | 'pantalon' | 'peine' | 'arenero' | 'casa'
  tier: 'basico' | 'avanzado' | 'premium' | 'exclusivo'
  daily_production: number
  image_url: string | null
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  created_at: string
}

export interface UserAccessory {
  id: string
  user_id: string
  accessory_id: string
  hachi_id: string | null
  acquired_at: string
  accessory?: Accessory
}

export interface Chest {
  id: string
  name: string
  tier: 'basico' | 'avanzado' | 'premium' | 'exclusivo'
  hachi_cost: number
  image_url: string | null
  created_at: string
}

export interface ChestDeposit {
  id: string
  user_id: string
  chest_id: string
  hachi_deposited: number
  completed: boolean
  accessory_won: string | null
  created_at: string
  completed_at: string | null
  chest?: Chest
  accessory?: Accessory
}

export interface Season {
  id: string
  name: string
  starts_at: string
  ends_at: string
  total_reward_pool: number
  is_active: boolean
  created_at: string
}

export interface Staking {
  id: string
  user_id: string
  season_id: string
  hachi_locked: number
  locked_at: string
  unlocked_at: string | null
  reward_claimed: number
  is_active: boolean
}

export interface Ranking {
  id: string
  user_id: string
  season_id: string
  points: number
  claims_count: number
  missions_completed: number
  ads_watched: number
  referrals_count: number
  last_activity: string
  profile?: Profile
}

export interface Advertisement {
  id: string
  advertiser_name: string
  image_url: string
  link_url: string
  wld_paid: number
  hachi_reward: number
  views_remaining: number
  is_active: boolean
  created_at: string
}

export interface AdView {
  id: string
  user_id: string
  ad_id: string
  hachi_earned: number
  viewed_at: string
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
  accessories: UserAccessory[]
  accessoryProduction: number
}

export type TabType = 'home' | 'hachi' | 'tienda' | 'misiones' | 'perfil' | 'ranking' | 'staking' | 'accesorios'
