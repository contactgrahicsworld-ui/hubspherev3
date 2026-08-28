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
  Upload,
  Download,
  // HRMS icons
  Briefcase,
  // Communication icons
  MessageSquare,
  Inbox,
  Bell,
  FileCode,
  Wifi,
  // Automation icons
  Zap,
  Workflow,
  UserCheck,
  CalendarCheck,
  CalendarOff,
  MapPin,
  Receipt,
  DollarSign,
  Network,
  IdCard,
  ClipboardList,
  UsersRound,
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

export const communicationNav: NavSection[] = [
  {
    label: 'Communication',
    items: [
      { title: 'Inbox', href: '/communication/inbox', icon: Inbox },
      { title: 'Notifications', href: '/communication/notifications', icon: Bell },
      { title: 'Templates', href: '/communication/templates', icon: FileCode },
      { title: 'Provider Settings', href: '/communication/settings', icon: Wifi },
    ],
  },
]

export const automationNav: NavSection[] = [
  {
    label: 'Automation',
    items: [
      { title: 'Dashboard', href: '/automation', icon: Zap },
      { title: 'Workflows', href: '/automation/workflows', icon: Workflow },
      { title: 'Executions', href: '/automation/executions', icon: Activity },
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

export const hrmsNav: NavSection[] = [
  {
    label: 'HRMS',
    items: [
      { title: 'HR Dashboard', href: '/hrms', icon: LayoutDashboard },
      { title: 'Employees', href: '/hrms/employees', icon: UsersRound },
      { title: 'Departments', href: '/hrms/departments', icon: Network },
      { title: 'Designations', href: '/hrms/designations', icon: IdCard },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { title: 'Attendance', href: '/hrms/attendance', icon: CalendarCheck },
      { title: 'Leave', href: '/hrms/leave', icon: CalendarOff },
    ],
  },
  {
    label: 'Field Sales',
    items: [
      { title: 'Field Dashboard', href: '/hrms/field-sales', icon: MapPin },
      { title: 'Visits', href: '/hrms/field-sales', icon: ClipboardList },
      { title: 'Expenses', href: '/hrms/expenses', icon: Receipt },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { title: 'Payroll', href: '/hrms/payroll', icon: DollarSign },
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
    label: 'HRMS',
    items: [
      { title: 'HR Dashboard', href: '/hrms', icon: Briefcase },
      { title: 'Employees', href: '/hrms/employees', icon: UsersRound },
      { title: 'Departments', href: '/hrms/departments', icon: Network },
      { title: 'Designations', href: '/hrms/designations', icon: IdCard },
      { title: 'Attendance', href: '/hrms/attendance', icon: CalendarCheck },
      { title: 'Leave', href: '/hrms/leave', icon: CalendarOff },
    ],
  },
  {
    label: 'Field Sales',
    items: [
      { title: 'Field Dashboard', href: '/hrms/field-sales', icon: MapPin },
      { title: 'Expenses', href: '/hrms/expenses', icon: Receipt },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { title: 'Payroll', href: '/hrms/payroll', icon: DollarSign },
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
  {
    label: 'Communication',
    items: [
      { title: 'Inbox', href: '/communication/inbox', icon: Inbox },
      { title: 'Notifications', href: '/communication/notifications', icon: Bell },
      { title: 'Templates', href: '/communication/templates', icon: FileCode },
      { title: 'Provider Settings', href: '/communication/settings', icon: Wifi },
    ],
  },
  {
    label: 'Automation',
    items: [
      { title: 'Dashboard', href: '/automation', icon: Zap },
      { title: 'Workflows', href: '/automation/workflows', icon: Workflow },
      { title: 'Executions', href: '/automation/executions', icon: Activity },
    ],
  },
]

export function getNavForRole(role: string): NavSection[] {
  if (role === 'SUPER_ADMIN') return superAdminNav
  if (role === 'HR_MANAGER' || role === 'HR_EXECUTIVE' || role === 'ACCOUNTANT') {
    return [...hrmsNav, ...communicationNav.slice(1, 3)]
  }
  if (role === 'FIELD_MANAGER' || role === 'FIELD_EXECUTIVE') {
    return [...crmNav.slice(0, 1), ...hrmsNav.slice(2), ...communicationNav.slice(0, 1)]
  }
  if (['TENANT_OWNER', 'ADMIN', 'MANAGER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'TELECALLER'].includes(role)) {
    return [...tenantAdminNav, ...communicationNav, ...automationNav]
  }
  return [...crmNav, ...hrmsNav, ...communicationNav, ...automationNav]
}
