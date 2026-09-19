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
  Smartphone,
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
  // Analytics icons
  BarChart3,
  // AI icons
  Brain,
  // Inventory icons
  Package,
  // Accounting icons
  Calculator,
  // Marketing icons
  Megaphone,
  // Search icon
  Search,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  shortcut?: string
  commandCenter?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const searchNav: NavSection[] = [
  {
    label: 'Search',
    items: [
      { title: 'Search', href: '#command-center', icon: Search, shortcut: 'Ctrl+K', commandCenter: true },
    ],
  },
]

export const inventoryNav: NavSection[] = [
  {
    label: 'Inventory',
    items: [
      { title: 'Dashboard', href: '/inventory', icon: Package },
      { title: 'Products', href: '/inventory/products', icon: Package },
      { title: 'Stock', href: '/inventory/stock', icon: Package },
      { title: 'Purchase Orders', href: '/inventory/purchase-orders', icon: Package },
      { title: 'Vendors', href: '/inventory/vendors', icon: Package },
    ],
  },
]

export const accountingNav: NavSection[] = [
  {
    label: 'Accounting',
    items: [
      { title: 'Dashboard', href: '/accounting', icon: Calculator },
      { title: 'Accounts', href: '/accounting/accounts', icon: Calculator },
      { title: 'Journal Entries', href: '/accounting/journal-entries', icon: Calculator },
      { title: 'Tax Rates', href: '/accounting/tax-rates', icon: Calculator },
      { title: 'Budgets', href: '/accounting/budgets', icon: Calculator },
    ],
  },
]

export const marketingNav: NavSection[] = [
  {
    label: 'Marketing',
    items: [
      { title: 'Dashboard', href: '/marketing', icon: Megaphone },
      { title: 'Campaigns', href: '/marketing/campaigns', icon: Megaphone },
      { title: 'Forms', href: '/marketing/forms', icon: Megaphone },
      { title: 'Lists', href: '/marketing/lists', icon: Megaphone },
    ],
  },
]

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
      { title: 'AI Configuration', href: '/super-admin/ai-config', icon: Brain },
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

export const analyticsNav: NavSection[] = [
  {
    label: 'Analytics',
    items: [
      { title: 'Analytics Hub', href: '/analytics', icon: BarChart3 },
      { title: 'Executive', href: '/analytics/executive', icon: LayoutDashboard },
      { title: 'CRM', href: '/analytics/crm', icon: Target },
      { title: 'Telecaller', href: '/analytics/telecaller', icon: Phone },
      { title: 'HR', href: '/analytics/hr', icon: Briefcase },
      { title: 'Communication', href: '/analytics/communication', icon: MessageSquare },
      { title: 'Automation', href: '/analytics/automation', icon: Zap },
      { title: 'AI Usage', href: '/analytics/ai', icon: Brain },
    ],
  },
]

export const aiNav: NavSection[] = [
  {
    label: 'AI Hub',
    items: [
      { title: 'AI Agents', href: '/ai', icon: Brain },
      { title: 'Chat', href: '/ai/chat', icon: MessageSquare },
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
    label: 'Telecalling',
    items: [
      { title: 'Devices & Calls', href: '/telecalling', icon: Smartphone },
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
  {
    label: 'Analytics',
    items: [
      { title: 'Analytics Hub', href: '/analytics', icon: BarChart3 },
      { title: 'Executive', href: '/analytics/executive', icon: LayoutDashboard },
      { title: 'CRM', href: '/analytics/crm', icon: Target },
      { title: 'HR', href: '/analytics/hr', icon: Briefcase },
      { title: 'Communication', href: '/analytics/communication', icon: MessageSquare },
    ],
  },
  {
    label: 'AI',
    items: [
      { title: 'AI Agents', href: '/ai', icon: Brain },
      { title: 'Chat', href: '/ai/chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { title: 'Dashboard', href: '/inventory', icon: Package },
      { title: 'Products', href: '/inventory/products', icon: Package },
      { title: 'Stock', href: '/inventory/stock', icon: Package },
      { title: 'Purchase Orders', href: '/inventory/purchase-orders', icon: Package },
      { title: 'Vendors', href: '/inventory/vendors', icon: Package },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { title: 'Dashboard', href: '/accounting', icon: Calculator },
      { title: 'Accounts', href: '/accounting/accounts', icon: Calculator },
      { title: 'Journal Entries', href: '/accounting/journal-entries', icon: Calculator },
      { title: 'Tax Rates', href: '/accounting/tax-rates', icon: Calculator },
      { title: 'Budgets', href: '/accounting/budgets', icon: Calculator },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { title: 'Dashboard', href: '/marketing', icon: Megaphone },
      { title: 'Campaigns', href: '/marketing/campaigns', icon: Megaphone },
      { title: 'Forms', href: '/marketing/forms', icon: Megaphone },
      { title: 'Lists', href: '/marketing/lists', icon: Megaphone },
    ],
  },
]

export function getNavForRole(role: string): NavSection[] {
  if (role === 'SUPER_ADMIN') return superAdminNav
  if (role === 'HR_MANAGER' || role === 'HR_EXECUTIVE' || role === 'ACCOUNTANT') {
    return [...hrmsNav, ...communicationNav.slice(1, 3), ...accountingNav]
  }
  if (role === 'FIELD_MANAGER' || role === 'FIELD_EXECUTIVE') {
    return [...crmNav.slice(0, 1), ...hrmsNav.slice(2), ...communicationNav.slice(0, 1)]
  }
  if (['TENANT_OWNER', 'ADMIN', 'MANAGER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'TELECALLER'].includes(role)) {
    return [...tenantAdminNav, ...communicationNav, ...automationNav, ...analyticsNav, ...aiNav, ...inventoryNav, ...accountingNav, ...marketingNav]
  }
  return [...crmNav, ...hrmsNav, ...communicationNav, ...automationNav, ...analyticsNav, ...aiNav, ...inventoryNav, ...accountingNav, ...marketingNav]
}
