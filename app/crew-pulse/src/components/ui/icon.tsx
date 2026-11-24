import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { C } from '@/constants/crew-theme';

/** Eigene Linien-Icons im CrewPulse-Stil (1.8–2 px, runde Enden) */
export type IconName =
  | 'back'
  | 'chevron'
  | 'info'
  | 'plus'
  | 'mic'
  | 'send'
  | 'camera'
  | 'image'
  | 'chat'
  | 'map'
  | 'search'
  | 'shield'
  | 'bell'
  | 'bellOff'
  | 'share'
  | 'refresh'
  | 'reply'
  | 'edit'
  | 'trash'
  | 'eye'
  | 'check'
  | 'checks'
  | 'close'
  | 'play'
  | 'pause'
  | 'user'
  | 'code'
  | 'pulse'
  | 'flash'
  | 'pen'
  | 'text'
  | 'undo'
  | 'timer'
  | 'download';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color = C.accent, strokeWidth = 1.9 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  const content = (() => {
    switch (name) {
      case 'back':
        return <Path d="M15 18l-6-6 6-6" {...stroke} />;
      case 'chevron':
        return <Path d="M9 6l6 6-6 6" {...stroke} />;
      case 'info':
        return (
          <>
            <Circle cx={12} cy={12} r={9} {...stroke} />
            <Path d="M12 11v5M12 8h.01" {...stroke} />
          </>
        );
      case 'plus':
        return <Path d="M12 5v14M5 12h14" {...stroke} />;
      case 'mic':
        return (
          <>
            <Rect x={9} y={3} width={6} height={11} rx={3} {...stroke} />
            <Path d="M5 11a7 7 0 0014 0M12 18v3" {...stroke} />
          </>
        );
      case 'send':
        return <Path d="M4 12l16-8-6 16-2-6z" {...stroke} />;
      case 'camera':
        return (
          <>
            <Path d="M4 8h3l2-3h6l2 3h3v11H4z" {...stroke} />
            <Circle cx={12} cy={13} r={3.5} {...stroke} />
          </>
        );
      case 'image':
        return (
          <>
            <Rect x={3} y={4} width={18} height={16} rx={3} {...stroke} />
            <Path d="M3 16l5-5 4 4 3-3 6 6" {...stroke} />
            <Circle cx={16} cy={9} r={1.5} {...stroke} />
          </>
        );
      case 'chat':
        return <Path d="M4 5h16v11H9l-5 4z" {...stroke} />;
      case 'map':
        return (
          <>
            <Path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z" {...stroke} />
            <Circle cx={12} cy={10} r={2.2} {...stroke} />
          </>
        );
      case 'search':
        return (
          <>
            <Circle cx={11} cy={11} r={7} {...stroke} />
            <Path d="M20 20l-4-4" {...stroke} />
          </>
        );
      case 'shield':
        return <Path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4" {...stroke} />;
      case 'bell':
        return <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" {...stroke} />;
      case 'bellOff':
        return <Path d="M18 8a6 6 0 00-9.3-5M6 8c0 7-3 9-3 9h14M13.7 21a2 2 0 01-3.4 0M3 3l18 18" {...stroke} />;
      case 'share':
        return <Path d="M12 15V3M7 8l5-5 5 5M5 13v6h14v-6" {...stroke} />;
      case 'refresh':
        return <Path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" {...stroke} />;
      case 'reply':
        return <Path d="M9 7L4 12l5 5M4 12h11a5 5 0 015 5" {...stroke} />;
      case 'edit':
        return <Path d="M4 20h4L19 9l-4-4L4 16z" {...stroke} />;
      case 'trash':
        return <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" {...stroke} />;
      case 'eye':
        return (
          <>
            <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" {...stroke} />
            <Circle cx={12} cy={12} r={3} {...stroke} />
          </>
        );
      case 'check':
        return <Path d="M5 12l5 5 9-10" {...stroke} />;
      case 'checks':
        return <Path d="M2 13l4 4 8-9M10 16l1 1 9-10" {...stroke} />;
      case 'close':
        return <Path d="M6 6l12 12M18 6L6 18" {...stroke} />;
      case 'play':
        return <Path d="M7 4.5v15l13-7.5z" fill={color} stroke="none" />;
      case 'pause':
        return (
          <>
            <Rect x={6} y={4.5} width={4} height={15} rx={1.2} fill={color} />
            <Rect x={14} y={4.5} width={4} height={15} rx={1.2} fill={color} />
          </>
        );
      case 'user':
        return (
          <>
            <Circle cx={12} cy={8} r={4} {...stroke} />
            <Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" {...stroke} />
          </>
        );
      case 'code':
        return (
          <>
            <Rect x={4} y={4} width={16} height={16} rx={4} {...stroke} />
            <Path d="M9 10h6M9 14h4" {...stroke} />
          </>
        );
      case 'pulse':
        return <Path d="M2.5 12.5h4l2-4.5 3.5 9 2.5-6 1.5 1.5h5.5" {...stroke} />;
      case 'flash':
        return <Path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" {...stroke} />;
      case 'pen':
        return <Path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" {...stroke} />;
      case 'text':
        return <Path d="M5 6V4h14v2M12 4v16M9 20h6" {...stroke} />;
      case 'undo':
        return <Path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" {...stroke} />;
      case 'timer':
        return (
          <>
            <Circle cx={12} cy={13} r={8} {...stroke} />
            <Path d="M12 9v4l2.5 2M9 2h6" {...stroke} />
          </>
        );
      case 'download':
        return <Path d="M12 3v12M7 10l5 5 5-5M5 20h14" {...stroke} />;
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {content}
    </Svg>
  );
}
