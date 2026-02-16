import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';

interface ActionSheetOption {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
  onSelect: (optionId: string) => void;
}

const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  options,
  onSelect,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close action sheet">
        <View style={styles.container}>
          <Pressable onPress={(e) => e.stopPropagation()} accessibilityRole="menu">
            <View style={styles.handle} />
            {(title || subtitle) && (
              <View style={styles.header}>
                {title && <Text style={styles.title}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            )}

            <View style={styles.optionsContainer}>
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="menuitem"
                  accessibilityState={{ disabled: !!option.disabled }}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && !option.disabled && styles.optionPressed,
                    option.disabled && styles.optionDisabled,
                  ]}
                  onPress={async () => {
                    if (!option.disabled) {
                      try { await Haptics.selectionAsync(); } catch {}
                      onSelect(option.id);
                      onClose();
                    }
                  }}
                  disabled={option.disabled}
                >
                  {option.icon && (
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={
                        option.disabled
                          ? colors.textSecondary
                          : option.destructive
                          ? colors.error
                          : option.color || colors.text
                      }
                      style={styles.optionIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      option.disabled && styles.optionTextDisabled,
                      option.destructive && styles.optionTextDestructive,
                      option.color && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel and close">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: spacing.xl,
    ...shadows.card,
    borderTopWidth: 1,
    borderColor: colors.border + '40',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  optionsContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  optionPressed: {
    backgroundColor: colors.primary + '08',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    marginRight: spacing.sm,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  optionTextDisabled: {
    color: colors.textSecondary,
  },
  optionTextDestructive: {
    color: colors.error,
  },
  cancelButton: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});

export default ActionSheet;
