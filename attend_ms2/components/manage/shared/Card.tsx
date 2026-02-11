import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';

export type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'default' | 'subtle' | 'outlined';
  padded?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: any;
};

const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padded = true,
  accessibilityLabel,
  accessibilityRole,
}) => {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        styles.card,
        variant === 'subtle' && styles.cardSubtle,
        variant === 'outlined' && styles.cardOutlined,
        padded ? styles.cardPadded : null,
        style as any,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    ...shadows.card,
  },
  cardPadded: {
    padding: spacing.md,
  },
  cardSubtle: {
    ...shadows.subtle,
  },
  cardOutlined: {
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default Card;
