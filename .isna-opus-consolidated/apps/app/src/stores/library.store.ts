import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  LibraryItem, Library, LibraryFilters, LibraryItemCategory,
  LibraryTheme, CompatibilityScore, LibraryUsableIn, DEFAULT_LIBRARY_FILTERS,
} from '@/engines/types/library';
import { genId } from '@/lib/ids';

type LibraryStore = {
  // State
  library: Library;
  filters: LibraryFilters;
  selectedItemId: string | null;
  importModalOpen: boolean;

  // Getters
  getFilteredItems: () => LibraryItem[];
  getPersonalItems: () => LibraryItem[];
  getCommunityItems: () => LibraryItem[];
  getItemById: (id: string) => LibraryItem | null;
  getItemsByCategory: (cat: LibraryItemCategory) => LibraryItem[];

  // Actions — items
  addItem: (item: Omit<LibraryItem, 'id' | 'created_at'>) => LibraryItem;
  updateItem: (id: string, patch: Partial<LibraryItem>) => void;
  deleteItem: (id: string) => void;
  likeItem: (id: string) => void;
  incrementDownloads: (id: string) => void;

  // Actions — filters
  setFilter: <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => void;
  resetFilters: () => void;
  setSearch: (q: string) => void;

  // Actions — selection + modal
  setSelectedItem: (id: string | null) => void;
  openImportModal: () => void;
  closeImportModal: () => void;

  // Actions — community sync
  publishToCommunity: (id: string) => void;
  importFromCommunity: (item: LibraryItem) => void;
};

const DEFAULT_FILTERS: LibraryFilters = {
  category: 'all',
  theme: 'all',
  compatibility: 'all',
  source: 'all',
  search: '',
  usableIn: 'all',
};

