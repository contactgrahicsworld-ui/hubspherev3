const TOKEN_KEY = 'hs-token'
const REFRESH_TOKEN_KEY = 'hs-refresh-token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

export function getUserInfo(): { name: string; email: string; role: string } | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('hs-user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as { name: string; email: string; role: string }
  } catch {
    return null
  }
}

export function setUserInfo(user: { name: string; email: string; role: string }): void {
  localStorage.setItem('hs-user', JSON.stringify(user))
}

export function clearUserInfo(): void {
  localStorage.removeItem('hs-user')
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearTokens()
    clearUserInfo()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (response.status === 403) {
    const { toast } = await import('sonner').then((m) => m)
    toast.error('You do not have permission to perform this action')
    throw new Error('Forbidden')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }))
    // Handle both { error: { message } } and { error: 'string' } formats
    const msg =
      (body.error && typeof body.error === 'object' ? body.error.message : null) ||
      (typeof body.error === 'string' ? body.error : null) ||
      body.message ||
      `Request failed with status ${response.status}`
    throw new Error(msg)
  }

  return response.json() as Promise<T>
}
