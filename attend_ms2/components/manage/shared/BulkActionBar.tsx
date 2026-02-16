import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';

interface BulkAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  destructive?: boolean;
}

interface BulkActionBarProps {
  visible: boolean;
  selectedCount: number;
  actions: BulkAction[];
  onAction: (actionId: string) => void;
  onClear: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  visible,
  selectedCount,
  actions,
  onAction,
  onClear,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, animatedValue]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <TouchableOpacity onPress={onClear} style={styles.clearButton}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.countText}>
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </Text>
        </View>

        <View style={styles.actionsSection}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionButton,
                action.destructive && styles.destructiveButton,
              ]}
              onPress={() => onAction(action.id)}
            >
              <Ionicons
                name={action.icon}
                size={18}
                color={
                  action.destructive
                    ? colors.error
                    : action.color || colors.primary
                }
              />
              <Text
                style={[
                  styles.actionText,
                  action.destructive && styles.destructiveText,
                  action.color && { color: action.color },
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.card,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.md + 20, // Account for safe area
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clearButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary + '15',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  destructiveButton: {
    backgroundColor: colors.error + '15',
    borderColor: colors.error + '30',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  destructiveText: {
    color: colors.error,
  },
});

export default BulkActionBar;
