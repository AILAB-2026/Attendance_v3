import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import colors from '@/constants/colors';
import CustomLoader from '@/components/CustomLoader';

// Define the expected error response type
interface ErrorResponse {
  error?: string;
  message?: string;
}

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    companyCode: '',
    employeeNo: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const passwordRef = useRef<TextInput>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyCode.trim()) {
      newErrors.companyCode = 'Company code is required';
    } else if (formData.companyCode.length < 1) {
      newErrors.companyCode = 'Company code is required';
    }

    if (!formData.employeeNo.trim()) {
      newErrors.employeeNo = 'Employee number is required';
    } else if (formData.employeeNo.length < 3) {
      newErrors.employeeNo = 'Employee number must be at least 3 characters';
    }

    // Password validation removed - accept any password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm() || isLoading) return;

    try {
      // Delegate to auth hook which calls our local API via lib/api.ts
      await login({
        companyCode: formData.companyCode.trim().toUpperCase(),
        employeeNo: formData.employeeNo.trim(),
        password: formData.password,
      });

      // Login successful — navigate to dashboard.
      // Face verification/registration is handled on the clock in/out page only.
    } catch (error: any) {
      // Show specific validation popup
      const errorMessage = error?.message || 'Invalid company code, employee number, or password.';
      const errorTitle = error?.title || 'Validation';
      Alert.alert(errorTitle, errorMessage, [
        {
          text: 'OK',
          onPress: () => {
            try { Keyboard.dismiss(); } catch { }
            // Clear field-level errors and reset password for a fresh retry
            setErrors({});
            setFormData(prev => ({ ...prev, password: '' }));
          },
        },
      ]);
    }
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
              {/* App Logo and Title */}
              <View style={{ alignItems: 'center', marginBottom: 48 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="finger-print" size={40} color="white" />
                </View>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: 8,
                  }}
                >
                  AI Attend Tracker
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: 'rgba(255, 255, 255, 0.8)',
                    textAlign: 'center',
                  }}
                >
                  Secure Employee Attendance Management
                </Text>
              </View>

              {/* Login Form */}
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: 16,
                  padding: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: colors.text,
                    textAlign: 'center',
                    marginBottom: 24,
                  }}
                >
                  Sign In
                </Text>
                {/* Validation popup replaces inline error banner */}

                {/* Company Code Field */}
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    Company Code
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: errors.companyCode ? colors.error : colors.border,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons
                      name="business"
                      size={20}
                      color={colors.textSecondary}
                      style={{ marginRight: 12 }}
                    />
                    <TextInput
                      style={{
                        flex: 1,
                        height: 50,
                        fontSize: 16,
                        color: colors.text,
                      }}
                      placeholder="Enter company code"
                      placeholderTextColor={colors.textSecondary}
                      value={formData.companyCode}
                      onChangeText={(value) => updateField('companyCode', value)}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                  </View>
                  {errors.companyCode && (
                    <Text style={{ color: colors.error, fontSize: 14, marginTop: 4 }}>
                      {errors.companyCode}
                    </Text>
                  )}
                </View>

                {/* Employee Number Field */}
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    Employee Number
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: errors.employeeNo ? colors.error : colors.border,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons
                      name="person"
                      size={20}
                      color={colors.textSecondary}
                      style={{ marginRight: 12 }}
                    />
                    <TextInput
                      style={{
                        flex: 1,
                        height: 50,
                        fontSize: 16,
                        color: colors.text,
                      }}
                      placeholder="Enter employee number"
                      placeholderTextColor={colors.textSecondary}
                      value={formData.employeeNo}
                      onChangeText={(value) => updateField('employeeNo', value)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                  </View>
                  {errors.employeeNo && (
                    <Text style={{ color: colors.error, fontSize: 14, marginTop: 4 }}>
                      {errors.employeeNo}
                    </Text>
                  )}
                </View>

                {/* Password Field */}
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    Password
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.background,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: errors.password ? colors.error : colors.border,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={20}
                      color={colors.textSecondary}
                      style={{ marginRight: 12 }}
                    />
                    <TextInput
                      ref={passwordRef}
                      style={{
                        flex: 1,
                        height: 50,
                        fontSize: 16,
                        color: colors.text,
                      }}
                      placeholder="Enter password"
                      placeholderTextColor={colors.textSecondary}
                      value={formData.password}
                      onChangeText={(value) => updateField('password', value)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password && (
                    <Text style={{ color: colors.error, fontSize: 14, marginTop: 4 }}>
                      {errors.password}
                    </Text>
                  )}
                </View>

                {/* Login Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    height: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                    opacity: isLoading ? 0.7 : 1,
                  }}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <CustomLoader color="white" size="small" />
                  ) : (
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 18,
                        fontWeight: 'bold',
                      }}
                    >
                      Sign In
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={{ alignItems: 'center', marginTop: 32 }}>
                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                >
                  Secure authentication with end-to-end encryption
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

    </SafeAreaView>
  );
}
