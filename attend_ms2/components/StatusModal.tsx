import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Platform
} from 'react-native';
import { Check, X, Clock, AlertTriangle, Info, Lock } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'clock-in' | 'clock-out';

export interface StatusModalButton {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'primary' | 'danger';
}

export interface StatusModalProps {
    visible: boolean;
    type?: StatusType;
    title: string;
    message: string;
    buttons?: StatusModalButton[];
    onClose?: () => void;
}

const { width } = Dimensions.get('window');

const StatusModal: React.FC<StatusModalProps> = ({
    visible,
    type = 'info',
    title,
    message,
    buttons = [{ text: 'OK', onPress: () => { }, style: 'primary' }],
    onClose,
}) => {
    const scaleValue = useRef(new Animated.Value(0.8)).current;
    const opacityValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleValue, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityValue, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleValue.setValue(0.8);
            opacityValue.setValue(0);
        }
    }, [visible]);

    const getIcon = () => {
        const iconSize = 36;
        const strokeWidth = 3;
        switch (type) {
            case 'success':
                return <Check size={iconSize} color="#fff" strokeWidth={strokeWidth} />;
            case 'error':
                return <X size={iconSize} color="#fff" strokeWidth={strokeWidth} />;
            case 'warning':
                return <Lock size={iconSize} color="#fff" strokeWidth={strokeWidth} />;
            case 'clock-in':
            case 'clock-out':
                return <Clock size={iconSize} color="#fff" strokeWidth={strokeWidth} />;
            default:
                return <Info size={iconSize} color="#fff" strokeWidth={strokeWidth} />;
        }
    };

    const getGradientColors = (): [string, string] => {
        switch (type) {
            case 'success':
            case 'clock-in':
                return ['#4ade80', '#16a34a']; // Green-400 to Green-600
            case 'error':
                return ['#fb7185', '#e11d48']; // Rose-400 to Rose-600
            case 'warning':
                return ['#fbbf24', '#d97706']; // Amber-400 to Amber-600
            case 'clock-out':
            case 'info':
            default:
                return ['#60a5fa', '#2563eb']; // Blue-400 to Blue-600
        }
    };

    const handleButtonPress = (button: StatusModalButton) => {
        button.onPress();
        if (onClose) onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none" // We handle animation manually
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlayWrapper}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={styles.androidOverlay} />
                )}

                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: opacityValue,
                            transform: [{ scale: scaleValue }],
                        },
                    ]}
                >
                    {/* Icon with Gradient */}
                    <LinearGradient
                        colors={getGradientColors()}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.iconContainer}
                    >
                        {getIcon()}
                    </LinearGradient>

                    {/* Title */}
                    <Text style={styles.title}>{title}</Text>

                    {/* Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Buttons */}
                    <View style={[styles.buttonContainer, buttons.length > 2 && { flexDirection: 'column' }]}>
                        {buttons.map((button, index) => {
                            const isVertical = buttons.length > 2;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    activeOpacity={0.8}
                                    style={[
                                        styles.buttonWrapper,
                                        !isVertical && buttons.length > 1 && { flex: 1 },
                                        !isVertical && index > 0 && { marginLeft: spacing.md },
                                        isVertical && { width: '100%', marginTop: index > 0 ? 12 : 0 },
                                    ]}
                                    onPress={() => handleButtonPress(button)}
                                >
                                    {button.style === 'primary' || button.style === 'danger' || button.style === 'default' ? (
                                        <LinearGradient
                                            colors={
                                                button.style === 'danger' ? ['#ef4444', '#b91c1c'] : // Red
                                                    button.style === 'primary' ? getGradientColors() :
                                                        ['#f1f5f9', '#e2e8f0']
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.gradientButton}
                                        >
                                            <Text
                                                style={[
                                                    styles.buttonText,
                                                    button.style === 'default' && { color: colors.textSecondary },
                                                    (button.style === 'primary' || button.style === 'danger') && { color: '#fff' }
                                                ]}
                                            >
                                                {button.text}
                                            </Text>
                                        </LinearGradient>
                                    ) : (
                                        <View style={[styles.gradientButton, styles.cancelButton]}>
                                            <Text style={[styles.buttonText, styles.cancelButtonText]}>
                                                {button.text}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlayWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    androidOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#fff',
        borderRadius: 24,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xxl,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: spacing.sm,
        letterSpacing: 0.5,
    },
    message: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: spacing.xl + 4,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonWrapper: {
        borderRadius: 99,
        // overflow: 'hidden', // caused shadow cut off, verify if needed
    },
    gradientButton: {
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
        borderRadius: 99,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    cancelButton: {
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    cancelButtonText: {
        color: '#64748b',
    },
});

export default StatusModal;
