import React, { useEffect, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
    ActivityIndicator, SafeAreaView, StatusBar
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
        // Reuse the survey detail screen logic but keep user in Feedback tab context
        router.push(`/(tabs)/feedback/${surveyId}` as any);
    };

    const pendingSurveys = surveys.filter(s => !s.has_submitted);

    // Filter history to last 1 month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const historySurveys = surveys.filter(s => {
        if (!s.has_submitted) return false;
        if (!s.submitted_at) return true;
        const submittedDate = new Date(s.submitted_at);
        return submittedDate >= oneMonthAgo;
    });

    const displayList = activeTab === 'pending' ? pendingSurveys : historySurveys;

    const renderItem = ({ item }: { item: any }) => {
        if (activeTab === 'history') {
            const dateObj = item.submitted_at ? new Date(item.submitted_at) : new Date();
            const day = dateObj.getDate().toString().padStart(2, '0');
            const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const year = dateObj.getFullYear();
            const dateStr = `${day}-${month}-${year}`;

            return (
                <TouchableOpacity style={styles.historyCard} onPress={() => handlePress(item.id)} activeOpacity={0.9}>
                    <View style={styles.historyHeader}>
                        <Text style={styles.historyDate} numberOfLines={1}>{dateStr}</Text>
                        <View style={[styles.historyBadge, { backgroundColor: '#dcfce7' }]}>
                            <Text style={[styles.historyBadgeText, { color: '#15803d' }]}>SUBMITTED</Text>
                        </View>
                    </View>

                    <View style={styles.separator} />

                    <View style={styles.historyRow}>
                        <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
                        <Text style={styles.historyLabel}>Feedback  :</Text>
                        <Text style={styles.historyValue} numberOfLines={1}>{item.title}</Text>
                    </View>

                    <View style={styles.historyRow}>
                        <Ionicons name="calendar-outline" size={16} color="#64748b" />
                        <Text style={styles.historyLabel}>Date      :</Text>
                        <Text style={styles.historyValue} numberOfLines={1}>{dateStr}</Text>
                    </View>

                    <View style={styles.separator} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Submitted: {dateStr}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: '#15803d', fontWeight: '700', fontSize: 13, marginRight: 4 }}>View Details</Text>
                            <Ionicons name="document-text" size={16} color="#15803d" />
                        </View>
                    </View>
                </TouchableOpacity>
            );
        } else {
            // PENDING CARD
            const dateObj = item.create_date ? new Date(item.create_date) : new Date();
            const day = dateObj.getDate().toString().padStart(2, '0');
            const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const year = dateObj.getFullYear();
            const dateStr = `${day}-${month}-${year}`;

            return (
                <TouchableOpacity style={styles.historyCard} onPress={() => handlePress(item.id)} activeOpacity={0.9}>
                    <View style={styles.historyHeader}>
                        <Text style={styles.historyDate} numberOfLines={1}>{item.title}</Text>
                        <View style={[styles.historyBadge, { backgroundColor: '#fff7ed' }]}>
                            <Text style={[styles.historyBadgeText, { color: '#ea580c' }]}>GIVE FEEDBACK</Text>
                        </View>
                    </View>

                    <View style={styles.separator} />

                    <View style={styles.historyRow}>
                        <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
                            {item.description || "Please share your thoughts with us."}
                        </Text>
                    </View>

                    <View style={styles.separator} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Created: {dateStr}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, marginRight: 4 }}>Start</Text>
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
            )
            }
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, // removed paddingTop: 12 as topHeader handles padding
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
    screenTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    tabContainer: { flexDirection: 'row' },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', position: 'relative' },
    tabText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
    activeTabText: { color: colors.primary, fontWeight: '700' },
    activeLine: { position: 'absolute', bottom: 0, height: 3, width: '40%', backgroundColor: colors.primary, borderRadius: 2 },
    list: { padding: 16 },
    historyCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    historyDate: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
    historyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    historyBadgeText: { fontSize: 11, fontWeight: '700' },
    separator: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
    historyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    historyLabel: { marginLeft: 8, fontSize: 14, color: '#64748b', width: 80, fontWeight: '500' },
    historyValue: { fontSize: 14, color: '#334155', fontWeight: '600', flex: 1 },
    emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 8 },
    emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
});
