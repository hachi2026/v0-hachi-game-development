// Hachi Hub Game Configuration
// All economic values and level configurations

// Base daily claim amount
export const BASE_DAILY_CLAIM = 110 // HACHI tokens
export const DAILY_FOOD_COST = 100 // HACHI tokens required for feeding

// Level configurations (30 levels)
// Levels 1-10: 2 WLD each, +100 HACHI bonus per level
// Levels 11-20: 5 WLD each, +250 HACHI bonus per level  
// Levels 21-30: 10 WLD each, +500 HACHI bonus per level

export interface LevelConfig {
  level: number
  wldCost: number
  dailyBonus: number
  totalDailyProduction: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const LEVEL_CONFIGS: LevelConfig[] = Array.from({ length: 30 }, (_, i) => {
  const level = i + 1
  let wldCost: number
  let bonusPerLevel: number
  let rarity: 'common' | 'rare' | 'epic' | 'legendary'

  if (level <= 10) {
    wldCost = 2
    bonusPerLevel = 100
    rarity = 'common'
  } else if (level <= 20) {
    wldCost = 5
    bonusPerLevel = 250
    rarity = level <= 15 ? 'rare' : 'epic'
  } else {
    wldCost = 10
    bonusPerLevel = 500
    rarity = level <= 25 ? 'epic' : 'legendary'
  }

  // Calculate cumulative daily bonus
  let totalBonus = 0
  for (let l = 2; l <= level; l++) {
    if (l <= 10) totalBonus += 100
    else if (l <= 20) totalBonus += 250
    else totalBonus += 500
  }

  return {
    level,
    wldCost,
    dailyBonus: bonusPerLevel,
    totalDailyProduction: BASE_DAILY_CLAIM + totalBonus,
    rarity,
  }
})

// Food pack configurations
export interface FoodPack {
  days: 30 | 60 | 90
  wldCost: number
  bonusTokens: number
  dailyBonusFromFood: number
  label: string
  description: string
}

// Food costs and bonuses:
// 1 month (30 days) = 5 WLD
// 2 months (60 days) = 10 WLD  
// 3 months (90 days) = 15 WLD + 50% bonus (200,000 tokens / 90 days = ~2,222/day)
// Bonus calculation: 15 WLD = 400,000 value / 2 = 200,000 distributed over 90 days

export const FOOD_PACKS: FoodPack[] = [
  {
    days: 30,
    wldCost: 5,
    bonusTokens: 0,
    dailyBonusFromFood: 0,
    label: 'Pack 30 Días',
    description: 'Producción continua durante 30 días',
  },
  {
    days: 60,
    wldCost: 10,
    bonusTokens: 0,
    dailyBonusFromFood: 0,
    label: 'Pack 60 Días',
    description: 'Producción continua durante 60 días',
  },
  {
    days: 90,
    wldCost: 15,
    bonusTokens: 200000,
    dailyBonusFromFood: Math.floor(200000 / 90), // ~2,222 HACHI/day bonus
    label: 'Pack 90 Días',
    description: 'Producción continua + 50% bonus en tokens',
  },
]

// Daily food (single day)
export const DAILY_FOOD = {
  days: 1,
  hachiCost: 100,
  label: 'Alimento Diario',
  description: 'Mantiene 1 día de producción',
}

// Referral rewards
export const REFERRAL_REWARDS = {
  signup: 100, // +100 HACHI when friend signs up
  level_5: 200, // +200 HACHI when friend reaches level 5
  level_10: 500, // +500 HACHI when friend reaches level 10
}

// Cat images mapping (30 unique cats)
export const CAT_RARITIES = {
  common: { min: 1, max: 10, color: 'gray' },
  rare: { min: 11, max: 18, color: 'blue' },
  epic: { min: 19, max: 25, color: 'purple' },
  legendary: { min: 26, max: 30, color: 'gold' },
}

// Helper functions
export function getLevelConfig(level: number): LevelConfig {
  return LEVEL_CONFIGS[Math.min(level, 30) - 1]
}

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= 30) return 0
  return getLevelConfig(currentLevel + 1).wldCost
}

export function getDailyProduction(level: number, hasFoodBonus: boolean = false): number {
  const config = getLevelConfig(level)
  let production = config.totalDailyProduction
  if (hasFoodBonus) {
    production += FOOD_PACKS[2].dailyBonusFromFood // 90-day bonus
  }
  return production
}

export function getRarityFromLevel(level: number): 'common' | 'rare' | 'epic' | 'legendary' {
  if (level <= 10) return 'common'
  if (level <= 15) return 'rare'
  if (level <= 25) return 'epic'
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
