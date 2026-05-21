'use client'

import { ReactNode, useEffect } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'

export function MiniKitProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    MiniKit.install()
  }, [])

  return <>{children}</>
}

// Hook to check if MiniKit is available
export function useMiniKit() {
  const isInstalled = MiniKit.isInstalled()
  
  return {
    isInstalled,
    minikit: MiniKit,
  }
}
