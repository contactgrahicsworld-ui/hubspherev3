import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  FileText,
  Flag,
  Activity,
  Settings,
  Lock,
  UserCog,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const superAdminNav: NavSection[] = [
  {
    label: 'Platform',
    items: [
      { title: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
      { title: 'Tenants', href: '/super-admin/tenants', icon: Building2 },
      { title: 'Users', href: '/super-admin/users', icon: Users },
      { title: 'Roles & Permissions', href: '/super-admin/roles', icon: Shield },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Audit Logs', href: '/super-admin/audit', icon: FileText },
      { title: 'Feature Flags', href: '/super-admin/features', icon: Flag },
      { title: 'System Health', href: '/super-admin/health', icon: Activity },
      { title: 'Settings', href: '/super-admin/settings', icon: Settings },
    ],
  },
]

export const tenantAdminNav: NavSection[] = [
  {
    label: 'Management',
    items: [
      { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { title: 'Organization Settings', href: '/admin/settings', icon: Settings },
      { title: 'Users', href: '/admin/users', icon: Users },
      { title: 'Roles', href: '/admin/roles', icon: Shield },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Memberships', href: '/admin/memberships', icon: UserCog },
      { title: 'Security', href: '/admin/security', icon: Lock },
      { title: 'Audit Activity', href: '/admin/audit', icon: FileText },
      { title: 'Subscription', href: '/admin/subscription', icon: CreditCard },
    ],
  },
]

export function getNavForRole(role: string): NavSection[] {
  if (role === 'SUPER_ADMIN') return superAdminNav
  return tenantAdminNav
}
