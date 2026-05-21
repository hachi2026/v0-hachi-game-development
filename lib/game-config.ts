// Hachi Hub Game Configuration
// All economic values and level configurations

// Base daily claim amount (HACHI KOBAN production)
export const BASE_DAILY_CLAIM = 100 // HACHI KOBAN tokens
export const DAILY_FOOD_COST = 100 // HACHI tokens required for feeding

// Level configurations (20 levels)
// Levels 1-10: Common (2 WLD each, +100 KOBAN/day)
// Levels 11-15: Rare (5 WLD each, +250 KOBAN/day)
// Levels 16-18: Epic (7 WLD each, +400 KOBAN/day)
// Levels 19-20: Legendary (10 WLD each, +600 KOBAN/day)

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

  // Calculate cumulative daily bonus
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

// Accessory types and tiers
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

// Chest configurations for gacha system
export interface ChestConfig {
  tier: AccessoryTier
  name: string
  hachiCost: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const CHEST_CONFIGS: ChestConfig[] = [
  { tier: 'basico', name: 'Cofre Basico', hachiCost: 100, rarity: 'common' },
  { tier: 'avanzado', name: 'Cofre Avanzado', hachiCost: 500, rarity: 'rare' },
  { tier: 'premium', name: 'Cofre Premium', hachiCost: 2000, rarity: 'epic' },
  { tier: 'exclusivo', name: 'Cofre Exclusivo', hachiCost: 10000, rarity: 'legendary' },
]

// Food pack configurations
export interface FoodPack {
  days: 30 | 60 | 90
  wldCost: number
  bonusTokens: number
  dailyBonusFromFood: number
  label: string
  description: string
}

export const FOOD_PACKS: FoodPack[] = [
  {
    days: 30,
    wldCost: 5,
    bonusTokens: 0,
    dailyBonusFromFood: 0,
    label: 'Pack 30 Dias',
    description: 'Produccion continua durante 30 dias',
  },
  {
    days: 60,
    wldCost: 10,
    bonusTokens: 0,
    dailyBonusFromFood: 0,
    label: 'Pack 60 Dias',
    description: 'Produccion continua durante 60 dias',
  },
  {
    days: 90,
    wldCost: 15,
    bonusTokens: 200000,
    dailyBonusFromFood: Math.floor(200000 / 90),
    label: 'Pack 90 Dias',
    description: 'Produccion continua + 50% bonus en tokens',
  },
]

// Daily food (single day)
export const DAILY_FOOD = {
  days: 1,
  hachiCost: 100,
  label: 'Alimento Diario',
  description: 'Mantiene 1 dia de produccion',
}

// Referral rewards
export const REFERRAL_REWARDS = {
  signup: 100,
  level_5: 200,
  level_10: 500,
}

// Staking APY by lock duration
export const STAKING_CONFIG = {
  minLock: 1000, // Minimum HACHI to lock
  seasonDuration: 30, // days
  rewardMultiplier: 1.5, // 50% bonus for full season lock
}

// Ranking points
export const RANKING_POINTS = {
  dailyClaim: 10,
  missionComplete: 25,
  adWatch: 5,
  referral: 100,
  catUpgrade: 50,
}

// Cat images mapping (20 unique cats)
export const CAT_RARITIES = {
  common: { min: 1, max: 10, color: 'gray' },
  rare: { min: 11, max: 15, color: 'blue' },
  epic: { min: 16, max: 18, color: 'purple' },
  legendary: { min: 19, max: 20, color: 'gold' },
}

// Helper functions
export function getLevelConfig(level: number): LevelConfig {
  return LEVEL_CONFIGS[Math.min(level, MAX_LEVEL) - 1]
}

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 0
  return getLevelConfig(currentLevel + 1).wldCost
}

export function getDailyProduction(level: number, hasFoodBonus: boolean = false): number {
  const config = getLevelConfig(level)
  let production = config.totalDailyProduction
  if (hasFoodBonus) {
    production += FOOD_PACKS[2].dailyBonusFromFood
  }
  return production
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
