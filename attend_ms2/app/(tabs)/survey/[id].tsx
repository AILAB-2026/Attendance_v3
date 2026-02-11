import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Modal, Animated
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiService } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import colors from '@/constants/colors';

export default function SurveyDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [survey, setSurvey] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [layoutSections, setLayoutSections] = useState<any[]>([]);
    const [answers, setAnswers] = useState<Record<number, { value: any }>>({});
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [submissionDate, setSubmissionDate] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Track location fetching state per question
    // Track location fetching state per question
    const [locationLoading, setLocationLoading] = useState<Record<number, boolean>>({});
    const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

    useEffect(() => {
        if (id && user) {
            fetchSurveyDetails();
        }
    }, [id, user]);

    // Auto-fetch GPS for automatic questions when questions are loaded
    useEffect(() => {
        if (questions.length > 0 && !hasSubmitted) {
            questions.forEach(q => {
                if (q.question_type === 'gps_location' && !answers[q.id]?.value) {
                    fetchGPSLocation(q.id);
                }
            });
        }
    }, [questions, hasSubmitted]);

    const fetchSurveyDetails = async () => {
        try {
            const cc = (user as any).companyCode;
            const emp = (user as any).employeeNo || (user as any).empNo;

            const res = await apiService.getSurveyDetails(cc, id as string, emp);

            if (res.success) {
                setSurvey(res.survey);
                setQuestions(res.questions || []);

                // Handle Layout Sections
                if (res.layoutSections && res.layoutSections.length > 0) {
                    setLayoutSections(res.layoutSections);
                } else {
                    // Fallback to single default section
                    setLayoutSections([{
                        id: 'default',
                        name: res.survey?.title || 'Questions',
                        questions: res.questions || []
                    }]);
                }

                if (res.hasSubmitted && res.previousAnswers) {
                    setHasSubmitted(true);
                    setSubmissionDate(res.submissionDate);
                    const loaded: any = {};
                    Object.keys(res.previousAnswers).forEach(k => {
                        // If it looks like JSON from our GPS, try parsing it to show nicely (optional for now)
                        // But previousAnswers are usually raw. If it was stored as JSON string, we keep it as string
                        // The UI will handle displaying it if possible.
                        loaded[k] = { value: res.previousAnswers[k] };
                    });
                    setAnswers(loaded);
                }
            } else {
                Alert.alert('Error', res.message || 'Failed to load survey');
                router.back();
            }
        } catch (e: any) {
            console.error('[SurveyDetail] Exception:', e);
            Alert.alert('Error', 'Failed to load survey: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchGPSLocation = async (questionId: number) => {
        setLocationLoading(prev => ({ ...prev, [questionId]: true }));
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Allow location access to capture GPS.');
                setLocationLoading(prev => ({ ...prev, [questionId]: false }));
                return;
            }

            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const { latitude, longitude } = loc.coords;

            // Reverse Geocode
            let address = "Unknown Location";
            try {
                const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (reverse && reverse.length > 0) {
                    const r = reverse[0];
                    address = `${r.street || ''} ${r.city || ''}, ${r.region || ''}, ${r.postalCode || ''}`.replace(/\s+/g, ' ').trim();
                    if (!address || address === ', ,') address = r.name || "Unknown Location";
                }
            } catch (err) {
                console.warn("Reverse geocode failed", err);
            }

            // Store as object
            const val = { latitude, longitude, address };
            setAnswers(prev => ({ ...prev, [questionId]: { value: val } }));

        } catch (error: any) {
            Alert.alert('GPS Error', 'Could not fetch location: ' + error.message);
        } finally {
            setLocationLoading(prev => ({ ...prev, [questionId]: false }));
        }
    };

    const handleAnswerChange = (questionId: number, value: any, type: string) => {
        if (hasSubmitted) return;

        setAnswers(prev => {
            let newValue = value;
            if (type === 'multiple_choice') {
                const current = prev[questionId]?.value || [];
                const list = Array.isArray(current) ? current : [];
                if (list.includes(value)) {
                    newValue = list.filter((v: any) => v !== value);
                } else {
                    newValue = [...list, value];
                }
            }
            return { ...prev, [questionId]: { value: newValue } };
        });
    };

    const handleSubmit = async () => {
        const missingFields: string[] = [];
        for (const q of questions) {
            if (q.constr_mandatory) {
                const ans = answers[q.id]?.value;
                const isEmpty = ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0);
                if (isEmpty) {
                    missingFields.push(q.title);
                }
            }
        }

        if (missingFields.length > 0) {
            Alert.alert(
                'Action Required',
                `Please complete the following mandatory fields:\n\n${missingFields.map(f => `• ${f}`).join('\n')}`
            );
            return;
        }

        setSubmitting(true);
        try {
            const cc = (user as any).companyCode;
            const emp = (user as any).employeeNo || (user as any).empNo;

            const finalAnswers: any[] = [];
            questions.forEach(q => {
                const ans = answers[q.id];
                if (!ans) return;
                const val = ans.value;
                if (val === undefined || val === null || val === '') return;

                if (q.question_type === 'simple_choice' || q.question_type === 'dropdown') {
                    finalAnswers.push({ questionId: q.id, answerId: val });
                } else if (q.question_type === 'multiple_choice' && Array.isArray(val)) {
                    val.forEach((v: any) => {
                        finalAnswers.push({ questionId: q.id, answerId: v });
                    });
                } else if (q.question_type === 'gps_location' || q.question_type === 'gps_location_manual') {
                    // Stringify GPS object
                    finalAnswers.push({ questionId: q.id, value: JSON.stringify(val) });
                } else {
                    finalAnswers.push({ questionId: q.id, value: val });
                }
            });

            const res = await apiService.submitSurvey(cc, emp, id as string, finalAnswers);

            if (res.success) {
                setShowSuccessModal(true);
            } else {
                Alert.alert('Error', res.message || 'Submission failed');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString?: string | null) => {
        if (!dateString) return new Date().toISOString().split('T')[0];
        const d = new Date(dateString);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // --- REPORT VIEW (Read Only) ---
    const renderReportView = () => {
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Render Questions Grouped by Sections (Same layout as Form) */}
                {layoutSections.map((section, sectionIndex) => (
                    <View key={section.id} style={styles.sectionContainer}>
                        {/* Section Header */}
                        <View style={styles.sectionHeaderBar}>
                            <View style={styles.sectionNumberCircle}>
                                <Text style={styles.sectionNumberText}>{sectionIndex + 1}</Text>
                            </View>
                            <Text style={styles.sectionTitleText}>{section.name}</Text>
                        </View>

                        {/* Section Card */}
                        <View style={styles.sectionCard}>
                            {section.questions?.map((q: any, qIndex: number) => {
                                const isLast = qIndex === (section.questions?.length || 0) - 1;
                                const answer = answers[q.id]?.value;
                                const type = q.question_type;

                                // Handle GPS specially (3 rows)
                                if ((type === 'gps_location' || type === 'gps_location_manual') && answer) {
                                    let parsed: any = {};
                                    try { parsed = typeof answer === 'string' ? JSON.parse(answer) : answer; } catch { parsed = {}; }

                                    return (
                                        <View key={q.id} style={[styles.questionRow, !isLast && styles.questionRowBorder]}>
                                            <View style={styles.questionLabelColumn}>
                                                <Text style={styles.questionLabel}>{q.title}</Text>
                                            </View>
                                            <View style={styles.questionInputColumn}>
                                                {/* Filter display based on title */}
                                                {(q.title.toLowerCase().includes('latitude') || (!q.title.toLowerCase().includes('longitude') && !q.title.toLowerCase().includes('location'))) && (
                                                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                                                        <Text style={{ width: 80, color: '#64748b', fontSize: 13 }}>Latitude :</Text>
                                                        <Text style={{ color: '#0f172a', fontWeight: '600', fontSize: 13 }}>{parsed.latitude || '-'}</Text>
                                                    </View>
                                                )}
                                                {(q.title.toLowerCase().includes('longitude') || (!q.title.toLowerCase().includes('latitude') && !q.title.toLowerCase().includes('location'))) && (
                                                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                                                        <Text style={{ width: 80, color: '#64748b', fontSize: 13 }}>Longitude :</Text>
                                                        <Text style={{ color: '#0f172a', fontWeight: '600', fontSize: 13 }}>{parsed.longitude || '-'}</Text>
                                                    </View>
                                                )}
                                                {(q.title.toLowerCase().includes('location') || (!q.title.toLowerCase().includes('latitude') && !q.title.toLowerCase().includes('longitude'))) && (
                                                    <View style={{ flexDirection: 'row' }}>
                                                        <Text style={{ width: 80, color: '#64748b', fontSize: 13 }}>Location :</Text>
                                                        <Text style={{ color: '#0f172a', fontWeight: '600', fontSize: 13, flex: 1 }}>{parsed.address || '-'}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    );
                                }

                                // Default Text Display for other types
                                let displayValue = "-";
                                if (type === 'simple_choice' || type === 'multiple_choice') {
                                    if (Array.isArray(answer)) {
                                        displayValue = q.choices?.filter((c: any) => answer.includes(c.id)).map((c: any) => c.value).join(', ') || "-";
                                    } else {
                                        displayValue = q.choices?.find((c: any) => c.id === answer)?.value || "-";
                                    }
                                } else {
                                    displayValue = answer || "-";
                                }

                                return (
                                    <View key={q.id} style={[styles.questionRow, !isLast && styles.questionRowBorder]}>
                                        <View style={styles.questionLabelColumn}>
                                            <Text style={styles.questionLabel}>{q.title}</Text>
                                        </View>
                                        <View style={styles.questionInputColumn}>
                                            <Text style={{ color: '#334155', fontSize: 14, fontWeight: '500' }}>{displayValue}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ))}

                <View style={{ height: 40 }} />
            </ScrollView>
        );
    };

    // --- FORM VIEW (Edit) ---
    const renderQuestion = (q: any, isLastInSection: boolean) => {
        const answer = answers[q.id]?.value;
        const type = q.question_type;
        const isLoadingLoc = locationLoading[q.id];

        const isSelected = (val: any) => {
            if (Array.isArray(answer)) return answer.includes(val);
            return answer === val;
        };

        const renderInlineRadio = () => (
            <View style={styles.inlineRadioContainer}>
                {q.choices?.map((c: any) => {
                    const active = isSelected(c.id);
                    return (
                        <TouchableOpacity
                            key={c.id}
                            style={styles.inlineRadioItem}
                            onPress={() => handleAnswerChange(q.id, c.id, type)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={active ? "radio-button-on" : "radio-button-off"}
                                size={20}
                                color={active ? colors.primary : "#94a3b8"}
                            />
                            <Text style={[styles.inlineRadioText, active && styles.inlineRadioTextActive]}>
                                {c.value}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );

        const renderInlineCheckboxes = () => (
            <View style={styles.inlineCheckboxContainer}>
                {q.choices?.map((c: any) => {
                    const active = isSelected(c.id);
                    return (
                        <TouchableOpacity
                            key={c.id}
                            style={styles.inlineCheckboxItem}
                            onPress={() => handleAnswerChange(q.id, c.id, type)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={active ? "checkbox" : "square-outline"}
                                size={20}
                                color={active ? colors.primary : "#94a3b8"}
                            />
                            <Text style={[styles.inlineCheckboxText, active && styles.inlineCheckboxTextActive]}>
                                {c.value}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );

        const renderDropdown = () => {
            const currentAnswerId = answer;
            const options = q.choices || [];
            // Handle multiple selection for dropdown if needed, currently assumes single for 'simple_choice' logic
            // If type is multiple_choice, user might want multi-select dropdown, but simplified to single for now based on 'dropdown' implies select ONE usually.
            // If user explicitly maps 'dropdown' to single select.

            const selectedOption = options.find((c: any) => c.id === currentAnswerId);

            return (
                <View>
                    <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setActiveDropdownId(q.id)}
                    >
                        <Text style={{ color: selectedOption ? '#0f172a' : '#94a3b8', fontSize: 15 }}>
                            {selectedOption ? selectedOption.value : (q.question_placeholder || 'Select an option')}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#64748b" />
                    </TouchableOpacity>

                    {/* Dropdown Modal */}
                    <Modal
                        visible={activeDropdownId === q.id}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setActiveDropdownId(null)}
                    >
                        <TouchableOpacity
                            style={styles.dropdownOverlay}
                            activeOpacity={1}
                            onPress={() => setActiveDropdownId(null)}
                        >
                            <View style={styles.dropdownContainer}>
                                <View style={styles.dropdownHeader}>
                                    <Text style={styles.dropdownTitle}>{q.title}</Text>
                                    <TouchableOpacity onPress={() => setActiveDropdownId(null)}>
                                        <Ionicons name="close" size={24} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView style={{ maxHeight: 300 }}>
                                    {options.map((c: any) => (
                                        <TouchableOpacity
                                            key={c.id}
                                            style={[styles.dropdownItem, c.id === currentAnswerId && styles.dropdownItemActive]}
                                            onPress={() => {
                                                handleAnswerChange(q.id, c.id, 'simple_choice');
                                                setActiveDropdownId(null);
                                            }}
                                        >
                                            <Text style={[styles.dropdownItemText, c.id === currentAnswerId && styles.dropdownItemTextActive]}>
                                                {c.value}
                                            </Text>
                                            {c.id === currentAnswerId && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                </View>
            );
        };

        // Logic for GPS Display
        if (type === 'gps_location' || type === 'gps_location_manual') {
            let gpsData = answer || {};
            try { if (typeof gpsData === 'string') gpsData = JSON.parse(gpsData); } catch { }
            const isCaptured = !!gpsData.latitude;

            return (
                <View key={q.id} style={[styles.questionRow, !isLastInSection && styles.questionRowBorder]}>
                    <View style={styles.questionLabelColumn}>
                        <Text style={styles.questionLabel}>
                            {q.title}
                            {q.constr_mandatory && <Text style={styles.requiredStar}> *</Text>}
                        </Text>
                    </View>
                    <View style={styles.questionInputColumn}>
                        {/* Manual Button */}
                        {type === 'gps_location_manual' && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row', backgroundColor: '#e2e8f0', padding: 8, borderRadius: 8,
                                    alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8
                                }}
                                onPress={() => fetchGPSLocation(q.id)}
                            >
                                {isLoadingLoc ? <ActivityIndicator size="small" color="#334155" /> : (
                                    <>
                                        <Ionicons name="locate" size={16} color="#334155" />
                                        <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#334155' }}>Capture Location</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {type === 'gps_location' && isLoadingLoc && (
                            <Text style={{ color: '#64748b', fontSize: 13, fontStyle: 'italic', marginBottom: 4 }}>Auto-fetching location...</Text>
                        )}

                        <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            {/* Filter display based on title */}
                            {(q.title.toLowerCase().includes('latitude') || (!q.title.toLowerCase().includes('longitude') && !q.title.toLowerCase().includes('location'))) && (
                                <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                                    <Text style={{ width: 70, fontSize: 13, color: '#64748b' }}>Latitude :</Text>
                                    <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }}>{gpsData.latitude || '-'}</Text>
                                </View>
                            )}
                            {(q.title.toLowerCase().includes('longitude') || (!q.title.toLowerCase().includes('latitude') && !q.title.toLowerCase().includes('location'))) && (
                                <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                                    <Text style={{ width: 70, fontSize: 13, color: '#64748b' }}>Longitude :</Text>
                                    <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }}>{gpsData.longitude || '-'}</Text>
                                </View>
                            )}
                            {(q.title.toLowerCase().includes('location') || (!q.title.toLowerCase().includes('latitude') && !q.title.toLowerCase().includes('longitude'))) && (
                                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                                    <Text style={{ width: 70, fontSize: 13, color: '#64748b' }}>Location :</Text>
                                    <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600', flex: 1 }}>{gpsData.address || '-'}</Text>
                                </View>
                            )}

                            {/* GPS Active Status */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600', marginRight: 8 }}>GPS Active</Text>
                                {isCaptured ? (
                                    <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                                ) : (
                                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View key={q.id} style={[styles.questionRow, !isLastInSection && styles.questionRowBorder]}>
                {/* Label Column */}
                <View style={styles.questionLabelColumn}>
                    <Text style={styles.questionLabel}>
                        {q.title}
                        {q.constr_mandatory && <Text style={styles.requiredStar}> *</Text>}
                    </Text>
                </View>

                {/* Input Column */}
                <View style={styles.questionInputColumn}>
                    {/* Text/Numeric Input */}
                    {(type === 'char_box' || type === 'numerical_box') && (
                        <TextInput
                            style={styles.horizontalInput}
                            keyboardType={type === 'numerical_box' ? 'numeric' : 'default'}
                            placeholder={q.question_placeholder || `Enter ${q.title}`}
                            placeholderTextColor="#94a3b8"
                            value={String(answer || '')}
                            onChangeText={(t) => handleAnswerChange(q.id, type === 'numerical_box' ? Number(t) : t, type)}
                        />
                    )}

                    {/* Text Area */}
                    {(type === 'text_box' || type === 'matrix') && (
                        <TextInput
                            style={[styles.horizontalInput, styles.horizontalTextArea]}
                            multiline
                            placeholder={q.question_placeholder || `Enter ${q.title}`}
                            placeholderTextColor="#94a3b8"
                            value={String(answer || '')}
                            onChangeText={(t) => handleAnswerChange(q.id, t, type)}
                        />
                    )}

                    {/* Simple Choice - Inline Radio or Dropdown */}
                    {(type === 'simple_choice' || type === 'dropdown') && (
                        (type === 'dropdown' || (type === 'simple_choice' && (q.choices?.length || 0) > 4))
                            ? renderDropdown()
                            : renderInlineRadio()
                    )}

                    {/* Multiple Choice - Inline Checkboxes */}
                    {type === 'multiple_choice' && renderInlineCheckboxes()}
                </View>
            </View>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
    if (!survey) return <View style={styles.center}><Text style={styles.errorText}>Survey not found.</Text></View>;




    // Switch View based on status
    if (hasSubmitted) {
        return (
            <View style={styles.mainContainer}>
                <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
                {/* Blue Nav Header (Restored) */}
                <View style={styles.blueNavHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.blueNavTitle} numberOfLines={1}>{survey.title}</Text>
                    <View style={styles.navSpacer} />
                </View>
                {renderReportView()}
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            {/* Blue Nav Header (Restored) */}
            <View style={styles.blueNavHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.blueNavTitle} numberOfLines={1}>{survey.title}</Text>
                <View style={styles.navSpacer} />
            </View>




            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Render Questions Grouped by Sections */}
                    {layoutSections.map((section, sectionIndex) => (
                        <View key={section.id} style={styles.sectionContainer}>
                            {/* Section Header - Numbered Style */}
                            <View style={styles.sectionHeaderBar}>
                                <View style={styles.sectionNumberCircle}>
                                    <Text style={styles.sectionNumberText}>{sectionIndex + 1}</Text>
                                </View>
                                <Text style={styles.sectionTitleText}>{section.name}</Text>
                            </View>

                            {/* Section Card - Contains All Questions */}
                            <View style={styles.sectionCard}>
                                {section.questions?.map((q: any, qIndex: number) =>
                                    renderQuestion(q, qIndex === (section.questions?.length || 0) - 1)
                                )}
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.submitBtnText}>Submit Response</Text>
                                <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Custom Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setShowSuccessModal(false);
                    router.back();
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Success Icon */}
                        <View style={styles.successIconContainer}>
                            <View style={styles.successIconCircle}>
                                <Ionicons name="checkmark" size={48} color="#fff" />
                            </View>
                        </View>

                        {/* Title */}
                        <Text style={styles.modalTitle}>Survey Submitted!</Text>

                        {/* Message */}
                        <Text style={styles.modalMessage}>
                            Thank you for your response! Your feedback has been recorded successfully.
                        </Text>

                        {/* Divider */}
                        <View style={styles.modalDivider} />

                        {/* OK Button */}
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.back();
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalButtonText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 16 },
    errorText: { color: '#64748b', fontSize: 16 },

    // Nav Header
    navHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white',
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
    },
    navBackBtn: { padding: 4 },
    navTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    navSpacer: { width: 32 },

    // Blue Nav Header (for Survey)
    blueNavHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#1a365d',
    },
    blueNavTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 8,
    },

    // Status Bar (Clocked In & GPS Active)
    statusBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 40,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusIconCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusIconGreen: {
        backgroundColor: '#22c55e',
    },
    gpsIconDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'white',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },

    // Form Styles
    headerCard: {
        backgroundColor: 'white', borderRadius: 20, padding: 24, marginBottom: 24,
        alignItems: 'center', shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
    },
    iconCircle: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: '#eff6ff',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16
    },
    title: { fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
    description: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },

    // Section Styles
    sectionContainer: {
        marginBottom: 16,
    },
    sectionHeaderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f0fe',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    sectionNumberCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#1e40af',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    sectionNumberText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
    },
    sectionTitleText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e40af',
    },
    sectionCard: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderTopWidth: 0,
    },

    // Question Row Styles - Horizontal Layout
    questionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 12,
    },
    questionRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    questionLabelColumn: {
        width: '35%',
        paddingRight: 12,
        justifyContent: 'center',
    },
    questionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    requiredStar: {
        color: '#ef4444',
    },
    questionInputColumn: {
        flex: 1,
    },
    horizontalInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#0f172a',
    },
    horizontalTextArea: {
        height: 60,
        textAlignVertical: 'top',
    },

    // Inline Radio/Checkbox Styles
    inlineRadioContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    inlineRadioItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    inlineRadioText: {
        marginLeft: 6,
        fontSize: 14,
        color: '#475569',
    },
    inlineRadioTextActive: {
        color: '#1e40af',
        fontWeight: '600',
    },
    inlineCheckboxContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    inlineCheckboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
        marginBottom: 4,
    },
    inlineCheckboxText: {
        marginLeft: 6,
        fontSize: 14,
        color: '#475569',
    },
    inlineCheckboxTextActive: {
        color: '#1e40af',
        fontWeight: '600',
    },

    // Keep old questionCard style for report view or backup
    questionCard: {
        backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16,
        borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    },
    questionHeader: { flexDirection: 'row', marginBottom: 8 },
    questionTitle: { fontSize: 17, fontWeight: '700', color: '#334155', lineHeight: 24, flex: 1 },
    questionDesc: { fontSize: 13, color: '#94a3b8', marginBottom: 16, fontStyle: 'italic' },

    choicesContainer: { gap: 10, marginTop: 4 },
    choiceRow: {
        flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    },
    choiceRowSelected: { backgroundColor: '#eff6ff', borderColor: colors.primary },
    iconBox: { marginRight: 12 },
    iconBoxSelected: {},
    choiceText: { fontSize: 15, color: '#475569', flex: 1 },
    choiceTextSelected: { color: '#0f172a', fontWeight: '600' },

    inputContainer: { position: 'relative' },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
        padding: 14, fontSize: 15, color: '#0f172a',
    },
    textArea: { height: 100, textAlignVertical: 'top' },

    submitBtn: {
        backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 16,
        alignItems: 'center', marginTop: 12, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
    },
    submitBtnDisabled: { opacity: 0.7 },
    submitBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

    // Report Styles
    reportContainer: { padding: 16 },
    reportHeaderCard: {
        backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, marginBottom: 20,
        borderWidth: 1, borderColor: '#dbeafe'
    },
    reportHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    reportDateText: { marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
    submittedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    submittedBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '700' },

    reportInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    reportLabel: { marginLeft: 8, fontSize: 14, color: '#64748b', width: 60, fontWeight: '500' },
    reportValue: { fontSize: 14, color: '#334155', fontWeight: '600', flex: 1 },

    sectionHeader: { fontSize: 13, color: '#94a3b8', fontWeight: '700', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },

    // Rename duplicate sectionCard to simple name if needed or stick to new one above. 
    // The previous sectionCard usage in report view (line 456 in old file) needs to be checked.
    // In report view: <View style={styles.sectionCard}> ... </View>
    // This style was: backgroundColor white, borderRadius 12, padding 16...
    // The NEW sectionCard style (line 117 in replacement) is: borderBottomLeftRadius 12, borderTopWidth 0...
    // This might break the Report View visually a bit (it will look open at top).
    // I should create a separate 'reportSectionCard' or 'cardContainer' for the report view.

    reportSectionCard: {
        backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 20,
        borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8,
    },

    completedText: { color: '#15803d', fontWeight: '700', fontSize: 15 },

    reportItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    reportQuestionTitle: { fontSize: 13, color: '#64748b', marginBottom: 4, fontWeight: '500' },
    reportAnswerText: { fontSize: 15, color: '#0f172a', fontWeight: '600' },

    backBtn: { alignItems: 'center', padding: 10, marginTop: 10 },
    backBtnText: { color: '#64748b', fontSize: 15, fontWeight: '600' },

    // Success Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 24,
        paddingVertical: 32,
        paddingHorizontal: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    successIconContainer: {
        marginBottom: 20,
    },
    successIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    modalDivider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        width: '100%',
        marginBottom: 20,
    },
    modalButton: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Dropdown Styles
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        marginTop: 4,
    },
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    dropdownContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        maxHeight: 400,
        width: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    dropdownItemActive: {
        backgroundColor: '#f0f9ff',
    },
    dropdownItemText: {
        fontSize: 15,
        color: '#334155',
    },
    dropdownItemTextActive: {
        color: colors.primary,
        fontWeight: '600',
    },
});
