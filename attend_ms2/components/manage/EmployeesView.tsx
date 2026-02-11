import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet, ScrollView, Alert, LayoutAnimation, Platform, UIManager, Pressable, RefreshControl, Linking, Share } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
// Note: These packages need to be installed for full functionality:
// npm install expo-file-system expo-sharing expo-print expo-media-library
// For now, we'll use fallback implementations
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';
import Chip from '@/components/manage/shared/Chip';
import StickyHeader from '@/components/manage/shared/StickyHeader';
import ActionSheet from '@/components/manage/shared/ActionSheet';
import BulkActionBar from '@/components/manage/shared/BulkActionBar';
import FilterBar from '@/components/manage/shared/FilterBar';
import StatsCard from '@/components/manage/shared/StatsCard';
import { apiService } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { formatDateLocal } from '@/lib/date';

interface EmployeesViewProps {
  loading: boolean;
  empRefreshing: boolean;
  setEmpRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  load: () => Promise<void>;
  items: Array<any>;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  roleFilter: 'all' | 'employee' | 'manager' | 'admin';
  setRoleFilter: React.Dispatch<React.SetStateAction<'all' | 'employee' | 'manager' | 'admin'>>;
  statusFilter: 'all' | 'active' | 'inactive';
  setStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'active' | 'inactive'>>;
  total: number;
  compact: boolean;
  setEditUser: React.Dispatch<React.SetStateAction<any>>;
  page: number;
  styles: any;
  onQuickToggleActive?: (userId: string, nextActive: boolean) => Promise<void>;
  sortBy?: 'name-asc' | 'name-desc' | 'role' | 'status';
  setSortBy?: React.Dispatch<React.SetStateAction<'name-asc' | 'name-desc' | 'role' | 'status'>>;
  setCompact: React.Dispatch<React.SetStateAction<boolean>>;
  onBulkAction?: (action: string, selectedIds: string[]) => Promise<void>;
  onExport?: (format: 'csv' | 'excel') => Promise<void>;
  onUpdateUser?: (userId: string, updates: { name?: string; email?: string; role?: 'employee' | 'manager' | 'admin'; isActive?: boolean }) => Promise<void>;
}

