import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import colors from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '@/lib/api';
import StatusModal, { StatusType, StatusModalButton } from '@/components/StatusModal';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;

interface DashboardItem {
    id: string;
    title: string;
    icon?: any;
    imageIcon?: any; // For realistic image icons
    route?: string;
    visible?: boolean;
    gradient?: [string, string];
}

export default function DashboardScreen() {
    const router = useRouter();
    const { user, logout, refreshSession } = useAuth();
    const [dynamicCompanyName, setDynamicCompanyName] = useState<string>('');

    // Status Modal state
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusModalType, setStatusModalType] = useState<StatusType>('info');
    const [statusModalTitle, setStatusModalTitle] = useState('');
    const [statusModalMessage, setStatusModalMessage] = useState('');
    const [statusModalButtons, setStatusModalButtons] = useState<StatusModalButton[]>([]);

    const userName = (user as any)?.name || 'User';
    // Fallback logic handled in effect, init with auth data if available
    const profileImage = (user as any)?.profileImageUri;

    useEffect(() => {
        const fetchCompanyName = async () => {
            const code = (user as any)?.companyCode;
            if (code) {
                // Try fetching specific company name endpoint first
                try {
                    const res = await apiService.getCompanyName(code);
                    if (res?.success && res?.data?.companyName) {
                        setDynamicCompanyName(res.data.companyName);
                        return;
                    }
                } catch (e) { console.log('Error fetching company name:', e); }

                // Fallback to company info if needed (though getCompanyName is preferred)
                try {
                    const res = await apiService.getCompanyInfo(code);
                    if (res?.success && res?.data?.companyName) {
                        setDynamicCompanyName(res.data.companyName);
                    }
                } catch (e) { console.log('Error fetching company info:', e); }
            }
        };
        fetchCompanyName();
    }, [user]);

    // Use fetched name, or auth name, or fallback
    const displayCompanyName = dynamicCompanyName || (user as any)?.companyName || 'INFO-TECH SYSTEMS LTD.';

    // Filter items based on company module flags
    const moduleFlags = (user as any)?.modules || {};

    // Default to true if modules config is missing (backward compatibility)
    // If modules config exists, we respect the boolean values.
    const checkModule = (key: string) => {
        if (!moduleFlags || Object.keys(moduleFlags).length === 0) return true;
        return moduleFlags[key] !== false;
    };

    const allItems: DashboardItem[] = [
        {
            id: 'attendance',
            title: 'Attendance',
            imageIcon: require('@/assets/images/icon_attendance.png'),
            route: '/(tabs)/attendance',
            visible: checkModule('attendance'),
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'history',
            title: 'History',
            imageIcon: require('@/assets/images/history.png.png'),
            route: '/(tabs)/history',
            visible: checkModule('history'),
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'leave',
            title: 'Leave',
            imageIcon: require('@/assets/images/icon_leave.png'),
            route: '/(tabs)/leave',
            visible: checkModule('leave'),
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'schedule',
            title: 'Schedule',
            imageIcon: require('@/assets/images/schedule.png'),
            route: '/(tabs)/schedule',
            visible: checkModule('schedule'),
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'survey',
            title: 'Survey',
            imageIcon: require('@/assets/images/survey.png'),
            route: '/(tabs)/survey',
            visible: checkModule('survey'),
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'payslip',
            title: 'Payslip',
            imageIcon: require('@/assets/images/icon_payslip.png'),
            route: '/(tabs)/payslips',
            visible: checkModule('payroll'),
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'feedback',
            title: 'Feedback',
            imageIcon: require('@/assets/images/feedback.png'),
            route: '/(tabs)/feedback',
            visible: checkModule('feedback'),
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'claims',
            title: 'Claims',
            imageIcon: require('@/assets/images/icon_claims.png'),
            route: '',
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'incometax',
            title: 'Income Tax',
            imageIcon: require('@/assets/images/icon_incometax.png'),
            route: '',
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'hrmemos',
            title: 'HR Memos',
            icon: <MaterialCommunityIcons name="file-document-outline" size={32} color="#fff" />,
            route: '',
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'policies',
            title: 'Company Policies',
            icon: <MaterialIcons name="shield" size={32} color="#fff" />,
            route: '',
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'meetings',
            title: 'Meeting Room',
            icon: <MaterialIcons name="meeting-room" size={32} color="#fff" />,
            route: '/(tabs)/toolbox',
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
        {
            id: 'flexwork',
            title: 'Flexible Work',
            icon: <MaterialCommunityIcons name="laptop" size={32} color="#fff" />,
            route: '',
            gradient: ['#bae6fd', '#3b82f6'] // Light Blue
        },
    ];

    const items = allItems;

    const showStatusModal = (title: string, message: string, type: StatusType, buttons?: StatusModalButton[]) => {
        setStatusModalTitle(title);
        setStatusModalMessage(message);
        setStatusModalType(type);
        setStatusModalButtons(buttons || [{ text: 'OK', onPress: () => setStatusModalVisible(false), style: 'primary' }]);
        setStatusModalVisible(true);
    };

    const onChangeProfileImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showStatusModal('Permission required', 'Please grant Photo Library permission to select a profile image.', 'warning');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (result.canceled) return;
            const asset = result.assets?.[0];
            if (!asset?.uri) return;

            const cc = (user as any)?.companyCode;
            const emp = (user as any)?.empNo || (user as any)?.employeeNo;

            if (!cc || !emp) return;

            const resp = await apiService.updateProfileImage(cc, emp, asset.uri);
            if (!resp?.success) {
                showStatusModal('Update failed', 'Could not update profile image. Please try again.', 'error');
                return;
            }

            showStatusModal('Profile updated', 'Your profile image has been updated.', 'success');
            if (refreshSession) { try { await refreshSession(); } catch { } }
        } catch (e: any) {
            showStatusModal('Update failed', 'Could not update profile image.', 'error');
        }
    };

    const confirmLogout = () => {
        showStatusModal(
            'Logout',
            'Are you sure you want to logout?',
            'warning',
            [
                { text: 'Cancel', style: 'cancel', onPress: () => setStatusModalVisible(false) },
                {
                    text: 'Logout',
                    style: 'primary',
                    onPress: async () => {
                        setStatusModalVisible(false);
                        try { await logout(); } catch (error) { }
                    }
                },
            ]
        );
    };

    const handleProfilePress = () => {
        showStatusModal(
            'Profile Options',
            'What would you like to do?',
            'info',
            [
                {
                    text: 'Update Photo',
                    style: 'primary',
                    onPress: () => {
                        setStatusModalVisible(false);
                        setTimeout(() => onChangeProfileImage(), 500);
                    }
                },
                {
                    text: 'Logout',
                    style: 'danger',
                    onPress: () => {
                        setStatusModalVisible(false);
                        setTimeout(() => confirmLogout(), 500);
                    }
                },
                { text: 'Cancel', style: 'cancel', onPress: () => setStatusModalVisible(false) },
            ]
        );
    };

    const handlePress = (item: DashboardItem) => {
        if (item.visible === false) {
            showStatusModal(
                'Access Unavailable',
                'This feature is currently not enabled for your account. Please contact your administrator for access.',
                'warning'
            );
            return;
        }
        if (item.route) {
            router.push(item.route as any);
        } else {
            Alert.alert('Coming Soon', `${item.title} feature is coming soon.`);
        }
    };

    // Dynamic Logo Logic
    const getCompanyLogo = () => {
        const code = (user as any)?.companyCode?.toUpperCase() || '';
        if (code.includes('AILAB') || code.includes('AI LAB')) {
            return require('@/assets/images/ai_lab_logo-Picsart-BackgroundRemover.jpg');
        } else if (code.includes('SKK')) {
            return require('@/assets/images/skk-logo-Picsart-BackgroundRemover.png');
        } else if (code.includes('BRK')) {
            return require('@/assets/images/brk_logo.png');
        }
        // Default fallback
        return require('@/assets/images/ai_lab_logo-Picsart-BackgroundRemover.jpg');
    };

    return (
        <View style={styles.container}>
            {/* Fixed Header */}
            <View style={styles.header}>
                <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
                    <View style={styles.headerTop}>
                        <View style={{ flex: 1 }}>
                            <View style={{
                                width: 45,
                                height: 45,
                                borderRadius: 22.5,
                                backgroundColor: 'white',
                                justifyContent: 'center',
                                alignItems: 'center',
                                overflow: 'hidden',
                                borderWidth: 2,
                                borderColor: 'white'
                            }}>
                                <Image
                                    source={getCompanyLogo()}
                                    style={{ width: '85%', height: '85%' }}
                                    contentFit="contain"
                                />
                            </View>
                        </View>

                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.iconBtn}>
                                <Ionicons name="settings-outline" size={24} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn}>
                                <Ionicons name="notifications-outline" size={24} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.profileBtn} onPress={handleProfilePress}>
                                {profileImage ? (
                                    <Image source={{ uri: profileImage }} style={styles.profileImg} />
                                ) : (
                                    <View style={[styles.profileImg, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{userName.charAt(0)}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.welcomeSection}>
                        <Text style={styles.welcomeText}>HELLO, {userName.toUpperCase()}</Text>
                        <Text style={styles.companyText}>{displayCompanyName}</Text>
                    </View>
                </SafeAreaView>
            </View>

            {/* Scrollable Content (Icons Only) */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>Manage Your Work</Text>

                <View style={styles.grid}>
                    {items.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.gridItem}
                            onPress={() => handlePress(item)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.iconShadow}>
                                <LinearGradient
                                    colors={item.gradient || ['#3b82f6', '#1d4ed8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.iconContainer}
                                >
                                    {item.imageIcon ? (
                                        <Image
                                            source={item.imageIcon}
                                            style={styles.innerImageIcon}
                                            contentFit="contain"
                                        />
                                    ) : (
                                        item.icon
                                    )}
                                </LinearGradient>
                            </View>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Spacer for bottom content if needed */}
                <View style={{ height: 20 }} />
            </ScrollView>



            <StatusModal
                visible={statusModalVisible}
                type={statusModalType}
                title={statusModalTitle}
                message={statusModalMessage}
                buttons={statusModalButtons}
                onClose={() => setStatusModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F5FA',
    },
    header: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingBottom: 30, // Increased padding for curve effect
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        zIndex: 10, // Ensure it sits on top if we overlap
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        marginTop: 10,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    iconBtn: {
        padding: 4,
    },
    profileBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'white',
        overflow: 'hidden',
    },
    profileImg: {
        width: '100%',
        height: '100%',
    },
    welcomeSection: {
        marginTop: 10,
        marginBottom: 10,
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4,
    },
    companyText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 28,
        letterSpacing: 0.3,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    gridItem: {
        width: '30%',
        alignItems: 'center',
        marginBottom: 28,
    },
    iconShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
        marginBottom: 12,
        borderRadius: 99, // Circular shadow
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 99, // Circular container
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageIconContainer: {
        width: 72,
        height: 72,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    imageIcon: {
        width: '100%',
        height: '100%',
    },
    innerImageIcon: {
        width: 66,
        height: 66,
        borderRadius: 33,
    },
    itemTitle: {
        fontSize: 12,
        color: '#475569',
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 16,
    },
    footerContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 10,
        backgroundColor: '#F0F5FA', // Match bg
    },
    banner: {
        borderRadius: 16,
        padding: 16,
        overflow: 'hidden',
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bannerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 2,
    },
    bannerSubtitle: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    bannerBtn: {
        backgroundColor: '#F59E0B',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginLeft: 8,
    },
    bannerBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
});
