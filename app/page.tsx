'use client'

import { useHachi } from '@/lib/hachi-context'
import { AuthScreen } from '@/components/auth-screen'
import { Header } from '@/components/header'
import { BottomNav } from '@/components/bottom-nav'
import { HomeTab } from '@/components/tabs/home-tab'
import { HachiTab } from '@/components/tabs/hachi-tab'
import { TiendaTab } from '@/components/tabs/tienda-tab'
import { MisionesTab } from '@/components/tabs/misiones-tab'
import { PerfilTab } from '@/components/tabs/perfil-tab'
import { Spinner } from '@/components/ui/spinner'

export default function HomePage() {
  const { user, loading, error, activeTab } = useHachi()

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
          <span className="text-2xl">🐱</span>
        </div>
        <Spinner className="w-8 h-8 text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Cargando Hachi Hub...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-primary underline"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  // Not authenticated - show auth screen
  if (!user) {
    return <AuthScreen />
  }

  // Authenticated - show main app
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-md mx-auto">
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'hachi' && <HachiTab />}
        {activeTab === 'tienda' && <TiendaTab />}
        {activeTab === 'misiones' && <MisionesTab />}
        {activeTab === 'perfil' && <PerfilTab />}
      </main>

      <BottomNav />
    </div>
  )
}
