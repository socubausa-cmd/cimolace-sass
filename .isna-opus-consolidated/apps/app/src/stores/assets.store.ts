import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type AssetType = 'image' | 'svg' | 'icon' | 'font' | 'graph' | 'illustration' | 'lottie';

export type Asset = {
  id: string;
  type: AssetType;
  name: string;
  url: string;
  thumbnail?: string;
  tags?: string[];
  source?: 'upload' | 'unsplash' | 'liri-pack' | 'system';
  size?: number;
  width?: number;
  height?: number;
  createdAt?: string;
};

export type FontAsset = {
  id: string;
  family: string;
  variants: string[];
  url?: string;
  loaded: boolean;
};

export type IconAsset = {
  id: string;
  name: string;
  category: string;
  svg: string;
  tags: string[];
};

type AssetsStore = {
  // State
  images: Asset[];
  svgs: Asset[];
  icons: IconAsset[];
  fonts: FontAsset[];
  uploadedAssets: Asset[];
  searchQuery: string;
  activeCategory: string | null;
  loading: boolean;

  // Actions
  addImage: (asset: Asset) => void;
  addSvg: (asset: Asset) => void;
  addIcon: (icon: IconAsset) => void;
  addFont: (font: FontAsset) => void;
  addUpload: (asset: Asset) => void;
  removeUpload: (id: string) => void;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (cat: string | null) => void;
  setLoading: (loading: boolean) => void;
  getFilteredImages: () => Asset[];
  getFilteredIcons: () => IconAsset[];
};

export const useAssetsStore = create<AssetsStore>()(
  devtools(
    (set, get) => ({
      images: [],
      svgs: [],
      icons: [],
      fonts: [
        { id: 'inter', family: 'Inter', variants: ['400', '500', '600', '700'], loaded: true },
        { id: 'georgia', family: 'Georgia', variants: ['400', '700'], loaded: true },
        { id: 'mono', family: 'ui-monospace', variants: ['400'], loaded: true },
      ],
      uploadedAssets: [],
      searchQuery: '',
      activeCategory: null,
      loading: false,

      addImage: (asset) => set((s) => ({ images: [...s.images, asset] })),
      addSvg: (asset) => set((s) => ({ svgs: [...s.svgs, asset] })),
      addIcon: (icon) => set((s) => ({ icons: [...s.icons, icon] })),
      addFont: (font) => set((s) => ({ fonts: [...s.fonts, font] })),
      addUpload: (asset) => set((s) => ({ uploadedAssets: [asset, ...s.uploadedAssets] })),
      removeUpload: (id) => set((s) => ({ uploadedAssets: s.uploadedAssets.filter((a) => a.id !== id) })),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setActiveCategory: (cat) => set({ activeCategory: cat }),
      setLoading: (loading) => set({ loading }),

      getFilteredImages: () => {
        const { images, uploadedAssets, searchQuery } = get();
        const all = [...uploadedAssets.filter((a) => a.type === 'image'), ...images];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter((a) => a.name.toLowerCase().includes(q) || a.tags?.some((t) => t.toLowerCase().includes(q)));
      },

      getFilteredIcons: () => {
        const { icons, searchQuery, activeCategory } = get();
        let result = icons;
        if (activeCategory) result = result.filter((i) => i.category === activeCategory);
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter((i) => i.name.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q)));
        }
        return result;
      },
    }),
    { name: 'assets-store' },
  ),
);
