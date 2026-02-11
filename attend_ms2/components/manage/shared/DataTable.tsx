import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { spacing, radii } from '@/constants/theme';

interface Column {
  key: string;
  title: string;
  width?: number | string;
  sortable?: boolean;
  render?: (value: any, item: any) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  keyExtractor: (item: any) => string;
  onRowPress?: (item: any) => void;
  selectable?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  searchable?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
}

const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  keyExtractor,
  onRowPress,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  loading = false,
  emptyMessage = 'No data available',
  sortBy,
  sortDirection,
  onSort,
  searchable = false,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  const handleSort = (columnKey: string) => {
    if (!onSort) return;
    
    const newDirection = sortBy === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    
    const allIds = data.map(keyExtractor);
    const isAllSelected = allIds.every(id => selectedItems.includes(id));
    
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  };

  const handleSelectItem = (itemId: string) => {
    if (!onSelectionChange) return;
    
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];
    
    onSelectionChange(newSelection);
  };

  const renderHeader = () => (
    <View style={styles.headerRow}>
      {selectable && (
        <TouchableOpacity
          style={styles.checkboxCell}
          onPress={handleSelectAll}
        >
          <Ionicons
            name={
              selectedItems.length === data.length && data.length > 0
                ? 'checkbox'
                : selectedItems.length > 0
                ? 'checkbox-outline'
                : 'square-outline'
            }
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
      
      {columns.map((column) => (
        <TouchableOpacity
          key={column.key}
          style={[
            styles.headerCell,
            column.width && { width: typeof column.width === 'number' ? column.width : undefined },
            column.align === 'center' && styles.centerAlign,
            column.align === 'right' && styles.rightAlign,
          ]}
          onPress={() => column.sortable && handleSort(column.key)}
          disabled={!column.sortable}
        >
          <Text style={styles.headerText}>{column.title}</Text>
          {column.sortable && sortBy === column.key && (
            <Ionicons
              name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.primary}
              style={styles.sortIcon}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRow = ({ item }: { item: any }) => {
    const itemId = keyExtractor(item);
    const isSelected = selectedItems.includes(itemId);

    return (
      <TouchableOpacity
        style={[styles.dataRow, isSelected && styles.selectedRow]}
        onPress={() => onRowPress?.(item)}
        activeOpacity={0.7}
      >
        {selectable && (
          <TouchableOpacity
            style={styles.checkboxCell}
            onPress={() => handleSelectItem(itemId)}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
        
        {columns.map((column) => (
          <View
            key={column.key}
            style={[
              styles.dataCell,
              column.width && { width: typeof column.width === 'number' ? column.width : undefined },
              column.align === 'center' && styles.centerAlign,
              column.align === 'right' && styles.rightAlign,
            ]}
          >
            {column.render ? (
              column.render(item[column.key], item)
            ) : (
              <Text style={styles.cellText} numberOfLines={2}>
                {String(item[column.key] || '')}
              </Text>
            )}
          </View>
        ))}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={48} color={colors.textSecondary} />
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {searchable && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textSecondary}
            value={localSearchQuery}
            onChangeText={(text) => {
              setLocalSearchQuery(text);
              onSearchChange?.(text);
            }}
          />
          {localSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setLocalSearchQuery('');
                onSearchChange?.('');
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        style={styles.table}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    marginLeft: spacing.sm,
  },
  table: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  headerCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sortIcon: {
    marginLeft: spacing.xs,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedRow: {
    backgroundColor: colors.primary + '10',
  },
  checkboxCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataCell: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  centerAlign: {
    alignItems: 'center',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  cellText: {
    fontSize: 14,
    color: colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});

export default DataTable;
