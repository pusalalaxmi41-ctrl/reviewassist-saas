import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChefHat,
  Minus,
  Plus,
  Send,
  Sparkles,
  UtensilsCrossed,
  X,
  AlertCircle,
  Search,
  LayoutGrid,
  List,
  Star,
} from 'lucide-react';
import type {
  DietaryTag,
  MenuThemeTemplate,
  RestaurantCustomerWalletState,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantProfile,
  RestaurantTable,
  RestaurantTableOrder,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { resolveDishPhotoUrl } from '../../config/menuPresets';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';

interface Props {
  businessSlug: string;
  businessName: string;
  businessCity: string;
  profile: RestaurantProfile;
  table: RestaurantTable | null;
  tableKey?: string | null;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  wallet: RestaurantCustomerWalletState | null;
  onBackToHub: () => void;
}

interface ThemeStyleTokens {
  shellBg: string;
  stickyBar: string;
  backBtn: string;
  headerCard: string;
  headerTitle: string;
  headerSub: string;
  tablePill: string;
  noticeBox: string;
  searchBar: string;
  viewToggleWrap: string;
  viewToggleActive: string;
  viewToggleInactive: string;
  tabContainer: string;
  tabActive: string;
  tabInactive: string;
  vegPillActive: string;
  vegPillInactive: string;
  categoryTitle: string;
  categoryDesc: string;
  dishCard: string;
  compactCard: string;
  dishTitle: string;
  dishDesc: string;
  priceTag: string;
  featuredBadge: string;
  addBtn: string;
  qtyPill: string;
  qtyBtn: string;
  floatingBar: string;
  floatingBtn: string;
  photoRounding: string;
  fallbackPlateBg: string;
}

function getThemeTokens(theme: MenuThemeTemplate): ThemeStyleTokens {
  switch (theme) {
    case 'masala':
      return {
        shellBg: 'masala-parchment-bg text-[#3A1612]',
        stickyBar:
          'bg-[#7A1624] text-[#FDF8EE] border-b-2 border-[#D97706] shadow-md',
        backBtn:
          'rounded-full border border-[#F4C430]/75 bg-[#5C0E19] px-3.5 py-1.5 text-[12px] font-bold text-[#FDF8EE] hover:bg-[#490B14]',
        headerCard:
          'rounded-2xl border-4 border-double border-amber-600/60 bg-[#FFFDF7] p-5 text-center shadow-sm',
        headerTitle:
          'font-serif-editorial text-[27px] font-bold tracking-tight text-[#7A1624]',
        headerSub: 'text-[13px] italic text-[#7A4420]',
        tablePill:
          'rounded-full border border-[#F4C430] bg-[#7A1624] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#F4C430]',
        noticeBox:
          'rounded-2xl border border-amber-600/35 bg-[#FEF3C7]/65 px-4 py-2.5 text-center text-[12px] font-semibold text-[#7A1624]',
        searchBar:
          'rounded-2xl border-2 border-amber-600/40 bg-[#FFFDF7] text-[#3A1612] placeholder:text-[#8C5B38]',
        viewToggleWrap:
          'rounded-xl border border-amber-600/40 bg-[#FFFDF7] p-0.5',
        viewToggleActive: 'rounded-lg bg-[#7A1624] text-[#F4C430]',
        viewToggleInactive: 'rounded-lg text-[#7A4420]',
        tabContainer:
          'rounded-2xl border border-amber-600/40 bg-[#FFFDF7]/95 p-1.5 shadow-sm',
        tabActive:
          'rounded-full bg-[#7A1624] px-4 py-1.5 text-[12px] font-bold text-[#F4C430] shadow-xs',
        tabInactive:
          'rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#7A4420] hover:bg-[#FEF3C7]',
        vegPillActive:
          'rounded-full border border-[#15803D] bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-[#15803D]',
        vegPillInactive:
          'rounded-full border border-amber-600/40 bg-[#FDF8EE] px-3 py-1.5 text-[11px] font-bold text-[#7A4420]',
        categoryTitle:
          'font-serif-editorial text-[19px] font-bold text-[#FDF8EE]',
        categoryDesc: 'text-[12px] italic text-[#7A4420] text-center',
        dishCard:
          'rounded-2xl border-2 border-double border-amber-600/55 bg-[#FFFDF7] overflow-hidden shadow-xs',
        compactCard:
          'rounded-2xl border-2 border-double border-amber-600/55 bg-[#FFFDF7] divide-y divide-amber-600/20 shadow-xs',
        dishTitle:
          'font-serif-editorial text-[15.5px] font-bold text-[#4A1216] leading-snug',
        dishDesc: 'text-[12px] text-[#6E4935] leading-relaxed',
        priceTag:
          'rounded-full border border-amber-600/50 bg-[#FEF3C7] px-2.5 py-0.5 text-[12.5px] font-extrabold text-[#7A1624] tabular-nums',
        featuredBadge:
          'rounded-full bg-[#D97706] px-2 py-0.5 text-[9.5px] font-bold text-[#FFFFFF]',
        addBtn:
          'rounded-full bg-[#7A1624] px-3.5 py-1.5 text-[12px] font-extrabold text-[#F4C430] shadow-xs hover:bg-[#5C0E19]',
        qtyPill:
          'rounded-full border border-[#7A1624] bg-[#7A1624] text-[#FDF8EE] px-1.5 py-0.5',
        qtyBtn: 'h-6 w-6 rounded-full hover:bg-[#FFFFFF]/15 text-[#F4C430]',
        floatingBar:
          'rounded-full border-2 border-[#F4C430] bg-[#7A1624] text-[#FDF8EE] shadow-2xl',
        floatingBtn:
          'rounded-full bg-[#F4C430] px-4 py-2 text-[12px] font-extrabold text-[#4A1216]',
        photoRounding: 'rounded-none',
        fallbackPlateBg: 'bg-gradient-to-br from-[#7A1624] to-[#B45309] text-[#FDF8EE]',
      };

    case 'prakriti':
      return {
        shellBg: 'prakriti-paper-bg text-[#1E3F20]',
        stickyBar:
          'bg-[#2D4A33] text-[#F2ECE1] border-b border-[#4A6B50]/50 shadow-sm',
        backBtn:
          'rounded-full bg-[#3E6346] px-3.5 py-1.5 text-[12px] font-bold text-[#FAF6EE] hover:bg-[#243B29]',
        headerCard:
          'rounded-3xl border border-[#2D4A33]/20 bg-[#FAF6EE] p-5 text-center shadow-sm',
        headerTitle:
          'font-serif-editorial text-[26px] font-bold tracking-tight text-[#2D4A33]',
        headerSub: 'text-[13px] text-[#4E644F]',
        tablePill:
          'rounded-full bg-[#B85D3B] px-3.5 py-1 text-[11px] font-bold text-[#FAF6EE]',
        noticeBox:
          'rounded-3xl border border-[#2D4A33]/20 bg-[#2D4A33]/10 px-4 py-2.5 text-center text-[12px] font-semibold text-[#2D4A33]',
        searchBar:
          'rounded-3xl border border-[#2D4A33]/25 bg-[#FAF6EE] text-[#1E3F20] placeholder:text-[#5B735C]',
        viewToggleWrap:
          'rounded-full border border-[#2D4A33]/20 bg-[#FAF6EE] p-0.5',
        viewToggleActive: 'rounded-full bg-[#2D4A33] text-[#FAF6EE]',
        viewToggleInactive: 'rounded-full text-[#2D4A33]',
        tabContainer:
          'rounded-full border border-[#2D4A33]/20 bg-[#FAF6EE]/95 p-1.5 shadow-sm',
        tabActive:
          'rounded-full bg-[#2D4A33] px-4 py-1.5 text-[12px] font-bold text-[#FAF6EE]',
        tabInactive:
          'rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#2D4A33] hover:bg-[#E7DFCE]',
        vegPillActive:
          'rounded-full border border-[#2D4A33] bg-[#2D4A33] px-3 py-1.5 text-[11px] font-bold text-[#FAF6EE]',
        vegPillInactive:
          'rounded-full border border-[#2D4A33]/30 bg-[#F2ECE1] px-3 py-1.5 text-[11px] font-bold text-[#2D4A33]',
        categoryTitle:
          'font-serif-editorial text-[20px] font-bold text-[#2D4A33]',
        categoryDesc: 'text-[12px] text-[#4E644F]',
        dishCard:
          'rounded-3xl border border-[#2D4A33]/15 bg-[#FAF6EE] overflow-hidden shadow-xs',
        compactCard:
          'rounded-3xl border border-[#2D4A33]/15 bg-[#FAF6EE] divide-y divide-[#2D4A33]/12 shadow-xs',
        dishTitle:
          'font-serif-editorial text-[15.5px] font-bold text-[#1E3F20] leading-snug',
        dishDesc: 'text-[12px] text-[#556355] leading-relaxed',
        priceTag:
          'rounded-full bg-[#B85D3B]/15 px-2.5 py-0.5 text-[12.5px] font-extrabold text-[#B85D3B] tabular-nums',
        featuredBadge:
          'rounded-full bg-[#2D4A33] px-2 py-0.5 text-[9.5px] font-bold text-[#FAF6EE]',
        addBtn:
          'rounded-full bg-[#B85D3B] px-3.5 py-1.5 text-[12px] font-bold text-[#FAF6EE] hover:bg-[#9C4A2B]',
        qtyPill: 'rounded-full bg-[#2D4A33] text-[#FAF6EE] px-1.5 py-0.5',
        qtyBtn: 'h-6 w-6 rounded-full hover:bg-[#FFFFFF]/15 text-[#F2ECE1]',
        floatingBar:
          'rounded-full bg-[#2D4A33] text-[#FAF6EE] shadow-2xl border border-[#4A6B50]',
        floatingBtn:
          'rounded-full bg-[#B85D3B] px-4 py-2 text-[12px] font-extrabold text-[#FAF6EE]',
        photoRounding: 'rounded-none',
        fallbackPlateBg: 'bg-gradient-to-br from-[#2D4A33] to-[#527957] text-[#FAF6EE]',
      };

    case 'bistro':
      return {
        shellBg: 'bistro-obsidian-bg text-[#FAF7F2]',
        stickyBar:
          'bg-[#141414] text-[#FAF7F2] border-b border-[#C5A880]/45',
        backBtn:
          'rounded-none border border-[#C5A880]/70 bg-transparent px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C5A880] hover:bg-[#C5A880] hover:text-[#141414]',
        headerCard:
          'rounded-none border border-[#C5A880]/50 bg-[#1B1B1B] p-6 text-center',
        headerTitle:
          'text-[24px] font-light uppercase tracking-[0.24em] text-[#FAF7F2]',
        headerSub: 'text-[12px] tracking-[0.1em] text-[#C5A880]',
        tablePill:
          'rounded-none border border-[#C5A880] bg-transparent px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#C5A880]',
        noticeBox:
          'rounded-none border-y border-[#C5A880]/35 bg-[#1B1B1B] px-4 py-2.5 text-center text-[10.5px] uppercase tracking-[0.14em] text-[#C5A880]',
        searchBar:
          'rounded-none border border-[#C5A880]/45 bg-[#1B1B1B] text-[#FAF7F2] placeholder:text-[#C5A880]/60',
        viewToggleWrap:
          'rounded-none border border-[#C5A880]/45 bg-[#1B1B1B] p-0.5',
        viewToggleActive: 'rounded-none bg-[#C5A880] text-[#141414]',
        viewToggleInactive: 'rounded-none text-[#C5A880]',
        tabContainer:
          'rounded-none border border-[#C5A880]/35 bg-[#1B1B1B]/95 p-1.5',
        tabActive:
          'rounded-none bg-[#C5A880] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#141414]',
        tabInactive:
          'rounded-none px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FAF7F2]/75 hover:text-[#C5A880]',
        vegPillActive:
          'rounded-none border border-[#C5A880] bg-[#C5A880]/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#C5A880]',
        vegPillInactive:
          'rounded-none border border-[#FAF7F2]/25 bg-transparent px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#FAF7F2]/70',
        categoryTitle:
          'text-[13px] font-bold uppercase tracking-[0.24em] text-[#C5A880]',
        categoryDesc: 'text-[11.5px] text-[#FAF7F2]/60',
        dishCard:
          'rounded-none border border-[#C5A880]/45 bg-[#FAF7F2] text-[#141414] overflow-hidden',
        compactCard:
          'rounded-none border border-[#C5A880]/45 bg-[#FAF7F2] text-[#141414] divide-y divide-[#C5A880]/35',
        dishTitle:
          'text-[14px] font-bold uppercase tracking-[0.06em] text-[#141414]',
        dishDesc: 'text-[11.5px] text-[#4B4B4B] leading-relaxed',
        priceTag:
          'text-[13.5px] font-bold tracking-wider text-[#141414] tabular-nums border-b border-[#C5A880] pb-0.5',
        featuredBadge:
          'rounded-none bg-[#141414] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#C5A880]',
        addBtn:
          'rounded-none border border-[#141414] bg-[#141414] px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#C5A880] hover:bg-[#2A2A2A]',
        qtyPill:
          'rounded-none border border-[#141414] bg-[#141414] text-[#C5A880] px-1.5 py-0.5',
        qtyBtn: 'h-6 w-6 hover:bg-[#C5A880]/20 text-[#C5A880]',
        floatingBar:
          'rounded-none border border-[#C5A880] bg-[#141414] text-[#FAF7F2] shadow-2xl',
        floatingBtn:
          'rounded-none bg-[#C5A880] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#141414]',
        photoRounding: 'rounded-none',
        fallbackPlateBg: 'bg-gradient-to-br from-[#141414] to-[#3A3226] text-[#C5A880]',
      };

    case 'samudra':
      return {
        shellBg: 'samudra-coastal-bg text-[#1A365D]',
        stickyBar:
          'bg-[#1A365D] text-[#FFFFFF] border-b-2 border-[#0D9488] shadow-sm',
        backBtn:
          'rounded-full bg-[#FFFFFF]/15 px-3.5 py-1.5 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/25',
        headerCard:
          'rounded-3xl border border-[#1A365D]/15 bg-[#FFFFFF] p-5 text-center shadow-sm',
        headerTitle:
          'text-[25px] font-extrabold tracking-tight text-[#1A365D]',
        headerSub: 'text-[13px] text-[#3B5978]',
        tablePill:
          'rounded-full bg-[#0D9488] px-3.5 py-1 text-[11px] font-extrabold text-[#FFFFFF]',
        noticeBox:
          'rounded-2xl border border-[#0D9488]/30 bg-[#0D9488]/10 px-4 py-2.5 text-center text-[12px] font-semibold text-[#1A365D]',
        searchBar:
          'rounded-full border border-[#1A365D]/20 bg-[#FFFFFF] text-[#1A365D] placeholder:text-[#5B7694]',
        viewToggleWrap:
          'rounded-full border border-[#1A365D]/15 bg-[#FFFFFF] p-0.5',
        viewToggleActive: 'rounded-full bg-[#0D9488] text-[#FFFFFF]',
        viewToggleInactive: 'rounded-full text-[#1A365D]',
        tabContainer:
          'rounded-full border border-[#1A365D]/15 bg-[#FFFFFF]/95 p-1.5 shadow-sm',
        tabActive:
          'rounded-full bg-[#1A365D] px-4 py-1.5 text-[12px] font-bold text-[#FFFFFF]',
        tabInactive:
          'rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#1A365D]/75 hover:bg-[#F5EFE6]',
        vegPillActive:
          'rounded-full border border-[#0D9488] bg-[#0D9488] px-3 py-1.5 text-[11px] font-bold text-[#FFFFFF]',
        vegPillInactive:
          'rounded-full border border-[#1A365D]/20 bg-[#F5EFE6] px-3 py-1.5 text-[11px] font-bold text-[#1A365D]',
        categoryTitle: 'text-[19px] font-extrabold text-[#1A365D]',
        categoryDesc: 'text-[12px] text-[#3B5978]',
        dishCard:
          'rounded-3xl border border-[#1A365D]/12 bg-[#FFFFFF] p-3.5 shadow-xs',
        compactCard:
          'rounded-3xl border border-[#1A365D]/12 bg-[#FFFFFF] divide-y divide-[#1A365D]/10 shadow-xs',
        dishTitle: 'text-[15px] font-extrabold text-[#1A365D] leading-snug',
        dishDesc: 'text-[12px] text-[#4A627A] leading-relaxed',
        priceTag:
          'rounded-full bg-[#0D9488]/12 px-2.5 py-0.5 text-[12.5px] font-extrabold text-[#0F766E] tabular-nums',
        featuredBadge:
          'rounded-full bg-[#0D9488] px-2 py-0.5 text-[9.5px] font-extrabold text-[#FFFFFF]',
        addBtn:
          'rounded-full bg-[#0D9488] px-3.5 py-1.5 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#0F766E]',
        qtyPill: 'rounded-full bg-[#1A365D] text-[#FFFFFF] px-1.5 py-0.5',
        qtyBtn: 'h-6 w-6 rounded-full hover:bg-[#FFFFFF]/20 text-[#2DD4BF]',
        floatingBar:
          'rounded-full bg-[#1A365D] text-[#FFFFFF] shadow-2xl border border-[#2DD4BF]/40',
        floatingBtn:
          'rounded-full bg-[#0D9488] px-4 py-2 text-[12px] font-extrabold text-[#FFFFFF]',
        photoRounding: 'rounded-full',
        fallbackPlateBg: 'bg-gradient-to-br from-[#1A365D] to-[#0D9488] text-[#FFFFFF]',
      };

    case 'sizzler':
      return {
        shellBg: 'sizzler-diner-bg text-[#111827]',
        stickyBar:
          'bg-[#DC2626] text-[#FEFCE8] border-b-2 border-[#111827]',
        backBtn:
          'rounded-xl border-2 border-[#111827] bg-[#FACC15] px-3.5 py-1.5 text-[12px] font-black uppercase text-[#111827] shadow-[2px_2px_0px_#111827]',
        headerCard:
          'rounded-2xl border-2 border-[#111827] bg-[#FACC15] p-5 text-center shadow-[4px_4px_0px_#111827]',
        headerTitle:
          'text-[26px] font-black uppercase tracking-tight text-[#111827]',
        headerSub: 'text-[12.5px] font-extrabold text-[#7F1D1D]',
        tablePill:
          'rounded-xl border-2 border-[#111827] bg-[#FACC15] px-3 py-1 text-[11px] font-black uppercase text-[#111827]',
        noticeBox:
          'rounded-xl border-2 border-[#111827] bg-[#FFFFFF] px-4 py-2.5 text-center text-[12px] font-black uppercase text-[#111827] shadow-[3px_3px_0px_#111827]',
        searchBar:
          'rounded-xl border-2 border-[#111827] bg-[#FFFFFF] text-[#111827] placeholder:text-[#4B5563] shadow-[3px_3px_0px_#111827]',
        viewToggleWrap:
          'rounded-xl border-2 border-[#111827] bg-[#FFFFFF] p-0.5 shadow-[2px_2px_0px_#111827]',
        viewToggleActive: 'rounded-lg bg-[#DC2626] text-[#FEFCE8]',
        viewToggleInactive: 'rounded-lg text-[#111827]',
        tabContainer:
          'rounded-2xl border-2 border-[#111827] bg-[#FFFFFF] p-1.5 shadow-[3px_3px_0px_#111827]',
        tabActive:
          'rounded-xl border-2 border-[#111827] bg-[#DC2626] px-3.5 py-1.5 text-[12px] font-black uppercase text-[#FEFCE8]',
        tabInactive:
          'rounded-xl px-3.5 py-1.5 text-[12px] font-extrabold uppercase text-[#111827] hover:bg-[#FEFCE8]',
        vegPillActive:
          'rounded-xl border-2 border-[#111827] bg-[#16A34A] px-3 py-1.5 text-[11px] font-black uppercase text-[#FFFFFF]',
        vegPillInactive:
          'rounded-xl border-2 border-[#111827] bg-[#FEFCE8] px-3 py-1.5 text-[11px] font-black uppercase text-[#111827]',
        categoryTitle:
          'text-[20px] font-black uppercase tracking-tight text-[#111827]',
        categoryDesc: 'text-[12px] font-bold text-[#4B5563]',
        dishCard:
          'rounded-2xl border-2 border-[#111827] bg-[#FFFFFF] overflow-hidden shadow-[4px_4px_0px_#111827]',
        compactCard:
          'rounded-2xl border-2 border-[#111827] bg-[#FFFFFF] divide-y-2 divide-[#111827]/15 shadow-[4px_4px_0px_#111827]',
        dishTitle: 'text-[15.5px] font-black uppercase text-[#111827] leading-snug',
        dishDesc: 'text-[12px] font-medium text-[#374151] leading-relaxed',
        priceTag:
          'rounded-lg border-2 border-[#111827] bg-[#FACC15] px-2.5 py-0.5 text-[13px] font-black text-[#111827] tabular-nums',
        featuredBadge:
          'rounded-lg border border-[#111827] bg-[#DC2626] px-2 py-0.5 text-[9.5px] font-black uppercase text-[#FEFCE8]',
        addBtn:
          'rounded-xl border-2 border-[#111827] bg-[#FACC15] px-3.5 py-1 text-[12px] font-black uppercase text-[#111827] shadow-[2px_2px_0px_#111827] active:translate-x-[1px] active:translate-y-[1px]',
        qtyPill:
          'rounded-xl border-2 border-[#111827] bg-[#DC2626] text-[#FEFCE8] px-1.5 py-0.5',
        qtyBtn: 'h-6 w-6 rounded-lg hover:bg-[#111827]/20 text-[#FACC15]',
        floatingBar:
          'rounded-2xl border-2 border-[#111827] bg-[#DC2626] text-[#FEFCE8] shadow-[4px_4px_0px_#111827]',
        floatingBtn:
          'rounded-xl border-2 border-[#111827] bg-[#FACC15] px-4 py-2 text-[12px] font-black uppercase text-[#111827]',
        photoRounding: 'rounded-none',
        fallbackPlateBg: 'bg-gradient-to-br from-[#DC2626] to-[#FACC15] text-[#111827]',
      };

    default:
      return {
        shellBg: 'bg-[#F8F9FA] text-[#111827]',
        stickyBar:
          'bg-[#1E1B4B] text-[#FFFFFF] border-b border-[#1E1B4B]/20 shadow-sm',
        backBtn:
          'rounded-full bg-[#FFFFFF]/15 px-3.5 py-1.5 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/25',
        headerCard: 'bistro-card p-5 text-center',
        headerTitle: 'text-[24px] font-extrabold tracking-tight text-[#111827]',
        headerSub: 'text-[13px] text-[#6B7280]',
        tablePill:
          'rounded-full bg-[#D2DB76] px-3.5 py-1 text-[11px] font-extrabold text-[#1E1B4B]',
        noticeBox:
          'rounded-2xl border border-[#1E1B4B]/10 bg-[#FFFFFF] px-4 py-2.5 text-center text-[12px] font-semibold text-[#6B7280]',
        searchBar:
          'rounded-2xl border border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] placeholder:text-[#6B7280]',
        viewToggleWrap:
          'rounded-xl border border-[#1E1B4B]/15 bg-[#FFFFFF] p-0.5',
        viewToggleActive: 'rounded-lg bg-[#1E1B4B] text-[#FFFFFF]',
        viewToggleInactive: 'rounded-lg text-[#6B7280]',
        tabContainer:
          'rounded-2xl border border-[#1E1B4B]/10 bg-[#FFFFFF]/95 p-1.5 shadow-sm',
        tabActive:
          'rounded-full bg-[#1E1B4B] px-4 py-1.5 text-[12px] font-bold text-[#FFFFFF]',
        tabInactive:
          'rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#6B7280] hover:text-[#111827]',
        vegPillActive:
          'rounded-full border border-[#059669] bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-[#059669]',
        vegPillInactive:
          'rounded-full border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3 py-1.5 text-[11px] font-extrabold text-[#111827]',
        categoryTitle: 'text-[18px] font-extrabold text-[#111827]',
        categoryDesc: 'text-[12px] text-[#6B7280]',
        dishCard: 'bistro-card overflow-hidden',
        compactCard: 'bistro-card divide-y divide-[#1E1B4B]/10 overflow-hidden',
        dishTitle: 'text-[15px] font-extrabold text-[#111827] leading-snug',
        dishDesc: 'text-[12px] text-[#6B7280] leading-relaxed',
        priceTag:
          'rounded-full bg-[#1E1B4B]/[0.07] px-2.5 py-0.5 text-[12.5px] font-extrabold text-[#1E1B4B] tabular-nums',
        featuredBadge:
          'rounded-full bg-[#D2DB76]/70 px-2 py-0.5 text-[9.5px] font-extrabold text-[#1E1B4B]',
        addBtn:
          'rounded-full bg-[#1E1B4B] px-3.5 py-1.5 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E]',
        qtyPill: 'rounded-full bg-[#1E1B4B] text-[#FFFFFF] px-1.5 py-0.5',
        qtyBtn: 'h-6 w-6 rounded-full hover:bg-[#FFFFFF]/20 text-[#D2DB76]',
        floatingBar: 'rounded-full bg-[#1E1B4B] text-[#FFFFFF] shadow-2xl',
        floatingBtn:
          'rounded-full bg-[#D2DB76] px-4 py-2 text-[12px] font-extrabold text-[#1E1B4B]',
        photoRounding: 'rounded-none',
        fallbackPlateBg: 'bg-gradient-to-br from-[#1E1B4B] to-[#3730A3] text-[#D2DB76]',
      };
  }
}

/** Authentic Indian FSSAI Veg / Non-Veg / Egg / Vegan square indicator */
function FssaiDietaryMark({ tag }: { tag: DietaryTag }) {
  if (tag === 'none') return null;
  if (tag === 'non_veg') {
    return (
      <span
        title="Non-Veg"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-[#DC2626] bg-[#FFFFFF]"
      >
        <span
          className="block h-0 w-0"
          style={{
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderBottom: '7px solid #DC2626',
          }}
        />
      </span>
    );
  }
  const color = tag === 'egg' ? '#D97706' : '#15803D';
  return (
    <span
      title={tag === 'vegan' ? 'Vegan' : tag === 'egg' ? 'Contains Egg' : 'Pure Veg'}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] bg-[#FFFFFF]"
      style={{ borderColor: color }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/** Resilient culinary photo component with graceful offline fallback */
function DishPhoto({
  src,
  alt,
  className,
  fallbackClass,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackClass: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center ${className} ${fallbackClass}`}
        aria-label={alt}
      >
        <UtensilsCrossed className="h-6 w-6 opacity-80" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export function CustomerDigitalMenuView({
  businessSlug,
  businessName,
  businessCity,
  profile,
  table,
  tableKey,
  categories,
  items,
  wallet,
  onBackToHub,
}: Props) {
  const theme: MenuThemeTemplate = profile.menuThemeTemplate ?? 'default';
  const tokens = getThemeTokens(theme);
  const orderingEnabled = Boolean(profile.tableOrderingEnabled);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Default to rich photo cards, auto-available switch to Classic Compact Menu (great for 40+ Indian dishes!)
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');

  // Optional Table Order Draft State (ONLY active when tableOrderingEnabled === true)
  const [orderQuantities, setOrderQuantities] = useState<
    Record<string, number>
  >({});
  const [showOrderReview, setShowOrderReview] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState(
    () => wallet?.customer.displayName ?? '',
  );
  const [orderNote, setOrderNote] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] =
    useState<RestaurantTableOrder | null>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleItems = items.filter((item) => {
    if (
      selectedCategoryId !== 'all' &&
      item.categoryId !== selectedCategoryId
    ) {
      return false;
    }
    if (vegOnly && item.dietaryTag !== 'veg' && item.dietaryTag !== 'vegan') {
      return false;
    }
    if (normalizedSearch) {
      const hay = `${item.name} ${item.description ?? ''}`.toLowerCase();
      if (!hay.includes(normalizedSearch)) {
        return false;
      }
    }
    return true;
  });

  const categoriesToRender =
    selectedCategoryId === 'all'
      ? categories
      : categories.filter((c) => c.id === selectedCategoryId);

  const selectedEntries = Object.entries(orderQuantities)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => {
      const dish = items.find((i) => i.id === itemId);
      return dish ? { dish, quantity: qty } : null;
    })
    .filter(
      (entry): entry is { dish: RestaurantMenuItem; quantity: number } =>
        entry !== null,
    );

  const totalSelectedCount = selectedEntries.reduce(
    (sum, e) => sum + e.quantity,
    0,
  );

  function adjustQty(itemId: string, delta: number) {
    setOrderQuantities((prev) => {
      const next = Math.max(0, Math.min(25, (prev[itemId] ?? 0) + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderingEnabled || selectedEntries.length === 0) return;
    setSubmittingOrder(true);
    setOrderError(null);
    try {
      const cleanNote = orderNote.trim() || null;
      const created = await businessRepository.submitCustomerTableOrder({
        businessSlug,
        tableKey: table?.tableKey ?? tableKey ?? null,
        customerId: wallet?.customer.id ?? null,
        guestName:
          guestNameInput.trim() || wallet?.customer.displayName || null,
        items: selectedEntries.map((entry, idx) => ({
          itemId: entry.dish.id,
          quantity: entry.quantity,
          notes: idx === 0 ? cleanNote : null,
        })),
      });
      setSubmittedOrder(created);
      setOrderQuantities({});
      setOrderNote('');
      setShowOrderReview(false);
    } catch (err) {
      setOrderError((err as Error).message);
    } finally {
      setSubmittingOrder(false);
    }
  }

  function renderOrderControls(dish: RestaurantMenuItem) {
    if (!orderingEnabled) return null;
    const qty = orderQuantities[dish.id] ?? 0;
    if (qty === 0) {
      return (
        <button
          type="button"
          data-testid={`order-add-${dish.id}`}
          onClick={() => adjustQty(dish.id, 1)}
          className={`inline-flex items-center gap-1 transition-all active:scale-[0.96] cursor-pointer ${tokens.addBtn}`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span>Add</span>
        </button>
      );
    }
    return (
      <div className={`inline-flex items-center gap-1.5 ${tokens.qtyPill}`}>
        <button
          type="button"
          aria-label={`Remove one ${dish.name}`}
          onClick={() => adjustQty(dish.id, -1)}
          className={`inline-flex items-center justify-center cursor-pointer ${tokens.qtyBtn}`}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="min-w-5 text-center text-[13px] font-extrabold tabular-nums">
          {qty}
        </span>
        <button
          type="button"
          aria-label={`Add one more ${dish.name}`}
          onClick={() => adjustQty(dish.id, 1)}
          className={`inline-flex items-center justify-center cursor-pointer ${tokens.qtyBtn}`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      data-menu-theme={theme}
      className={`min-h-[82vh] -mx-4 sm:-mx-6 -mt-6 sm:-mt-12 pb-28 transition-colors duration-200 animate-fadeSlideUp ${tokens.shellBg}`}
    >
      {/* Sticky Top Navigation Bar ("← Back to Table Hub") */}
      <div className={`sticky top-0 z-30 ${tokens.stickyBar}`}>
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onBackToHub}
            className={`inline-flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${tokens.backBtn}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            <span>Back to Table Hub</span>
          </button>

          {table ? (
            <span className={tokens.tablePill}>{table.tableNumber}</span>
          ) : (
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
              Digital Menu
            </span>
          )}
        </div>
        {theme === 'sizzler' && <div className="sizzler-checker-stripe" />}
      </div>

      <div className="mx-auto max-w-md px-4 pt-5 space-y-4">
        {/* Culturally Styled Restaurant Masthead */}
        <header className={tokens.headerCard}>
          {theme === 'masala' && (
            <p className="mb-1 text-[12px] tracking-[0.35em] text-[#D97706]">
              ✦ ❖ ✦
            </p>
          )}
          {theme === 'prakriti' && (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2D4A33]">
              🌿 Seasonal &amp; Botanical Kitchen
            </p>
          )}
          {theme === 'bistro' && (
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="h-[1px] w-8 bg-[#C5A880]/60" />
              <span className="bg-[#C5A880] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-[#141414]">
                The Menu
              </span>
              <span className="h-[1px] w-8 bg-[#C5A880]/60" />
            </div>
          )}
          {theme === 'samudra' && (
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0D9488]">
              Coastal Kitchen • {businessCity}
            </p>
          )}
          {theme === 'sizzler' && (
            <span className="mb-1.5 inline-block rounded-lg border-2 border-[#111827] bg-[#DC2626] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#FEFCE8]">
              Hot Off The Grill!
            </span>
          )}

          <h1 className={tokens.headerTitle}>{businessName}</h1>
          <p className={`mt-1 ${tokens.headerSub}`}>
            {profile.tagline || `${businessCity} • Crafted Fresh to Order`}
          </p>
        </header>

        {/* Ordering Mode Banner */}
        <div className={tokens.noticeBox}>
          {orderingEnabled
            ? 'Tap + on dishes below to send your table order for quick manager approval → Chef.'
            : 'Ready to order? Just let your server know.'}
        </div>

        {/* Search Dishes + Photo Cards / Classic Menu List Switcher */}
        <div className="flex items-center gap-2">
          <div
            className={`relative flex flex-1 items-center px-3 ${tokens.searchBar}`}
          >
            <Search className="h-4 w-4 shrink-0 opacity-65" aria-hidden />
            <input
              type="search"
              aria-label="Search dishes"
              placeholder="Search dishes, biryani, dosa, coffee…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full bg-transparent pl-2.5 text-[13px] font-semibold focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          <div
            className={`inline-flex shrink-0 items-center ${tokens.viewToggleWrap}`}
            role="group"
            aria-label="Menu view mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Photo Cards View"
              className={`flex h-9 w-9 items-center justify-center transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? tokens.viewToggleActive
                  : tokens.viewToggleInactive
              }`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              title="Classic Menu List View"
              className={`flex h-9 w-9 items-center justify-center transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? tokens.viewToggleActive
                  : tokens.viewToggleInactive
              }`}
            >
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Submitted Table Order Confirmation Banner */}
        {submittedOrder && (
          <div
            role="status"
            className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-[#065F46] shadow-sm space-y-1.5 animate-fadeSlideUp"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[14px] font-extrabold">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0" aria-hidden />
                Order Sent for Manager Approval!
              </p>
              <button
                type="button"
                onClick={() => setSubmittedOrder(null)}
                className="rounded-lg p-1 hover:bg-emerald-100 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="text-[12px] font-medium">
              {submittedOrder.items
                .map((i) => `${i.quantity}× ${i.name}`)
                .join(', ')}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Status: Pending Staff Approval → Kitchen Queue
            </p>
          </div>
        )}

        {/* Sticky Category Tabs + Pure Veg Filter */}
        <div
          className={`sticky top-[56px] z-20 flex items-center gap-1.5 overflow-x-auto backdrop-blur-md ${tokens.tabContainer}`}
        >
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`whitespace-nowrap transition-all active:scale-[0.98] cursor-pointer ${
              selectedCategoryId === 'all'
                ? tokens.tabActive
                : tokens.tabInactive
            }`}
          >
            All ({items.length})
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`whitespace-nowrap transition-all active:scale-[0.98] cursor-pointer ${
                selectedCategoryId === cat.id
                  ? tokens.tabActive
                  : tokens.tabInactive
              }`}
            >
              {cat.name}
            </button>
          ))}

          <button
            type="button"
            aria-pressed={vegOnly}
            onClick={() => setVegOnly((v) => !v)}
            className={`ml-auto inline-flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-[0.98] cursor-pointer ${
              vegOnly ? tokens.vegPillActive : tokens.vegPillInactive
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
            Pure Veg
          </button>
        </div>

        {/* Categorized Culturally Styled Menu Sections */}
        {visibleItems.length === 0 ? (
          <div className={`${tokens.dishCard} p-8 text-center space-y-2`}>
            <UtensilsCrossed
              className="mx-auto h-7 w-7 opacity-60"
              aria-hidden
            />
            <p className={tokens.dishTitle}>
              {normalizedSearch
                ? `No dishes matching "${searchQuery}"`
                : vegOnly
                  ? 'No Pure Veg dishes in this category'
                  : 'Menu items are being updated'}
            </p>
            <p className={tokens.dishDesc}>
              {normalizedSearch
                ? 'Try clearing your search filter to see the full menu.'
                : vegOnly
                  ? 'Tap Pure Veg again or switch categories to view all dishes.'
                  : 'Ask your server for today’s fresh chef specials.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {categoriesToRender.map((cat, catIdx) => {
              const catItems = visibleItems.filter(
                (i) => i.categoryId === cat.id,
              );
              if (catItems.length === 0) return null;

              const catPhotoUrl = resolveDishPhotoUrl(
                catItems[0]?.name ?? cat.name,
                cat.name,
                catItems[0]?.imageUrl,
                theme,
              );

              return (
                <section
                  key={cat.id}
                  aria-label={cat.name}
                  className="space-y-3"
                >
                  {/* Signature Cultural Category Banner */}
                  {theme === 'masala' ? (
                    // Kritunga / Saffron House inspired Maroon Pill Banner with overlapping circular dish bowl
                    <div className="space-y-1.5 pt-1">
                      <div className="relative flex items-center">
                        <div className="relative z-10 h-13 w-13 shrink-0 overflow-hidden rounded-full border-2 border-[#F4C430] shadow-md bg-[#7A1624]">
                          <DishPhoto
                            src={catPhotoUrl}
                            alt={cat.name}
                            className="h-full w-full"
                            fallbackClass={tokens.fallbackPlateBg}
                          />
                        </div>
                        <div className="-ml-4 flex-1 rounded-r-full bg-[#7A1624] py-2 pl-7 pr-4 shadow-sm border border-[#F4C430]/50">
                          <h2 className={tokens.categoryTitle}>{cat.name}</h2>
                        </div>
                      </div>
                      {cat.description && (
                        <p className={tokens.categoryDesc}>{cat.description}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 px-1">
                      {theme === 'bistro' && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] font-bold text-[#C5A880]">
                            {String(catIdx + 1).padStart(2, '0')}
                          </span>
                          <div className="h-[1px] flex-1 bg-[#C5A880]/40" />
                        </div>
                      )}
                      {theme === 'samudra' && (
                        <svg
                          viewBox="0 0 200 10"
                          className="h-2.5 w-24 text-[#0D9488]"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M0 5 Q 12.5 0, 25 5 T 50 5 T 75 5 T 100 5 T 125 5 T 150 5 T 175 5 T 200 5"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      <h2 className={tokens.categoryTitle}>
                        {theme === 'prakriti' ? `🌿 ${cat.name}` : cat.name}
                      </h2>
                      {cat.description && (
                        <p className={tokens.categoryDesc}>{cat.description}</p>
                      )}
                    </div>
                  )}

                  {/* VIEW MODE A: CLASSIC COMPACT PRINTED MENU LIST (Ideal for 40+ Indian dishes!) */}
                  {viewMode === 'compact' ? (
                    <div className={tokens.compactCard}>
                      {catItems.map((dish) => (
                        <article
                          key={dish.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <FssaiDietaryMark tag={dish.dietaryTag} />
                              {dish.isFeatured && (
                                <Star
                                  className="h-3.5 w-3.5 shrink-0 text-[#D97706] fill-[#F59E0B]"
                                  aria-label="House Special"
                                />
                              )}
                              <h3 className={`${tokens.dishTitle} truncate`}>
                                {dish.name}
                              </h3>
                            </div>
                            {dish.description && (
                              <p className={`${tokens.dishDesc} line-clamp-1`}>
                                {dish.description}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span className={tokens.priceTag}>
                              {formatPriceFromPaise(
                                dish.pricePaise,
                                profile.currencyCode,
                              )}
                            </span>
                            {renderOrderControls(dish)}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : theme === 'samudra' ? (
                    // SUNDAY CLUB / SAMUDRA CIRCULAR PHOTO PILL-ROW CARDS
                    <div className="space-y-3">
                      {catItems.map((dish, dishIdx) => {
                        const photoUrl = resolveDishPhotoUrl(
                          dish.name,
                          cat.name,
                          dish.imageUrl,
                          theme,
                        );
                        return (
                          <article
                            key={dish.id}
                            className={`${tokens.dishCard} flex items-center gap-3.5`}
                          >
                            <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-full border-2 border-[#0D9488]/30 shadow-xs">
                              <DishPhoto
                                src={photoUrl}
                                alt={dish.name}
                                className="h-full w-full"
                                fallbackClass={tokens.fallbackPlateBg}
                              />
                              <span className="absolute bottom-0 right-0 rounded-full bg-[#1A365D] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#FFFFFF]">
                                {String(dishIdx + 1).padStart(2, '0')}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <FssaiDietaryMark tag={dish.dietaryTag} />
                                {dish.isFeatured && (
                                  <span
                                    className={`inline-flex items-center gap-0.5 ${tokens.featuredBadge}`}
                                  >
                                    <Sparkles className="h-2.5 w-2.5" aria-hidden />
                                    Pick
                                  </span>
                                )}
                              </div>
                              <h3 className={tokens.dishTitle}>{dish.name}</h3>
                              {dish.description && (
                                <p className={`${tokens.dishDesc} line-clamp-2`}>
                                  {dish.description}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <span className={tokens.priceTag}>
                                {formatPriceFromPaise(
                                  dish.pricePaise,
                                  profile.currencyCode,
                                )}
                              </span>
                              {renderOrderControls(dish)}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    // VIEW MODE B: RICH EDITORIAL 2-COLUMN PHOTO DISH CARDS (Saffron House, Casa Limone, SUMI, Fire & Smoke)
                    <div className="grid grid-cols-2 gap-3">
                      {catItems.map((dish) => {
                        const photoUrl = resolveDishPhotoUrl(
                          dish.name,
                          cat.name,
                          dish.imageUrl,
                          theme,
                        );
                        return (
                          <article
                            key={dish.id}
                            className={`${tokens.dishCard} flex flex-col justify-between`}
                          >
                            <div>
                              <div className="relative h-28 w-full overflow-hidden">
                                <DishPhoto
                                  src={photoUrl}
                                  alt={dish.name}
                                  className="h-full w-full transition-transform duration-300 hover:scale-105"
                                  fallbackClass={tokens.fallbackPlateBg}
                                />
                                <div className="absolute top-2 left-2 flex items-center gap-1">
                                  <FssaiDietaryMark tag={dish.dietaryTag} />
                                </div>
                                {dish.isFeatured && (
                                  <span
                                    className={`absolute top-2 right-2 inline-flex items-center gap-0.5 shadow-xs ${tokens.featuredBadge}`}
                                  >
                                    <Sparkles
                                      className="h-2.5 w-2.5"
                                      aria-hidden
                                    />
                                    Best
                                  </span>
                                )}
                              </div>

                              <div className="p-3 space-y-1">
                                <h3 className={`${tokens.dishTitle} line-clamp-2`}>
                                  {dish.name}
                                </h3>
                                {dish.description && (
                                  <p className={`${tokens.dishDesc} line-clamp-2`}>
                                    {dish.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1.5 px-3 pb-3 pt-1">
                              <span className={tokens.priceTag}>
                                {formatPriceFromPaise(
                                  dish.pricePaise,
                                  profile.currencyCode,
                                )}
                              </span>
                              {renderOrderControls(dish)}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Review Table Order Bar (ONLY when tableOrderingEnabled === true & items selected) */}
      {orderingEnabled && totalSelectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[400px] -translate-x-1/2 animate-fadeSlideUp">
          <div
            className={`flex items-center justify-between gap-3 p-2.5 pl-4 ${tokens.floatingBar}`}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold tabular-nums">
                {totalSelectedCount}{' '}
                {totalSelectedCount === 1 ? 'Dish' : 'Dishes'} Selected
              </p>
              <p className="text-[11px] opacity-80">
                No payment needed — sent for manager approval
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOrderError(null);
                setShowOrderReview(true);
              }}
              className={`shrink-0 transition-all active:scale-[0.98] cursor-pointer ${tokens.floatingBtn}`}
            >
              Review Table Order →
            </button>
          </div>
        </div>
      )}

      {/* Review & Submit Table Order Modal (Zero Billing / Zero Tax) */}
      {orderingEnabled && showOrderReview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review Table Order"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={(e) => void handleSubmitOrder(e)}
            className="w-full max-w-md rounded-3xl bg-[#FFFFFF] p-6 text-[#111827] shadow-2xl space-y-4 animate-fadeSlideUp"
          >
            <div className="flex items-center justify-between border-b border-[#1E1B4B]/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                  <ChefHat className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[18px] font-extrabold text-[#111827]">
                    Review Table Order
                  </h3>
                  <p className="text-[12px] text-[#6B7280]">
                    {table ? `${table.tableNumber} • ` : ''}Sent to manager for kitchen approval
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderReview(false)}
                className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {orderError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                <span>{orderError}</span>
              </div>
            )}

            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedEntries.map(({ dish, quantity }) => (
                <div
                  key={dish.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#1E1B4B]/10 bg-[#F8F9FA] px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-[#111827]">
                      {dish.name}
                    </p>
                    <p className="text-[12px] text-[#6B7280] tabular-nums">
                      {formatPriceFromPaise(
                        dish.pricePaise,
                        profile.currencyCode,
                      )}{' '}
                      each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustQty(dish.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <span className="min-w-5 text-center text-[13px] font-extrabold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustQty(dish.id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              <input
                type="text"
                maxLength={80}
                placeholder="Your Name (Optional — helps your server)"
                value={guestNameInput}
                onChange={(e) => setGuestNameInput(e.target.value)}
                className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[13px] text-[#111827]"
              />
              <input
                type="text"
                maxLength={160}
                placeholder="Kitchen note (e.g. Less spicy, no onions)"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[13px] text-[#111827]"
              />
            </div>

            <button
              type="submit"
              disabled={submittingOrder || selectedEntries.length === 0}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B4B] px-5 py-3 text-[14px] font-extrabold text-[#FFFFFF] shadow-sm hover:bg-[#2E2A6E] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-4 w-4 text-[#D2DB76]" aria-hidden />
              {submittingOrder
                ? 'Sending to Manager…'
                : 'Send Table Order for Approval'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
