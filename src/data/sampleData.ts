import {
  MembershipPlan,
  ReportRecord,
  SuccessStory,
} from '../types/matrimony';

export const HERO_IMAGE = '/src/assets/images/hero_indian_wedding_1795419429042.jpg';

export const MOTHER_TONGUES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Gujarati',
  'Bengali',
  'Punjabi',
  'Odia',
  'Urdu',
  'Konkani',
  'Sindhi',
  'Tulu',
  'Kashmiri',
  'Assamese',
  'English',
];

export const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'United Arab Emirates',
  'Singapore',
  'Australia',
  'Germany',
];

export const RASHIS = [
  'Mesha (Aries)',
  'Vrishabha (Taurus)',
  'Mithuna (Gemini)',
  'Karka (Cancer)',
  'Simha (Leo)',
  'Kanya (Virgo)',
  'Tula (Libra)',
  'Vrishchika (Scorpio)',
  'Dhanu (Sagittarius)',
  'Makara (Capricorn)',
  'Kumbha (Aquarius)',
  'Meena (Pisces)',
];

export const NAKSHATRAS = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
];

export const NAKSHATRA_PADAMS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: 'Padam 1' },
  { value: 2, label: 'Padam 2' },
  { value: 3, label: 'Padam 3' },
  { value: 4, label: 'Padam 4' },
];

export const HEIGHTS = [
  "4'10\"",
  "4'11\"",
  "5'0\"",
  "5'1\"",
  "5'2\"",
  "5'3\"",
  "5'4\"",
  "5'5\"",
  "5'6\"",
  "5'7\"",
  "5'8\"",
  "5'9\"",
  "5'10\"",
  "5'11\"",
  "6'0\"",
  "6'1\"",
  "6'2\"",
  "6'3\"",
];

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'plan-free',
    name: 'Free',
    audience: 'For families getting started',
    priceINR: '₹0',
    priceUSD: '$0',
    duration: 'Unlimited basic access',
    contactViews: 'Receive interests & browse verified summaries',
    features: [
      'Create complete matrimonial & Jataka profile',
      'Upload up to 3 moderated gallery photos',
      'Search across Indian & NRI communities',
      'Shortlist profiles & receive match interests',
    ],
  },
  {
    id: 'plan-silver',
    name: 'Silver',
    audience: 'For active partner search',
    priceINR: '₹4,999',
    priceUSD: '$65',
    duration: '3 Months',
    contactViews: '40 Direct Verified Contact Views',
    features: [
      '40 verified phone & family contact unlocks',
      'Unlimited personalized interest messages',
      'Full Jataka / Horoscope compatibility view',
      'Priority photo & profile verification review',
    ],
  },
  {
    id: 'plan-gold',
    name: 'Royal Gold',
    audience: 'Most chosen by Indian families',
    priceINR: '₹8,999',
    priceUSD: '$115',
    duration: '6 Months',
    contactViews: '100 Direct Verified Contact Views',
    highlighted: true,
    features: [
      '100 verified phone & family contact unlocks',
      'Featured placement in regional & community searches',
      'Horoscope matching report with Nakshatra insights',
      'Private photo album lock & selective share',
    ],
  },
  {
    id: 'plan-platinum',
    name: 'Imperial Platinum',
    audience: 'Dedicated relationship advisor',
    priceINR: '₹19,999',
    priceUSD: '$250',
    duration: '12 Months',
    contactViews: 'Unlimited Verified Contact Views',
    features: [
      'Dedicated Relationship Manager for curated introductions',
      'Unlimited verified contact unlocks & direct calls',
      'Handpicked weekly shortlist vetted with parents',
      'Confidential VIP profile privacy controls',
    ],
  },
];

export const SUCCESS_STORIES: SuccessStory[] = [
  {
    id: 'ss-1',
    coupleNames: 'Rohan & Devika',
    location: 'Mumbai & Pune',
    weddingDate: 'February 2026',
    imageUrl: '/src/assets/images/couple_success_one_1795419429932.jpg',
    quote:
      'Our families connected over shared roots and verified Jataka alignment within two weeks of joining Nimmi Matrimony.',
    story:
      'Both of our parents wanted a dignified platform free of noisy clutter. Having complete family background, education, and horoscope details verified in one place made our first family meeting effortless and warm.',
  },
  {
    id: 'ss-2',
    coupleNames: 'Siddharth & Kavya',
    location: 'Chennai & Singapore',
    weddingDate: 'May 2026',
    imageUrl: '/src/assets/images/couple_success_two_1795419428984.jpg',
    quote:
      'Across continents, Nimmi Matrimony brought two families together with complete transparency and traditional respect.',
    story:
      'Working in Singapore while my parents were in Chennai made searching challenging until we discovered Nimmi Matrimony’s NRI filters and verified family profiles.',
  },
];

export const INITIAL_REPORTS: ReportRecord[] = [];
