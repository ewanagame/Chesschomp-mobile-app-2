import Svg, { Path } from 'react-native-svg';

export type ActionLeadingIconName =
  | 'rematch'
  | 'save'
  | 'home'
  | 'hint'
  | 'ultraHint'
  | 'lock'
  | 'lockOpen';

type ActionLeadingIconProps = {
  name: ActionLeadingIconName;
  color: string;
  size?: number;
};

const ICON_PATHS: Record<ActionLeadingIconName, string[]> = {
  rematch: [
    'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
    'M21 3v5h-5',
    'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
    'M8 16H3v5',
  ],
  save: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
  ],
  home: [
    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M9 22V12h6v10',
  ],
  hint: [
    'M9 18h6',
    'M10 22h4',
    'M15.09 14c.18-.98.65-1.74 1.41-2.5A5.86 5.86 0 0 0 17 9a5 5 0 0 0-10 0c0 1 .23 2.23 1.5 3.5A5.36 5.36 0 0 1 9.91 14',
  ],
  ultraHint: [
    'M9 18h6',
    'M10 22h4',
    'M15.09 14c.18-.98.65-1.74 1.41-2.5A5.86 5.86 0 0 0 17 9a5 5 0 0 0-10 0c0 1 .23 2.23 1.5 3.5A5.36 5.36 0 0 1 9.91 14',
    'M5 12h6',
    'M9 8l4 4-4 4',
  ],
  lock: ['M7 11V7a5 5 0 0 1 10 0v4', 'M5 11h14v10H5z'],
  lockOpen: ['M7 11V7a5 5 0 0 1 9.9-1', 'M5 11h14v10H5z'],
};

export default function ActionLeadingIcon({
  name,
  color,
  size = 15,
}: ActionLeadingIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ICON_PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
