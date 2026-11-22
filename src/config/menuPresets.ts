import type {
  DietaryTag,
  MenuPresetKey,
  MenuThemeTemplate,
} from '../types/restaurant';

export interface MenuThemePreviewMeta {
  id: MenuThemeTemplate;
  presetKey?: MenuPresetKey;
  name: string;
  subtitle: string;
  vibeBadge: string;
  swatches: [string, string, string];
  previewBg: string;
  previewText: string;
  previewAccent: string;
  previewButtonStyle: string;
  previewBorderStyle: string;
  previewFontClass: string;
  sampleTagline: string;
}

export interface PresetDishSpec {
  name: string;
  description: string;
  pricePaise: number;
  dietaryTag: DietaryTag;
  isFeatured?: boolean;
  imageUrl?: string;
}

export interface PresetCategorySpec {
  name: string;
  description: string;
  dishes: PresetDishSpec[];
}

export interface PresetRewardSpec {
  title: string;
  description: string;
  starsRequired: number;
}

export interface RestaurantMenuPresetPack {
  presetKey: MenuPresetKey;
  themeTemplate: MenuThemeTemplate;
  label: string;
  tagline: string;
  categories: PresetCategorySpec[];
  starterRewards: PresetRewardSpec[];
}

export const MENU_THEME_LIST: ReadonlyArray<MenuThemePreviewMeta> = [
  {
    id: 'masala',
    presetKey: 'masala_indian',
    name: 'Masala',
    subtitle: 'Traditional Indian Royal Parchment',
    vibeBadge: 'Crimson & Saffron',
    swatches: ['#7A1624', '#D97706', '#FDF8EE'],
    previewBg: '#FDF8EE',
    previewText: '#7A1624',
    previewAccent: '#D97706',
    previewButtonStyle: 'rounded-full bg-[#7A1624] text-[#FDF8EE]',
    previewBorderStyle: 'rounded-2xl border-4 border-double border-amber-600/60',
    previewFontClass: 'font-serif-editorial',
    sampleTagline: 'Royal Tandoor, Slow-Cooked Dum Curries & Heritage Spices',
  },
  {
    id: 'prakriti',
    presetKey: 'prakriti_organic',
    name: 'Prakriti',
    subtitle: 'Organic Earthy Botanical Cafe',
    vibeBadge: 'Moss, Sand & Clay',
    swatches: ['#2D4A33', '#B85D3B', '#F2ECE1'],
    previewBg: '#F2ECE1',
    previewText: '#2D4A33',
    previewAccent: '#B85D3B',
    previewButtonStyle: 'rounded-full bg-[#B85D3B] text-[#FAF6EE]',
    previewBorderStyle: 'rounded-3xl border border-[#2D4A33]/25',
    previewFontClass: 'font-serif-editorial',
    sampleTagline: 'Farm-to-Table Bowls, Ancient Grains & Botanical Elixirs',
  },
  {
    id: 'bistro',
    presetKey: 'bistro_modern',
    name: 'Bistro',
    subtitle: 'Sleek Modern Fine Dining',
    vibeBadge: 'Charcoal & Gold',
    swatches: ['#141414', '#C5A880', '#FAF7F2'],
    previewBg: '#141414',
    previewText: '#FAF7F2',
    previewAccent: '#C5A880',
    previewButtonStyle: 'rounded-none border border-[#C5A880] text-[#C5A880]',
    previewBorderStyle: 'rounded-none border border-[#C5A880]/70',
    previewFontClass: 'uppercase tracking-[0.16em]',
    sampleTagline: 'Artisan Small Plates, Craft Coffee & Modern Plates',
  },
  {
    id: 'samudra',
    presetKey: 'samudra_coastal',
    name: 'Samudra',
    subtitle: 'Coastal Seaside & Harbor Catch',
    vibeBadge: 'Ocean & Turquoise',
    swatches: ['#1A365D', '#0D9488', '#F5EFE6'],
    previewBg: '#F5EFE6',
    previewText: '#1A365D',
    previewAccent: '#0D9488',
    previewButtonStyle: 'rounded-full bg-[#0D9488] text-[#FFFFFF]',
    previewBorderStyle: 'rounded-2xl border border-[#0D9488]/35',
    previewFontClass: 'font-extrabold tracking-tight',
    sampleTagline: 'Fresh Coastal Spices, Malabar Curries & Island Coolers',
  },
  {
    id: 'sizzler',
    presetKey: 'sizzler_diner',
    name: 'Sizzler',
    subtitle: 'Retro Pop Diner & Smash Grill',
    vibeBadge: 'Cherry & Mustard',
    swatches: ['#DC2626', '#FACC15', '#FEFCE8'],
    previewBg: '#FEFCE8',
    previewText: '#111827',
    previewAccent: '#DC2626',
    previewButtonStyle:
      'rounded-xl border-2 border-[#111827] bg-[#FACC15] text-[#111827]',
    previewBorderStyle:
      'rounded-xl border-2 border-[#111827] shadow-[3px_3px_0px_#111827]',
    previewFontClass: 'font-black uppercase tracking-tight',
    sampleTagline: 'Sizzling Grills, Double Smash Burgers & Classic Shakes',
  },
  {
    id: 'default',
    name: 'BistroOS Classic',
    subtitle: 'Clean Milk & Midnight Navy',
    vibeBadge: 'Editorial Minimal',
    swatches: ['#1E1B4B', '#D2DB76', '#F8F9FA'],
    previewBg: '#F8F9FA',
    previewText: '#1E1B4B',
    previewAccent: '#D2DB76',
    previewButtonStyle: 'rounded-full bg-[#1E1B4B] text-[#FFFFFF]',
    previewBorderStyle: 'rounded-2xl border border-[#1E1B4B]/15',
    previewFontClass: 'font-extrabold tracking-tight',
    sampleTagline: 'Freshly crafted dishes served hot to your table',
  },
];