const EmployeesView: React.FC<EmployeesViewProps> = ({
  loading,
  empRefreshing,
  setEmpRefreshing,
  load,
  items,
  query,
  setQuery,
  setPage,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  total,
  compact,
  setEditUser,
  page,
  styles,
  onQuickToggleActive,
  sortBy,
  setSortBy,
  setCompact,
  onBulkAction,
  onExport,
  onUpdateUser
}) => {
  const { user } = useAuth();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  // Enable smooth layout transitions
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      try { UIManager.setLayoutAnimationEnabledExperimental(true); } catch { }
    }
  }, []);
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [viewMode]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'employee' as 'employee' | 'manager' | 'admin', isActive: true, phone: '', department: '' });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [editErrors, setEditErrors] = useState<{ name?: string; email?: string }>({});
  const [originalForm, setOriginalForm] = useState<{ name: string; email: string; role: 'employee' | 'manager' | 'admin'; isActive: boolean; phone: string; department: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ type: 'deactivate' | 'role-change', user?: any } | null>(null);
  const [quickEditingUser, setQuickEditingUser] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [profileImageUploading, setProfileImageUploading] = useState(false);

  const isDirty = useMemo(() => {
    if (!originalForm) return false;
    return (
      originalForm.name !== editForm.name ||
      (originalForm.email || '') !== (editForm.email || '') ||
      originalForm.role !== editForm.role ||
      originalForm.isActive !== editForm.isActive ||
      (originalForm.phone || '') !== (editForm.phone || '') ||
      (originalForm.department || '') !== (editForm.department || '')
    );
  }, [originalForm, editForm]);

  const validateForm = (f: typeof editForm) => {
    const errs: { name?: string; email?: string } = {};
    if (!String(f.name || '').trim()) errs.name = 'Name is required';
    else if (String(f.name || '').trim().length < 2) errs.name = 'Name must be at least 2 characters';
    else if (String(f.name || '').trim().length > 50) errs.name = 'Name must be less than 50 characters';

    if (String(f.email || '').trim()) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(f.email)) errs.email = 'Enter a valid email address';
      else if (f.email.length > 100) errs.email = 'Email must be less than 100 characters';
    }
    return errs;
  };

  const confirmAssignMeeting = async () => {
    try {
      const companyCode = user?.companyCode;
      const employeeNo = user?.employeeNo;

      if (!companyCode || !employeeNo) { Alert.alert('Error', 'Missing approver context'); return; }
      if (!selectedMeetingId) { Alert.alert('Select Meeting', 'Please select a meeting to assign.'); return; }
      if (!selectedEmployees.length) { Alert.alert('Select employees', 'Please select one or more employees.'); return; }
      setAssignLoading(true);
      const meetingId = selectedMeetingId as string;
      const results = await Promise.allSettled(
        selectedEmployees.map(async (empId) => {
          const target = items.find((it) => it.id === empId);
          if (!target?.empNo) throw new Error('Missing empNo');
          await apiService.assignToolboxMeeting(companyCode, employeeNo, target.empNo as string, meetingId);
          return target.empNo;
        })
      );
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      try { await Haptics.notificationAsync(ok > 0 && fail === 0 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning); } catch { }
      Alert.alert('Assignment Complete', `Assigned: ${ok}${fail ? `\nFailed: ${fail}` : ''}`);
      setAssignModalVisible(false);
      setSelectedMeetingId(null);
      setSelectedEmployees([]);
    } catch (e) {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { }
      Alert.alert('Error', 'Failed to assign meeting.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const activeCount = items.filter(item => item.isActive).length;
    const inactiveCount = items.length - activeCount;
    const roleStats = items.reduce((acc, item) => {
      acc[item.role] = (acc[item.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { activeCount, inactiveCount, roleStats };
  }, [items]);

  // Helper functions
  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.length === items.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(items.map(item => item.id));
    }
  };

  // Filter options with counts
  const roleOptions = useMemo(() => [
    { id: 'all', label: 'All Roles', count: items.length },
    { id: 'employee', label: 'Employee', count: stats.roleStats.employee || 0 },
    { id: 'manager', label: 'Manager', count: stats.roleStats.manager || 0 },
    { id: 'admin', label: 'Admin', count: stats.roleStats.admin || 0 },
  ], [stats, items.length]);

  const statusOptions = useMemo(() => [
    { id: 'all', label: 'All Status', count: items.length },
    { id: 'active', label: 'Active', count: stats.activeCount, color: colors.success },
    { id: 'inactive', label: 'Inactive', count: stats.inactiveCount, color: colors.error },
  ], [stats, items.length]);

  // Bulk actions
  const bulkActions = [
    { id: 'activate', label: 'Activate', icon: 'checkmark-circle-outline' as const, color: colors.success },
    { id: 'deactivate', label: 'Deactivate', icon: 'close-circle-outline' as const, destructive: true },
    { id: 'export_selected', label: 'Export Selected', icon: 'download-outline' as const },
    { id: 'send_notification', label: 'Send Notification', icon: 'mail-outline' as const },
    { id: 'assign_toolbox', label: 'Assign Toolbox Meeting', icon: 'calendar-outline' as const },
  ];

  // Action sheet options
  const actionSheetOptions = [
    { id: 'export_csv', label: 'Export as CSV', icon: 'document-text-outline' as const },
    { id: 'export_excel', label: 'Export as Excel', icon: 'grid-outline' as const },
    { id: 'import_employees', label: 'Import Employees', icon: 'cloud-upload-outline' as const },
    { id: 'bulk_edit', label: 'Bulk Edit', icon: 'create-outline' as const },
  ];

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [availableMeetings, setAvailableMeetings] = useState<Array<{ id: string; title: string; meetingDate: string; presenterName?: string }>>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const loadAvailableMeetings = async () => {
    try {
      if (!user?.companyCode || !user?.employeeNo) return;
      setAssignLoading(true);
      // Managers pick from upcoming meetings; assignedOnly=false to list all
      const resp: any = await apiService.getToolboxMeetings(user.companyCode, user.employeeNo, true, false);
      const list = Array.isArray(resp) ? resp : resp?.data || [];
      setAvailableMeetings(list.map((m: any) => ({ id: m.id, title: m.title, meetingDate: m.meetingDate, presenterName: m.presenterName })));
    } catch (e) {
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleBulkAction = async (actionId: string) => {
    try {
      if (actionId === 'assign_toolbox') {
        if (selectedEmployees.length < 1) {
          Alert.alert('Assign Toolbox Meeting', 'Please select one or more employees to assign a meeting.');
          return;
        }
        await loadAvailableMeetings();
        setAssignModalVisible(true);
        return;
      }

      if (!onBulkAction || selectedEmployees.length === 0) {
        Alert.alert('Select employees', 'Please select one or more employees.');
        return;
      }

      await onBulkAction(actionId, selectedEmployees);
      setSelectedEmployees([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to perform bulk action');
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      if (onExport) {
        await onExport(format);
        return;
      }

      // Fallback implementation if onExport is not provided
      const exportData = items.map(item => ({
        'Employee ID': item.empNo || 'N/A',
        'Name': item.name || '',
        'Email': item.email || '',
        'Phone': item.phone || '',
        'Department': item.department || '',
        'Role': item.role || '',
        'Status': item.isActive ? 'Active' : 'Inactive',
        'Join Date': item.joinDate || 'N/A'
      }));

      if (format === 'csv') {
        const csvContent = convertToCSV(exportData);
        await downloadFile(csvContent, 'employees.csv', 'text/csv');
      } else {
        // For Excel, we'll use CSV format as a fallback
        const csvContent = convertToCSV(exportData);
        await downloadFile(csvContent, 'employees.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }

      Alert.alert('Success', `Employee data exported as ${format.toUpperCase()}`);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { }
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma
        return value.toString().includes(',') ? `"${value.toString().replace(/"/g, '""')}"` : value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  };

  const downloadFile = async (content: string, filename: string, mimeType: string) => {
    try {
      const preview = content.split('\n').slice(0, 5).join('\n');
      const totalLines = content.split('\n').length;

      Alert.alert(
        'Export Ready',
        `File: ${filename}\nFormat: ${mimeType === 'text/csv' ? 'CSV' : 'Excel'}\nLines: ${totalLines}\n\nPreview:\n${preview}${totalLines > 5 ? '\n...' : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share Content',
            onPress: async () => {
              try {
                await Share.share({
                  message: content,
                  title: `Employee Export - ${filename}`,
                });

                Alert.alert('Success', `${filename} shared successfully!`);
                try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
              } catch (error) {
                Alert.alert('Error', 'Failed to share content');
              }
            }
          },
          {
            text: 'Send via Email',
            onPress: async () => {
              try {
                const emailSubject = `Employee Export - ${filename}`;
                const emailBody = `Please find the employee export data below:\n\n${content}`;
                const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

                const canOpen = await Linking.canOpenURL(mailtoUrl);
                if (canOpen) {
                  await Linking.openURL(mailtoUrl);
                  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
                } else {
                  // Fallback to Share API
                  await Share.share({
                    message: `${emailSubject}\n\n${content}`,
                    title: emailSubject,
                  });
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to open email. Please try Share Content instead.');
              }
            }
          },
          {
            text: 'View Full Content',
            onPress: () => {
              Alert.alert(
                filename,
                content,
                [
                  { text: 'Close' },
                  {
                    text: 'Share This',
                    onPress: async () => {
                      try {
                        await Share.share({
                          message: content,
                          title: filename,
                        });
                      } catch (error) {
                        Alert.alert('Error', 'Failed to share content');
                      }
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(
        'Export Error',
        'Failed to prepare export. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleActionSheetSelect = async (optionId: string) => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    switch (optionId) {
      case 'export_csv':
        handleExport('csv');
        break;
      case 'export_excel':
        handleExport('excel');
        break;
      case 'import_employees':
        handleImportEmployees();
        break;
      case 'bulk_edit':
        handleBulkEdit();
        break;
      case 'assign_toolbox':
        await handleBulkAction('assign_toolbox');
        break;
      case 'refresh_data':
        handleRefreshData();
        break;
      case 'print_list':
        handlePrintList();
        break;
    }
  };

  const handleImportEmployees = async () => {
    try {
      Alert.alert(
        'Import Employees',
        'Choose import method:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Paste CSV Data',
            onPress: () => showCSVImportDialog()
          },
          {
            text: 'Import Sample Data',
            onPress: () => handleImportSampleData()
          },
          {
            text: 'Bulk Add Employees',
            onPress: () => showBulkAddDialog()
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to import employees');
    }
  };

  const showCSVImportDialog = () => {
    Alert.prompt(
      'Import CSV Data',
      'Paste your CSV data here:\n\nFormat: Employee ID,Name,Email,Phone,Department,Role,Status,Join Date\n\nExample:\n001,John Doe,john@company.com,+1234567890,Engineering,employee,Active,2023-01-15',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: (csvData?: string) => {
            if (csvData) {
              parseAndImportCSV(csvData);
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const showBulkAddDialog = () => {
    Alert.alert(
      'Bulk Add Employees',
      'Add multiple employees at once:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add 5 Employees',
          onPress: () => createBulkEmployees(5)
        },
        {
          text: 'Add 10 Employees',
          onPress: () => createBulkEmployees(10)
        }
      ]
    );
  };

  const parseAndImportCSV = async (csvData: string) => {
    try {
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        Alert.alert('Error', 'CSV data must have at least a header and one data row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const employees: any[] = [];

      // Validate headers
      const requiredHeaders = ['name', 'email'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        Alert.alert('Error', `Missing required headers: ${missingHeaders.join(', ')}`);
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) {
          Alert.alert('Error', `Row ${i + 1} has ${values.length} values but expected ${headers.length}`);
          return;
        }

        const employee: any = {};
        headers.forEach((header, index) => {
          const value = values[index];
          switch (header) {
            case 'employee id':
            case 'emp_no':
            case 'empno':
              employee.empNo = value;
              break;
            case 'name':
              employee.name = value;
              break;
            case 'email':
              employee.email = value;
              break;
            case 'phone':
              employee.phone = value;
              break;
            case 'department':
              employee.department = value;
              break;
            case 'role':
              employee.role = value.toLowerCase() === 'admin' ? 'admin' :
                value.toLowerCase() === 'manager' ? 'manager' : 'employee';
              break;
            case 'status':
              employee.isActive = value.toLowerCase() === 'active';
              break;
            case 'join date':
            case 'joindate':
            case 'join_date':
              employee.joinDate = value;
              break;
          }
        });

        // Validate required fields
        if (!employee.name || !employee.email) {
          Alert.alert('Error', `Row ${i + 1}: Name and Email are required`);
          return;
        }

        // Set defaults
        employee.empNo = employee.empNo || `EMP${String(i).padStart(3, '0')}`;
        employee.role = employee.role || 'employee';
        employee.isActive = employee.isActive !== undefined ? employee.isActive : true;
        employee.password = 'password123'; // Default password

        employees.push(employee);
      }

      if (employees.length === 0) {
        Alert.alert('Error', 'No valid employee data found.');
        return;
      }

      // Show preview and confirm
      const preview = employees.slice(0, 3).map(emp =>
        `• ${emp.name} (${emp.empNo}) - ${emp.email}`
      ).join('\n');

      Alert.alert(
        'Import Preview',
        `Found ${employees.length} employees to import:\n\n${preview}${employees.length > 3 ? '\n... and more' : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import All',
            onPress: () => importEmployeesToDB(employees)
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to parse CSV data. Please check the format.');
    }
  };

  const createBulkEmployees = async (count: number) => {
    try {
      const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
      const roles = ['employee', 'employee', 'employee', 'manager', 'employee'];
      const employees: any[] = [];

      for (let i = 1; i <= count; i++) {
        const empNo = `EMP${String(i + 100).padStart(3, '0')}`;
        const dept = departments[Math.floor(Math.random() * departments.length)];
        const role = roles[Math.floor(Math.random() * roles.length)];

        employees.push({
          empNo,
          name: `Employee ${i}`,
          email: `employee${i}@company.com`,
          phone: `+123456789${String(i).padStart(2, '0')}`,
          department: dept,
          role,
          isActive: true,
          password: 'password123',
          joinDate: formatDateLocal(new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1))
        });
      }

      Alert.alert(
        'Bulk Employee Creation',
        `Create ${count} sample employees with random departments and roles?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create',
            onPress: () => importEmployeesToDB(employees)
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create bulk employees.');
    }
  };

  const importEmployeesToDB = async (employees: any[]) => {
    try {
      // Show loading
      Alert.alert('Importing...', 'Please wait while we import the employees.');

      // Call the actual API endpoint
      const response = await fetch('/api/admin/employees/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyCode: 'ABC123', // This should come from app context/auth
          employeeNo: 'ADMIN001', // This should come from current user
          employees: employees
        })
      });

      const result = await response.json();

      if (result.success) {
        const { results } = result;
        Alert.alert(
          'Import Complete',
          `Import Results:\n\n✅ Successfully imported: ${results.success}\n❌ Failed: ${results.failed}\n⚠️ Duplicates skipped: ${results.duplicates}\n\nTotal processed: ${results.total}${results.errors.length > 0 ? '\n\nFirst few errors:\n' + results.errors.slice(0, 3).join('\n') : ''}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh the employee list
                load();
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
              }
            }
          ]
        );
      } else {
        Alert.alert('Import Error', result.message || 'Failed to import employees.');
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Import Error', 'Failed to connect to server. Please check your connection and try again.');
    }
  };

  const handleImportSampleData = async () => {
    try {
      const sampleEmployees = [
        {
          empNo: 'EMP001',
          name: 'Alice Johnson',
          email: 'alice@company.com',
          phone: '+1234567890',
          department: 'Engineering',
          role: 'employee',
          isActive: true,
          password: 'password123',
          joinDate: '2023-01-15'
        },
        {
          empNo: 'EMP002',
          name: 'Bob Smith',
          email: 'bob@company.com',
          phone: '+1234567891',
          department: 'Marketing',
          role: 'manager',
          isActive: true,
          password: 'password123',
          joinDate: '2023-02-01'
        },
        {
          empNo: 'EMP003',
          name: 'Carol Brown',
          email: 'carol@company.com',
          phone: '+1234567892',
          department: 'Sales',
          role: 'employee',
          isActive: true,
          password: 'password123',
          joinDate: '2023-03-10'
        },
        {
          empNo: 'EMP004',
          name: 'David Wilson',
          email: 'david@company.com',
          phone: '+1234567893',
          department: 'HR',
          role: 'manager',
          isActive: true,
          password: 'password123',
          joinDate: '2023-01-20'
        },
        {
          empNo: 'EMP005',
          name: 'Eva Martinez',
          email: 'eva@company.com',
          phone: '+1234567894',
          department: 'Finance',
          role: 'employee',
          isActive: true,
          password: 'password123',
          joinDate: '2023-04-05'
        }
      ];

      Alert.alert(
        'Sample Import',
        `Import ${sampleEmployees.length} sample employees with complete data?\n\n${sampleEmployees.map(emp => `• ${emp.name} (${emp.department} - ${emp.role})`).join('\n')}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import Sample Data',
            onPress: () => importEmployeesToDB(sampleEmployees)
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to prepare sample data');
    }
  };

  const handleBulkEdit = async () => {
    if (selectedEmployees.length === 0) {
      Alert.alert(
        'Bulk Edit',
        'Please select employees first by long-pressing on employee cards, then try bulk edit.',
        [{ text: 'OK' }]
      );
      return;
    }

    const selectedEmployeeNames = items
      .filter(emp => selectedEmployees.includes(emp.id))
      .map(emp => emp.name)
      .slice(0, 3)
      .join(', ') + (selectedEmployees.length > 3 ? ` and ${selectedEmployees.length - 3} more` : '');

    Alert.alert(
      'Bulk Edit',
      `Edit ${selectedEmployees.length} selected employee(s):\n${selectedEmployeeNames}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Department',
          onPress: () => handleBulkDepartmentChange()
        },
        {
          text: 'Change Status',
          onPress: () => handleBulkStatusChange()
        },
        {
          text: 'Change Role',
          onPress: () => handleBulkRoleChange()
        }
      ]
    );
  };

  const handleBulkDepartmentChange = () => {
    const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'IT Support', 'Customer Service'];

    Alert.alert(
      'Change Department',
      'Select new department for selected employees:',
      [
        { text: 'Cancel', style: 'cancel' },
        ...departments.slice(0, 3).map(dept => ({
          text: dept,
          onPress: () => {
            Alert.alert('Success', `${selectedEmployees.length} employees would be moved to ${dept} department.`);
            setSelectedEmployees([]);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
          }
        })),
        {
          text: 'More Options',
          onPress: () => {
            Alert.alert('Department Options', departments.slice(3).join('\n'));
          }
        }
      ]
    );
  };

  const handleBulkStatusChange = () => {
    Alert.alert(
      'Change Status',
      `Change status for ${selectedEmployees.length} selected employees:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate All',
          onPress: () => {
            Alert.alert('Success', `${selectedEmployees.length} employees would be activated.`);
            setSelectedEmployees([]);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
          }
        },
        {
          text: 'Deactivate All',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', `${selectedEmployees.length} employees would be deactivated.`);
            setSelectedEmployees([]);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
          }
        }
      ]
    );
  };

  const handleBulkRoleChange = () => {
    Alert.alert(
      'Change Role',
      `Change role for ${selectedEmployees.length} selected employees:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set as Employee',
          onPress: () => {
            Alert.alert('Success', `${selectedEmployees.length} employees would be set as Employee role.`);
            setSelectedEmployees([]);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
          }
        },
        {
          text: 'Set as Manager',
          onPress: () => {
            Alert.alert('Success', `${selectedEmployees.length} employees would be set as Manager role.`);
            setSelectedEmployees([]);
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
          }
        }
      ]
    );
  };

  const handleRefreshData = async () => {
    try {
      await load();
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
      // Could add a toast notification here
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh employee data');
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { }
    }
  };

  const handlePrintList = async () => {
    try {
      Alert.alert(
        'Print Employee List',
        'Choose print format:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Summary List',
            onPress: () => generatePrintPreview('summary')
          },
          {
            text: 'Detailed Report',
            onPress: () => generatePrintPreview('detailed')
          },
          {
            text: 'Current View',
            onPress: () => generatePrintPreview('current')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to prepare print');
    }
  };

  const generatePrintPreview = async (format: 'summary' | 'detailed' | 'current') => {
    try {
      const currentDate = new Date().toLocaleDateString();
      let htmlContent = '';
      let title = '';

      // Generate HTML content for better printing
      if (format === 'summary') {
        title = 'Employee Summary Report';
        htmlContent = `
          <html>
            <head>
              <meta charset="utf-8">
              <title>${title}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #007AFF; padding-bottom: 10px; }
                .stats { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .employee-list { margin-top: 20px; }
                .employee-item { padding: 8px 0; border-bottom: 1px solid #eee; }
                .active { color: #28a745; }
                .inactive { color: #dc3545; }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              <p><strong>Generated:</strong> ${currentDate}</p>
              
              <div class="stats">
                <h3>Statistics</h3>
                <p><strong>Total Employees:</strong> ${total}</p>
                <p><strong>Active:</strong> <span class="active">${items.filter(emp => emp.isActive).length}</span></p>
                <p><strong>Inactive:</strong> <span class="inactive">${items.filter(emp => !emp.isActive).length}</span></p>
              </div>
              
              <div class="employee-list">
                <h3>Employee List</h3>
                ${items.map(emp =>
          `<div class="employee-item">
                    <strong>${emp.empNo || 'N/A'}</strong> - ${emp.name} 
                    <em>(${emp.role})</em> - 
                    <span class="${emp.isActive ? 'active' : 'inactive'}">
                      ${emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>`
        ).join('')}
              </div>
            </body>
          </html>
        `;
      } else if (format === 'detailed') {
        title = 'Detailed Employee Report';
        htmlContent = `
          <html>
            <head>
              <meta charset="utf-8">
              <title>${title}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #007AFF; padding-bottom: 10px; }
                .employee-card { 
                  border: 1px solid #ddd; 
                  border-radius: 8px; 
                  padding: 15px; 
                  margin: 15px 0; 
                  background: #f9f9f9;
                }
                .employee-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
                .field { margin: 5px 0; }
                .label { font-weight: bold; color: #666; }
                .active { color: #28a745; }
                .inactive { color: #dc3545; }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              <p><strong>Generated:</strong> ${currentDate}</p>
              
              ${items.map(emp =>
          `<div class="employee-card">
                  <div class="employee-name">${emp.name}</div>
                  <div class="field"><span class="label">Employee ID:</span> ${emp.empNo || 'N/A'}</div>
                  <div class="field"><span class="label">Email:</span> ${emp.email || 'N/A'}</div>
                  <div class="field"><span class="label">Phone:</span> ${emp.phone || 'N/A'}</div>
                  <div class="field"><span class="label">Department:</span> ${emp.department || 'N/A'}</div>
                  <div class="field"><span class="label">Role:</span> ${emp.role}</div>
                  <div class="field">
                    <span class="label">Status:</span> 
                    <span class="${emp.isActive ? 'active' : 'inactive'}">
                      ${emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div class="field"><span class="label">Join Date:</span> ${emp.joinDate || 'N/A'}</div>
                </div>`
        ).join('')}
            </body>
          </html>
        `;
      } else {
        title = 'Current View Report';
        htmlContent = `
          <html>
            <head>
              <meta charset="utf-8">
              <title>${title}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #007AFF; padding-bottom: 10px; }
                .filters { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .employee-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                .employee-table th, .employee-table td { 
                  border: 1px solid #ddd; 
                  padding: 8px; 
                  text-align: left; 
                }
                .employee-table th { background-color: #f2f2f2; font-weight: bold; }
                .active { color: #28a745; }
                .inactive { color: #dc3545; }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              <p><strong>Generated:</strong> ${currentDate}</p>
              
              <div class="filters">
                <h3>Current View Settings</h3>
                <p><strong>Showing:</strong> ${items.length} of ${total} employees</p>
                <p><strong>Role Filter:</strong> ${roleFilter}</p>
                <p><strong>Status Filter:</strong> ${statusFilter}</p>
                <p><strong>Search Query:</strong> ${query || 'None'}</p>
              </div>
              
              <table class="employee-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(emp =>
          `<tr>
                      <td>${emp.name}</td>
                      <td>${emp.role}</td>
                      <td>${emp.department || 'N/A'}</td>
                      <td class="${emp.isActive ? 'active' : 'inactive'}">
                        ${emp.isActive ? 'Active' : 'Inactive'}
                      </td>
                    </tr>`
        ).join('')}
                </tbody>
              </table>
            </body>
          </html>
        `;
      }

      // Convert HTML to readable text
      const textContent = htmlContent
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n') // Remove extra newlines
        .trim();

      // Show print options
      Alert.alert(
        'Print Options',
        `Ready to print: ${title}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share Report',
            onPress: async () => {
              try {
                await Share.share({
                  message: textContent,
                  title: title,
                });
                try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
              } catch (error) {
                Alert.alert('Error', 'Failed to share report');
              }
            }
          },
          {
            text: 'Email Report',
            onPress: async () => {
              try {
                const emailSubject = title;
                const emailBody = `Please find the ${title.toLowerCase()} below:\n\n${textContent}`;
                const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

                const canOpen = await Linking.canOpenURL(mailtoUrl);
                if (canOpen) {
                  await Linking.openURL(mailtoUrl);
                  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
                } else {
                  // Fallback to Share API
                  await Share.share({
                    message: `${emailSubject}\n\n${textContent}`,
                    title: emailSubject,
                  });
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to open email. Please try Share Report instead.');
              }
            }
          },
          {
            text: 'View & Print',
            onPress: () => {
              const preview = textContent.length > 1000 ? textContent.substring(0, 1000) + '\n\n... (content continues)' : textContent;

              Alert.alert(
                'Print Preview',
                preview,
                [
                  { text: 'Close' },
                  {
                    text: 'Share Full Report',
                    onPress: async () => {
                      try {
                        await Share.share({
                          message: textContent,
                          title: title,
                        });
                      } catch (error) {
                        Alert.alert('Error', 'Failed to share report');
                      }
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to prepare print content.');
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    const form = {
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'employee',
      isActive: user.isActive !== undefined ? user.isActive : true,
      phone: user.phone || '',
      department: user.department || ''
    };
    setEditForm(form);
    setOriginalForm(form);
    setEditErrors({});
    setShowRoleDropdown(false);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm({ name: '', email: '', role: 'employee', isActive: true, phone: '', department: '' });
    setShowRoleDropdown(false);
    setShowStatusDropdown(false);
    setShowDepartmentDropdown(false);
    setEditErrors({});
    setOriginalForm(null);
    setSaveBusy(false);
    setShowConfirmDialog(null);
  };

  const closeProfileModal = () => {
    setViewingProfile(null);
    setProfileImageUploading(false);
  };

  const handleProfileImageUpload = async () => {
    // Placeholder for image upload functionality
    Alert.alert('Feature Coming Soon', 'Profile image upload will be available in a future update.');
  };

  const handleQuickRoleToggle = async (user: any) => {
    if (!onUpdateUser) return;
    setQuickEditingUser(user.id);
    try {
      const nextRole = user.role === 'employee' ? 'manager' : user.role === 'manager' ? 'admin' : 'employee';
      await onUpdateUser(user.id, { role: nextRole });
      await load();
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    } catch (error) {
      Alert.alert('Error', 'Failed to update user role');
    } finally {
      setQuickEditingUser(null);
    }
  };

  const handleQuickStatusToggle = async (user: any) => {
    if (!onUpdateUser) return;
    if (!user.isActive) {
      // Activating user - no confirmation needed
      setQuickEditingUser(user.id);
      try {
        await onUpdateUser(user.id, { isActive: true });
        await load();
        try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
      } catch (error) {
        Alert.alert('Error', 'Failed to activate user');
      } finally {
        setQuickEditingUser(null);
      }
    } else {
      // Deactivating user - show confirmation
      setShowConfirmDialog({ type: 'deactivate', user });
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser || !onUpdateUser || saveBusy) return;
    const errs = validateForm(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Check for significant role changes that need confirmation
    const isRoleChange = originalForm?.role !== editForm.role;
    const isStatusChange = originalForm?.isActive !== editForm.isActive;

    if (isRoleChange && (editForm.role === 'admin' || originalForm?.role === 'admin')) {
      setShowConfirmDialog({ type: 'role-change', user: editingUser });
      return;
    }

    if (isStatusChange && !editForm.isActive) {
      setShowConfirmDialog({ type: 'deactivate', user: editingUser });
      return;
    }

    await performUserUpdate();
  };

  const performUserUpdate = async () => {
    if (!editingUser || !onUpdateUser || saveBusy) return;
    try {
      setSaveBusy(true);
      await onUpdateUser(editingUser.id, editForm);
      closeEditModal();
      await load(); // Refresh the list
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
    } catch (error) {
      Alert.alert('Error', 'Failed to update user. Please try again.');
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { }
    } finally {
      setSaveBusy(false);
    }
  };


  const initials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Skeleton loader for better perceived performance
  if (loading) {
    const skeletonData = Array.from({ length: 6 }).map((_, i) => ({ id: `sk-${i}` }));
    return (
      <FlatList
        data={skeletonData}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={() => (
          <View style={[styles.row, { opacity: 0.6 }]}>
            <View style={enhancedStyles.skelAvatar} />
            <View style={{ flex: 1 }}>
              <View style={enhancedStyles.skelLineLg} />
              <View style={enhancedStyles.skelLineSm} />
              <View style={[enhancedStyles.skelPill, { marginTop: spacing.xs }]} />
            </View>
          </View>
        )}
      />
    );
  }

  return (
    <>
      <FlatList
        data={items}
        key={viewMode}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? { gap: spacing.sm, paddingHorizontal: spacing.xs } : undefined}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        ListHeaderComponentStyle={{ marginBottom: 0, paddingBottom: 0, zIndex: 2, marginTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={empRefreshing}
            onRefresh={async () => {
              setEmpRefreshing(true);
              await load();
              setEmpRefreshing(false);
            }}
          />
        }
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <StickyHeader
            accessibilityLabel="Employee management filters"
            style={{ marginTop: 0, paddingTop: spacing.xs }}
          >
            {/* Compact Header Actions */}
            <View style={enhancedStyles.headerActions}>
              <TouchableOpacity onPress={() => setCompact(c => !c)} style={[styles.compactChip, compact && styles.compactChipActive]} accessibilityRole="button" accessibilityLabel={`Toggle compact mode, currently ${compact ? 'on' : 'off'}`}>
                <Text style={[styles.compactChipText, compact && styles.compactChipTextActive]}>{compact ? 'Compact: On' : 'Compact: Off'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={enhancedStyles.actionButton}
                onPress={selectAllEmployees}
              >
                <Text style={enhancedStyles.actionButtonText}>
                  {selectedEmployees.length === items.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>

              {/* View Mode Toggle */}
              <View style={enhancedStyles.viewToggle}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Switch to list view"
                  style={[enhancedStyles.viewToggleButton, viewMode === 'list' && enhancedStyles.viewToggleButtonActive]}
                  onPress={() => setViewMode('list')}
                >
                  <Text style={[enhancedStyles.viewToggleText, viewMode === 'list' && enhancedStyles.viewToggleTextActive]}>List</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Switch to grid view"
                  style={[enhancedStyles.viewToggleButton, viewMode === 'grid' && enhancedStyles.viewToggleButtonActive]}
                  onPress={() => setViewMode('grid')}
                >
                  <Text style={[enhancedStyles.viewToggleText, viewMode === 'grid' && enhancedStyles.viewToggleTextActive]}>Grid</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={enhancedStyles.actionButton}
                onPress={async () => { try { await Haptics.selectionAsync(); } catch { } setShowActionSheet(true); }}
                accessibilityRole="button"
                accessibilityLabel="Open actions menu"
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={{ position: 'relative' }}>
              <Ionicons name="search" size={16} color={colors.textSecondary} style={{ position: 'absolute', left: 10, top: 0, bottom: 0, alignSelf: 'center' }} />
              <TextInput
                style={[styles.searchInput, { paddingLeft: spacing.xl }]}
                placeholder="Search name, email, emp no"
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setPage(1);
                }}
                accessibilityLabel="Search employees"
                accessibilityHint="Type employee name, email, or employee number to filter results"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {!!query && (
                <TouchableOpacity
                  onPress={() => { setQuery(''); setPage(1); }}
                  style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' }}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
              accessibilityRole="radiogroup"
              accessibilityLabel="Employee role filters"
            >
              <View style={styles.filterChips}>
                {(['all', 'employee', 'manager', 'admin'] as const).map(k => (
                  <Chip
                    key={k}
                    label={k[0].toUpperCase() + k.slice(1)}
                    selected={roleFilter === k}
                    onPress={() => { setRoleFilter(k); setPage(1); }}
                    accessibilityLabel={`Filter by ${k} role`}
                    accessibilityRole="radio"
                  />
                ))}
                {(['all', 'active', 'inactive'] as const).map(k => (
                  <Chip
                    key={`s-${k}`}
                    label={k[0].toUpperCase() + k.slice(1)}
                    selected={statusFilter === k}
                    onPress={() => { setStatusFilter(k); setPage(1); }}
                    accessibilityLabel={`Filter by ${k} status`}
                    accessibilityRole="radio"
                  />
                ))}
                {!!setSortBy && (
                  <>
                    {([
                      { key: 'name-asc', label: 'Name A→Z' },
                      { key: 'name-desc', label: 'Name Z→A' },
                      { key: 'role', label: 'Role' },
                      { key: 'status', label: 'Status' },
                    ] as const).map(opt => (
                      <Chip
                        key={`sort-${opt.key}`}
                        label={opt.label}
                        selected={sortBy === opt.key}
                        onPress={() => { setSortBy(opt.key); setPage(1); }}
                        accessibilityLabel={`Sort by ${opt.label}`}
                      />
                    ))}
                  </>
                )}
              </View>
            </ScrollView>


            <Text
              style={[styles.subTitle, { fontSize: 12, marginTop: spacing.xs, marginBottom: 0 }]}
              accessibilityRole="text"
              accessibilityLabel={`Showing ${items.length} of ${total} employees`}
            >
              {items.length} of {total} employees
            </Text>
          </StickyHeader>
        }
        renderItem={({ item }) => {
          const isSelected = selectedEmployees.includes(item.id);
          return (
            <TouchableOpacity
              style={[
                styles.row,
                compact && styles.rowCompact,
                isSelected && enhancedStyles.selectedCard,
                viewMode === 'grid' && enhancedStyles.gridItem,
                { position: 'relative', zIndex: showQuickActions === item.id ? 9998 : 1 }
              ]}
              onPress={() => {
                // Close any open quick actions menu first
                if (showQuickActions) {
                  setShowQuickActions(null);
                  return;
                }
                openEditModal(item);
              }}
              onLongPress={() => toggleEmployeeSelection(item.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Edit employee ${item.name}, ${item.role}, employee number ${item.empNo}, ${item.isActive ? 'active' : 'inactive'}`}
              accessibilityHint="Tap to edit employee details, long press to select"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              {/* Selection Checkbox */}
              {selectedEmployees.length > 0 && (
                <TouchableOpacity
                  style={enhancedStyles.selectionCheckbox}
                  onPress={() => toggleEmployeeSelection(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              <View style={[enhancedStyles.employeeCardContent, viewMode === 'grid' && enhancedStyles.employeeCardGrid]}>
                {(item.profileImageUri) ? (
                  <Image
                    source={{ uri: item.profileImageUri }}
                    style={[styles.avatar, compact && styles.avatarCompact, viewMode === 'grid' && enhancedStyles.avatarGrid]}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[
                    styles.avatar,
                    compact && styles.avatarCompact,
                    viewMode === 'grid' && enhancedStyles.avatarGrid,
                    {
                      backgroundColor: colors.primary + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: colors.primary + '30'
                    }
                  ]}>
                    <Text style={{
                      color: colors.primary,
                      fontWeight: '800',
                      fontSize: viewMode === 'grid' ? 12 : (compact ? 12 : 14)
                    }}>
                      {initials(item.name)}
                    </Text>
                  </View>
                )}
                <View style={[enhancedStyles.employeeInfo, viewMode === 'grid' && { alignItems: 'center', marginTop: spacing.xs }]}>
                  <View style={[enhancedStyles.employeeHeader, viewMode === 'grid' && { width: '100%' }]}>
                    <Text style={[styles.name, { flex: 1, textAlign: viewMode === 'grid' ? 'center' : 'left' }]} numberOfLines={1}>{item.name}</Text>
                    <View style={enhancedStyles.statusContainer}>
                      <Text style={[
                        styles.badge,
                        item.role === 'admin' ? styles.badgeAdmin :
                          item.role === 'manager' ? styles.badgeManager :
                            styles.badgeEmployee
                      ]}>
                        {item.role}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.meta, { marginTop: spacing.xs, textAlign: viewMode === 'grid' ? 'center' : 'left' }]} numberOfLines={1}>
                    {item.empNo} • {item.email}
                  </Text>
                  <View style={enhancedStyles.employeeFooter}>
                    <View style={[
                      enhancedStyles.statusIndicator,
                      { backgroundColor: item.isActive ? colors.success + '20' : colors.textSecondary + '20' }
                    ]}>
                      <View style={[
                        enhancedStyles.statusDot,
                        { backgroundColor: item.isActive ? colors.success : colors.textSecondary }
                      ]} />
                      <Text style={[
                        enhancedStyles.statusText,
                        { color: item.isActive ? colors.success : colors.textSecondary }
                      ]}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>

                    {/* Quick Action Buttons */}
                    <View style={enhancedStyles.quickActions}>
                      {/* Quick Role Toggle */}
                      <TouchableOpacity
                        onPress={() => handleQuickRoleToggle(item)}
                        style={[
                          enhancedStyles.quickActionButton,
                          { backgroundColor: item.role === 'admin' ? colors.error + '15' : item.role === 'manager' ? colors.warning + '15' : colors.primary + '15' }
                        ]}
                        disabled={quickEditingUser === item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Change role from ${item.role}`}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        {quickEditingUser === item.id ? (
                          <CustomLoader size="small" color={colors.primary} />
                        ) : (
                          <Ionicons
                            name={item.role === 'admin' ? 'shield-checkmark' : item.role === 'manager' ? 'briefcase' : 'person'}
                            size={12}
                            color={item.role === 'admin' ? colors.error : item.role === 'manager' ? colors.warning : colors.primary}
                          />
                        )}
                      </TouchableOpacity>

                      {/* Quick Status Toggle */}
                      <TouchableOpacity
                        onPress={() => handleQuickStatusToggle(item)}
                        style={[
                          enhancedStyles.quickActionButton,
                          { backgroundColor: item.isActive ? colors.error + '15' : colors.success + '15' }
                        ]}
                        disabled={quickEditingUser === item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.name}`}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        {quickEditingUser === item.id ? (
                          <CustomLoader size="small" color={colors.primary} />
                        ) : (
                          <Ionicons
                            name={item.isActive ? 'pause' : 'play'}
                            size={12}
                            color={item.isActive ? colors.error : colors.success}
                          />
                        )}
                      </TouchableOpacity>

                      {/* More Actions */}
                      <TouchableOpacity
                        onPress={() => setShowQuickActions(showQuickActions === item.id ? null : item.id)}
                        style={enhancedStyles.quickActionButton}
                        accessibilityRole="button"
                        accessibilityLabel="More actions"
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={12} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick Actions Menu */}
                  {showQuickActions === item.id && (
                    <View style={enhancedStyles.quickActionsMenu}>
                      <TouchableOpacity
                        style={enhancedStyles.quickMenuItem}
                        onPress={() => {
                          setShowQuickActions(null);
                          openEditModal(item);
                        }}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.primary} />
                        <Text style={enhancedStyles.quickMenuText}>Edit Details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={enhancedStyles.quickMenuItem}
                        onPress={() => {
                          setShowQuickActions(null);
                          setViewingProfile(item);
                        }}
                      >
                        <Ionicons name="person-outline" size={16} color={colors.primary} />
                        <Text style={enhancedStyles.quickMenuText}>View Profile</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={enhancedStyles.quickMenuItem}
                        onPress={async () => {
                          setShowQuickActions(null);
                          await handleActionSheetSelect('export_csv');
                        }}
                      >
                        <Ionicons name="download-outline" size={16} color={colors.success} />
                        <Text style={enhancedStyles.quickMenuText}>Export as CSV</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={enhancedStyles.quickMenuItem}
                        onPress={async () => {
                          setShowQuickActions(null);
                          await handleActionSheetSelect('export_excel');
                        }}
                      >
                        <Ionicons name="document-outline" size={16} color={colors.success} />
                        <Text style={enhancedStyles.quickMenuText}>Export as Excel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={enhancedStyles.quickMenuItem}
                        onPress={async () => {
                          setShowQuickActions(null);
                          await handleActionSheetSelect('import_employees');
                        }}
                      >
                        <Ionicons name="cloud-upload-outline" size={16} color={colors.warning} />
                        <Text style={enhancedStyles.quickMenuText}>Import Employees</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={enhancedStyles.quickMenuItem}
                        onPress={async () => {
                          setShowQuickActions(null);
                          await handleActionSheetSelect('bulk_edit');
                        }}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.primary} />
                        <Text style={enhancedStyles.quickMenuText}>Bulk Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={enhancedStyles.quickMenuItem}
                        onPress={async () => {
                          setShowQuickActions(null);
                          await handleActionSheetSelect('refresh_data');
                        }}
                      >
                        <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                        <Text style={enhancedStyles.quickMenuText}>Refresh Data</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[enhancedStyles.quickMenuItem, { borderBottomWidth: 0 }]}
                        onPress={async () => {
                          setShowQuickActions(null);
                          await handleActionSheetSelect('print_list');
                        }}
                      >
                        <Ionicons name="print-outline" size={16} color={colors.textSecondary} />
                        <Text style={enhancedStyles.quickMenuText}>Print List</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View
            style={styles.center}
            accessibilityRole="text"
            accessibilityLabel="No employees found. Try adjusting filters or search criteria."
          >
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySub}>Try adjusting filters or search</Text>
          </View>
        }
      />
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}
        accessibilityRole="toolbar"
        accessibilityLabel="Pagination controls"
      >
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (page > 1) {
              setPage(page - 1);
            }
          }}
          disabled={page <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityState={{ disabled: page <= 1 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Prev</Text>
        </TouchableOpacity>
        <Text
          style={styles.meta}
          accessibilityRole="text"
          accessibilityLabel={`Page ${page} of employees, total ${total} items`}
        >
          Page {page} • Total {total}
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (items.length >= 20) {
              setPage(page + 1);
            }
          }}
          disabled={items.length < 20}
          accessibilityRole="button"
          accessibilityLabel="Load more employees"
        >
          <Text style={styles.buttonText}>Load More</Text>
        </TouchableOpacity>
      </View>

      {/* Action Sheet for Three Dot Menu */}
      <ActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        title="Employee Actions"
        options={[
          { id: 'export_csv', label: 'Export as CSV', icon: 'download-outline' },
          { id: 'export_excel', label: 'Export as Excel', icon: 'document-outline' },
          { id: 'import_employees', label: 'Import Employees', icon: 'cloud-upload-outline' },
          { id: 'bulk_edit', label: 'Bulk Edit', icon: 'create-outline' },
          { id: 'assign_toolbox', label: 'Assign Toolbox Meeting', icon: 'calendar-outline' },
          { id: 'refresh_data', label: 'Refresh Data', icon: 'refresh-outline' },
          { id: 'print_list', label: 'Print List', icon: 'print-outline' },
        ]}
        onSelect={handleActionSheetSelect}
      />

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmDialog(null)}
        >
          <View style={enhancedStyles.confirmOverlay}>
            <View style={enhancedStyles.confirmDialog}>
              <View style={enhancedStyles.confirmHeader}>
                <View style={[
                  enhancedStyles.confirmIcon,
                  { backgroundColor: colors.warning + '15' }
                ]}>
                  <Ionicons
                    name={showConfirmDialog.type === 'deactivate' ? 'pause' : 'shield-checkmark'}
                    size={24}
                    color={colors.warning}
                  />
                </View>
                <Text style={enhancedStyles.confirmTitle}>
                  {showConfirmDialog.type === 'deactivate' ? 'Deactivate User' : 'Change Admin Role'}
                </Text>
                <Text style={enhancedStyles.confirmMessage}>
                  {showConfirmDialog.type === 'deactivate' ?
                    `Are you sure you want to deactivate ${showConfirmDialog.user?.name}? They will lose access to the system.` :
                    `Are you sure you want to change ${showConfirmDialog.user?.name}'s role? This will affect their system permissions.`}
                </Text>
              </View>
              <View style={enhancedStyles.confirmActions}>
                <TouchableOpacity
                  style={enhancedStyles.confirmCancelButton}
                  onPress={() => setShowConfirmDialog(null)}
                >
                  <Text style={enhancedStyles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    enhancedStyles.confirmActionButton,
                    { backgroundColor: colors.warning }
                  ]}
                  onPress={async () => {
                    const dialog = showConfirmDialog;
                    setShowConfirmDialog(null);

                    if (dialog.type === 'deactivate') {
                      if (dialog.user) {
                        setQuickEditingUser(dialog.user.id);
                        try {
                          await onUpdateUser?.(dialog.user.id, { isActive: false });
                          await load();
                        } catch (error) {
                          Alert.alert('Error', 'Failed to deactivate user');
                        } finally {
                          setQuickEditingUser(null);
                        }
                      }
                    } else if (dialog.type === 'role-change') {
                      await performUserUpdate();
                    }
                  }}
                >
                  <Text style={enhancedStyles.confirmActionText}>
                    {showConfirmDialog.type === 'deactivate' ? 'Deactivate' : 'Change Role'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Assign Toolbox Meeting Modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={enhancedStyles.modalHeaderCompact}>
              <View style={styles.modalHandle} />
              <View style={enhancedStyles.modalTitleSection}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={enhancedStyles.modalTitleCompact}>Assign Toolbox Meeting</Text>
                  <Text style={enhancedStyles.modalSubtitleCompact}>Select a meeting to assign to {selectedEmployees.length} selected employee(s)</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setAssignModalVisible(false)}
                style={enhancedStyles.closeButtonTopRight}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {assignLoading ? (
                <View style={{ padding: spacing.md }}>
                  <CustomLoader size="small" color={colors.primary} />
                </View>
              ) : (
                <View>
                  {availableMeetings.length === 0 ? (
                    <Text style={styles.meta}>No upcoming meetings available.</Text>
                  ) : (
                    availableMeetings.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={{
                          paddingVertical: spacing.md,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                          flexDirection: 'row',
                          alignItems: 'center'
                        }}
                        onPress={() => setSelectedMeetingId(m.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: selectedMeetingId === m.id }}
                      >
                        <Ionicons
                          name={selectedMeetingId === m.id ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={colors.primary}
                          style={{ marginRight: spacing.sm }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.title} numberOfLines={1}>{m.title}</Text>
                          <Text style={styles.meta}>{m.presenterName ? `${m.presenterName} • ` : ''}{m.meetingDate}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </ScrollView>

            <View style={enhancedStyles.modalActionsCompact}>
              <TouchableOpacity
                style={enhancedStyles.cancelButtonCompact}
                onPress={() => setAssignModalVisible(false)}
                disabled={assignLoading}
              >
                <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
                <Text style={enhancedStyles.cancelButtonTextCompact}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[enhancedStyles.saveButtonCompact, (!selectedMeetingId || assignLoading) && { opacity: 0.6 }]}
                onPress={confirmAssignMeeting}
                disabled={!selectedMeetingId || assignLoading}
              >
                {assignLoading ? (
                  <CustomLoader size="small" color="#ffffff" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="checkmark-outline" size={16} color="#ffffff" />
                )}
                <Text style={enhancedStyles.saveButtonTextCompact}>{assignLoading ? 'Assigning...' : 'Assign Meeting'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={!!editingUser}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={enhancedStyles.modalHeaderCompact}>
              <View style={styles.modalHandle} />
              <View style={enhancedStyles.modalTitleSection}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="create" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={enhancedStyles.modalTitleCompact}>Edit Employee</Text>
                  <Text style={enhancedStyles.modalSubtitleCompact}>Update employee information</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={closeEditModal}
                style={enhancedStyles.closeButtonTopRight}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Compact User Header */}
              <View style={enhancedStyles.editCompactHeader}>
                <View style={enhancedStyles.editCompactAvatar}>
                  {editingUser?.profileImageUri ? (
                    <Image
                      source={{ uri: editingUser.profileImageUri }}
                      style={enhancedStyles.editCompactAvatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={enhancedStyles.editCompactAvatarPlaceholder}>
                      <Text style={enhancedStyles.editCompactAvatarInitials}>
                        {editingUser ? initials(editingUser.name) : 'U'}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={enhancedStyles.editCompactCameraButton}
                    onPress={handleProfileImageUpload}
                    disabled={profileImageUploading}
                  >
                    <Ionicons name="camera" size={12} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                <View style={enhancedStyles.editCompactInfo}>
                  <Text style={enhancedStyles.editCompactName}>{editForm.name || 'Enter name'}</Text>
                  <Text style={enhancedStyles.editCompactRole}>
                    {editForm.role?.charAt(0).toUpperCase() + editForm.role?.slice(1)} • {editingUser?.empNo}
                  </Text>
                </View>
              </View>

              {/* Compact Form Fields */}
              <View style={enhancedStyles.editCompactSection}>
                {/* Two Column Layout for Name and Email */}
                <View style={enhancedStyles.editRowContainer}>
                  <View style={enhancedStyles.editHalfField}>
                    <Text style={enhancedStyles.editCompactLabel}>Name *</Text>
                    <TextInput
                      style={[
                        enhancedStyles.editCompactInput,
                        editErrors.name && enhancedStyles.editInputError
                      ]}
                      value={editForm.name}
                      onChangeText={(text) => {
                        const next = { ...editForm, name: text };
                        setEditForm(next);
                        const errors = validateForm(next);
                        setEditErrors(prev => ({ ...prev, name: errors.name }));
                      }}
                      placeholder="Full name"
                      placeholderTextColor={colors.textSecondary}
                      maxLength={50}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                    {!!editErrors.name && (
                      <Text style={enhancedStyles.editCompactError}>{editErrors.name}</Text>
                    )}
                  </View>

                  <View style={enhancedStyles.editHalfField}>
                    <Text style={enhancedStyles.editCompactLabel}>Email</Text>
                    <TextInput
                      style={[
                        enhancedStyles.editCompactInput,
                        editErrors.email && enhancedStyles.editInputError
                      ]}
                      value={editForm.email}
                      onChangeText={(text) => {
                        const next = { ...editForm, email: text };
                        setEditForm(next);
                        const errors = validateForm(next);
                        setEditErrors(prev => ({ ...prev, email: errors.email }));
                      }}
                      placeholder="Email address"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      maxLength={100}
                      returnKeyType="next"
                    />
                    {!!editErrors.email && (
                      <Text style={enhancedStyles.editCompactError}>{editErrors.email}</Text>
                    )}
                  </View>
                </View>

                {/* Two Column Layout for Phone and Department */}
                <View style={enhancedStyles.editRowContainer}>
                  <View style={enhancedStyles.editHalfField}>
                    <Text style={enhancedStyles.editCompactLabel}>Phone</Text>
                    <TextInput
                      style={enhancedStyles.editCompactInput}
                      value={editForm.phone}
                      onChangeText={(text) => {
                        setEditForm(prev => ({ ...prev, phone: text }));
                      }}
                      placeholder="Phone number"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="phone-pad"
                      maxLength={15}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={enhancedStyles.editHalfField}>
                    <Text style={enhancedStyles.editCompactLabel}>Department</Text>
                    <TouchableOpacity
                      style={[enhancedStyles.editCompactDropdown, showDepartmentDropdown && enhancedStyles.editDropdownActive]}
                      onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    >
                      <View style={enhancedStyles.editCompactDropdownContent}>
                        <View style={[enhancedStyles.editCompactRoleIcon, {
                          backgroundColor: colors.primary + '15'
                        }]}>
                          <Ionicons
                            name="business"
                            size={14}
                            color={colors.primary}
                          />
                        </View>
                        <Text style={enhancedStyles.editCompactDropdownText}>
                          {editForm.department || 'Select'}
                        </Text>
                      </View>
                      <Ionicons name={showDepartmentDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                    </TouchableOpacity>

                    {showDepartmentDropdown && (
                      <View style={enhancedStyles.editCompactDropdownMenu}>
                        {(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'IT Support', 'Customer Service'] as const).map((dept) => (
                          <TouchableOpacity
                            key={dept}
                            style={[
                              enhancedStyles.editCompactDropdownItem,
                              editForm.department === dept && enhancedStyles.editDropdownItemSelected
                            ]}
                            onPress={() => {
                              setEditForm(prev => ({ ...prev, department: dept }));
                              setShowDepartmentDropdown(false);
                            }}
                          >
                            <View style={enhancedStyles.editCompactDropdownContent}>
                              <View style={[enhancedStyles.editCompactRoleIcon, {
                                backgroundColor: colors.primary + '15'
                              }]}>
                                <Ionicons
                                  name="business"
                                  size={14}
                                  color={colors.primary}
                                />
                              </View>
                              <Text style={[
                                enhancedStyles.editCompactDropdownText,
                                editForm.department === dept && { color: colors.primary }
                              ]}>
                                {dept}
                              </Text>
                            </View>
                            {editForm.department === dept && (
                              <Ionicons name="checkmark" size={16} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Compact Role and Status */}
              <View style={enhancedStyles.editCompactSection}>
                <View style={enhancedStyles.editRowContainer}>
                  {/* Role Selection */}
                  <View style={enhancedStyles.editHalfField}>
                    <Text style={enhancedStyles.editCompactLabel}>Role *</Text>
                    <TouchableOpacity
                      style={[enhancedStyles.editCompactDropdown, showRoleDropdown && enhancedStyles.editDropdownActive]}
                      onPress={() => setShowRoleDropdown(!showRoleDropdown)}
                    >
                      <View style={enhancedStyles.editCompactDropdownContent}>
                        <View style={[enhancedStyles.editCompactRoleIcon, {
                          backgroundColor: editForm.role === 'admin' ? colors.error + '15' :
                            editForm.role === 'manager' ? colors.warning + '15' : colors.primary + '15'
                        }]}>
                          <Ionicons
                            name={
                              editForm.role === 'admin' ? 'shield-checkmark' :
                                editForm.role === 'manager' ? 'briefcase' : 'person'
                            }
                            size={14}
                            color={
                              editForm.role === 'admin' ? colors.error :
                                editForm.role === 'manager' ? colors.warning : colors.primary
                            }
                          />
                        </View>
                        <Text style={enhancedStyles.editCompactDropdownText}>
                          {editForm.role.charAt(0).toUpperCase() + editForm.role.slice(1)}
                        </Text>
                      </View>
                      <Ionicons name={showRoleDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                    </TouchableOpacity>

                    {showRoleDropdown && (
                      <View style={enhancedStyles.editCompactDropdownMenu}>
                        {(['employee', 'manager', 'admin'] as const).map((role) => (
                          <TouchableOpacity
                            key={role}
                            style={[
                              enhancedStyles.editCompactDropdownItem,
                              editForm.role === role && enhancedStyles.editDropdownItemSelected
                            ]}
                            onPress={() => {
                              setEditForm(prev => ({ ...prev, role }));
                              setShowRoleDropdown(false);
                            }}
                          >
                            <View style={enhancedStyles.editCompactDropdownContent}>
                              <View style={[enhancedStyles.editCompactRoleIcon, {
                                backgroundColor: role === 'admin' ? colors.error + '15' :
                                  role === 'manager' ? colors.warning + '15' : colors.primary + '15'
                              }]}>
                                <Ionicons
                                  name={
                                    role === 'admin' ? 'shield-checkmark' :
                                      role === 'manager' ? 'briefcase' : 'person'
                                  }
                                  size={14}
                                  color={
                                    role === 'admin' ? colors.error :
                                      role === 'manager' ? colors.warning : colors.primary
                                  }
                                />
                              </View>
                              <Text style={[
                                enhancedStyles.editCompactDropdownText,
                                editForm.role === role && { color: colors.primary }
                              ]}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </Text>
                            </View>
                            {editForm.role === role && (
                              <Ionicons name="checkmark" size={16} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Status Selection */}
                  <View style={enhancedStyles.editHalfField}>
                    <Text style={enhancedStyles.editCompactLabel}>Status *</Text>
                    <TouchableOpacity
                      style={[enhancedStyles.editCompactDropdown, showStatusDropdown && enhancedStyles.editDropdownActive]}
                      onPress={() => setShowStatusDropdown(!showStatusDropdown)}
                    >
                      <View style={enhancedStyles.editCompactDropdownContent}>
                        <View style={[enhancedStyles.editCompactStatusIcon, {
                          backgroundColor: editForm.isActive ? colors.success + '15' : colors.error + '15'
                        }]}>
                          <View style={[
                            enhancedStyles.editCompactStatusDot,
                            { backgroundColor: editForm.isActive ? colors.success : colors.error }
                          ]} />
                        </View>
                        <Text style={enhancedStyles.editCompactDropdownText}>
                          {editForm.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      <Ionicons name={showStatusDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                    </TouchableOpacity>

                    {showStatusDropdown && (
                      <View style={enhancedStyles.editCompactDropdownMenu}>
                        <TouchableOpacity
                          style={[
                            enhancedStyles.editCompactDropdownItem,
                            editForm.isActive && enhancedStyles.editDropdownItemSelected
                          ]}
                          onPress={() => {
                            setEditForm(prev => ({ ...prev, isActive: true }));
                            setShowStatusDropdown(false);
                          }}
                        >
                          <View style={enhancedStyles.editCompactDropdownContent}>
                            <View style={[enhancedStyles.editCompactStatusIcon, { backgroundColor: colors.success + '15' }]}>
                              <View style={[enhancedStyles.editCompactStatusDot, { backgroundColor: colors.success }]} />
                            </View>
                            <Text style={[
                              enhancedStyles.editCompactDropdownText,
                              editForm.isActive && { color: colors.primary }
                            ]}>
                              Active
                            </Text>
                          </View>
                          {editForm.isActive && (
                            <Ionicons name="checkmark" size={16} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            enhancedStyles.editCompactDropdownItem,
                            !editForm.isActive && enhancedStyles.editDropdownItemSelected,
                            { borderBottomWidth: 0 }
                          ]}
                          onPress={() => {
                            setEditForm(prev => ({ ...prev, isActive: false }));
                            setShowStatusDropdown(false);
                          }}
                        >
                          <View style={enhancedStyles.editCompactDropdownContent}>
                            <View style={[enhancedStyles.editCompactStatusIcon, { backgroundColor: colors.error + '15' }]}>
                              <View style={[enhancedStyles.editCompactStatusDot, { backgroundColor: colors.error }]} />
                            </View>
                            <Text style={[
                              enhancedStyles.editCompactDropdownText,
                              !editForm.isActive && { color: colors.primary }
                            ]}>
                              Inactive
                            </Text>
                          </View>
                          {!editForm.isActive && (
                            <Ionicons name="checkmark" size={16} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={enhancedStyles.modalActionsCompact}>
              <TouchableOpacity
                style={enhancedStyles.cancelButtonCompact}
                onPress={closeEditModal}
              >
                <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
                <Text style={enhancedStyles.cancelButtonTextCompact}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  enhancedStyles.saveButtonCompact,
                  (!isDirty || saveBusy) && { opacity: 0.6 }
                ]}
                onPress={handleSaveUser}
                disabled={!isDirty || saveBusy}
              >
                {saveBusy ? (
                  <CustomLoader size="small" color="#ffffff" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="checkmark-outline" size={16} color="#ffffff" />
                )}
                <Text style={enhancedStyles.saveButtonTextCompact}>{saveBusy ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Profile Modal */}
      <Modal
        visible={!!viewingProfile}
        transparent
        animationType="slide"
        onRequestClose={closeProfileModal}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={enhancedStyles.modalHeaderCompact}>
              <View style={styles.modalHandle} />
              <View style={enhancedStyles.modalTitleSection}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={enhancedStyles.modalTitleCompact}>Employee Profile</Text>
                  <Text style={enhancedStyles.modalSubtitleCompact}>View employee information</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={closeProfileModal}
                style={enhancedStyles.closeButtonTopRight}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Compact Profile Header */}
              <View style={enhancedStyles.profileCompactHeader}>
                <View style={enhancedStyles.profileCompactAvatar}>
                  {viewingProfile?.profileImageUri ? (
                    <Image
                      source={{ uri: viewingProfile.profileImageUri }}
                      style={enhancedStyles.profileCompactAvatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={enhancedStyles.profileCompactAvatarPlaceholder}>
                      <Text style={enhancedStyles.profileCompactAvatarInitials}>
                        {viewingProfile ? initials(viewingProfile.name) : 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={[
                    enhancedStyles.profileCompactStatusBadge,
                    { backgroundColor: viewingProfile?.isActive ? colors.success : colors.error }
                  ]}>
                    <Ionicons
                      name={viewingProfile?.isActive ? 'checkmark' : 'close'}
                      size={10}
                      color="#ffffff"
                    />
                  </View>
                </View>
                <View style={enhancedStyles.profileCompactInfo}>
                  <Text style={enhancedStyles.profileCompactName}>{viewingProfile?.name}</Text>
                  <Text style={enhancedStyles.profileCompactRole}>
                    {viewingProfile?.role?.charAt(0).toUpperCase() + viewingProfile?.role?.slice(1)} • {viewingProfile?.empNo}
                  </Text>
                  <View style={[
                    enhancedStyles.profileCompactStatusIndicator,
                    { backgroundColor: viewingProfile?.isActive ? colors.success + '20' : colors.error + '20' }
                  ]}>
                    <View style={[
                      enhancedStyles.profileCompactStatusDot,
                      { backgroundColor: viewingProfile?.isActive ? colors.success : colors.error }
                    ]} />
                    <Text style={[
                      enhancedStyles.profileCompactStatusText,
                      { color: viewingProfile?.isActive ? colors.success : colors.error }
                    ]}>
                      {viewingProfile?.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Compact Profile Grid */}
              <View style={enhancedStyles.profileCompactGrid}>
                {/* Row 1: Employee ID and Email */}
                <View style={enhancedStyles.profileGridRow}>
                  <View style={enhancedStyles.profileGridItem}>
                    <View style={enhancedStyles.profileCompactFieldIcon}>
                      <Ionicons name="id-card" size={16} color={colors.primary} />
                    </View>
                    <Text style={enhancedStyles.profileCompactFieldLabel}>Employee ID</Text>
                    <Text style={enhancedStyles.profileCompactFieldValue}>{viewingProfile?.empNo || 'N/A'}</Text>
                  </View>
                  <View style={enhancedStyles.profileGridItem}>
                    <View style={enhancedStyles.profileCompactFieldIcon}>
                      <Ionicons name="mail" size={16} color={colors.primary} />
                    </View>
                    <Text style={enhancedStyles.profileCompactFieldLabel}>Email</Text>
                    <Text style={enhancedStyles.profileCompactFieldValue}>{viewingProfile?.email || 'Not provided'}</Text>
                  </View>
                </View>

                {/* Row 2: Phone and Department */}
                <View style={enhancedStyles.profileGridRow}>
                  <View style={enhancedStyles.profileGridItem}>
                    <View style={enhancedStyles.profileCompactFieldIcon}>
                      <Ionicons name="call" size={16} color={colors.primary} />
                    </View>
                    <Text style={enhancedStyles.profileCompactFieldLabel}>Phone</Text>
                    <Text style={enhancedStyles.profileCompactFieldValue}>{viewingProfile?.phone || 'Not provided'}</Text>
                  </View>
                  <View style={enhancedStyles.profileGridItem}>
                    <View style={enhancedStyles.profileCompactFieldIcon}>
                      <Ionicons name="business" size={16} color={colors.primary} />
                    </View>
                    <Text style={enhancedStyles.profileCompactFieldLabel}>Department</Text>
                    <Text style={enhancedStyles.profileCompactFieldValue}>{viewingProfile?.department || 'Not assigned'}</Text>
                  </View>
                </View>

                {/* Row 3: Role and Join Date */}
                <View style={enhancedStyles.profileGridRow}>
                  <View style={enhancedStyles.profileGridItem}>
                    <View style={enhancedStyles.profileCompactFieldIcon}>
                      <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                    </View>
                    <Text style={enhancedStyles.profileCompactFieldLabel}>Role</Text>
                    <Text style={enhancedStyles.profileCompactFieldValue}>
                      {viewingProfile?.role === 'admin' ? 'Administrator' :
                        viewingProfile?.role === 'manager' ? 'Manager' : 'Employee'}
                    </Text>
                  </View>
                  <View style={enhancedStyles.profileGridItem}>
                    <View style={enhancedStyles.profileCompactFieldIcon}>
                      <Ionicons name="calendar" size={16} color={colors.primary} />
                    </View>
                    <Text style={enhancedStyles.profileCompactFieldLabel}>Join Date</Text>
                    <Text style={enhancedStyles.profileCompactFieldValue}>{viewingProfile?.joinDate || 'Not available'}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={enhancedStyles.modalActionsCompact}>
              <TouchableOpacity
                style={enhancedStyles.cancelButtonCompact}
                onPress={closeProfileModal}
              >
                <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
                <Text style={enhancedStyles.cancelButtonTextCompact}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={enhancedStyles.saveButtonCompact}
                onPress={() => {
                  closeProfileModal();
                  openEditModal(viewingProfile);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#ffffff" />
                <Text style={enhancedStyles.saveButtonTextCompact}>Edit Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Enhanced styles for better employee card layout
const enhancedStyles = StyleSheet.create({
  statsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 2,
  },
  viewToggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  viewToggleTextActive: {
    color: '#ffffff',
  },
  actionButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary + '15',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    minWidth: 60,
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  employeeCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  statusContainer: {
    marginLeft: spacing.sm,
  },
  employeeFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  selectionCheckbox: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
  },
  selectedCard: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  gridItem: {
    flex: 1,
  },
  employeeCardGrid: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  avatarGrid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 0,
  },
  // Skeleton styles
  skelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border + '40',
    marginRight: spacing.md,
  },
  skelLineLg: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border + '50',
    width: '60%',
    marginBottom: spacing.xs,
  },
  skelLineSm: {
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.border + '40',
    width: '40%',
  },
  skelPill: {
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.border + '50',
    width: 80,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    paddingTop: 60,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '90%',
    minHeight: '60%',
    ...shadows.card,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalContent: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  modalAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  userNamePreview: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  userEmailPreview: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: spacing.xl,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIconContainer: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
    width: 20,
    alignItems: 'center',
  },
  formInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  formInputWithIcon: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingLeft: 50,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 56,
  },
  dropdownButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  roleIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  dropdownMenu: {
    marginTop: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...shadows.card,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
    minHeight: 64,
  },
  roleDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  statusDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  dropdownItemText: {
    fontSize: 16,
    color: colors.text,
  },
  dropdownItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    gap: spacing.xs,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Quick Actions Styles
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  quickActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '50',
  },
  quickActionsMenu: {
    position: 'absolute',
    top: '100%',
    right: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
    minWidth: 140,
  },
  quickMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
    gap: spacing.sm,
  },
  quickMenuText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  // Confirmation Dialog Styles
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmDialog: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...shadows.card,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  confirmMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmActionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  confirmActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Profile Modal Styles
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  profileAvatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.primary + '30',
  },
  profileAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.primary + '30',
  },
  profileAvatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
  },
  profileStatusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  profileRole: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  profileStatusContainer: {
    alignItems: 'center',
  },
  profileStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  profileStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  profileStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary + '20',
  },
  profileField: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  fieldValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '400',
    lineHeight: 22,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  // Enhanced Edit Modal Styles
  editProfileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
    backgroundColor: colors.primary + '05',
    borderRadius: radii.lg,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  editAvatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  editAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  editAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  editAvatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.card,
    ...shadows.card,
  },
  editUserName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  editUserRole: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  editSection: {
    marginBottom: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '30',
    ...shadows.card,
    shadowOpacity: 0.05,
  },
  editSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary + '20',
    flexDirection: 'row',
    alignItems: 'center',
  },
  editFormGroup: {
    marginBottom: spacing.lg,
  },
  editFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  editInputContainer: {
    position: 'relative',
  },
  editInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingRight: 50,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 52,
  },
  editInputError: {
    borderColor: colors.error,
    backgroundColor: colors.error + '05',
  },
  editInputIcon: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
  },
  editErrorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  // Enhanced Dropdown Styles
  editDropdown: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  editDropdownActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '05',
  },
  editDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editDropdownText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  editDropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  editDropdownSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  editDropdownMenu: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    shadowOpacity: 0.1,
    overflow: 'hidden',
  },
  editDropdownItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editDropdownItemSelected: {
    backgroundColor: colors.primary + '08',
  },
  editRoleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Compact Edit Modal Styles
  editCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary + '05',
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  editCompactAvatar: {
    position: 'relative',
    marginRight: spacing.md,
  },
  editCompactAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  editCompactAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  editCompactAvatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  editCompactCameraButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  editCompactInfo: {
    flex: 1,
  },
  editCompactName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  editCompactRole: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  editCompactSection: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '30',
  },
  editRowContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  editHalfField: {
    flex: 1,
  },
  editCompactLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  editCompactInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 40,
  },
  editCompactError: {
    fontSize: 10,
    color: colors.error,
    marginTop: 2,
    fontWeight: '500',
  },
  editCompactDropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  editCompactDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editCompactDropdownText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  editCompactDropdownMenu: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    shadowOpacity: 0.1,
    overflow: 'hidden',
  },
  editCompactDropdownItem: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editCompactRoleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCompactStatusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCompactStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Compact Profile Modal Styles
  profileCompactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary + '05',
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  profileCompactAvatar: {
    position: 'relative',
    marginRight: spacing.md,
  },
  profileCompactAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profileCompactAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profileCompactAvatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  profileCompactStatusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  profileCompactInfo: {
    flex: 1,
  },
  profileCompactName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  profileCompactRole: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  profileCompactStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  profileCompactStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  profileCompactStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileCompactGrid: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '30',
  },
  profileGridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  profileGridItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  profileCompactFieldIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  profileCompactFieldLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'center',
  },
  profileCompactFieldValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Compact Modal Header & Button Styles
  modalHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  modalTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitleCompact: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  modalSubtitleCompact: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  closeButtonTopRight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.md,
  },
  modalActionsCompact: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '30',
    backgroundColor: colors.background,
  },
  cancelButtonCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.xs,
  },
  cancelButtonTextCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButtonCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    gap: spacing.xs,
    ...shadows.card,
  },
  saveButtonTextCompact: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default EmployeesView;
