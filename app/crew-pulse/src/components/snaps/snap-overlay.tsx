import { StyleSheet } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

import type { SnapOverlay } from '@/services/snaps';

type Props = {
  overlay: SnapOverlay | null;
  /** Gerade gezeichneter Strich (im Editor) */
  livePath?: { d: string; c: string; s: number } | null;
  /** Bildunterschrift im Editor ausblenden, während sie bearbeitet wird */
  hideCaption?: boolean;
};

/** Grösse der Bildunterschrift relativ zur Bildbreite (gleich im Editor und beim Ansehen) */
export function captionMetrics(w: number) {
  const fontSize = w * 0.045;
  return { fontSize, barHeight: fontSize * 2 };
}

/**
 * Zeichnung + Text über dem Foto. Gleiches "cover"-Verhalten wie das Foto
 * (preserveAspectRatio slice), dadurch liegt alles auf jedem Bildschirm an der gleichen Stelle.
 */
export function SnapOverlayView({ overlay, livePath, hideCaption }: Props) {
  if (!overlay && !livePath) return null;
  const w = overlay?.w ?? 1;
  const h = overlay?.h ?? 1;
  const caption = overlay?.caption;
  const { fontSize, barHeight } = captionMetrics(w);

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none">
      {overlay?.paths.map((p, i) => (
        <Path key={i} d={p.d} stroke={p.c} strokeWidth={p.s} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {livePath ? (
        <Path d={livePath.d} stroke={livePath.c} strokeWidth={livePath.s} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : null}
      {caption && !hideCaption ? (
        <>
          <Rect x={0} y={caption.y - barHeight / 2} width={w} height={barHeight} fill="rgba(10,13,20,0.6)" />
          <SvgText
            x={w / 2}
            y={caption.y + fontSize * 0.35}
            fill="#FFFFFF"
            fontSize={fontSize}
            fontWeight="600"
            textAnchor="middle">
            {caption.text}
          </SvgText>
        </>
      ) : null}
    </Svg>
  );
}
