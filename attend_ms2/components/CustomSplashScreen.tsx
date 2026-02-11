import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text, Dimensions, Easing, Platform } from 'react-native';
import { ScanFace, User, Scan, Zap, CheckCircle2, Server } from 'lucide-react-native';
import colors from '@/constants/colors';
import { shadows } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

interface CustomSplashScreenProps {
    onFinish: () => void;
}

export default function CustomSplashScreen({ onFinish }: CustomSplashScreenProps) {
    // Animation values
    const bgOpacity = useRef(new Animated.Value(0)).current;
    const iconScale = useRef(new Animated.Value(0)).current;
    const iconOpacity = useRef(new Animated.Value(0)).current;
    const scanLineY = useRef(new Animated.Value(0)).current;
    const scannerOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const textTranslateY = useRef(new Animated.Value(20)).current;
    const successScale = useRef(new Animated.Value(0)).current;

    // Node dots animations
    const dot1Opacity = useRef(new Animated.Value(0)).current;
    const dot2Opacity = useRef(new Animated.Value(0)).current;
    const dot3Opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Sequence of animations
        const cleanup = () => {
            // Clean up logic if unmounted
        };

        // Start animation
        runAnimation();

    }, []);

    const runAnimation = () => {
        // Reset
        scanLineY.setValue(-60);

        Animated.sequence([
            // Enter
            Animated.parallel([
                Animated.timing(bgOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(iconScale, { toValue: 1, friction: 7, useNativeDriver: true }),
                Animated.timing(iconOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]),

            // Show Scanner
            Animated.timing(scannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),

            // Scan twice
            Animated.parallel([
                // Scan Line Movement
                Animated.sequence([
                    Animated.timing(scanLineY, { toValue: 60, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
                    Animated.timing(scanLineY, { toValue: -60, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
                    Animated.timing(scanLineY, { toValue: 60, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
                ]),
                // Dots flickering
                Animated.sequence([
                    Animated.delay(500),
                    Animated.timing(dot1Opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                    Animated.delay(300),
                    Animated.timing(dot2Opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                    Animated.delay(300),
                    Animated.timing(dot3Opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                ])
            ]),

            // Success / Text Reveal
            Animated.parallel([
                Animated.timing(scannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(successScale, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.elastic(1.2) }),
                Animated.timing(textOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(textTranslateY, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
            ]),

            Animated.delay(1200), // Hold the success state

            // Fade out
            Animated.timing(bgOpacity, { toValue: 0, duration: 500, useNativeDriver: true })
        ]).start(({ finished }) => {
            if (finished) onFinish();
        });
    };

    return (
        <Animated.View style={[styles.container, { opacity: bgOpacity }]}>

            {/* Central Identity Composition */}
            <View style={styles.centerContent}>

                {/* Face Icon Container */}
                <Animated.View style={[
                    styles.iconContainer,
                    {
                        transform: [{ scale: iconScale }],
                        opacity: iconOpacity
                    }
                ]}>
                    <ScanFace size={80} color={colors.primary} strokeWidth={1.5} />

                    {/* Grid/Nodes Overlay */}
                    <View style={StyleSheet.absoluteFill}>
                        <Animated.View style={[styles.node, { top: '30%', left: '30%', opacity: dot1Opacity }]} />
                        <Animated.View style={[styles.node, { top: '60%', right: '35%', opacity: dot2Opacity }]} />
                        <Animated.View style={[styles.node, { top: '45%', right: '25%', opacity: dot3Opacity }]} />
                    </View>

                    {/* Scan Line */}
                    <Animated.View style={[
                        styles.scanLine,
                        {
                            opacity: scannerOpacity,
                            transform: [{ translateY: scanLineY }]
                        }
                    ]} >
                        <View style={styles.scanLaser} />
                    </Animated.View>

                    {/* Success Checkmark overlay */}
                    <Animated.View style={[styles.successOverlay, { transform: [{ scale: successScale }], opacity: successScale }]}>
                        <View style={styles.successCircle}>
                            <CheckCircle2 size={40} color="#fff" strokeWidth={3} />
                        </View>
                    </Animated.View>

                </Animated.View>

                {/* Text */}
                <Animated.View style={[
                    styles.textContainer,
                    {
                        opacity: textOpacity,
                        transform: [{ translateY: textTranslateY }]
                    }
                ]}>
                    <Text style={styles.title}>AI ATTEND</Text>
                    <Text style={styles.subtitle}>SECURE • FAST • INTELLIGENT</Text>
                </Animated.View>

            </View>

            {/* Decorative background elements */}
            <View style={styles.bgGrid}>
                {/* Simple subtle grid lines if needed */}
            </View>

        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.background, // F7F9FC
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        overflow: 'hidden',
        // App Style Shadows
        ...shadows.card,
    },
    scanLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanLaser: {
        width: '100%',
        height: 2,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
        elevation: 4,
    },
    node: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primaryLight,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.primary,
        letterSpacing: 2,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    bgGrid: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: -1,
    },
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.05)', // Very subtle tint
    },
    successCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    }
});
