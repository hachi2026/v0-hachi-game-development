// Hachi Hub Game Configuration
// All economic values and level configurations

// ============================================
// TOKEN SYSTEM
// ============================================
// HACHI: Token principal - agua, cofres, ranking
// KOBAN: Token secundario - produccion, staking rewards

// Base daily claim amount (HACHI KOBAN production)
export const BASE_DAILY_CLAIM = 100 // HACHI KOBAN tokens

// Water cost (HACHI) - INDISPENSABLE para producir
export const DAILY_WATER_COST = 100 // HACHI tokens required daily
export const WATER_COST = DAILY_WATER_COST // Alias

// ============================================
// TEMPORADA (3 MESES)
// ============================================
export const SEASON_DURATION_DAYS = 90

// ============================================
// LEVEL CONFIGS (20 niveles)
// ============================================
export interface LevelConfig {
  level: number
  wldCost: number
  dailyBonus: number
  totalDailyProduction: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const LEVEL_CONFIGS: LevelConfig[] = Array.from({ length: 20 }, (_, i) => {
  const level = i + 1
  let wldCost: number
  let bonusPerLevel: number
  let rarity: 'common' | 'rare' | 'epic' | 'legendary'

  if (level <= 10) {
    wldCost = 2
    bonusPerLevel = 100
    rarity = 'common'
  } else if (level <= 15) {
    wldCost = 5
    bonusPerLevel = 250
    rarity = 'rare'
  } else if (level <= 18) {
    wldCost = 7
    bonusPerLevel = 400
    rarity = 'epic'
  } else {
    wldCost = 10
    bonusPerLevel = 600
    rarity = 'legendary'
  }

  let totalBonus = 0
  for (let l = 2; l <= level; l++) {
    if (l <= 10) totalBonus += 100
    else if (l <= 15) totalBonus += 250
    else if (l <= 18) totalBonus += 400
    else totalBonus += 600
  }

  return {
    level,
    wldCost,
    dailyBonus: bonusPerLevel,
    totalDailyProduction: BASE_DAILY_CLAIM + totalBonus,
    rarity,
  }
})

export const MAX_LEVEL = 20

// ============================================
// FOOD PACKS (Producen KOBAN)
// ============================================
// Formula: (WLD_VALUE * KOBAN_RATE - 20%) / DAYS = KOBAN diario bonus
export const KOBAN_PER_WLD = 1000 // Tasa de conversion

export interface FoodPack {
  id: string
  days: number
  wldCost: number
  kobanValue: number // Valor en KOBAN antes del 20%
  totalKobanValue: number // Alias
  dailyKobanReward: number // KOBAN diario despues del 20%
  label: string
  description: string
}

export const FOOD_PACKS: FoodPack[] = [
  {
    id: 'pack_7',
    days: 7,
    wldCost: 1,
    kobanValue: 1000,
    totalKobanValue: 1000, // 1 WLD * 1000
    dailyKobanReward: Math.floor((1000 * 0.8) / 7), // 114 KOBAN/dia
    label: 'Pack Semanal',
    description: '7 dias de alimento + produccion KOBAN',
  },
  {
    id: 'pack_30',
    days: 30,
    wldCost: 3,
    kobanValue: 3000,
    totalKobanValue: 3000,
    dailyKobanReward: Math.floor((3000 * 0.8) / 30), // 80 KOBAN/dia
    label: 'Pack Mensual',
    description: '30 dias de alimento + produccion KOBAN',
  },
  {
    id: 'pack_90',
    days: 90,
    wldCost: 7,
    kobanValue: 7000,
    totalKobanValue: 7000,
    dailyKobanReward: Math.floor((7000 * 0.8) / 90), // 62 KOBAN/dia
    label: 'Pack Temporada',
    description: '90 dias de alimento + produccion KOBAN (mejor valor)',
  },
]

// ============================================
// MEMBERSHIP (10 WLD)
// ============================================
export const MEMBERSHIP_CONFIG = {
  wldCost: 10,
  durationDays: 90, // 3 meses
  apyBonus: 0.20, // +20% APY adicional (llega a 100%)
  upgradeDiscount: 0.10, // 10% descuento en mejoras de gatos
  hachiReturn: 0.60, // 60% del valor devuelto en HACHI
  hachiReturnPercent: 0.60, // Alias para compatibilidad
  // 60% de 10 WLD = 6 WLD en HACHI distribuido en 90 dias
  dailyHachiReturn: function(hachiPriceInWld: number) {
    const totalHachi = (this.wldCost * this.hachiReturn) / hachiPriceInWld
    return Math.floor(totalHachi / this.durationDays)
  }
}

// ============================================
// STAKING CONFIG (KOBAN -> KOBAN)
// ============================================
export const STAKING_CONFIG = {
  minLock: 100, // Minimum KOBAN to stake
  seasonDuration: SEASON_DURATION_DAYS, // 90 dias (3 meses)
  baseAPY: 0.60, // 60% base APY anual
  maxAPY: 0.80, // 80% max APY sin membresia
  maxAPYWithMembership: 1.00, // 100% max APY con membresia
  membershipAPYBonus: 0.20, // +20% bonus con membresia
  apyBonusPerLevel: 0.02, // 2% bonus por nivel de gato arriba de 10
}

// Calculate APY based on cat level and membership
export function calculateAPY(catLevel: number, hasMembership: boolean = false): number {
  let baseAPY = STAKING_CONFIG.baseAPY
  
  // Bonus por nivel de gato
  if (catLevel > 10) {
    const bonusLevels = catLevel - 10
    baseAPY += bonusLevels * STAKING_CONFIG.apyBonusPerLevel
  }
  
  // Cap segun membresia
  const maxAPY = hasMembership ? STAKING_CONFIG.maxAPYWithMembership : STAKING_CONFIG.maxAPY
  return Math.min(baseAPY, maxAPY)
}

// ============================================
// CHEST CONFIG (5 cuotas, 5 dias)
// ============================================
export const CHEST_CONFIG = {
  totalDeposits: 5, // 5 cuotas
  revealDays: 5, // Se revela despues de 5 dias
  depositCountsAsTask: true, // Cada deposito cuenta como tarea diaria
}

export interface ChestTier {
  tier: 'basico' | 'avanzado' | 'premium' | 'exclusivo'
  name: string
  totalHachiCost: number
  depositPerDay: number // totalHachiCost / 5
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const CHEST_TIERS: ChestTier[] = [
  { 
    tier: 'basico', 
    name: 'Cofre Basico', 
    totalHachiCost: 500, 
    depositPerDay: 100,
    rarity: 'common' 
  },
  { 
    tier: 'avanzado', 
    name: 'Cofre Avanzado', 
    totalHachiCost: 2500, 
    depositPerDay: 500,
    rarity: 'rare' 
  },
  { 
    tier: 'premium', 
    name: 'Cofre Premium', 
    totalHachiCost: 10000, 
    depositPerDay: 2000,
    rarity: 'epic' 
  },
  { 
    tier: 'exclusivo', 
    name: 'Cofre Exclusivo', 
    totalHachiCost: 50000, 
    depositPerDay: 10000,
    rarity: 'legendary' 
  },
]

// Alias for compatibility
export const CHEST_CONFIGS = CHEST_TIERS

// ============================================
// REFERRAL SYSTEM
// ============================================
export const REFERRAL_CONFIG = {
  signupBonus: 1000, // HACHI para el referido
  referrerBonus: 1000, // HACHI para el referidor
  // Bonos adicionales por rango
  rankBonuses: {
    bronze: { referrals: 5, bonus: 2000 },
    silver: { referrals: 15, bonus: 5000 },
    gold: { referrals: 30, bonus: 15000 },
    platinum: { referrals: 50, bonus: 30000 },
    diamond: { referrals: 100, bonus: 100000 },
  }
}

// REFERRAL_RANKS for UI compatibility
export const REFERRAL_RANKS = [
  { rank: 1, name: 'Novato', referrals_needed: 0, bonus_hachi: 0 },
  { rank: 2, name: 'Bronze', referrals_needed: 5, bonus_hachi: 2000 },
  { rank: 3, name: 'Silver', referrals_needed: 15, bonus_hachi: 5000 },
  { rank: 4, name: 'Gold', referrals_needed: 30, bonus_hachi: 15000 },
  { rank: 5, name: 'Platinum', referrals_needed: 50, bonus_hachi: 30000 },
  { rank: 6, name: 'Diamond', referrals_needed: 100, bonus_hachi: 100000 },
]

// Recompensas por referido - niveles del amigo
export const REFERRAL_REWARDS = {
  signup: 1000, // Amigo se une
  level_5: 5000, // Amigo alcanza nivel 5
  level_10: 10000, // Amigo alcanza nivel 10
}

// ============================================
// WATER PACKS (Agua por dias)
// ============================================
export const WATER_PACKS = [
  { days: 1, hachiCost: 100, label: '1 Dia' },
  { days: 7, hachiCost: 600, label: '7 Dias' }, // 100*7*0.85
  { days: 30, hachiCost: 2400, label: '30 Dias' }, // 100*30*0.80
  { days: 90, hachiCost: 6750, label: 'Temporada' }, // 100*90*0.75
]

// ============================================
// RANKING POINTS
// ============================================
// Todos los HACHI ganados suman al ranking
export const RANKING_POINTS = {
  dailyClaim: 10,
  waterPurchase: 5, // Pagar agua diaria
  chestDeposit: 20, // Cada deposito de cofre (5 por cofre)
  chestOpen: 100, // Abrir cofre (despues de 5 dias)
  missionComplete: 25,
  adWatch: 15,
  referral: 100,
  catUpgrade: 75,
  equipAccessory: 10,
  stakingDeposit: 10, // Por cada 100 KOBAN
  foodPackPurchase: 50, // Comprar pack de comida
  membershipPurchase: 500, // Comprar membresia
}

// Pool progresiva - mas puntos = mas % del pool
export const RANKING_POOL_TIERS = [
  { minPoints: 0, poolShare: 0.01 }, // 1% del pool
  { minPoints: 1000, poolShare: 0.02 },
  { minPoints: 5000, poolShare: 0.05 },
  { minPoints: 15000, poolShare: 0.10 },
  { minPoints: 30000, poolShare: 0.15 },
  { minPoints: 50000, poolShare: 0.20 },
]

// ============================================
// ACCESSORIES
// ============================================
export type AccessoryType = 'gafas' | 'gorro' | 'pantalon' | 'peine' | 'arenero' | 'casa'
export type AccessoryTier = 'basico' | 'avanzado' | 'premium' | 'exclusivo'

export interface AccessoryConfig {
  type: AccessoryType
  label: string
  icon: string
  tiers: {
    [key in AccessoryTier]: {
      name: string
      dailyProduction: number
      rarity: 'common' | 'rare' | 'epic' | 'legendary'
    }
  }
}

export const ACCESSORY_CONFIGS: AccessoryConfig[] = [
  {
    type: 'gafas',
    label: 'Gafas',
    icon: 'glasses',
    tiers: {
      basico: { name: 'Gafas Simples', dailyProduction: 1, rarity: 'common' },
      avanzado: { name: 'Gafas de Sol', dailyProduction: 3, rarity: 'rare' },
      premium: { name: 'Gafas Doradas', dailyProduction: 8, rarity: 'epic' },
      exclusivo: { name: 'Gafas de Diamante', dailyProduction: 20, rarity: 'legendary' },
    },
  },
  {
    type: 'gorro',
    label: 'Gorro',
    icon: 'crown',
    tiers: {
      basico: { name: 'Gorro de Lana', dailyProduction: 1, rarity: 'common' },
      avanzado: { name: 'Gorro Elegante', dailyProduction: 3, rarity: 'rare' },
      premium: { name: 'Sombrero de Copa', dailyProduction: 8, rarity: 'epic' },
      exclusivo: { name: 'Corona Real', dailyProduction: 20, rarity: 'legendary' },
    },
  },
  {
    type: 'pantalon',
    label: 'Pantalon',
    icon: 'shirt',
    tiers: {
      basico: { name: 'Pantalon Casual', dailyProduction: 2, rarity: 'common' },
      avanzado: { name: 'Pantalon Deportivo', dailyProduction: 5, rarity: 'rare' },
      premium: { name: 'Pantalon Elegante', dailyProduction: 12, rarity: 'epic' },
      exclusivo: { name: 'Pantalon Real', dailyProduction: 30, rarity: 'legendary' },
    },
  },
  {
    type: 'peine',
    label: 'Peine',
    icon: 'sparkles',
    tiers: {
      basico: { name: 'Peine Basico', dailyProduction: 1, rarity: 'common' },
      avanzado: { name: 'Cepillo Suave', dailyProduction: 4, rarity: 'rare' },
      premium: { name: 'Cepillo Premium', dailyProduction: 10, rarity: 'epic' },
      exclusivo: { name: 'Cepillo de Oro', dailyProduction: 25, rarity: 'legendary' },
    },
  },
  {
    type: 'arenero',
    label: 'Arenero',
    icon: 'box',
    tiers: {
      basico: { name: 'Arenero Simple', dailyProduction: 3, rarity: 'common' },
      avanzado: { name: 'Arenero Cubierto', dailyProduction: 7, rarity: 'rare' },
      premium: { name: 'Arenero Automatico', dailyProduction: 15, rarity: 'epic' },
      exclusivo: { name: 'Arenero Inteligente', dailyProduction: 40, rarity: 'legendary' },
    },
  },
  {
    type: 'casa',
    label: 'Casa',
    icon: 'home',
    tiers: {
      basico: { name: 'Casa Carton', dailyProduction: 5, rarity: 'common' },
      avanzado: { name: 'Casa Madera', dailyProduction: 12, rarity: 'rare' },
      premium: { name: 'Casa Moderna', dailyProduction: 25, rarity: 'epic' },
      exclusivo: { name: 'Mansion Felina', dailyProduction: 60, rarity: 'legendary' },
    },
  },
]

// ============================================
// HELPER FUNCTIONS
// ============================================
export function getLevelConfig(level: number): LevelConfig {
  return LEVEL_CONFIGS[Math.min(level, MAX_LEVEL) - 1]
}

export function getDailyProduction(level: number, hasFoodBonus: boolean = false): number {
  const config = getLevelConfig(level)
  return config.totalDailyProduction
}

export function getUpgradeCost(currentLevel: number, hasMembership: boolean = false): number {
  if (currentLevel >= MAX_LEVEL) return 0
  const baseCost = getLevelConfig(currentLevel + 1).wldCost
  if (hasMembership) {
    return baseCost * (1 - MEMBERSHIP_CONFIG.upgradeDiscount)
  }
  return baseCost
}

export function getRarityFromLevel(level: number): 'common' | 'rare' | 'epic' | 'legendary' {
  if (level <= 10) return 'common'
  if (level <= 15) return 'rare'
  if (level <= 18) return 'epic'
  return 'legendary'
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return 'text-gray-400'
    case 'rare': return 'text-blue-400'
    case 'epic': return 'text-purple-400'
    case 'legendary': return 'text-amber-400'
    default: return 'text-gray-400'
  }
}

export function getRarityBgColor(rarity: string): string {
  switch (rarity) {
    case 'common': return 'bg-gray-500/20'
    case 'rare': return 'bg-blue-500/20'
    case 'epic': return 'bg-purple-500/20'
    case 'legendary': return 'bg-amber-500/20'
    default: return 'bg-gray-500/20'
  }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

export function getChestTier(tier: string): ChestTier | undefined {
  return CHEST_TIERS.find(c => c.tier === tier)
}

export function getFoodPack(id: string): FoodPack | undefined {
  return FOOD_PACKS.find(p => p.id === id)
}

export function getReferralRank(referralCount: number): string {
  const { rankBonuses } = REFERRAL_CONFIG
  if (referralCount >= rankBonuses.diamond.referrals) return 'diamond'
  if (referralCount >= rankBonuses.platinum.referrals) return 'platinum'
  if (referralCount >= rankBonuses.gold.referrals) return 'gold'
  if (referralCount >= rankBonuses.silver.referrals) return 'silver'
  if (referralCount >= rankBonuses.bronze.referrals) return 'bronze'
  return 'none'
}