const CURATED_FOOD_PHOTOS: ReadonlyArray<{
  keywords: string[];
  url: string;
}> = [
  {
    keywords: ['biryani', 'pulao', 'rice', 'handi'],
    url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['paneer', 'tikka', 'kebab', 'tandoor', 'tandoori'],
    url: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['butter chicken', 'curry', 'masala', 'dal', 'makhani', 'mutton'],
    url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['naan', 'roti', 'parotta', 'dosa', 'appam', 'flatbread', 'chapati'],
    url: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['gulab', 'jamun', 'sweet', 'dessert', 'halwa', 'tart', 'parfait', 'cake', 'chocolate'],
    url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['coffee', 'espresso', 'cappuccino', 'latte', 'chai', 'tea'],
    url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['lassi', 'cooler', 'spritz', 'tonic', 'juice', 'mojito', 'soda', 'shake', 'float', 'chaas', 'drink'],
    url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['avocado', 'salad', 'quinoa', 'bowl', 'tartine', 'khichdi', 'soup', 'velouté', 'tofu'],
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['pasta', 'risotto', 'bruschetta', 'burrata', 'noodle', 'mac'],
    url: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['fish', 'prawn', 'salmon', 'calamari', 'squid', 'seafood', 'coastal'],
    url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=480&q=80&auto=format&fit=crop',
  },
  {
    keywords: ['burger', 'smash', 'sizzler', 'wings', 'fries', 'onion ring', 'grill', 'chicken'],
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=480&q=80&auto=format&fit=crop',
  },
];

const THEME_FALLBACK_PHOTOS: Record<MenuThemeTemplate, string> = {
  masala:
    'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=480&q=80&auto=format&fit=crop',
  prakriti:
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=480&q=80&auto=format&fit=crop',
  bistro:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=480&q=80&auto=format&fit=crop',
  samudra:
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=480&q=80&auto=format&fit=crop',
  sizzler:
    'https://images.unsplash.com/photo-1550547660-d9450f859349?w=480&q=80&auto=format&fit=crop',
  default:
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=480&q=80&auto=format&fit=crop',
};

/**
 * Resolves a crisp dish photo URL: prefers explicit owner URL, otherwise matches
 * curated culinary imagery by dish/category keyword with a theme-aware fallback.
 */
export function resolveDishPhotoUrl(
  dishName: string,
  categoryName: string,
  explicitUrl: string | null | undefined,
  theme: MenuThemeTemplate = 'default',
): string {
  if (explicitUrl && /^https?:\/\/.+/i.test(explicitUrl.trim())) {
    return explicitUrl.trim();
  }
  const haystack = `${dishName} ${categoryName}`.toLowerCase();
  for (const entry of CURATED_FOOD_PHOTOS) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) {
      return entry.url;
    }
  }
  return THEME_FALLBACK_PHOTOS[theme] ?? THEME_FALLBACK_PHOTOS.default;
}

