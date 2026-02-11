import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { apiService } from '@/lib/api';
import colors from '@/constants/colors';

interface AssignmentSyncViewProps {
  companyCode: string;
  employeeNo: string;
}

interface ConsistencyReport {
  tableName: string;
  issues: Array<{
    type: 'error' | 'warning';
    description: string;
    count: number;
    query?: string;
  }>;
  totalRecords: number;
  lastChecked: string;
}

export default function AssignmentSyncView({ companyCode, employeeNo }: AssignmentSyncViewProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [reports, setReports] = useState<ConsistencyReport[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const handleCheckSync = async () => {
    try {
      setIsChecking(true);
      const response = await apiService.adminCheckAssignmentSync(companyCode, employeeNo);

      if (response.success && response.data) {
        setReports(response.data);
        setLastCheck(new Date());

        const totalIssues = response.data.reduce((sum: number, report: ConsistencyReport) =>
          sum + report.issues.reduce((issueSum, issue) => issueSum + issue.count, 0), 0
        );

        if (totalIssues === 0) {
          Alert.alert('✅ All Good!', 'No assignment synchronization issues found.');
        } else {
          Alert.alert('⚠️ Issues Found', `Found ${totalIssues} synchronization issues. Review the details below.`);
        }
      } else {
        Alert.alert('Error', 'Failed to check assignment synchronization');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to check assignment synchronization');
    } finally {
      setIsChecking(false);
    }
  };

  const handleFixSync = async () => {
    try {
      setIsFixing(true);
      const response = await apiService.adminFixAssignmentSync(companyCode, employeeNo);

      if (response.success && response.data) {
        const { fixed, errors } = response.data;

        if (fixed > 0) {
          Alert.alert(
            '✅ Fixed Issues',
            `Successfully fixed ${fixed} synchronization issues.${errors.length > 0 ? `\n\nSome errors occurred:\n${errors.slice(0, 3).join('\n')}` : ''}`,
            [{ text: 'OK', onPress: () => handleCheckSync() }]
          );
        } else if (errors.length > 0) {
          Alert.alert('⚠️ Fix Failed', `No issues were fixed.\n\nErrors:\n${errors.slice(0, 3).join('\n')}`);
        } else {
          Alert.alert('ℹ️ Nothing to Fix', 'No synchronization issues were found to fix.');
        }
      } else {
        Alert.alert('Error', 'Failed to fix assignment synchronization issues');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to fix assignment synchronization issues');
    } finally {
      setIsFixing(false);
    }
  };

  const getIssueIcon = (type: 'error' | 'warning') => {
    return type === 'error' ? '🔴' : '🟡';
  };

  const getIssueColor = (type: 'error' | 'warning') => {
    return type === 'error' ? colors.error : colors.warning;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Assignment Synchronization</Text>
        <Text style={styles.subtitle}>
          Check and fix synchronization between schedules and employee assignments
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.checkButton]}
          onPress={handleCheckSync}
          disabled={isChecking || isFixing}
          accessibilityRole="button"
          accessibilityLabel="Check assignment synchronization"
        >
          {isChecking ? (
            <CustomLoader size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>🔍 Check Sync</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.fixButton, (!reports.length || isChecking || isFixing) && styles.buttonDisabled]}
          onPress={handleFixSync}
          disabled={!reports.length || isChecking || isFixing}
          accessibilityRole="button"
          accessibilityLabel="Fix assignment synchronization issues"
        >
          {isFixing ? (
            <CustomLoader size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>🔧 Fix Issues</Text>
          )}
        </TouchableOpacity>
      </View>

      {lastCheck && (
        <Text style={styles.lastCheck}>
          Last checked: {lastCheck.toLocaleString()}
        </Text>
      )}

      {reports.length > 0 && (
        <View style={styles.reportsContainer}>
          <Text style={styles.reportsTitle}>Synchronization Report</Text>

          {reports.map((report, index) => (
            <View key={index} style={styles.reportCard}>
              <Text style={styles.reportTitle}>
                {report.tableName.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.reportMeta}>
                Total Records: {report.totalRecords}
              </Text>

              {report.issues.length === 0 ? (
                <View style={styles.noIssues}>
                  <Text style={styles.noIssuesText}>✅ No issues found</Text>
                </View>
              ) : (
                <View style={styles.issuesList}>
                  {report.issues.map((issue, issueIndex) => (
                    <View key={issueIndex} style={styles.issueItem}>
                      <View style={styles.issueHeader}>
                        <Text style={styles.issueIcon}>
                          {getIssueIcon(issue.type)}
                        </Text>
                        <Text style={[styles.issueCount, { color: getIssueColor(issue.type) }]}>
                          {issue.count}
                        </Text>
                      </View>
                      <Text style={styles.issueDescription}>
                        {issue.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row' as const,
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 44,
  },
  checkButton: {
    backgroundColor: colors.primary,
  },
  fixButton: {
    backgroundColor: colors.success,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  lastCheck: {
    textAlign: 'center' as const,
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  reportsContainer: {
    padding: 16,
  },
  reportsTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 12,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 4,
  },
  reportMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  noIssues: {
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
  },
  noIssuesText: {
    color: colors.success,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  issuesList: {
    gap: 8,
  },
  issueItem: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  issueHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  issueIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  issueCount: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    marginRight: 8,
  },
  issueDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 18,
  },
};
