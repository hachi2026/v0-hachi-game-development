'use client'

import { Home, Cat, ShoppingBag, Target, User, Trophy, Lock, Package } from 'lucide-react'
import { useHachi } from '@/lib/hachi-context'
import type { TabType } from '@/lib/types'
import { cn } from '@/lib/utils'

const tabs: { id: TabType; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'hachi', label: 'Hachi', icon: Cat },
  { id: 'accesorios', label: 'Items', icon: Package },
  { id: 'misiones', label: 'Misiones', icon: Target },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
]

const secondaryTabs: { id: TabType; label: string; icon: typeof Home }[] = [
  { id: 'tienda', label: 'Tienda', icon: ShoppingBag },
  { id: 'staking', label: 'Staking', icon: Lock },
  { id: 'perfil', label: 'Perfil', icon: User },
]

export function BottomNav() {
  const { activeTab, setActiveTab } = useHachi()

  const isSecondaryActive = secondaryTabs.some(t => t.id === activeTab)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50">
      <div className="max-w-md mx-auto">
        {/* Main navigation */}
        <div className="flex items-center justify-around py-2 px-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200',
                activeTab === id
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Secondary navigation */}
        <div className="flex items-center justify-center gap-4 py-1.5 px-4 border-t border-border/50 bg-muted/30">
          {secondaryTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 text-xs',
                activeTab === id
                  ? 'text-primary bg-primary/10 font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
