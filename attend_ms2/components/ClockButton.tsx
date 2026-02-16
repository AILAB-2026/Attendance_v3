import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import * as Haptics from 'expo-haptics';
import { LogIn, LogOut } from 'lucide-react-native';

import colors from '@/constants/colors';

type ClockButtonProps = {
  type: 'in' | 'out';
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

const ClockButton = ({ type, onPress, isLoading = false, disabled = false }: ClockButtonProps) => {
  const handlePress = () => {
    if (!disabled && !isLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const isClockIn = type === 'in';
  const backgroundColor = isClockIn ? colors.clockIn : colors.clockOut;
  const Icon = isClockIn ? LogIn : LogOut;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor },
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={isClockIn ? 'Clock In' : 'Clock Out'}
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      activeOpacity={0.85}
      testID={`clock-${type}-button`}
    >
      {isLoading ? (
        <CustomLoader color="#fff" size="small" />
      ) : (
        <View style={styles.content}>
          <Icon size={24} color="#fff" />
          <Text style={styles.text}>{isClockIn ? 'Clock In' : 'Clock Out'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default ClockButton;