
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Switch, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { apiService } from '@/lib/api';
import colors from '@/constants/colors';
import { safeFormatDate } from '@/lib/date';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FeedbackScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [canSubmit, setCanSubmit] = useState(false);
    const [lastSubmission, setLastSubmission] = useState<any>(null);

    // Form State
    const [rating, setRating] = useState(0);
    const [workEnvironment, setWorkEnvironment] = useState<string | null>(null);
    const [supervisorSupport, setSupervisorSupport] = useState(0);
    const [comments, setComments] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            setLoading(true);
            const cc = (user as any)?.companyCode;
            const emp = (user as any)?.empNo || (user as any)?.employeeNo;
            if (cc && emp) {
                const res = await apiService.checkFeedbackStatus(cc, emp);
                if (res?.success) {
                    setCanSubmit(res.canSubmit);
                    setLastSubmission(res.lastSubmission);
                }
            }
        } catch (e) {
            console.log('Error checking feedback status:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Required', 'Please provide an overall rating.');
            return;
        }

        try {
            setSubmitting(true);
            const cc = (user as any)?.companyCode;
            const emp = (user as any)?.empNo || (user as any)?.employeeNo;
            const name = (user as any)?.name;

            const submittedAt = safeFormatDate(new Date(), 'dd/MMM/yyyy hh:mm:ss a');

            const res = await apiService.submitFeedback({
                companyCode: cc,
                employeeNo: emp,
                employeeName: name,
                rating,
                workEnvironment: workEnvironment || '',
                supervisorSupport,
                comments,
                isAnonymous,
                submittedAt
            });

            if (res?.success) {
                Alert.alert('Thank You', 'Your feedback has been submitted successfully.', [
                    { text: 'OK', onPress: () => router.replace('/(tabs)') }
                ]);
            } else {
                Alert.alert('Error', res?.message || 'Failed to submit feedback.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'An error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    const StarRating = ({ value, onChange, max = 5, size = 32 }: any) => {
        return (
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {[...Array(max)].map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => onChange(i + 1)}>
                        <MaterialIcons
                            name={i < value ? "star" : "star-border"}
                            size={size}
                            color={i < value ? "#fbbf24" : "#cbd5e1"}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }



    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Read-Only Banner */}
                {!canSubmit && lastSubmission && (
                    <View style={styles.readOnlyBanner}>
                        <Ionicons name="checkmark-circle" size={24} color="#15803d" />
                        <Text style={styles.readOnlyText}>Feedback Submitted on {lastSubmission.submitted_at || new Date(lastSubmission.created_at).toLocaleDateString()}</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.question}>How was your overall experience today?</Text>
                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                        <StarRating value={!canSubmit && lastSubmission ? lastSubmission.rating : rating} onChange={!canSubmit ? () => { } : setRating} size={40} />
                        <Text style={styles.ratingLabel}>
                            {(!canSubmit && lastSubmission ? lastSubmission.rating : rating) === 1 ? 'Poor' :
                                (!canSubmit && lastSubmission ? lastSubmission.rating : rating) === 2 ? 'Fair' :
                                    (!canSubmit && lastSubmission ? lastSubmission.rating : rating) === 3 ? 'Good' :
                                        (!canSubmit && lastSubmission ? lastSubmission.rating : rating) === 4 ? 'Very Good' :
                                            (!canSubmit && lastSubmission ? lastSubmission.rating : rating) === 5 ? 'Excellent' : 'Select a rating'}
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.question}>How would you rate your work environment?</Text>
                    <View style={styles.chipContainer}>
                        {['Excellent', 'Good', 'Average', 'Poor'].map((opt) => (
                            <TouchableOpacity
                                key={opt}
                                style={[
                                    styles.chip,
                                    ((!canSubmit && lastSubmission?.work_environment === opt) || (canSubmit && workEnvironment === opt)) && styles.chipActive
                                ]}
                                onPress={() => canSubmit && setWorkEnvironment(opt)}
                                disabled={!canSubmit}
                            >
                                <Text style={[
                                    styles.chipText,
                                    ((!canSubmit && lastSubmission?.work_environment === opt) || (canSubmit && workEnvironment === opt)) && styles.chipTextActive
                                ]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.question}>Supervisor / Manager Support</Text>
                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                        <StarRating value={!canSubmit && lastSubmission ? lastSubmission.supervisor_support : supervisorSupport} onChange={!canSubmit ? () => { } : setSupervisorSupport} />
                        <Text style={styles.ratingLabel}>
                            {(!canSubmit && lastSubmission ? lastSubmission.supervisor_support : supervisorSupport) > 0 ? `${!canSubmit && lastSubmission ? lastSubmission.supervisor_support : supervisorSupport} stars` : 'Select a rating'}
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.question}>Any concerns or suggestions?</Text>
                    <TextInput
                        style={[styles.textArea, !canSubmit && { backgroundColor: '#f1f5f9', color: '#64748b' }]}
                        multiline
                        numberOfLines={4}
                        placeholder={!canSubmit ? "No comments provided." : "Share your thoughts..."}
                        value={!canSubmit && lastSubmission ? lastSubmission.comments : comments}
                        onChangeText={setComments}
                        textAlignVertical="top"
                        editable={canSubmit}
                    />
                </View>

                <View style={styles.section}>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Submit Anonymously</Text>
                            <Text style={styles.subtext}>Your name will be hidden from reports.</Text>
                        </View>
                        <Switch
                            value={!canSubmit && lastSubmission ? lastSubmission.is_anonymous : isAnonymous}
                            onValueChange={setIsAnonymous}
                            trackColor={{ false: '#e2e8f0', true: colors.primary }}
                            disabled={!canSubmit}
                        />
                    </View>
                </View>

                <View style={{ height: 20 }} />

                {canSubmit && (
                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.submitBtnText}>Submit Feedback</Text>
                        )}
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    question: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12,
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    subtext: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    ratingLabel: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '500',
        color: colors.primary,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500',
    },
    chipTextActive: {
        color: 'white',
    },
    textArea: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        padding: 12,
        minHeight: 100,
        fontSize: 15,
        color: '#334155',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    submitBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    successTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1e293b',
        marginTop: 20,
        marginBottom: 10,
    },
    successText: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    homeBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    homeBtnText: {
        fontSize: 16,
        color: '#475569',
        fontWeight: '600',
    },
    readOnlyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    readOnlyText: {
        fontSize: 15,
        color: '#166534',
        fontWeight: '600',
        flex: 1,
    }
});