export const MENU_PRESET_PACKS: Record<
  MenuPresetKey,
  RestaurantMenuPresetPack
> = {
  masala_indian: {
    presetKey: 'masala_indian',
    themeTemplate: 'masala',
    label: 'Traditional Indian "Masala"',
    tagline: 'Royal Tandoor, Slow-Cooked Dum Curries & Heritage Spices',
    categories: [
      {
        name: 'Tandoori Starters',
        description: 'Charcoal-grilled kebabs & house spiced appetizers',
        dishes: [
          {
            name: 'Paneer Tikka Angara',
            description:
              'Smoky cottage cheese marinated in Kashmiri chilli yogurt, roasted in clay tandoor with bell peppers',
            pricePaise: 29500,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Crispy Paneer 65',
            description:
              'Golden spiced cottage cheese tossed with crackling curry leaves and green chillies',
            pricePaise: 26500,
            dietaryTag: 'veg',
          },
          {
            name: 'Murgh Malai Kebab',
            description:
              'Velvety cardamom and cashew-cream marinated chicken morsels grilled to perfection',
            pricePaise: 34500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
        ],
      },
      {
        name: 'Royal Curries & Biryani',
        description: 'Slow-simmered handi gravies & saffron dum biryani',
        dishes: [
          {
            name: 'Hyderabadi Dum Biryani',
            description:
              'Long-grain aged basmati steamed under dough seal with saffron, caramelized onions & raita',
            pricePaise: 38500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
          {
            name: 'Dal Makhani Royal',
            description:
              'Black lentils slow-simmered 18 hours over glowing charcoal with cultured white butter',
            pricePaise: 27500,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Butter Chicken Masala',
            description:
              'Tandoor-charred chicken simmered in rich heirloom tomato & fenugreek makhani gravy',
            pricePaise: 36500,
            dietaryTag: 'non_veg',
          },
          {
            name: 'Garlic Butter Naan',
            description:
              'Hand-stretched tandoor flatbread brushed with roasted garlic and golden ghee',
            pricePaise: 9500,
            dietaryTag: 'veg',
          },
        ],
      },
      {
        name: 'Traditional Drinks & Sweets',
        description: 'Cooling heritage drinks & warm mithai',
        dishes: [
          {
            name: 'Mango Kesar Lassi',
            description:
              'Chilled hand-churned Alphonso mango yogurt topped with Kashmiri saffron strands',
            pricePaise: 14500,
            dietaryTag: 'veg',
          },
          {
            name: 'Smoked Masala Chaas',
            description:
              'Spiced buttermilk infused with roasted cumin, fresh coriander and ginger',
            pricePaise: 9500,
            dietaryTag: 'veg',
          },
          {
            name: 'Warm Gulab Jamun',
            description:
              'Melt-in-mouth khoya dumplings steeped in rose-cardamom syrup with pistachio dust',
            pricePaise: 16500,
            dietaryTag: 'veg',
            isFeatured: true,
          },
        ],
      },
    ],
    starterRewards: [
      {
        title: 'Complimentary Royal Masala Chai',
        description: 'Freshly brewed Assam tea with crushed ginger & cardamom',
        starsRequired: 2,
      },
      {
        title: 'Warm Gulab Jamun Platter',
        description: 'House signature saffron & rose-water dessert on the house',
        starsRequired: 4,
      },
    ],
  },

  prakriti_organic: {
    presetKey: 'prakriti_organic',
    themeTemplate: 'prakriti',
    label: 'Organic Earthy "Prakriti"',
    tagline: 'Farm-to-Table Bowls, Ancient Grains & Botanical Elixirs',
    categories: [
      {
        name: 'Farm-Fresh Bowls',
        description: 'Locally harvested greens, sprouts & warm broths',
        dishes: [
          {
            name: 'Avocado Sprout Tartine',
            description:
              'Multigrain sourdough topped with smashed Hass avocado, micro-greens & toasted sesame',
            pricePaise: 32000,
            dietaryTag: 'vegan',
            isFeatured: true,
          },
          {
            name: 'Roasted Pumpkin & Sage Velouté',
            description:
              'Slow-roasted heirloom pumpkin blended with coconut milk and crispy pepitas',
            pricePaise: 24000,
            dietaryTag: 'vegan',
          },
          {
            name: 'Charred Broccoli & Quinoa Salad',
            description:
              'Tri-color organic quinoa, roasted almonds, pomegranate pearls & lemon-tahini dressing',
            pricePaise: 29000,
            dietaryTag: 'vegan',
            isFeatured: true,
          },
        ],
      },
      {
        name: 'Wholesome Plates',
        description: 'Nourishing ancient grains, millets & wood-fired flatbreads',
        dishes: [
          {
            name: 'Foxtail Millet Khichdi Bowl',
            description:
              'Comforting organic millet and moong lentil bowl tempered with A2 ghee & seasonal veggies',
            pricePaise: 28000,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Wood-Roasted Mushroom Flatbread',
            description:
              'Stone-milled whole wheat flatbread with wild shiitake, caramelized onions & thyme',
            pricePaise: 34000,
            dietaryTag: 'veg',
          },
          {
            name: 'Herb-Crusted Tofu Steak',
            description:
              'Pan-seared organic tofu with basil pesto, sweet potato mash & blistered cherry tomatoes',
            pricePaise: 33000,
            dietaryTag: 'vegan',
          },
          {
            name: 'Crisp Ragi Dosa & Coconut Dip',
            description:
              'Fermented finger-millet crepe served with freshly ground coconut-coriander chutney',
            pricePaise: 22000,
            dietaryTag: 'vegan',
          },
        ],
      },
      {
        name: 'Botanical Elixirs',
        description: 'Cold-pressed juices & slow-steeped herbal infusions',
        dishes: [
          {
            name: 'Turmeric Ginger Sunrise Tonic',
            description:
              'Fresh raw turmeric root, pressed ginger, black pepper & wild forest honey',
            pricePaise: 16000,
            dietaryTag: 'veg',
          },
          {
            name: 'Hibiscus Mint Cooler',
            description:
              'Sun-steeped ruby hibiscus petals shaken with garden mint and organic lime',
            pricePaise: 15000,
            dietaryTag: 'vegan',
            isFeatured: true,
          },
          {
            name: 'Cold-Pressed Green Glow',
            description:
              'Organic spinach, crisp cucumber, green apple, celery & cold-pressed lemon',
            pricePaise: 18500,
            dietaryTag: 'vegan',
          },
        ],
      },
    ],
    starterRewards: [
      {
        title: 'Organic Botanical Elixir',
        description: 'Your choice of any cold-pressed tonic or herbal cooler',
        starsRequired: 2,
      },
      {
        title: 'Wholesome Farm Bowl',
        description: 'Complimentary seasonal salad or grain bowl on your visit',
        starsRequired: 5,
      },
    ],
  },

  bistro_modern: {
    presetKey: 'bistro_modern',
    themeTemplate: 'bistro',
    label: 'Sleek Modern "Bistro"',
    tagline: 'Artisan Small Plates, Craft Coffee & Modern Plates',
    categories: [
      {
        name: 'Small Plates',
        description: 'Chef-curated starters designed for sharing',
        dishes: [
          {
            name: 'Truffle Mushroom Bruschetta',
            description:
              'Charred country loaf, whipped mascarpone, sautéed porcini & white truffle oil',
            pricePaise: 34000,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Burrata & Heirloom Tomato',
            description:
              'Creamy artisan burrata, aged Modena balsamic reduction, basil oil & toasted pine nuts',
            pricePaise: 42000,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Crispy Calamari & Saffron Aioli',
            description:
              'Lightly dusted squid rings flashed crisp, served with charred lemon and saffron aioli',
            pricePaise: 39500,
            dietaryTag: 'non_veg',
          },
        ],
      },
      {
        name: 'Artisan Mains',
        description: 'Handcrafted pasta, risotto & seared signatures',
        dishes: [
          {
            name: 'Wild Mushroom Arborio Risotto',
            description:
              '24-month aged Parmigiano-Reggiano, forest mushrooms, crispy sage & brown butter',
            pricePaise: 46000,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Pan-Seared Herb Salmon',
            description:
              'Crispy-skin Norwegian salmon over saffron cauliflower purée & charred asparagus',
            pricePaise: 69000,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
          {
            name: 'Smoked Paprika Roast Chicken',
            description:
              'Free-range half chicken, thyme pan jus, baby Hasselback potatoes & baby carrots',
            pricePaise: 49500,
            dietaryTag: 'non_veg',
          },
          {
            name: 'Cacio e Pepe Tagliatelle',
            description:
              'House-extruded ribbon pasta tossed with toasted Tellicherry peppercorn & Pecorino',
            pricePaise: 41000,
            dietaryTag: 'veg',
          },
        ],
      },
      {
        name: 'Craft Coffee & Patisserie',
        description: 'Single-origin pours, zero-proof spritzes & tarts',
        dishes: [
          {
            name: 'Single-Origin Espresso Tonic',
            description:
              'Double ristretto layered over botanical tonic water & expressed orange peel',
            pricePaise: 21000,
            dietaryTag: 'vegan',
          },
          {
            name: 'Yuzu Rosemary Spritz',
            description:
              'Japanese yuzu citrus, smoked rosemary sprig & chilled sparkling mineral water',
            pricePaise: 22500,
            dietaryTag: 'vegan',
            isFeatured: true,
          },
          {
            name: '70% Dark Chocolate Ganache Tart',
            description:
              'Crisp cocoa sablé shell filled with silky Belgian ganache & Maldon sea salt',
            pricePaise: 28000,
            dietaryTag: 'egg',
          },
        ],
      },
    ],
    starterRewards: [
      {
        title: 'Artisan Single-Origin Coffee',
        description: 'Complimentary Espresso Tonic, Flat White, or Pour Over',
        starsRequired: 2,
      },
      {
        title: "Chef's Dark Chocolate Tart",
        description: 'Signature patisserie dessert on the house',
        starsRequired: 4,
      },
    ],
  },

  samudra_coastal: {
    presetKey: 'samudra_coastal',
    themeTemplate: 'samudra',
    label: 'Coastal Seaside "Samudra"',
    tagline: 'Fresh Coastal Spices, Malabar Curries & Island Coolers',
    categories: [
      {
        name: 'Harbor Bites',
        description: 'Crisp coastal tawa fries & shoreline appetizers',
        dishes: [
          {
            name: 'Konkan Rava Fried Prawns',
            description:
              'Tiger prawns coated in spiced semolina crust, crisp-fried with curry leaves & lime',
            pricePaise: 44500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
          {
            name: 'Malabar Black Pepper Squid',
            description:
              'Tender squid rings wok-tossed with Tellicherry black pepper, shallots & coconut slivers',
            pricePaise: 39500,
            dietaryTag: 'non_veg',
          },
          {
            name: 'Banana Leaf Paneer Roast',
            description:
              'Cottage cheese slow-roasted inside fragrant banana leaf with Byadgi chilli masala',
            pricePaise: 31500,
            dietaryTag: 'veg',
            isFeatured: true,
          },
        ],
      },
      {
        name: 'Coastal Mains',
        description: 'Coconut-milk curries, ghee roasts & lacy appams',
        dishes: [
          {
            name: 'Goan Fish Curry & Red Rice',
            description:
              'Kingfish simmered in tangy kokum and fresh coconut gravy with steamed Goan ukda rice',
            pricePaise: 46500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
          {
            name: 'Kerala Prawn Moilee',
            description:
              'Delicate golden coconut milk stew infused with ginger, green chillies & curry leaves',
            pricePaise: 48500,
            dietaryTag: 'non_veg',
          },
          {
            name: 'Mangalore Chicken Ghee Roast',
            description:
              'Fiery Kundapur red-chilli spice paste slow-roasted in fragrant coastal ghee',
            pricePaise: 42500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
          {
            name: 'Lacy Appam & Vegetable Ishtu',
            description:
              'Two soft fermented rice hoppers paired with creamy spiced coconut vegetable stew',
            pricePaise: 29500,
            dietaryTag: 'vegan',
          },
        ],
      },
      {
        name: 'Island Coolers',
        description: 'Chilled tropical refreshers & shoreline sweets',
        dishes: [
          {
            name: 'Kokum Ginger Coastal Cooler',
            description:
              'Sun-dried Goan kokum extract shaken with crushed ginger, roasted cumin & soda',
            pricePaise: 14500,
            dietaryTag: 'vegan',
            isFeatured: true,
          },
          {
            name: 'Tender Coconut Lime Fizz',
            description:
              'Fresh malai coconut water, muddled Gondhoraj lime & chilled sparkling water',
            pricePaise: 16500,
            dietaryTag: 'vegan',
          },
          {
            name: 'Goan Serradura Parfait',
            description:
              'Chilled layers of vanilla whipped cream, crushed Marie biscuit dust & sea-salt caramel',
            pricePaise: 19500,
            dietaryTag: 'veg',
          },
        ],
      },
    ],
    starterRewards: [
      {
        title: 'Chilled Kokum Coastal Cooler',
        description: 'Refreshing Goan shoreline cooler served chilled',
        starsRequired: 2,
      },
      {
        title: 'Complimentary Harbor Bite',
        description: 'Any coastal starter from our Harbor Bites menu',
        starsRequired: 5,
      },
    ],
  },

  sizzler_diner: {
    presetKey: 'sizzler_diner',
    themeTemplate: 'sizzler',
    label: 'Retro Pop Diner "Sizzler"',
    tagline: 'Sizzling Grills, Double Smash Burgers & Classic Shakes',
    categories: [
      {
        name: 'Loaded Starters',
        description: 'Crunchy baskets built for the whole booth',
        dishes: [
          {
            name: 'Cheesy Peri-Peri Loaded Fries',
            description:
              'Double-fried skin-on fries drenched in aged cheddar sauce, jalapeños & peri-peri dust',
            pricePaise: 22500,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Crispy Beer-Battered Onion Rings',
            description:
              'Thick-cut sweet onion rings fried golden crisp with smoky chipotle ranch dip',
            pricePaise: 19500,
            dietaryTag: 'veg',
          },
          {
            name: 'Hot Honey Buffalo Wings',
            description:
              '6 crispy glazed chicken wings tossed in tangy hot-honey butter with blue-cheese dip',
            pricePaise: 32500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
        ],
      },
      {
        name: 'Smash Burgers & Sizzlers',
        description: 'Cast-iron sizzlers, smashed patties & toasted brioche',
        dishes: [
          {
            name: 'Double Smash Cheeseburger',
            description:
              'Two seared juicy patties, melted American cheddar, house pickles & diner sauce on brioche',
            pricePaise: 36500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
          {
            name: 'Crispy Veg Diner Burger',
            description:
              'Crunchy spiced potato-corn patty, sharp cheddar, shredded iceberg & tangy mustard mayo',
            pricePaise: 26500,
            dietaryTag: 'veg',
          },
          {
            name: 'Smoky BBQ Chicken Sizzler',
            description:
              'Flame-grilled chicken breast on a piping-hot cast iron platter with herb rice & grilled corn',
            pricePaise: 44500,
            dietaryTag: 'non_veg',
            isFeatured: true,
          },
          {
            name: 'Mac & Three-Cheese Skillet',
            description:
              'Elbow macaroni baked bubbling in cheddar, gouda & mozzarella with crunchy garlic crumbs',
            pricePaise: 29500,
            dietaryTag: 'veg',
          },
        ],
      },
      {
        name: 'Classic Shakes & Sodas',
        description: 'Hand-spun thick shakes & retro fountain floats',
        dishes: [
          {
            name: 'Belgian Chocolate Malt Shake',
            description:
              'Hand-spun dark chocolate ice cream, roasted malt & whipped cream topped with a cherry',
            pricePaise: 21500,
            dietaryTag: 'veg',
            isFeatured: true,
          },
          {
            name: 'Madagascar Vanilla Bean Shake',
            description:
              'Extra-thick classic retro diner milkshake spun with real vanilla bean pods',
            pricePaise: 19500,
            dietaryTag: 'veg',
          },
          {
            name: 'Classic Cherry Cola Float',
            description:
              'Icy fountain cherry cola crowned with a generous scoop of vanilla ice cream',
            pricePaise: 16500,
            dietaryTag: 'veg',
          },
        ],
      },
    ],
    starterRewards: [
      {
        title: 'Loaded Peri-Peri Fries Basket',
        description: 'Crispy cheesy diner fries basket on the house',
        starsRequired: 2,
      },
      {
        title: 'Classic Hand-Spun Milkshake',
        description: 'Your choice of Chocolate Malt or Vanilla Bean shake',
        starsRequired: 4,
      },
    ],
  },
};
