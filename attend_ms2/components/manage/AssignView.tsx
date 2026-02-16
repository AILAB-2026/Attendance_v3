import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { spacing } from '@/constants/theme';
import DateRangePicker from '@/components/DateRangePicker';
import { apiService } from '@/lib/api';
import Chip from '@/components/manage/shared/Chip';
import { formatDateLocal } from '@/lib/date';

interface AssignViewProps {
  assignForm: {
    employeeNos: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    siteName?: string;
    projectName?: string;
    notes?: string;
  };
  setAssignForm: React.Dispatch<React.SetStateAction<{
    employeeNos: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    siteName?: string;
    projectName?: string;
    notes?: string;
  }>>;
  assignBusy: boolean;
  setAssignBusy: React.Dispatch<React.SetStateAction<boolean>>;
  schedOptions: { sites?: Array<{ id: string; name: string }>; projects?: Array<{ id: string; name: string }> } | null;
  setSitePickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSiteSearch: React.Dispatch<React.SetStateAction<string>>;
  setProjectSearch: React.Dispatch<React.SetStateAction<string>>;
  user: any;
  today: Date;
  styles: any;
}

const AssignView: React.FC<AssignViewProps> = ({
  assignForm,
  setAssignForm,
  assignBusy,
  setAssignBusy,
  schedOptions,
  setSitePickerOpen,
  setProjectPickerOpen,
  setSiteSearch,
  setProjectSearch,
  user,
  today,
  styles
}) => {
  const handleAssign = async () => {
    try {
      setAssignBusy(true);
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const list = assignForm.employeeNos
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(Boolean);
      
      if (!list.length) {
        Alert.alert('Validation', 'Please enter at least one employee number');
        setAssignBusy(false);
        return;
      }
      
      const hhmm = /^\d{1,2}:\d{2}$/;
      if (!hhmm.test(assignForm.startTime) || !hhmm.test(assignForm.endTime)) {
        Alert.alert('Validation', 'Time must be HH:MM');
        setAssignBusy(false);
        return;
      }
      
      await (apiService as any).adminBulkAssignSchedules(companyCode, employeeNo, {
        employeeNos: list,
        startDate: assignForm.startDate,
        endDate: assignForm.endDate,
        startTime: assignForm.startTime,
        endTime: assignForm.endTime,
        shiftCode: undefined,
        location: assignForm.siteName || assignForm.projectName || undefined,
        siteName: assignForm.siteName || undefined,
        projectName: assignForm.projectName || undefined,
        notes: assignForm.notes || undefined,
      });
      
      Alert.alert('Success', 'Assignments created/updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to assign');
    } finally {
      setAssignBusy(false);
    }
  };

  const handleReset = () => {
    setAssignForm({
      employeeNos: '',
      startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: formatDateLocal(today),
      startTime: '09:00',
      endTime: '18:00',
      siteName: '',
      projectName: '',
      notes: ''
    });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0, default: 0 })}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View 
          style={[styles.sectionCard, { marginBottom: spacing.md }]}
          accessibilityRole="header"
          accessibilityLabel="Bulk assignment form"
        >
          <Text style={styles.sectionTitle}>Bulk Assignments</Text>
          <Text 
            style={styles.helpText}
            accessibilityRole="text"
            accessibilityLabel="Instructions: Assign a site/project and working hours to multiple employees at once. Paste a list of employee numbers or separate them with commas."
          >
            Assign a site/project and working hours to multiple employees at once. 
            Paste a list of employee numbers or separate them with commas.
          </Text>
        </View>
        
        <View style={styles.filtersRow}>
          <Text 
            style={styles.label}
            accessibilityRole="text"
            accessibilityLabel="Employee numbers input field"
          >
            Employees
          </Text>
          <TextInput
            style={[styles.searchInput, { minHeight: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="Enter employee numbers separated by comma or newline (e.g., E001,E002)"
            placeholderTextColor={colors.textSecondary}
            value={assignForm.employeeNos}
            onChangeText={(t) => setAssignForm(f => ({ ...f, employeeNos: t }))}
            accessibilityLabel="Employee numbers input"
            accessibilityHint="Enter multiple employee numbers separated by commas or new lines"
            accessibilityRole="text"
          />
          <Text 
            style={styles.helpText}
            accessibilityRole="text"
            accessibilityLabel={`Detected ${assignForm.employeeNos.split(/[\n,]/).map(s => s.trim()).filter(Boolean).length} employees`}
          >
            Detected: <Text style={styles.countPill}>
              {assignForm.employeeNos.split(/[\n,]/).map(s => s.trim()).filter(Boolean).length}
            </Text> employees
          </Text>
          
          <Text 
            style={styles.label}
            accessibilityRole="text"
            accessibilityLabel="Date range selection"
          >
            Date Range
          </Text>
          <DateRangePicker 
            value={{ startDate: assignForm.startDate, endDate: assignForm.endDate }} 
            onChange={(v) => setAssignForm(f => ({ ...f, startDate: v.startDate, endDate: v.endDate }))}
          />
          
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text 
                style={styles.label}
                accessibilityRole="text"
                accessibilityLabel="Start time input"
              >
                Start Time
              </Text>
              <TextInput 
                style={styles.searchInput} 
                placeholder="HH:MM" 
                placeholderTextColor={colors.textSecondary} 
                value={assignForm.startTime} 
                onChangeText={(t) => setAssignForm(f => ({ ...f, startTime: t }))}
                accessibilityLabel="Start time"
                accessibilityHint="Enter start time in HH:MM format"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text 
                style={styles.label}
                accessibilityRole="text"
                accessibilityLabel="End time input"
              >
                End Time
              </Text>
              <TextInput 
                style={styles.searchInput} 
                placeholder="HH:MM" 
                placeholderTextColor={colors.textSecondary} 
                value={assignForm.endTime} 
                onChangeText={(t) => setAssignForm(f => ({ ...f, endTime: t }))}
                accessibilityLabel="End time"
                accessibilityHint="Enter end time in HH:MM format"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
          
          <View 
            style={{ flexDirection: 'row', marginTop: spacing.xs }}
            accessibilityRole="toolbar"
            accessibilityLabel="Time presets"
          >
            <Chip 
              label="Preset: MOR 09:00-18:00"
              onPress={() => setAssignForm(f => ({ ...f, startTime: '09:00', endTime: '18:00' }))}
              accessibilityLabel="Set morning shift: 9 AM to 6 PM"
            />
            <Chip 
              label="Preset: NGT 20:00-05:00"
              onPress={() => setAssignForm(f => ({ ...f, startTime: '20:00', endTime: '05:00' }))}
              accessibilityLabel="Set night shift: 8 PM to 5 AM"
            />
          </View>
          
          <Text style={styles.label}>Site Name</Text>
          <View style={{ flexDirection: 'row' }}>
            <TextInput 
              style={[styles.searchInput, { flex: 1, marginRight: spacing.sm }]} 
              placeholder="Optional" 
              placeholderTextColor={colors.textSecondary} 
              value={assignForm.siteName} 
              onChangeText={(t) => setAssignForm(f => ({ ...f, siteName: t }))} 
            />
            <TouchableOpacity 
              style={styles.ghostBtn} 
              onPress={() => { setSiteSearch(''); setSitePickerOpen(true); }}
            >
              <Text style={styles.ghostBtnText}>
                <Ionicons name="chevron-down-outline" size={12} /> Choose
              </Text>
            </TouchableOpacity>
          </View>
          
          {!!schedOptions?.sites?.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <View style={styles.filterChips}>
                {(schedOptions?.sites ?? []).slice(0, 12).map((s) => (
                  <Chip 
                    key={s.id}
                    label={s.name}
                    onPress={() => setAssignForm(f => ({ ...f, siteName: s.name }))}
                    accessibilityLabel={`Pick site ${s.name}`}
                  />
                ))}
              </View>
            </ScrollView>
          )}
          
          <Text style={styles.label}>Project Name</Text>
          <View style={{ flexDirection: 'row' }}>
            <TextInput 
              style={[styles.searchInput, { flex: 1, marginRight: spacing.sm }]} 
              placeholder="Optional" 
              placeholderTextColor={colors.textSecondary} 
              value={assignForm.projectName} 
              onChangeText={(t) => setAssignForm(f => ({ ...f, projectName: t }))} 
            />
            <TouchableOpacity 
              style={styles.ghostBtn} 
              onPress={() => { setProjectSearch(''); setProjectPickerOpen(true); }}
            >
              <Text style={styles.ghostBtnText}>
                <Ionicons name="chevron-down-outline" size={12} /> Choose
              </Text>
            </TouchableOpacity>
          </View>
          
          {!!schedOptions?.projects?.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <View style={styles.filterChips}>
                {(schedOptions?.projects ?? []).slice(0, 12).map((p) => (
                  <Chip 
                    key={p.id}
                    label={p.name}
                    onPress={() => setAssignForm(f => ({ ...f, projectName: p.name }))}
                    accessibilityLabel={`Pick project ${p.name}`}
                  />
                ))}
              </View>
            </ScrollView>
          )}
          
          <Text style={styles.label}>Notes</Text>
          <TextInput 
            style={[styles.searchInput, { minHeight: 60, textAlignVertical: 'top' }]} 
            multiline 
            placeholder="Optional" 
            placeholderTextColor={colors.textSecondary} 
            value={assignForm.notes} 
            onChangeText={(t) => setAssignForm(f => ({ ...f, notes: t }))} 
          />
        </View>
        
        <View 
          style={{ flexDirection: 'row' }}
          accessibilityRole="toolbar"
          accessibilityLabel="Form actions"
        >
          <TouchableOpacity 
            style={[styles.primaryBtn, assignBusy && { opacity: 0.6 }, { marginRight: spacing.sm }]} 
            disabled={assignBusy} 
            onPress={handleAssign}
            accessibilityRole="button"
            accessibilityLabel={assignBusy ? "Creating assignments, please wait" : "Create bulk assignments"}
            accessibilityState={{ disabled: assignBusy }}
            accessibilityHint="Creates schedule assignments for all specified employees"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.primaryBtnText}>{assignBusy ? 'Assigning...' : 'Assign'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={handleReset}
            accessibilityRole="button"
            accessibilityLabel="Reset form"
            accessibilityHint="Clears all form fields and resets to default values"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.secondaryBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AssignView;
