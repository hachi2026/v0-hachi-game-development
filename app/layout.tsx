import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { HachiProvider } from '@/lib/hachi-context'
import { MiniKitProvider } from '@/lib/minikit-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Hachi Hub - Cuida tu Hachi y gana HACHI tokens',
  description: 'Cuida a tu Hachi, aliméntalo y gana HACHI todos los días. Conecta con World ID y mejora tu mascota virtual.',
  generator: 'v0.app',
  keywords: ['Hachi', 'crypto', 'pet', 'tokens', 'World ID', 'WLD'],
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1625',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark">
      <body className="font-sans antialiased bg-background min-h-screen">
        <MiniKitProvider>
          <HachiProvider>
            {children}
          </HachiProvider>
        </MiniKitProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
