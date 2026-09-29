import type { ImageSourcePropType } from 'react-native';

import type { ColorScheme } from '../theme';

export type BotCategory =
  | 'brandNew'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'impossible';

export type BotBehavior = 'standard' | 'losing' | 'tier600';

export type Bot = {
  id: string;
  name: string;
  species: string;
  elo: number;
  category: BotCategory;
  imageSourceDark: ImageSourcePropType;
  imageSourceLight: ImageSourcePropType;
  description: string;
  funDescription: string;
  level: string;
  skillLevel: number;
  behavior: BotBehavior;
};

export function getBotImageSource(bot: Bot, scheme: ColorScheme): ImageSourcePropType {
  return scheme === 'light' ? bot.imageSourceLight : bot.imageSourceDark;
}

export const BOTS: Bot[] = [
  {
    id: 'gary',
    name: 'Gary the Pigeon',
    species: 'Pigeon',
    elo: 100,
    category: 'brandNew',
    imageSourceDark: require('../assets/bots/gary.png'),
    imageSourceLight: require('../assets/bots/gary-light.png'),
    description: 'Gary is actively trying to lose. Somehow he still shows up every game.',
    funDescription:
      'Gary once tried to capture his own king with his beak so he could end the game early. He thinks blunders are brilliant moves and pecks at the board whenever he\'s confused — which is always.',
    level: 'Blunder Enthusiast',
    skillLevel: 0,
    behavior: 'losing',
  },
  {
    id: 'chip',
    name: 'Chip the Capybara',
    species: 'Capybara',
    elo: 200,
    category: 'brandNew',
    imageSourceDark: require('../assets/bots/chip.png'),
    imageSourceLight: require('../assets/bots/chip-light.png'),
    description: 'Chip just wants to vibe. He may or may not know how the knight moves.',
    funDescription:
      'Chip is brand new to chess — his friend introduced him to it yesterday. His favorite piece is the pawn, because its small like him.',
    level: 'Beginner',
    skillLevel: 0,
    behavior: 'standard',
  },
  {
    id: 'loaf',
    name: 'Loaf the Corgi',
    species: 'Corgi',
    elo: 500,
    category: 'beginner',
    imageSourceDark: require('../assets/bots/loaf.png'),
    imageSourceLight: require('../assets/bots/loaf-light.png'),
    description:
      'Loaf sits on the board like a warm loaf of bread and plays like one too — solid, a little dense, and hard to budge.',
    funDescription:
      'Loaf learned chess because the board is the perfect chin-rest height. He will castle into a fork, wag about it, and immediately demand another game. Short legs. Shorter memory. Surprisingly stubborn in the endgame.',
    level: 'Park Pup',
    skillLevel: 0,
    behavior: 'standard',
  },
  {
    id: 'bruce',
    name: 'Bruce the Shark',
    species: 'Great white',
    elo: 1000,
    category: 'beginner',
    imageSourceDark: require('../assets/bots/bruce.png'),
    imageSourceLight: require('../assets/bots/bruce-light.png'),
    description:
      'Bruce thinks a few moves ahead and rarely hangs pieces on purpose. A solid club-night opponent — with teeth.',
    funDescription:
      'Bruce has strong opinions about increment time controls and a grin that suggests he smelled blood in the water three moves ago. He will absolutely notice if you leave a knight hanging. He still blunders knights.',
    level: 'Club Player',
    skillLevel: 0,
    behavior: 'standard',
  },
  {
    id: 'cleo',
    name: 'Cleo the Cat',
    species: 'Cat',
    elo: 1500,
    category: 'intermediate',
    imageSourceDark: require('../assets/bots/cleo.png'),
    imageSourceLight: require('../assets/bots/cleo-light.png'),
    description:
      'Cleo takes chess seriously now — she has an opening repertoire doc and a grudge against the French Defense.',
    funDescription:
      'Cleo prep-studies one line deeply and plays it every game until it stops working. She knocks pieces off the board when she is winning — not out of malice, but because she can.',
    level: 'Strong Club',
    skillLevel: 0,
    behavior: 'standard',
  },
  {
    id: 'rex',
    name: 'Rex the Raccoon',
    species: 'Raccoon',
    elo: 1750,
    category: 'intermediate',
    imageSourceDark: require('../assets/bots/rex.png'),
    imageSourceLight: require('../assets/bots/rex-light.png'),
    description:
      'Rex is sharp, scrappy, and loves tactical scraps. He punishes loose pieces faster than Bruce.',
    funDescription:
      'Rex learned chess from watching humans picnic in the park — mostly by stealing their puzzle books. He plays tricky, practical chess and grins when your clock runs low.',
    level: 'Serious Club',
    skillLevel: 0,
    behavior: 'standard',
  },
  {
    id: 'nori',
    name: 'Nori the Arctic Wolf',
    species: 'Arctic wolf',
    elo: 2000,
    category: 'advanced',
    imageSourceDark: require('../assets/bots/nori.png'),
    imageSourceLight: require('../assets/bots/nori-light.png'),
    description:
      'Nori calculates two moves ahead and rarely blunders on purpose. A serious expert-level opponent.',
    funDescription:
      'Nori treats every game like a puzzle box — patient, precise, and quietly delighted when a tactic lands. He has opinions about your opening choices and keeps them to himself until it is too late.',
    level: 'Expert',
    skillLevel: 0,
    behavior: 'standard',
  },
  {
    id: 'nile',
    name: 'Nile the Crocodile',
    species: 'Crocodile',
    elo: 2450,
    category: 'advanced',
    imageSourceDark: require('../assets/bots/nile.png'),
    imageSourceLight: require('../assets/bots/nile-light.png'),
    description:
      'Nile waits. Then he snaps. Master-level patience with a bite that ends games.',
    funDescription:
      'Nile barely moves in the opening — then the whole board is his river. He will sit in a quiet position for twenty moves and take your queen the moment you blink.',
    level: 'Master',
    skillLevel: 0,
    behavior: 'standard',
  },
  {
    id: 'chomp',
    name: 'ChessChomp',
    species: 'Bear',
    elo: 3200,
    category: 'impossible',
    imageSourceDark: require('../assets/bots/chomp.png'),
    imageSourceLight: require('../assets/bots/chomp-light.png'),
    description:
      'ChessChomp is the strongest animal in the roster — full engine strength, no handicap. Bring your best.',
    funDescription:
      'ChessChomp does not study openings. ChessChomp is the opening. If you beat him, tell everyone.',
    level: 'Engine Max',
    skillLevel: 0,
    behavior: 'standard',
  },
];

export const BOT_CATEGORY_LABELS: Record<BotCategory, string> = {
  brandNew: 'Brand New to Chess',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  impossible: 'Impossible',
};

export const BOT_CATEGORY_ORDER: BotCategory[] = [
  'brandNew',
  'beginner',
  'intermediate',
  'advanced',
  'impossible',
];

export type BotCategoryGroup = {
  category: BotCategory;
  label: string;
  bots: Bot[];
};

export function getBotsGroupedByCategory(): BotCategoryGroup[] {
  return BOT_CATEGORY_ORDER.map((category) => ({
    category,
    label: BOT_CATEGORY_LABELS[category],
    bots: BOTS.filter((bot) => bot.category === category).sort((a, b) => a.elo - b.elo),
  })).filter((group) => group.bots.length > 0);
}

export function getBotById(id: string): Bot | undefined {
  return BOTS.find((bot) => bot.id === id);
}