function matchesFilters(item: LibraryItem, filters: LibraryFilters): boolean {
  if (filters.category !== 'all' && item.category !== filters.category) return false;
  if (filters.theme !== 'all' && item.theme !== filters.theme) return false;
  if (filters.compatibility !== 'all' && item.compatibility !== filters.compatibility) return false;
  if (filters.source !== 'all' && item.source !== filters.source) return false;
  if (filters.usableIn !== 'all' && !item.usable_in.includes(filters.usableIn)) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const haystack = `${item.title} ${item.tags.join(' ')} ${item.theme}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// Seed community items
const SEED_COMMUNITY: LibraryItem[] = [
  {
    id: 'seed-lut-cool', title: 'Cool Blue', category: 'lut', tags: ['cool', 'blue', 'modern'],
    theme: 'technology', preview: '', asset: '', compatibility: 100,
    usable_in: ['designer'], created_at: new Date().toISOString(), source: 'community',
    downloads: 124, likes: 42, fileType: 'cube',
  },
  {
    id: 'seed-lut-warm', title: 'Golden Hour', category: 'lut', tags: ['warm', 'golden', 'vintage'],
    theme: 'art', preview: '', asset: '', compatibility: 100,
    usable_in: ['designer'], created_at: new Date().toISOString(), source: 'community',
    downloads: 89, likes: 31, fileType: 'cube',
  },
  {
    id: 'seed-tpl-intro', title: 'Slide Introduction', category: 'template', tags: ['intro', 'education', 'titre'],
    theme: 'education', preview: '', asset: '', compatibility: 100,
    usable_in: ['designer', 'builder'], created_at: new Date().toISOString(), source: 'community',
    downloads: 210, likes: 76, fileType: 'json',
  },
  {
    id: 'seed-tpl-concept', title: 'Concept Map', category: 'template', tags: ['concept', 'science', 'visuel'],
    theme: 'science', preview: '', asset: '', compatibility: 100,
    usable_in: ['designer', 'builder'], created_at: new Date().toISOString(), source: 'community',
    downloads: 155, likes: 58, fileType: 'json',
  },
  {
    id: 'seed-svg-atoms', title: 'Atom Diagram', category: 'vector', tags: ['science', 'atom', 'physics'],
    theme: 'science', preview: '', asset: '', compatibility: 100,
    usable_in: ['designer'], created_at: new Date().toISOString(), source: 'community',
    downloads: 67, likes: 19, fileType: 'svg',
  },
];

export const useLibraryStore = create<LibraryStore>()(
  devtools(
    persist(
      (set, get) => ({
        library: {
          personal: [],
          community: SEED_COMMUNITY,
        },
        filters: DEFAULT_FILTERS,
        selectedItemId: null,
        importModalOpen: false,

        getFilteredItems: () => {
          const { library, filters } = get();
          const all = [...library.personal, ...library.community];
          return all.filter((item) => matchesFilters(item, filters));
        },

        getPersonalItems: () => get().library.personal,
        getCommunityItems: () => get().library.community,

        getItemById: (id) => {
          const { library } = get();
          return (
            library.personal.find((i) => i.id === id) ??
            library.community.find((i) => i.id === id) ??
            null
          );
        },

        getItemsByCategory: (cat) => {
          const { library } = get();
          return [...library.personal, ...library.community].filter((i) => i.category === cat);
        },

        addItem: (item) => {
          const newItem: LibraryItem = {
            ...item,
            id: genId('lib'),
            created_at: new Date().toISOString(),
          };
          set((s) => ({
            library: {
              ...s.library,
              personal: [newItem, ...s.library.personal],
            },
          }));
          return newItem;
        },

        updateItem: (id, patch) => set((s) => ({
          library: {
            personal: s.library.personal.map((i) => i.id === id ? { ...i, ...patch } : i),
            community: s.library.community.map((i) => i.id === id ? { ...i, ...patch } : i),
          },
        })),

        deleteItem: (id) => set((s) => ({
          library: {
            personal: s.library.personal.filter((i) => i.id !== id),
            community: s.library.community.filter((i) => i.id !== id),
          },
          selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
        })),

        likeItem: (id) => set((s) => {
          const updateList = (list: LibraryItem[]) =>
            list.map((i) => i.id === id
              ? { ...i, liked: !i.liked, likes: (i.likes ?? 0) + (i.liked ? -1 : 1) }
              : i,
            );
          return {
            library: {
              personal: updateList(s.library.personal),
              community: updateList(s.library.community),
            },
          };
        }),

        incrementDownloads: (id) => set((s) => {
          const updateList = (list: LibraryItem[]) =>
            list.map((i) => i.id === id ? { ...i, downloads: (i.downloads ?? 0) + 1 } : i);
          return {
            library: {
              personal: updateList(s.library.personal),
              community: updateList(s.library.community),
            },
          };
        }),

        setFilter: (key, value) => set((s) => ({
          filters: { ...s.filters, [key]: value },
        })),

        resetFilters: () => set({ filters: DEFAULT_FILTERS }),

        setSearch: (q) => set((s) => ({ filters: { ...s.filters, search: q } })),

        setSelectedItem: (id) => set({ selectedItemId: id }),
        openImportModal: () => set({ importModalOpen: true }),
        closeImportModal: () => set({ importModalOpen: false }),

        publishToCommunity: (id) => {
          const item = get().library.personal.find((i) => i.id === id);
          if (!item) return;
          const communityItem: LibraryItem = { ...item, source: 'community', downloads: 0, likes: 0 };
          set((s) => ({
            library: {
              ...s.library,
              community: [communityItem, ...s.library.community],
            },
          }));
        },

        importFromCommunity: (item) => {
          const localCopy: LibraryItem = { ...item, id: genId('lib'), source: 'personal', created_at: new Date().toISOString() };
          set((s) => ({
            library: { ...s.library, personal: [localCopy, ...s.library.personal] },
          }));
          get().incrementDownloads(item.id);
        },
      }),
      {
        name: 'liri-library',
        partialize: (s) => ({ library: s.library }),
      },
    ),
    { name: 'library-store' },
  ),
);
