import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,

  ScrollView,
  Alert,
} from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, Calendar, DollarSign, AlertCircle } from 'lucide-react-native';
import type { Router } from 'expo-router';

import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { API_BASE_URL } from '@/lib/http';
import { secureStorage } from '@/lib/secure-storage';

interface PayslipData {
  id: number;
  employeeId: number;
  employeeName: string;
  empNo: string;
  monthYear: string;
  month: string;
  year: string;
  payslipPeriod: string;
  payDate: string;
  basicSalary: number;
  allowance: number;
  deduction: number;
  totalSalary: number;
  grossPay: number;
  payslipUrl: string;
  status: string;
}

interface PayslipResponse {
  success: boolean;
  isActive: boolean;
  message?: string;
  data: PayslipData[];
  employee?: {
    id: number;
    name: string;
  };
}

export default function PayrollScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<PayslipData[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [inactiveMessage, setInactiveMessage] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if payroll is disabled for this company
    if (user && user.payrollEnable === false) {
      console.log('🚫 Payroll feature is disabled for this company. Redirecting to home.');
      router.replace('/(tabs)');
      return;
    }
    fetchPayslips();
  }, [user?.payrollEnable, router]);

  const fetchPayslips = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get token from secure storage
      const userData = await secureStorage.getUserData();
      if (!userData?.sessionToken) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/payroll/payslips`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userData.sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data: PayslipResponse = await response.json();

      if (!data.success) {
        setError(data.message || 'Failed to load payslips');
        return;
      }

      setIsActive(data.isActive);

      if (!data.isActive) {
        setInactiveMessage(data.message || '⚠️ Payslip access is restricted for inactive employees. Please contact HR for assistance.');
        setPayslips([]);
      } else {
        setPayslips(data.data || []);
      }

    } catch (err) {
      console.error('Error fetching payslips:', err);
      setError('Failed to load payslips. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleDownloadPayslip = (payslip: PayslipData) => {
    if (!payslip.payslipUrl) {
      Alert.alert('Error', 'Payslip URL not available');
      return;
    }

    // Open the payslip URL in browser
    Linking.openURL(payslip.payslipUrl).catch(err => {
      console.error('Error opening payslip:', err);
      Alert.alert('Error', 'Failed to open payslip. Please try again.');
    });
  };

  const renderPayslipCard = ({ item }: { item: PayslipData }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Month&Year</Text>
        <Text style={styles.cardTitle}>Pay Date</Text>
        <Text style={styles.cardTitle}>Basic Salary</Text>
      </View>

      <View style={styles.cardRow}>
        <Text style={styles.cardValue}>{item.monthYear}</Text>
        <Text style={[styles.cardValue, styles.payDateValue]}>{formatDate(item.payDate)}</Text>
        <Text style={[styles.cardValue, styles.salaryValue]}>{formatCurrency(item.basicSalary)}</Text>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Allowance</Text>
        <Text style={styles.cardTitle}>Deduction</Text>
        <Text style={styles.cardTitle}>Total Salary</Text>
      </View>

      <View style={styles.cardRow}>
        <Text style={styles.cardValue}>{formatCurrency(item.allowance)}</Text>
        <Text style={styles.cardValue}>{formatCurrency(item.deduction)}</Text>
        <Text style={[styles.cardValue, styles.totalValue]}>{formatCurrency(item.totalSalary)}</Text>
      </View>

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => handleDownloadPayslip(item)}
      >
        <Text style={styles.downloadButtonText}>Download Payslip</Text>
      </TouchableOpacity>
    </View>
  );

  const renderInactiveMessage = () => (
    <View style={styles.inactiveContainer}>
      <AlertCircle size={64} color={colors.warning} />
      <Text style={styles.inactiveTitle}>Account Inactive</Text>
      <Text style={styles.inactiveMessage}>{inactiveMessage}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={fetchPayslips}
      >
        <Text style={styles.retryButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <DollarSign size={48} color={colors.textSecondary} />
      <Text style={styles.emptyText}>No payslips available</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={fetchPayslips}
      >
        <Text style={styles.retryButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoader size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading payslips...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color={colors.error} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchPayslips}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isActive) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>Payslips for the Last 12 Months</Text>
        {renderInactiveMessage()}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={payslips}
        renderItem={renderPayslipCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.pageTitle}>Payslips for the Last 12 Months</Text>
        }
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={fetchPayslips}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'left',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'left',
  },
  payDateValue: {
    color: '#22c55e',
  },
  salaryValue: {
    color: '#3b82f6',
  },
  totalValue: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  downloadButton: {
    backgroundColor: '#3b82f6',
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  inactiveContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl * 2,
  },
  inactiveTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  inactiveMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
