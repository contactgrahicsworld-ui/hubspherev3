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
  // CRM icons
  Target,
  Contact,
  Building,
  HandshakeIcon,
  CheckSquare,
  Clock,
  Phone,
  Search,
  Upload,
  Download,
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

export const crmNav: NavSection[] = [
  {
    label: 'CRM',
    items: [
      { title: 'Dashboard', href: '/crm', icon: LayoutDashboard },
      { title: 'Leads', href: '/crm/leads', icon: Target },
      { title: 'Contacts', href: '/crm/contacts', icon: Contact },
      { title: 'Companies', href: '/crm/companies', icon: Building },
      { title: 'Deals', href: '/crm/deals', icon: HandshakeIcon },
    ],
  },
  {
    label: 'Sales',
    items: [
      { title: 'Pipeline', href: '/crm/deals', icon: Activity },
      { title: 'Tasks', href: '/crm/tasks', icon: CheckSquare },
      { title: 'Follow-ups', href: '/crm/follow-ups', icon: Clock },
      { title: 'Telecaller', href: '/crm/telecaller', icon: Phone },
    ],
  },
  {
    label: 'More',
    items: [
      { title: 'Call History', href: '/crm/calls', icon: Phone },
      { title: 'Import', href: '/crm/import', icon: Upload },
      { title: 'Export', href: '/crm/export', icon: Download },
    ],
  },
]

export const tenantAdminNav: NavSection[] = [
  {
    label: 'CRM',
    items: [
      { title: 'Dashboard', href: '/crm', icon: LayoutDashboard },
      { title: 'Leads', href: '/crm/leads', icon: Target },
      { title: 'Contacts', href: '/crm/contacts', icon: Contact },
      { title: 'Companies', href: '/crm/companies', icon: Building },
      { title: 'Deals', href: '/crm/deals', icon: HandshakeIcon },
      { title: 'Tasks', href: '/crm/tasks', icon: CheckSquare },
      { title: 'Follow-ups', href: '/crm/follow-ups', icon: Clock },
      { title: 'Telecaller', href: '/crm/telecaller', icon: Phone },
    ],
  },
  {
    label: 'Management',
    items: [
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
  // CRM roles get CRM navigation + admin management
  if (['TENANT_OWNER', 'ADMIN', 'MANAGER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'TELECALLER'].includes(role)) {
    return tenantAdminNav
  }
  // Viewer and other limited roles get CRM view only
  return crmNav
}
