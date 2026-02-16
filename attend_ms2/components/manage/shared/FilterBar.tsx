import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { spacing, radii } from '@/constants/theme';

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  color?: string;
}

interface FilterBarProps {
  title?: string;
  options: FilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  showCounts?: boolean;
  scrollable?: boolean;
  onReset?: () => void;
  resetLabel?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  title,
  options,
  selectedId,
  onSelect,
  showCounts = false,
  scrollable = true,
  onReset,
  resetLabel = 'Reset',
}) => {
  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? {
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        contentContainerStyle: styles.scrollContent,
      }
    : { style: styles.staticContent };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      <Container {...containerProps}>
        <View style={styles.optionsContainer}>
          {options.map((option) => {
            const isSelected = selectedId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.option,
                  isSelected && styles.selectedOption,
                  option.color && isSelected && { backgroundColor: option.color + '20' },
                ]}
                onPress={() => onSelect(option.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.selectedOptionText,
                    option.color && isSelected && { color: option.color },
                  ]}
                >
                  {option.label}
                </Text>
                {showCounts && option.count !== undefined && (
                  <View
                    style={[
                      styles.countBadge,
                      isSelected && styles.selectedCountBadge,
                      option.color && isSelected && { backgroundColor: option.color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        isSelected && styles.selectedCountText,
                      ]}
                    >
                      {option.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          
          {onReset && (
            <TouchableOpacity
              style={[styles.option, styles.resetOption]}
              onPress={onReset}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.resetText}>{resetLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Container>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.sm,
  },
  staticContent: {
    paddingHorizontal: spacing.sm,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
  },
  selectedOption: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  selectedOptionText: {
    color: colors.primary,
    fontWeight: '600',
  },
  countBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.textSecondary,
    borderRadius: radii.pill,
    minWidth: 20,
    alignItems: 'center',
  },
  selectedCountBadge: {
    backgroundColor: colors.primary,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },
  selectedCountText: {
    color: colors.card,
  },
  resetOption: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
});

export default FilterBar;
