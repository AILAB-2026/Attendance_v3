import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    label?: string;
  };
  onPress?: () => void;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  trend,
  onPress,
  loading = false,
  variant = 'default',
}) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.success + '10', accent: colors.success };
      case 'warning':
        return { bg: colors.warning + '10', accent: colors.warning };
      case 'error':
        return { bg: colors.error + '10', accent: colors.error };
      case 'info':
        return { bg: colors.primary + '10', accent: colors.primary };
      default:
        return { bg: colors.card, accent: colors.primary };
    }
  };

  const variantColors = getVariantColors();

  const getTrendIcon = () => {
    switch (trend?.direction) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  const getTrendColor = () => {
    switch (trend?.direction) {
      case 'up':
        return colors.success;
      case 'down':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.container,
        { backgroundColor: variantColors.bg },
        onPress && styles.pressable,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={iconColor || variantColors.accent}
              style={styles.icon}
            />
          )}
          <Text style={styles.title}>{title}</Text>
        </View>
        
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons
              name={getTrendIcon()}
              size={16}
              color={getTrendColor()}
              style={styles.trendIcon}
            />
            <Text style={[styles.trendValue, { color: getTrendColor() }]}>
              {trend.value}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingBar} />
            <View style={[styles.loadingBar, { width: '60%', marginTop: spacing.xs }]} />
          </View>
        ) : (
          <>
            <Text style={[styles.value, { color: variantColors.accent }]}>
              {value}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}
            {trend?.label && (
              <Text style={styles.trendLabel}>{trend.label}</Text>
            )}
          </>
        )}
      </View>

      {variant !== 'default' && (
        <View style={[styles.accent, { backgroundColor: variantColors.accent }]} />
      )}
    </Component>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.card,
    position: 'relative',
    overflow: 'hidden',
  },
  pressable: {
    transform: [{ scale: 1 }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    marginRight: spacing.xs / 2,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    minHeight: 40,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  trendLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  loadingContainer: {
    paddingVertical: spacing.xs,
  },
  loadingBar: {
    height: 12,
    backgroundColor: colors.textSecondary + '20',
    borderRadius: radii.sm,
    width: '80%',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
});

export default StatsCard;
