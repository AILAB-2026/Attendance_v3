import React from 'react';
import { Text, TouchableOpacity, StyleSheet, GestureResponderEvent, ViewStyle } from 'react-native';
import colors from '@/constants/colors';
import { spacing, radii } from '@/constants/theme';

export type ChipVariant = 'default' | 'active' | 'ghost' | 'danger' | 'primary' | 'secondary';

export interface ChipProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  selected?: boolean;
  variant?: ChipVariant;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  accessibilityRole?: any;
}

const Chip: React.FC<ChipProps> = ({
  label,
  onPress,
  selected,
  variant = 'default',
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}) => {
  const v = selected ? 'active' : variant;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.8}
      style={[styles.base, styles[v], style as any]}
    >
      <Text style={[styles.text, (v === 'active' || v === 'primary' || v === 'secondary') && styles.textOnAccent]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.xs,
  },
  text: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  textOnAccent: {
    color: '#fff',
  },
  default: {},
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.error + '15',
    borderColor: colors.error + '40',
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
});

export default Chip;
