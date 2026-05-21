'use client'

import { ReactNode, useEffect, useState } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'

export function MiniKitProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Only install MiniKit if we have an app_id configured
    const appId = process.env.NEXT_PUBLIC_WORLDCOIN_APP_ID
    if (appId) {
      MiniKit.install(appId)
    }
  }, [])

  return <>{children}</>
}

// Hook to check if MiniKit is available
export function useMiniKit() {
  const [isInstalled, setIsInstalled] = useState(false)
  
  useEffect(() => {
    setIsInstalled(MiniKit.isInstalled())
  }, [])
  
  return {
    isInstalled,
    minikit: MiniKit,
  }
}
