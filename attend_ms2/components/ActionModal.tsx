import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { BlurView } from 'expo-blur';
import colors from '@/constants/colors';
import { X } from 'lucide-react-native';

interface ActionOption {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    variant?: 'default' | 'destructive' | 'primary';
}

interface ActionModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    options: ActionOption[];
}

export default function ActionModal({ visible, onClose, title, options }: ActionModalProps) {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                    <TouchableWithoutFeedback>
                        <View style={styles.contentContainer}>
                            <View style={styles.header}>
                                <Text style={styles.title}>{title || 'Select Action'}</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <X size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.optionsContainer}>
                                {options.map((option, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.optionButton,
                                            option.variant === 'primary' && styles.primaryOption,
                                            option.variant === 'destructive' && styles.destructiveOption,
                                        ]}
                                        onPress={() => {
                                            onClose();
                                            option.onPress();
                                        }}
                                    >
                                        {option.icon && option.icon}
                                        <Text style={[
                                            styles.optionText,
                                            option.variant === 'primary' && styles.primaryOptionText,
                                            option.variant === 'destructive' && styles.destructiveOptionText,
                                        ]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    closeButton: {
        padding: 4,
    },
    optionsContainer: {
        gap: 12,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
    },
    primaryOption: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    destructiveOption: {
        backgroundColor: '#FF3B3010',
        borderColor: '#FF3B30',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    primaryOptionText: {
        color: '#FFFFFF',
    },
    destructiveOptionText: {
        color: '#FF3B30',
    },
});
