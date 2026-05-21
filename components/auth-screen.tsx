'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cat, Globe, Sparkles } from 'lucide-react'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 
              `${window.location.origin}/auth/callback`,
            data: {
              username: username || 'HachiLover',
            },
          },
        })
        if (error) throw error
        setSuccess('Revisa tu correo para confirmar tu cuenta')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo and Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mb-4">
          <Cat className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          HACHI HUB
        </h1>
        <p className="text-muted-foreground mt-2">
          Cuida tu Hachi y gana tokens todos los días
        </p>
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-sm border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <CardTitle>{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Únete y recibe tu primer Hachi gratis' 
              : 'Continúa cuidando a tu Hachi'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <Input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
            )}
            <div>
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-muted/50"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-muted/50"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            {success && (
              <p className="text-sm text-hachi-green text-center">{success}</p>
            )}

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Procesando...
                </span>
              ) : isSignUp ? 'Crear Cuenta' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setSuccess(null)
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignUp 
                ? '¿Ya tienes cuenta? Inicia sesión' 
                : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>

          {/* World ID Mock Button */}
          <div className="mt-6 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              disabled
            >
              <Globe className="w-4 h-4" />
              Verificar con World ID
              <span className="text-xs text-muted-foreground">(Próximamente)</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="mt-8 grid grid-cols-3 gap-4 max-w-sm w-full">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Cat className="w-6 h-6 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Cuida tu mascota</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-2">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <p className="text-xs text-muted-foreground">Gana tokens</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-hachi-gold/10 flex items-center justify-center mb-2">
            <Globe className="w-6 h-6 text-hachi-gold" />
          </div>
          <p className="text-xs text-muted-foreground">World Chain</p>
        </div>
      </div>
    </div>
  )
}
