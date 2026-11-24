import type { GymWorkoutFocus } from '../../../types/gym';

export const GYM_HERO_ASSETS = {
  splash: '/gym-ui/heroes/home-hero.webp',
  dashboard: '/gym-ui/heroes/home-strength.webp',
  planUpper: '/gym-ui/heroes/plan-upper.webp',
  planBarbell: '/gym-ui/heroes/plan-barbell.webp',
} as const;

export const GYM_ANATOMY_ASSETS = {
  chest: '/gym-ui/anatomy/chest.webp',
  back: '/gym-ui/anatomy/back.webp',
  posteriorLegs: '/gym-ui/anatomy/posterior-legs.webp',
  quadsCore: '/gym-ui/anatomy/quads-core.webp',
  shouldersArms: '/gym-ui/anatomy/shoulders-arms.webp',
} as const;

export const GYM_MEAL_ASSETS = {
  palakKhichdi: '/gym-ui/meals/palak-khichdi.webp',
  paneerRoti: '/gym-ui/meals/paneer-roti.webp',
  chanaRice: '/gym-ui/meals/chana-rice.webp',
  chickenRice: '/gym-ui/meals/chicken-rice.webp',
  saladBowl: '/gym-ui/meals/salad-bowl.webp',
} as const;

export const GYM_BADGE_ASSETS = {
  firstWorkout: '/gym-ui/badges/first-workout.webp',
  streak7d: '/gym-ui/badges/streak-7d.webp',
  streak30d: '/gym-ui/badges/streak-30d.webp',
  consistency: '/gym-ui/badges/consistency.webp',
  personalRecord: '/gym-ui/badges/personal-record.webp',
  workouts100: '/gym-ui/badges/workouts-100.webp',
} as const;

export const GYM_COMMUNITY_ASSETS = {
  floorCrew: '/gym-ui/community/floor-crew.webp',
  coachPt: '/gym-ui/community/coach-pt.webp',
} as const;

export const GYM_EMPTY_ASSETS = {
  barbell: '/gym-ui/empty/barbell.webp',
  notebook: '/gym-ui/empty/notebook.webp',
  shaker: '/gym-ui/empty/shaker.webp',
} as const;

export const GYM_AVATAR_ASSETS = {
  male: '/gym-ui/avatars/member-male.webp',
  female: '/gym-ui/avatars/member-female.webp',
} as const;

/** Maps workout muscles or focus key cleanly to the matching studio anatomy render. */
export function resolveAnatomyAssetForMuscles(
  muscles: string[] = [],
  focus?: GymWorkoutFocus | string,
): string {
  const joined = `${focus ?? ''} ${muscles.join(' ')}`.toLowerCase();
  if (
    joined.includes('back') ||
    joined.includes('pull') ||
    joined.includes('lat') ||
    joined.includes('row')
  ) {
    return GYM_ANATOMY_ASSETS.back;
  }
  if (
    joined.includes('hamstring') ||
    joined.includes('glute') ||
    joined.includes('calf') ||
    joined.includes('calves') ||
    joined.includes('rdl')
  ) {
    return GYM_ANATOMY_ASSETS.posteriorLegs;
  }
  if (
    joined.includes('leg') ||
    joined.includes('quad') ||
    joined.includes('squat') ||
    joined.includes('abs') ||
    joined.includes('core')
  ) {
    return GYM_ANATOMY_ASSETS.quadsCore;
  }
  if (
    joined.includes('shoulder') ||
    joined.includes('arm') ||
    joined.includes('bicep') ||
    joined.includes('tricep')
  ) {
    return GYM_ANATOMY_ASSETS.shouldersArms;
  }
  return GYM_ANATOMY_ASSETS.chest;
}

const MEAL_ROTATION = [
  GYM_MEAL_ASSETS.paneerRoti,
  GYM_MEAL_ASSETS.chickenRice,
  GYM_MEAL_ASSETS.palakKhichdi,
  GYM_MEAL_ASSETS.saladBowl,
  GYM_MEAL_ASSETS.chanaRice,
];

/** Picks a curated Indian/fitness meal photograph matching meal text without repetition. */
export function resolveMealImageForText(
  mealTime: string,
  items: string,
  index = 0,
): string {
  const text = `${mealTime} ${items}`.toLowerCase();
  if (
    text.includes('salad') ||
    text.includes('sprout') ||
    text.includes('cucumber')
  ) {
    return GYM_MEAL_ASSETS.saladBowl;
  }
  if (
    text.includes('paneer') ||
    text.includes('roti') ||
    text.includes('chapati') ||
    text.includes('bhurji') ||
    text.includes('egg')
  ) {
    return GYM_MEAL_ASSETS.paneerRoti;
  }
  if (
    text.includes('khichdi') ||
    text.includes('dal') ||
    text.includes('oat') ||
    text.includes('poha') ||
    text.includes('daliya')
  ) {
    return GYM_MEAL_ASSETS.palakKhichdi;
  }
  if (
    text.includes('chana') ||
    text.includes('rajma') ||
    text.includes('chickpea') ||
    text.includes('curd')
  ) {
    return GYM_MEAL_ASSETS.chanaRice;
  }
  if (
    text.includes('chicken') ||
    text.includes('fish') ||
    text.includes('rice')
  ) {
    return GYM_MEAL_ASSETS.chickenRice;
  }
  return MEAL_ROTATION[index % MEAL_ROTATION.length];
}
