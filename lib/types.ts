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
  has_membership: boolean
  membership_expires_at: string | null
  membership_hachi_claimed: number
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
  water_expires_at: string | null
  last_claim_at: string | null
  last_water_at: string | null
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
  installments: number // 5 cuotas
  image_url: string | null
  created_at: string
}

export interface ChestDeposit {
  id: string
  user_id: string
  chest_id: string
  hachi_deposited: number
  installments_paid: number // cuotas pagadas (max 5)
  started_at: string
  reveals_at: string | null // 5 dias despues de completar
  completed: boolean
  revealed: boolean
  accessory_won: string | null
  chest?: Chest
  accessory?: Accessory
}

export interface Season {
  id: string
  name: string
  starts_at: string
  ends_at: string
  duration_days: number // 90 dias
  total_reward_pool: number
  is_active: boolean
  created_at: string
}

export interface Staking {
  id: string
  user_id: string
  season_id: string
  koban_locked: number // Ahora es KOBAN, no HACHI
  locked_at: string
  last_claim_at: string | null
  unlocked_at: string | null
  reward_claimed: number
  is_active: boolean
}

export interface HachiLock {
  id: string
  user_id: string
  hachi_locked: number
  locked_at: string
  last_claim_at: string | null
  is_active: boolean
  total_claimed: number
  created_at: string
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
  chests_opened: number
  chest_deposits: number
  cats_fed: number
  cats_upgraded: number
  staking_deposits: number
  last_activity: string
  profile?: Profile
}

export interface Advertisement {
  id: string
  advertiser_name: string
  image_url: string
  link_url: string
  platform: 'youtube' | 'telegram' | 'x' | 'link'
  wld_paid: number
  hachi_reward: number
  views_remaining: number
  is_active: boolean
  submitted_by: string | null
  created_at: string
}

export interface AdView {
  id: string
  user_id: string
  ad_id: string
  hachi_earned: number
  viewed_at: string
}

// Food Packs - producen KOBAN
export interface FoodPack {
  id: string
  name: string
  days: 30 | 60 | 90
  wld_cost: number
  koban_value: number // valor total en KOBAN
  daily_koban: number // koban por dia (valor - 20% / dias)
}

export interface FoodPurchase {
  id: string
  user_id: string
  hachi_id: string
  pack_id: string
  days_purchased: 30 | 60 | 90
  wld_cost: number
  total_koban: number
  daily_koban: number
  koban_claimed: number
  purchased_at: string
  expires_at: string
}

// Water - 100 HACHI/dia
export interface WaterPurchase {
  id: string
  user_id: string
  hachi_id: string
  hachi_cost: number // 100 HACHI
  purchased_at: string
  expires_at: string // 24 horas
}

export interface UpgradePurchase {
  id: string
  user_id: string
  hachi_id: string
  from_level: number
  to_level: number
  wld_cost: number
  discount_applied: number // 10% con membresia
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
  accessory_bonus: number
  total_koban_claimed: number
  claimed_at: string
}

// Referrals - 1000 HACHI para ambos
export interface Referral {
  id: string
  referrer_id: string
  referred_id: string
  referrer_reward: number // 1000 HACHI
  referred_reward: number // 1000 HACHI
  rank_bonus: number // bonus por rango
  rewarded_at: string
}

export interface ReferralRank {
  rank: number
  name: string
  referrals_needed: number
  bonus_hachi: number
}

// Membership - 10 WLD
export interface Membership {
  id: string
  user_id: string
  wld_paid: number // 10 WLD
  hachi_return_total: number // 60% del valor en HACHI
  hachi_return_daily: number // distribuido en 90 dias
  hachi_claimed: number
  apy_bonus: number // +20% APY
  upgrade_discount: number // 10% descuento
  started_at: string
  expires_at: string // 90 dias
}

export interface UserData {
  profile: Profile
  hachi: Hachi
  canClaim: boolean
  canWater: boolean
  dailyProduction: number
  foodProduction: number
  energyDaysRemaining: number
  accessories: UserAccessory[]
  accessoryProduction: number
  membership: Membership | null
  activeFoodPack: FoodPurchase | null
}

export type TabType = 'home' | 'hachi' | 'tienda' | 'misiones' | 'perfil' | 'ranking' | 'staking' | 'accesorios' | 'referidos'
