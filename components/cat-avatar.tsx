'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CatAvatarProps {
  level: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showGlow?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
}

const glowClasses = {
  common: '',
  rare: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
  epic: 'shadow-[0_0_25px_rgba(168,85,247,0.5)]',
  legendary: 'shadow-[0_0_30px_rgba(251,191,36,0.6)]',
}

const borderClasses = {
  common: 'border-gray-500/30',
  rare: 'border-blue-500/50',
  epic: 'border-purple-500/50',
  legendary: 'border-amber-500/60',
}

export function CatAvatar({ level, rarity, size = 'lg', showGlow = true, className }: CatAvatarProps) {
  // Calculate cat image index based on level (1-30)
  const catIndex = Math.min(level, 30)
  
  return (
    <div 
      className={cn(
        'relative rounded-2xl overflow-hidden border-2 bg-gradient-to-br from-card to-muted',
        sizeClasses[size],
        borderClasses[rarity],
        showGlow && glowClasses[rarity],
        className
      )}
    >
      <Image
        src={`/cats/cat-${catIndex}.jpg`}
        alt={`Hachi Nivel ${level}`}
        fill
        className="object-cover"
        priority={size === 'xl' || size === 'lg'}
      />
      
      {/* Rarity badge */}
      {size !== 'sm' && (
        <div className={cn(
          'absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
          rarity === 'common' && 'bg-gray-500/80 text-gray-100',
          rarity === 'rare' && 'bg-blue-500/80 text-blue-100',
          rarity === 'epic' && 'bg-purple-500/80 text-purple-100',
          rarity === 'legendary' && 'bg-amber-500/80 text-amber-100',
        )}>
          {rarity === 'legendary' ? 'LEG' : rarity.slice(0, 3).toUpperCase()}
        </div>
      )}
    </div>
  )
}

// Placeholder component when cat images aren't loaded yet
export function CatAvatarPlaceholder({ size = 'lg', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  return (
    <div 
      className={cn(
        'relative rounded-2xl overflow-hidden border-2 border-border bg-gradient-to-br from-card to-muted flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      <div className="text-4xl">🐱</div>
    </div>
  )
}
