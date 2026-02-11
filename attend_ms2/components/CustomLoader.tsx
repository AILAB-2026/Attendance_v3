import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, ActivityIndicator } from 'react-native';
import colors from '@/constants/colors';

interface CustomLoaderProps {
    size?: 'small' | 'large' | number;
    color?: string;
    style?: any;
}

export default function CustomLoader({ size = 'large', color = colors.primary, style }: CustomLoaderProps) {
    // Use numeric size for custom scaling if provided, otherwise standard string mapping
    const isSmall = size === 'small' || (typeof size === 'number' && size < 30);

    if (isSmall) {
        // For small inline loaders (buttons etc), keep the native one for layout safety
        // unless we want a tiny custom animation? Let's stick to native for stability in tight spaces.
        return <ActivityIndicator size="small" color={color} style={style} />;
    }

    // Large animation logic
    const rotateValue = useRef(new Animated.Value(0)).current;
    const pulseValue = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const spin = Animated.loop(
            Animated.timing(rotateValue, {
                toValue: 1,
                duration: 1200,
                easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Standard cubic-bezier for smooth spin
                useNativeDriver: true,
            })
        );

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseValue, { toValue: 0.6, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseValue, { toValue: 1, duration: 800, useNativeDriver: true })
            ])
        );

        spin.start();
        pulse.start();

        return () => {
            spin.stop();
            pulse.stop();
        };
    }, []);

    const spin = rotateValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <View style={[styles.container, style]}>
            {/* Outer Ring Segment 1 */}
            <Animated.View style={[
                styles.ring,
                {
                    width: 48, height: 48, borderRadius: 24,
                    borderColor: color,
                    borderTopColor: 'transparent',
                    borderRightColor: 'transparent',
                    transform: [{ rotate: spin }]
                }
            ]} />

            {/* Outer Ring Segment 2 (Opposite) */}
            <Animated.View style={[
                styles.ring,
                {
                    width: 48, height: 48, borderRadius: 24,
                    borderColor: color,
                    borderBottomColor: 'transparent',
                    borderLeftColor: 'transparent',
                    opacity: 0.5,
                    transform: [{ rotate: rotateValue.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '540deg'] }) }]
                }
            ]} />

            {/* Inner Pulsing Core */}
            <Animated.View style={[
                styles.core,
                {
                    backgroundColor: color,
                    transform: [{ scale: pulseValue }]
                }
            ]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 50,
        height: 50,
    },
    ring: {
        borderWidth: 3,
        position: 'absolute',
    },
    core: {
        width: 12,
        height: 12,
        borderRadius: 6,
        opacity: 0.8,
    }
});
