
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { apiService } from '@/lib/api';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface FeedbackStats {
    averageRating: string;
    totalCount: number;
    distribution: { rating: number; count: number }[];
    environment: { work_environment: string; count: number }[];
    recentComments: { comments: string; created_at: string }[];
}

export default function FeedbackManagerView({ companyCode }: { companyCode: string }) {
    const [stats, setStats] = useState<FeedbackStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'comments'>('overview');
    const [comments, setComments] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalComments, setTotalComments] = useState(0);
    const [loadingComments, setLoadingComments] = useState(false);

    useEffect(() => {
        loadStats();
    }, [companyCode]);

    useEffect(() => {
        if (tab === 'comments') loadComments();
    }, [tab, page]);

    const loadStats = async () => {
        try {
            setLoading(true);
            const res = await apiService.getFeedbackStats(companyCode);
            if (res?.success) {
                setStats(res.stats);
            }
        } catch (e) {
            console.log('Error loading stats', e);
        } finally {
            setLoading(false);
        }
    };

    const loadComments = async () => {
        try {
            setLoadingComments(true);
            const res = await apiService.getFeedbackList(companyCode, page);
            if (res?.success) {
                if (page === 1) setComments(res.data.rows);
                else setComments(prev => [...prev, ...res.data.rows]);
                setTotalComments(res.data.total);
            }
        } finally {
            setLoadingComments(false);
        }
    };

    const RatingBar = ({ rating, count, total }: any) => (
        <View style={styles.ratingRow}>
            <Text style={styles.ratingNum}>{rating} ★</Text>
            <View style={styles.barContainer}>
                <View style={[styles.barFill, { width: `${(count / total) * 100}%` }]} />
            </View>
            <Text style={styles.ratingCount}>{count}</Text>
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

    return (
        <View style={styles.container}>
            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, tab === 'overview' && styles.activeTab]} onPress={() => setTab('overview')}>
                    <Text style={[styles.tabText, tab === 'overview' && styles.activeTabText]}>Overview</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, tab === 'comments' && styles.activeTab]} onPress={() => setTab('comments')}>
                    <Text style={[styles.tabText, tab === 'comments' && styles.activeTabText]}>All Comments</Text>
                </TouchableOpacity>
            </View>

            {tab === 'overview' && stats ? (
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Hero Card */}
                    <View style={styles.heroCard}>
                        <View>
                            <Text style={styles.heroTitle}>Average Rating</Text>
                            <Text style={styles.bigScore}>{stats.averageRating}</Text>
                            <View style={{ flexDirection: 'row' }}>
                                {[...Array(5)].map((_, i) => (
                                    <Ionicons
                                        key={i}
                                        name={i < Math.round(Number(stats.averageRating)) ? "star" : "star-outline"}
                                        size={16}
                                        color="#FDB022"
                                    />
                                ))}
                            </View>
                        </View>
                        <View style={styles.totalBadge}>
                            <Text style={styles.totalVal}>{stats.totalCount}</Text>
                            <Text style={styles.totalLabel}>Responses</Text>
                        </View>
                    </View>

                    {/* Breakdown */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Rating Breakdown</Text>
                        {stats.distribution.map((d: any) => (
                            <RatingBar key={d.rating} rating={d.rating} count={d.count} total={stats.totalCount} />
                        ))}
                    </View>

                    {/* Environment */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Work Environment</Text>
                        <View style={styles.chips}>
                            {stats.environment.map((e: any) => (
                                <View key={e.work_environment} style={styles.envChip}>
                                    <Text style={styles.envLabel}>{e.work_environment}</Text>
                                    <Text style={styles.envCount}>{e.count}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Recent Comments */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Comments</Text>
                        {stats.recentComments.length === 0 && <Text style={styles.muted}>No comments yet.</Text>}
                        {stats.recentComments.map((c: any, i: number) => (
                            <View key={i} style={styles.commentCardMini}>
                                <Text style={styles.commentText} numberOfLines={2}>"{c.comments}"</Text>
                                <Text style={styles.date}>{new Date(c.created_at).toLocaleDateString()}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            ) : (
                <FlatList
                    data={comments}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.commentCard}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.author}>{item.name}</Text>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{item.rating} ★</Text>
                                </View>
                            </View>
                            <Text style={styles.commentBody}>{item.comments || "No written comment"}</Text>
                            <View style={styles.rowBetween}>
                                <Text style={styles.meta}>Env: {item.work_environment || '-'}</Text>
                                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>
                        </View>
                    )}
                    onEndReached={() => {
                        if (comments.length < totalComments && !loadingComments) setPage(p => p + 1);
                    }}
                    ListFooterComponent={loadingComments ? <ActivityIndicator style={{ padding: 10 }} /> : null}
                    ListEmptyComponent={<Text style={styles.centerMuted}>No feedback records found.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabs: { flexDirection: 'row', backgroundColor: '#fff', padding: 4, margin: 16, borderRadius: 12, ...shadows.subtle },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeTab: { backgroundColor: colors.primary },
    tabText: { fontWeight: '600', color: colors.textSecondary },
    activeTabText: { color: '#fff' },
    content: { padding: 16 },
    listContent: { padding: 16 },
    heroCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, ...shadows.card },
    heroTitle: { fontSize: 14, color: '#64748b', fontWeight: '600' },
    bigScore: { fontSize: 42, fontWeight: '800', color: '#1e293b' },
    totalBadge: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12 },
    totalVal: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
    totalLabel: { fontSize: 12, color: colors.primary },
    section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, ...shadows.subtle },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#1e293b' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    ratingNum: { width: 30, fontSize: 12, fontWeight: '700', color: '#475569' },
    barContainer: { flex: 1, height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: colors.primary },
    ratingCount: { width: 20, fontSize: 12, color: '#94a3b8', textAlign: 'right' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    envChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
    envLabel: { fontSize: 13, color: '#334155', fontWeight: '500' },
    envCount: { fontSize: 13, fontWeight: '700', color: colors.primary },
    muted: { color: '#94a3b8', fontStyle: 'italic' },
    commentCardMini: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 8 },
    commentText: { fontSize: 14, color: '#334155', fontStyle: 'italic' },
    date: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
    commentCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, ...shadows.subtle },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    author: { fontWeight: '700', fontSize: 15, color: '#1e293b' },
    badge: { backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#FEF3C7' },
    badgeText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
    commentBody: { marginVertical: 8, fontSize: 14, color: '#475569', lineHeight: 20 },
    meta: { fontSize: 12, color: '#94a3b8' },
    centerMuted: { textAlign: 'center', marginTop: 20, color: '#94a3b8' }
});
