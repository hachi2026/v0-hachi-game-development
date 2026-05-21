'use client'

import { Home, Cat, ShoppingBag, Target, User } from 'lucide-react'
import { useHachi } from '@/lib/hachi-context'
import type { TabType } from '@/lib/types'
import { cn } from '@/lib/utils'

const tabs: { id: TabType; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'hachi', label: 'Hachi', icon: Cat },
  { id: 'tienda', label: 'Tienda', icon: ShoppingBag },
  { id: 'misiones', label: 'Misiones', icon: Target },
  { id: 'perfil', label: 'Perfil', icon: User },
]

export function BottomNav() {
  const { activeTab, setActiveTab } = useHachi()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50">
      <div className="max-w-md mx-auto flex items-center justify-around py-2 px-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
              activeTab === id
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
