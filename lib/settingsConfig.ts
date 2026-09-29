import type { AppPreferenceKey } from './appPreferences';
import {
  CLASSIFICATION_MOVETIME_MAX_MS,
  CLASSIFICATION_MOVETIME_MIN_MS,
  CLASSIFICATION_MOVETIME_STEP_MS,
  RECOMMENDED_CLASSIFICATION_MOVETIME_MS,
} from './classificationMovetime';
import {
  RECOMMENDED_REVIEW_DEPTH,
  REVIEW_DEPTH_MAX,
  REVIEW_DEPTH_MIN,
  REVIEW_DEPTH_STEP,
} from './reviewSettings';

export type SettingsToggleRow = {
  kind: 'toggle';
  key: AppPreferenceKey;
  label: string;
  description?: string;
  accessibilityLabel?: string;
};

export type SettingsSliderRow = {
  kind: 'slider';
  key: AppPreferenceKey;
  label: string;
  description?: string;
  accessibilityLabel?: string;
  min: number;
  max: number;
  step: number;
  recommended: number;
};

export type SettingsRow = SettingsToggleRow | SettingsSliderRow;

export const SETTINGS_ROWS: readonly SettingsRow[] = [
  {
    kind: 'slider',
    key: 'classificationMovetimeMs',
    label: 'Move rating think time',
    description: 'How long Stockfish analyzes each move for Brilliant, Great, and accuracy labels.',
    accessibilityLabel: 'Move rating think time',
    min: CLASSIFICATION_MOVETIME_MIN_MS,
    max: CLASSIFICATION_MOVETIME_MAX_MS,
    step: CLASSIFICATION_MOVETIME_STEP_MS,
    recommended: RECOMMENDED_CLASSIFICATION_MOVETIME_MS,
  },
  {
    kind: 'toggle',
    key: 'checkmateAnimationEnabled',
    label: 'Checkmate Animation',
    description: 'Show sword, crown, and loss badge before post-game evaluation.',
    accessibilityLabel: 'Checkmate animation',
  },
  {
    kind: 'toggle',
    key: 'chompSoundEnabled',
    label: 'Chomp Sound',
    description: 'Play a chomp SFX on captures instead of the standard capture sound.',
    accessibilityLabel: 'Chomp sound on captures',
  },
  {
    kind: 'toggle',
    key: 'moveQualitySpinAnimationEnabled',
    label: 'Brilliant/Great Move Spin',
    description:
      'Spin and zoom the piece automatically when a move is rated Brilliant or Great (tap or drag). The square glow is separate and always stays on.',
    accessibilityLabel: 'Brilliant and Great move spin animation',
  },
  {
    kind: 'slider',
    key: 'reviewDepth',
    label: 'Post-game evaluation depth',
    description: 'How deeply Stockfish analyzes each move during post-game evaluation. A time cap keeps long games around a minute.',
    accessibilityLabel: 'Post-game evaluation depth',
    min: REVIEW_DEPTH_MIN,
    max: REVIEW_DEPTH_MAX,
    step: REVIEW_DEPTH_STEP,
    recommended: RECOMMENDED_REVIEW_DEPTH,
  },
  {
    kind: 'toggle',
    key: 'reviewShowBestMoveArrows',
    label: 'Show best move arrows',
    description: 'Draw an arrow on the board for the engine best move during post-game evaluation.',
    accessibilityLabel: 'Show best move arrows in post-game evaluation',
  },
];
