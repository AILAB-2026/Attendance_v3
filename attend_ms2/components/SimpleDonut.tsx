import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

export type DonutSlice = {
  label: string;
  value: number; // absolute value
  color: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function SimpleDonut({ size = 160, stroke = 18, slices }: { size?: number; stroke?: number; slices: DonutSlice[]; }) {
  const total = Math.max(0, slices.reduce((s, d) => s + (isFinite(d.value) ? d.value : 0), 0));
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  let angle = 0;
  const arcs = total > 0 ? slices.map((d, idx) => {
    const pct = d.value / total;
    const sweep = pct * 360;
    const startAngle = angle;
    const endAngle = angle + sweep;
    angle = endAngle;
    const dPath = describeArc(cx, cy, radius, startAngle, endAngle);
    return (
      <Path key={`arc-${idx}`} d={dPath} stroke={d.color} strokeWidth={stroke} fill="none" strokeLinecap="butt" />
    );
  }) : null;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G>
          {/* Background ring */}
          <Circle cx={cx} cy={cy} r={radius} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
          {arcs}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
