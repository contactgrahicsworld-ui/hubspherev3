'use client';

/**
 * Command Center — Global Command Palette.
 * Triggered with Ctrl+K / Cmd+K.
 * Searches across all entities via /api/v1/search.
 * Includes quick actions and recent searches.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Users,
  Building2,
  Briefcase,
  ListTodo,
  UserCircle,
  FileText,
  Phone,
  MapPin,
  Plus,
  Settings,
  Search,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

// ============================================
// TYPES
// ============================================

interface SearchResult {
  type: string;
  id: string;
  label: string;
  subtitle: string;
  href: string;
}

interface RecentItem {
  type: string;
  id: string;
  label: string;
  href: string | null;
  viewedAt: string;
}

// ============================================
// ICON MAP
// ============================================

function EntityIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    lead: <Users className="size-4 text-blue-500" />,
    contact: <UserCircle className="size-4 text-green-500" />,
    company: <Building2 className="size-4 text-purple-500" />,
    deal: <Briefcase className="size-4 text-amber-500" />,
    task: <ListTodo className="size-4 text-orange-500" />,
    employee: <UserCircle className="size-4 text-teal-500" />,
    invoice: <FileText className="size-4 text-red-500" />,
    call: <Phone className="size-4 text-indigo-500" />,
    fieldVisit: <MapPin className="size-4 text-lime-500" />,
  };
  return <>{iconMap[type] ?? <Search className="size-4 text-muted-foreground" />}</>;
}

// Friendly group labels
const GROUP_LABELS: Record<string, string> = {
  lead: 'Leads',
  contact: 'Contacts',
  company: 'Companies',
  deal: 'Deals',
  task: 'Tasks',
  employee: 'Employees',
  invoice: 'Invoices',
  call: 'Calls',
  fieldVisit: 'Field Visits',
};

// ============================================
// QUICK ACTIONS
// ============================================

const QUICK_ACTIONS = [
  { id: 'create-lead', label: 'Create Lead', href: '/crm/leads?action=create', icon: <Plus className="size-4" /> },
  { id: 'create-task', label: 'Create Task', href: '/crm/tasks?action=create', icon: <Plus className="size-4" /> },
  { id: 'create-contact', label: 'Create Contact', href: '/crm/contacts?action=create', icon: <Plus className="size-4" /> },
  { id: 'create-deal', label: 'Create Deal', href: '/crm/deals?action=create', icon: <Plus className="size-4" /> },
  { id: 'open-settings', label: 'Open Settings', href: '/admin/settings', icon: <Settings className="size-4" /> },
];

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

const RECENT_SEARCHES_KEY = 'hubsphere-recent-searches';
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRecentSearches();
    const filtered = existing.filter((s) => s.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available, ignore
  }
}

// ============================================
// DEBOUNCE
// ============================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ============================================
// COMMAND CENTER COMPONENT
// ============================================

interface CommandCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandCenter({ open, onOpenChange }: CommandCenterProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const recentSearches = getRecentSearches();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const debouncedQuery = useDebounce(query, 300);
  const isMobile = useIsMobile();

  // Fetch recent items when dialog opens
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setError(false);

    fetch('/api/v1/search/recent')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.items) {
          setRecentItems(data.data.items);
        }
      })
      .catch(() => {
        // Recent items are best-effort
      });
  }, [open]);

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      query: debouncedQuery,
      limit: '20',
    });

    fetch(`/api/v1/search?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.data?.results) {
          setResults(data.data.results);
        } else {
          setResults([]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setLoading(false);
        setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Navigate on item select
  const handleSelect = useCallback(
    (href: string) => {
      if (query && query.length >= 2) {
        addRecentSearch(query);
      }
      onOpenChange(false);
      router.push(href);
    },
    [query, onOpenChange, router],
  );

  // Navigate on recent search click
  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
    },
    [],
  );

  // Group results by type
  const groupedResults = results.reduce<Record<string, SearchResult[]>>(
    (acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    },
    {},
  );

  const hasResults = results.length > 0;
  const hasQuery = query.length >= 2;
  const showRecentItems = !hasQuery && recentItems.length > 0;
  const showRecentSearches = !hasQuery && recentSearches.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Center"
      description="Search across all entities or run a quick action"
      className={isMobile ? 'h-[85vh] w-full' : 'h-auto max-h-[70vh] w-full max-w-2xl'}
    >
      <CommandInput
        ref={inputRef}
        placeholder="Search leads, contacts, deals, tasks…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Searching…
          </div>
        )}

        {/* Error state */}
        {!loading && error && hasQuery && (
          <CommandEmpty>Search failed. Please try again.</CommandEmpty>
        )}

        {/* No results state */}
        {!loading && !error && hasQuery && !hasResults && (
          <CommandEmpty>No results found for &ldquo;{query}&rdquo;</CommandEmpty>
        )}

        {/* Search results grouped by type */}
        {!loading && hasResults && (
          <>
            {Object.entries(groupedResults).map(([type, items]) => (
              <CommandGroup key={type} heading={GROUP_LABELS[type] ?? type}>
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.label} ${item.subtitle}`}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <EntityIcon type={item.type} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}

        {/* Recent searches (when no active query) */}
        {showRecentSearches && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((searchQuery, i) => (
              <CommandItem
                key={`recent-search-${i}`}
                value={`recent-search:${searchQuery}`}
                onSelect={() => handleRecentSearchClick(searchQuery)}
              >
                <Search className="size-4 text-muted-foreground" />
                <span>{searchQuery}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recently viewed items (when no active query) */}
        {showRecentItems && (
          <CommandGroup heading="Recently Viewed">
            {recentItems.map((item) => (
              <CommandItem
                key={`recent-${item.type}-${item.id}`}
                value={`recent:${item.label}`}
                onSelect={() => {
                  if (item.href) handleSelect(item.href);
                }}
                disabled={!item.href}
              >
                <EntityIcon type={item.type} />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick actions */}
        {!hasQuery && (
          <>
            {(showRecentSearches || showRecentItems) && <CommandSeparator />}
            <CommandGroup heading="Quick Actions">
              {QUICK_ACTIONS.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`action:${action.label}`}
                  onSelect={() => handleSelect(action.href)}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* AI hint when searching */}
        {!loading && hasQuery && hasResults && (
          <CommandGroup heading="">
            <CommandItem
              value="ai-hint"
              onSelect={() => handleSelect('/ai/chat')}
              className="text-muted-foreground"
            >
              <Sparkles className="size-4" />
              <span className="text-xs">Ask AI about &ldquo;{query}&rdquo;</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
