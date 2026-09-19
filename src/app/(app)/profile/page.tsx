'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  User,
  Lock,
  ShieldCheck,
  Monitor,
  Loader2,
  LogOut,
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  isSuperAdmin: boolean
  status: string
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  twoFactorEnabled: boolean
}

interface Membership {
  tenantId: string
  roleCode: string
  tenant: { id: string; name: string; slug: string; status: string }
}

interface Session {
  id: string
  deviceType: string
  deviceInfo: string
  createdAt: string
  expiresAt: string
}

interface ProfileData {
  user: UserProfile
  memberships: Membership[]
  sessions: Session[]
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)

  // Profile edit
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ success: boolean; data: ProfileData }>(
          '/api/v1/auth/profile'
        )
        if (res.success && res.data) {
          setProfile(res.data)
          setName(res.data.user.name)
          setAvatarUrl(res.data.user.avatarUrl ?? '')
          setTwoFactorEnabled(res.data.user.twoFactorEnabled)
        }
      } catch {
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSaveProfile() {
    setSaving(true)
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(
        '/api/v1/auth/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({ name, avatarUrl: avatarUrl || null }),
        }
      )
      if (res.success) {
        toast.success(res.message ?? 'Profile updated')
        // Update local user info
        const stored = localStorage.getItem('hs-user')
        if (stored) {
          const userInfo = JSON.parse(stored)
          userInfo.name = name
          userInfo.avatarUrl = avatarUrl || null
          localStorage.setItem('hs-user', JSON.stringify(userInfo))
        }
      } else {
        toast.error('Failed to update profile')
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setChangingPassword(true)
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(
        '/api/v1/auth/change-password',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      )
      if (res.success) {
        toast.success(res.message ?? 'Password changed. Please log in again.')
        setPasswordDialogOpen(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error('Failed to change password')
      }
    } catch {
      toast.error('Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleToggle2FA() {
    if (twoFactorEnabled) {
      try {
        const res = await apiFetch<{ success: boolean }>(
          '/api/v1/auth/two-factor/disable',
          { method: 'POST' }
        )
        if (res.success) {
          setTwoFactorEnabled(false)
          toast.success('Two-factor authentication disabled')
        }
      } catch {
        toast.error('Failed to disable 2FA')
      }
    } else {
      try {
        const res = await apiFetch<{ success: boolean; data: { uri: string; recoveryCodes: string[] } }>(
          '/api/v1/auth/two-factor/setup',
          { method: 'POST' }
        )
        if (res.success && res.data) {
          toast.success('2FA setup initiated. Verify with your authenticator app.', {
            duration: 5000,
          })
          // In a full implementation, show QR code dialog here
        }
      } catch {
        toast.error('Failed to set up 2FA')
      }
    }
  }

  async function handleRevokeSession(sessionId: string) {
    try {
      // Revoke by updating the refresh token
      await dbRefreshTokenRevoke(sessionId)
      toast.success('Session revoked')
      // Reload profile
      const res = await apiFetch<{ success: boolean; data: ProfileData }>(
        '/api/v1/auth/profile'
      )
      if (res.success && res.data) {
        setProfile(res.data)
      }
    } catch {
      toast.error('Failed to revoke session')
    }
  }

  // Helper to revoke a session via API
  async function dbRefreshTokenRevoke(sessionId: string) {
    await apiFetch('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    })
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Profile</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-48 w-full' />
        ))}
      </div>
    )
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-bold tracking-tight'>Profile</h1>

      {/* User Info & Edit */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <User className='size-5' />
            </div>
            <div>
              <CardTitle className='text-base'>Personal Information</CardTitle>
              <CardDescription>Update your name and avatar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-4'>
            <Avatar className='size-16'>
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback className='text-lg'>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className='font-medium'>{profile?.user.email}</p>
              <div className='flex items-center gap-2 mt-1'>
                <Badge variant={profile?.user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {profile?.user.status}
                </Badge>
                {profile?.user.isSuperAdmin && <Badge variant='destructive'>Super Admin</Badge>}
              </div>
            </div>
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='name'>Display Name</Label>
            <Input id='name' value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='avatar-url'>Avatar URL</Label>
            <Input
              id='avatar-url'
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder='https://example.com/avatar.jpg'
            />
          </div>
          <div className='flex justify-end'>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className='mr-2 size-4 animate-spin' />}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <Lock className='size-5' />
            </div>
            <div>
              <CardTitle className='text-base'>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant='outline' onClick={() => setPasswordDialogOpen(true)}>
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <ShieldCheck className='size-5' />
            </div>
            <div>
              <CardTitle className='text-base'>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <p className='text-sm font-medium'>
                {twoFactorEnabled ? 'Two-factor authentication is enabled' : 'Two-factor authentication is disabled'}
              </p>
              <p className='text-xs text-muted-foreground'>
                {twoFactorEnabled
                  ? 'Your account is protected with an authenticator app'
                  : 'Enable 2FA for enhanced account security'}
              </p>
            </div>
            <Switch checked={twoFactorEnabled} onCheckedChange={handleToggle2FA} />
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <Monitor className='size-5' />
            </div>
            <div>
              <CardTitle className='text-base'>Active Sessions</CardTitle>
              <CardDescription>Devices and browsers where you are logged in</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {profile?.sessions && profile.sessions.length > 0 ? (
            <div className='space-y-3'>
              {profile.sessions.map((session) => (
                <div
                  key={session.id}
                  className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'
                >
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>
                      {session.deviceType === 'WEB' ? '🌐 Browser' : session.deviceType === 'ANDROID' ? '📱 Android' : session.deviceType === 'IOS' ? '🍎 iOS' : '💻 Device'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {session.deviceInfo} · Since {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-destructive shrink-0'
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    <LogOut className='mr-1 size-4' />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>No active sessions found</p>
          )}
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='current-password'>Current Password</Label>
              <Input
                id='current-password'
                type='password'
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='new-password'>New Password</Label>
              <Input
                id='new-password'
                type='password'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='confirm-password'>Confirm New Password</Label>
              <Input
                id='confirm-password'
                type='password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword && <Loader2 className='mr-2 size-4 animate-spin' />}
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
