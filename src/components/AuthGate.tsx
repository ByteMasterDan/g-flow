import { useState, useEffect, createContext, useContext, useCallback } from 'react'

declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler: <T>(callback: (result: T) => void) => {
            withFailureHandler: (callback: (error: Error) => void) => {
              [key: string]: (...args: unknown[]) => void
            }
          }
          [key: string]: (...args: unknown[]) => void
        }
      }
    }
  }
}

export interface UserProfile {
  authenticated: boolean
  email: string | null
  role: string | null
  displayName: string | null
  skills: string[]
  token: string | null
}

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  login: (token: string, user: { email: string; role: string; displayName: string; skills: string[] }) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function callGAS<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const run = window.google?.script?.run
      if (!run) {
        reject(new Error('Not running inside Google Apps Script'))
        return
      }

      run.withSuccessHandler((result: { success: boolean; data: T; error: string | null }) => {
          if (result && result.success && result.data) {
            resolve(result.data)
          } else {
            const errMsg = result?.data?.error || result?.error || 'Unknown error'
            reject(new Error(errMsg))
          }
        })
        .withFailureHandler((error: Error) => reject(error))
        .apiCall(JSON.stringify({ action, params }))
    } catch (e) {
      reject(e)
    }
  })
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem('gflow_token')
  } catch {
    return null
  }
}

function storeToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('gflow_token', token)
    } else {
      localStorage.removeItem('gflow_token')
    }
  } catch {
    // Ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const checkSession = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const result = await callGAS<{ authenticated: boolean; email?: string; role?: string; displayName?: string; skills?: string[] }>(
        'getSession',
        { token }
      )

      if (result.authenticated) {
        setUser({
          authenticated: true,
          email: result.email || null,
          role: result.role || null,
          displayName: result.displayName || null,
          skills: result.skills || [],
          token: token,
        })
      } else {
        storeToken(null)
        setUser(null)
      }
    } catch {
      storeToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = (token: string, userData: { email: string; role: string; displayName: string; skills: string[] }) => {
    storeToken(token)
    setUser({
      authenticated: true,
      email: userData.email,
      role: userData.role,
      displayName: userData.displayName,
      skills: userData.skills || [],
      token: token,
    })
  }

  const logout = () => {
    const token = user?.token
    if (token) {
      callGAS('logout', { token }).catch(() => {})
    }
    storeToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function hasPermission(role: string | null, permission: string): boolean {
  const permissions: Record<string, string[]> = {
    Admin: ['approve', 'create', 'view', 'manage', 'delete'],
    SuperApprover: ['approve', 'view', 'create'],
    Approver: ['approve', 'view'],
    Operator: ['create', 'view', 'submit'],
  }
  if (!role) return false
  return permissions[role]?.includes(permission) || false
}