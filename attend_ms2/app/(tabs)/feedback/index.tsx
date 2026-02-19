import React, { useEffect, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
    ActivityIndicator, SafeAreaView, StatusBar, Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { apiService } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import colors from '@/constants/colors';

export default function FeedbackListScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [surveys, setSurveys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

    const fetchSurveys = async (isRefresh = false) => {
        if (!user) return;
        if (!isRefresh) setLoading(true);
        try {
            const cc = (user as any).companyCode;
            const emp = (user as any).employeeNo || (user as any).empNo;
            // Fetch surveys with type='feedback'
            const res = await apiService.getSurveys(cc, emp, 'feedback');
            if (res.success && res.surveys) {
                setSurveys(res.surveys);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSurveys();
        }, [user])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchSurveys(true);
    };

    const handlePress = (surveyId: number) => {
        router.push(`/(tabs)/feedback/${surveyId}` as any);
    };

    const pendingSurveys = surveys.filter(s => !s.has_submitted && s.state !== 'completed' && s.state !== 'draft');

    // Filter history to last 1 month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const historySurveys = surveys.filter(s => {
        const isMissed = !s.has_submitted && s.state === 'completed';
        const isSubmitted = s.has_submitted;

        if (!isSubmitted && !isMissed) return false;

        let dateToCheck = new Date();
        if (s.submitted_at) {
            dateToCheck = new Date(s.submitted_at);
        } else if (s.end_date) {
            dateToCheck = new Date(s.end_date);
        } else if (s.create_date) {
            dateToCheck = new Date(s.create_date);
        }

        return dateToCheck >= oneMonthAgo;
    });

    const displayList = activeTab === 'pending' ? pendingSurveys : historySurveys;

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const formatDateShort = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('en-GB', { month: 'short' });
        const year = d.getFullYear().toString().slice(-2);
        return `${day}/${month}/${year}`;
    };

    const renderItem = ({ item }: { item: any }) => {
        if (activeTab === 'history') {
            const isMissed = !item.has_submitted && item.state === 'completed';

            // Determine date to show
            let dateObj = new Date();
            if (item.submitted_at) {
                dateObj = new Date(item.submitted_at);
            } else if (item.end_date) {
                dateObj = new Date(item.end_date);
            } else if (item.create_date) {
                dateObj = new Date(item.create_date);
            }
            const dateStr = formatDate(dateObj.toISOString());

            return (
                <TouchableOpacity
                    style={[styles.card, isMissed && { opacity: 0.9, borderColor: '#fee2e2' }]}
                    onPress={() => isMissed ? Alert.alert('Feedback Closed', 'This feedback form is no longer available.') : handlePress(item.id)}
                    activeOpacity={0.9}
                >
                    {/* Header: Date + Badge */}
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardDate} numberOfLines={1}>{dateStr}</Text>
                        <View style={[styles.badge, { backgroundColor: isMissed ? '#fef2f2' : '#dcfce7' }]}>
                            <Text style={[styles.badgeText, { color: isMissed ? '#ef4444' : '#15803d' }]}>
                                {isMissed ? 'EXPIRED' : 'SUBMITTED'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.separator} />

                    {/* Detail Rows with feedback-themed icons */}
                    <View style={styles.detailRow}>
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                        <Text style={styles.detailLabel}>Feedback   :</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>{item.title}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color="#64748b" />
                        <Text style={styles.detailLabel}>Date Range :</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>
                            {formatDateShort(item.start_date)} - {formatDateShort(item.end_date)}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Ionicons name={isMissed ? "close-circle-outline" : "checkmark-circle-outline"} size={16} color={isMissed ? "#ef4444" : "#15803d"} />
                        <Text style={styles.detailLabel}>Status     :</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>
                            {isMissed ? 'Closed (Not Submitted)' : (item.state === 'completed' ? 'Closed' : item.state ? (item.state.charAt(0).toUpperCase() + item.state.slice(1)) : 'Completed')}
                        </Text>
                    </View>

                    <View style={styles.separator} />

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                        <Text style={[styles.footerDate, isMissed && { color: '#ef4444' }]}>
                            {isMissed ? 'Expired: ' + dateStr : 'Submitted: ' + dateStr}
                        </Text>

                        {!isMissed ? (
                            <View style={styles.footerAction}>
                                <Text style={[styles.footerActionText, { color: '#15803d' }]}>View Details</Text>
                                <Ionicons name="chatbubbles" size={16} color="#15803d" />
                            </View>
                        ) : (
                            <View style={styles.footerAction}>
                                <Text style={[styles.footerActionText, { color: '#ef4444' }]}>Closed</Text>
                                <Ionicons name="lock-closed" size={16} color="#ef4444" />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            );
        } else {
            // PENDING CARD DESIGN (matching survey pending card layout)
            const dateObj = item.create_date ? new Date(item.create_date) : new Date();
            const dateStr = formatDate(dateObj.toISOString());

            return (
                <TouchableOpacity style={styles.card} onPress={() => handlePress(item.id)} activeOpacity={0.9}>
                    {/* Header: Date + Badge */}
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardDate} numberOfLines={1}>{dateStr}</Text>
                        <View style={[styles.badge, { backgroundColor: '#fff7ed' }]}>
                            <Text style={[styles.badgeText, { color: '#ea580c' }]}>GIVE FEEDBACK</Text>
                        </View>
                    </View>

                    <View style={styles.separator} />

                    {/* Detail Rows with feedback-themed icons */}
                    <View style={styles.detailRow}>
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                        <Text style={styles.detailLabel}>Feedback   :</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>{item.title}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color="#64748b" />
                        <Text style={styles.detailLabel}>Date Range :</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>
                            {formatDateShort(item.start_date)} - {formatDateShort(item.end_date)}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={16} color="#ea580c" />
                        <Text style={styles.detailLabel}>Status     :</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>
                            {item.state === 'completed'
                                ? 'Closed'
                                : item.state
                                    ? (item.state.charAt(0).toUpperCase() + item.state.slice(1))
                                    : 'Open'}
                        </Text>
                    </View>

                    <View style={styles.separator} />

                    {/* Footer: Created Date and Give Feedback CTA */}
                    <View style={styles.cardFooter}>
                        <Text style={styles.footerDate}>Created: {dateStr}</Text>
                        <View style={styles.footerAction}>
                            <Text style={[styles.footerActionText, { color: colors.primary }]}>Give Feedback</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            <View style={styles.header}>
                <View style={styles.topHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.screenTitle}>My Feedback</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={styles.tab}
                        onPress={() => setActiveTab('pending')}
                    >
                        <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                            Pending ({pendingSurveys.length})
                        </Text>
                        {activeTab === 'pending' && <View style={styles.activeLine} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.tab}
                        onPress={() => setActiveTab('history')}
                    >
                        <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                            History
                        </Text>
                        {activeTab === 'history' && <View style={styles.activeLine} />}
                    </TouchableOpacity>
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={displayList}
                    renderItem={renderItem}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconBg}>
                                <Ionicons
                                    name={activeTab === 'pending' ? "chatbox-ellipses-outline" : "time-outline"}
                                    size={48}
                                    color="#94a3b8"
                                />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {activeTab === 'pending' ? "No Feedback Requests" : "No Feedback History"}
                            </Text>
                            <Text style={styles.emptyText}>
                                {activeTab === 'pending'
                                    ? "You have no pending feedback requests."
                                    : "You haven't submitted any feedback yet."}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    backButton: {
        padding: 4,
    },
    screenTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    tabContainer: { flexDirection: 'row' },
    tab: { flex: 1, paddingVertical: 16, alignItems: 'center', position: 'relative' },
    tabText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
    activeTabText: { color: colors.primary, fontWeight: '700' },
    activeLine: {
        position: 'absolute', bottom: 0, height: 3, width: '50%',
        backgroundColor: colors.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3,
    },

    list: { padding: 16 },

    // Card Styles
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardDate: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
        flex: 1,
        marginRight: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
    },

    separator: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },

    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    detailLabel: {
        marginLeft: 8,
        fontSize: 14,
        color: '#64748b',
        width: 110,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '600',
        flex: 1,
    },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    footerDate: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    footerAction: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerActionText: {
        fontWeight: '700',
        fontSize: 13,
        marginRight: 4,
    },

    // Empty State
    emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyIconBg: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 8 },
    emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
});
