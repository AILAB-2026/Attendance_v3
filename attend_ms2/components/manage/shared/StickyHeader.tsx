import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import colors from '@/constants/colors';
import { spacing, shadows } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
}

const StickyHeader: React.FC<Props> = ({ children, style, accessibilityLabel }) => {
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, style as any]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    paddingTop: 0,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    marginTop: 0,
  },
});

export default StickyHeader;
