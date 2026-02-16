import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';

import { AttendanceDay } from '@/types/attendance';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import { apiService } from '@/lib/api';
import { useAttendance } from '@/hooks/use-attendance-store';

type AttendanceCardProps = {
  attendance: AttendanceDay;
  onPress?: () => void;
  collapsed?: boolean;
  showHours?: boolean; // When false, hides Normal Hours & Overtime display
};

// Lazy-loadable image thumbnail that fetches on demand
type ImageThumbnailProps = {
  hasImage?: boolean;
  imageId?: number | string;
  imageUri?: string | null;
  imageType: 'clock_in' | 'clock_out';
  timestamp?: number;
  title: string;
  location?: string;
  onViewImage: (uri: string, timestamp?: number, title?: string, location?: string) => void;
};

const ImageThumbnail = ({ hasImage, imageId, imageUri, imageType, onViewImage, timestamp, title, location }: ImageThumbnailProps) => {
  const { user } = useAttendance();
  const companyCode = (user as any)?.companyCode || '';

  const [loading, setLoading] = useState(false);
  const [loadedUri, setLoadedUri] = useState<string | null>(imageUri || null);
  const [error, setError] = useState(false);

  // Define fetch function that can be called by effect or manual retry
  const fetchImage = useCallback(async () => {
    if (!companyCode || !imageId) {
      // Cannot fetch without these
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await apiService.getAttendanceImage(companyCode, imageId, imageType);
      if (res.success && res.data?.imageUri) {
        setLoadedUri(res.data.imageUri);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error('Failed to fetch attendance image:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [companyCode, imageId, imageType]);

  // Auto-fetch effect
  React.useEffect(() => {
    // If we have an image flag, but no URI, no error, and not loading... try to fetch
    if (hasImage && !loadedUri && !loading && !error && companyCode && imageId) {
      fetchImage();
    }
  }, [hasImage, loadedUri, loading, error, companyCode, imageId, fetchImage]);

  const handlePress = useCallback(() => {
    if (loadedUri) {
      onViewImage(loadedUri, timestamp, title, location);
    } else {
      // Manual retry or force fetch if stuck
      fetchImage();
    }
  }, [loadedUri, onViewImage, timestamp, title, location, fetchImage]);

  // If imageUri is directly provided (e.g., from today's attendance), use it
  if (imageUri) {
    return (
      <TouchableOpacity
        onPress={() => onViewImage(imageUri, timestamp, title, location)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View ${title.toLowerCase()} photo`}
        style={styles.thumbWrap}
      >
        <Image source={{ uri: imageUri }} style={styles.thumb} contentFit="cover" transition={200} />
      </TouchableOpacity>
    );
  }

  // If hasImage is false/undefined, don't render anything
  if (!hasImage) return null;

  // Show thumbnail (loading or loaded)
  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityRole="imagebutton"
      accessibilityLabel={`View ${title.toLowerCase()} photo`}
      style={[styles.thumbWrap, !loadedUri && styles.thumbPlaceholder]}
      disabled={loading}
    >
      {loading && !loadedUri ? (
        <CustomLoader size="small" color={colors.primary} />
      ) : error ? (
        <MaterialIcons name="broken-image" size={16} color={colors.textSecondary} />
      ) : loadedUri ? (
        <Image source={{ uri: loadedUri }} style={styles.thumb} contentFit="cover" transition={200} />
      ) : (
        // Waiting for auto-fetch to start or image to load
        <CustomLoader size="small" color={colors.primary} />
      )}
    </TouchableOpacity>
  );
};

const AttendanceCard = ({ attendance, onPress, collapsed = false, showHours = true }: AttendanceCardProps) => {
  const [viewer, setViewer] = useState<{ uri: string; timestamp?: number; title: string; location?: string } | null>(null);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '—';
    return format(new Date(timestamp), 'h:mm a');
  };

  const locText = (loc?: { latitude?: number; longitude?: number; address?: string | null }) => {
    if (!loc) return undefined;
    if (loc.address && String(loc.address).trim().length > 0) return String(loc.address);
    const lat = typeof loc.latitude === 'number' ? loc.latitude : undefined;
    const lng = typeof loc.longitude === 'number' ? loc.longitude : undefined;
    if (lat != null && lng != null) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return undefined;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEE, MMM d, yyyy');
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = colors.attendance;
    return colorMap[status] || colors.textSecondary;
  };

  const getStatusText = (status: AttendanceDay['status']) => {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'late': return 'Late';
      case 'early-exit': return 'Early Exit';
      case 'leave': return 'On Leave';
      default: return status;
    }
  };

  const handleViewImage = useCallback((uri: string, timestamp?: number, title: string = '', location?: string) => {
    setViewer({ uri, timestamp, title, location });
  }, []);

  // Check if any entry has improper clocking flag
  const hasImproperClocking = Array.isArray((attendance as any).entries) &&
    (attendance as any).entries.some((e: any) => e.isImproperClocking);

  const Container: React.ComponentType<any> = onPress ? TouchableOpacity : View;
  return (
    <Container style={styles.card} {...(onPress ? { onPress, activeOpacity: 0.8 } : {})}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(attendance.date)}</Text>
        <View style={styles.headerBadges}>
          {hasImproperClocking && (
            <View style={styles.improperBadge}>
              <Text style={styles.improperBadgeText}>Improper Clocking</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(attendance.status) }]}>
            <Text style={styles.statusText}>{getStatusText(attendance.status)}</Text>
          </View>
        </View>
      </View>
      {collapsed ? (
        // Compact view: only show basic in/out times, no addresses/entries/hours
        <View style={styles.timeContainer}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Clock In</Text>
            <View style={styles.timeRowWithThumb}>
              <Text style={styles.timeValue}>{formatTime(attendance.clockIn?.timestamp)}</Text>
              <ImageThumbnail
                hasImage={(attendance.clockIn as any)?.hasImage}
                imageId={(attendance.clockIn as any)?.imageId}
                imageUri={attendance.clockIn?.imageUri}
                imageType="clock_in"
                onViewImage={handleViewImage}
                timestamp={attendance.clockIn?.timestamp}
                title="Clock In"
                location={locText(attendance.clockIn?.location)}
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Clock Out</Text>
            <View style={styles.timeRowWithThumb}>
              <Text style={styles.timeValue}>{formatTime(attendance.clockOut?.timestamp)}</Text>
              <ImageThumbnail
                hasImage={(attendance.clockOut as any)?.hasImage}
                imageId={(attendance.clockOut as any)?.imageId}
                imageUri={attendance.clockOut?.imageUri}
                imageType="clock_out"
                onViewImage={handleViewImage}
                timestamp={attendance.clockOut?.timestamp}
                title="Clock Out"
                location={locText(attendance.clockOut?.location)}
              />
            </View>
          </View>
        </View>
      ) : (
        <>
          {/* Multi-entry list (per site/project) */}
          {Array.isArray((attendance as any).entries) && (attendance as any).entries.length > 0 && (
            <View style={styles.entriesContainer}>
              {(attendance as any).entries.map((e: any, idx: number) => (
                <View key={`${e.siteName || 'default'}-${e.projectName || 'default'}-${idx}`} style={styles.entryItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    <Text style={styles.entryTitle}>
                      {(e.siteName || e.projectName) ? `${e.siteName || ''}${e.siteName && e.projectName ? ' · ' : ''}${e.projectName || ''}` : 'Default'}
                    </Text>
                    {e.isImproperClocking && (
                      <View style={{
                        backgroundColor: '#fef3c7',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#f59e0b',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#b45309' }}>Improper Clocking</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.entryTimesRow}>
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeLabel}>In</Text>
                      <View style={styles.timeRowWithThumb}>
                        <Text style={styles.timeValue}>{formatTime(e.clockIn?.timestamp)}</Text>
                        <ImageThumbnail
                          hasImage={e?.clockIn?.hasImage}
                          imageId={e?.clockIn?.imageId}
                          imageUri={e?.clockIn?.imageUri}
                          imageType="clock_in"
                          onViewImage={handleViewImage}
                          timestamp={e.clockIn?.timestamp}
                          title="Clock In"
                          location={locText(e?.clockIn?.location)}
                        />
                      </View>
                      {e.clockIn?.location?.address ? (
                        <Text style={styles.addressText}>{e.clockIn.location.address}</Text>
                      ) : null}
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeLabel}>Out</Text>
                      <View style={styles.timeRowWithThumb}>
                        <Text style={styles.timeValue}>{formatTime(e.clockOut?.timestamp)}</Text>
                        <ImageThumbnail
                          hasImage={e?.clockOut?.hasImage}
                          imageId={e?.clockOut?.imageId}
                          imageUri={e?.clockOut?.imageUri}
                          imageType="clock_out"
                          onViewImage={handleViewImage}
                          timestamp={e.clockOut?.timestamp}
                          title="Clock Out"
                          location={locText(e?.clockOut?.location)}
                        />
                      </View>
                      {e.clockOut?.location?.address ? (
                        <Text style={styles.addressText}>{e.clockOut.location.address}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Show top-level Clock In/Out only when there are no detailed entries to avoid duplication */}
          {!(Array.isArray((attendance as any).entries) && (attendance as any).entries.length > 0) && (
            <View style={styles.timeContainer}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Clock In</Text>
                <View style={styles.timeRowWithThumb}>
                  <Text style={styles.timeValue}>{formatTime(attendance.clockIn?.timestamp)}</Text>
                  <ImageThumbnail
                    hasImage={(attendance.clockIn as any)?.hasImage}
                    imageId={(attendance.clockIn as any)?.imageId}
                    imageUri={attendance.clockIn?.imageUri}
                    imageType="clock_in"
                    onViewImage={handleViewImage}
                    timestamp={attendance.clockIn?.timestamp}
                    title="Clock In"
                    location={locText(attendance.clockIn?.location)}
                  />
                </View>
                {!!attendance.clockIn && (
                  <>
                    {(attendance.clockIn.siteName || attendance.clockIn.projectName) && (
                      <Text style={styles.metaText}>
                        {attendance.clockIn.siteName}{attendance.clockIn.siteName && attendance.clockIn.projectName ? ' · ' : ''}{attendance.clockIn.projectName}
                      </Text>
                    )}
                    {attendance.clockIn.location?.address ? (
                      <Text style={styles.addressText}>{attendance.clockIn.location.address}</Text>
                    ) : null}
                  </>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Clock Out</Text>
                <View style={styles.timeRowWithThumb}>
                  <Text style={styles.timeValue}>{formatTime(attendance.clockOut?.timestamp)}</Text>
                  <ImageThumbnail
                    hasImage={(attendance.clockOut as any)?.hasImage}
                    imageId={(attendance.clockOut as any)?.imageId}
                    imageUri={attendance.clockOut?.imageUri}
                    imageType="clock_out"
                    onViewImage={handleViewImage}
                    timestamp={attendance.clockOut?.timestamp}
                    title="Clock Out"
                    location={locText(attendance.clockOut?.location)}
                  />
                </View>
                {!!attendance.clockOut && (
                  <>
                    {(attendance.clockOut.siteName || attendance.clockOut.projectName) && (
                      <Text style={styles.metaText}>
                        {attendance.clockOut.siteName}{attendance.clockOut.siteName && attendance.clockOut.projectName ? ' · ' : ''}{attendance.clockOut.projectName}
                      </Text>
                    )}
                    {attendance.clockOut.location?.address ? (
                      <Text style={styles.addressText}>{attendance.clockOut.location.address}</Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          )}

          {showHours && (
            <View style={styles.hoursContainer}>
              <View style={styles.hoursBlock}>
                <Text style={styles.hoursLabel}>Normal Hours</Text>
                <Text style={styles.hoursValue}>{attendance.normalHours.toFixed(1)}h</Text>
              </View>

              <View style={styles.hoursBlock}>
                <Text style={styles.hoursLabel}>Overtime</Text>
                <Text style={[styles.hoursValue, styles.overtimeValue]}>
                  {attendance.overtimeHours.toFixed(1)}h
                </Text>
              </View>
            </View>
          )}
        </>
      )}
      {/* Fullscreen image viewer */}
      <Modal
        visible={!!viewer}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setViewer(null)}>
          <View style={styles.modalContent}>
            {!!viewer?.uri && (
              <Image source={{ uri: viewer.uri }} style={styles.modalImage} contentFit="contain" />
            )}
            {!!viewer && (
              <View style={styles.modalOverlayBar}>
                <Text style={styles.modalOverlayText}>
                  {viewer.title} • {viewer.timestamp ? format(new Date(viewer.timestamp), 'EEE, MMM d yyyy, h:mm a') : ''}
                </Text>
                {!!viewer.location && (
                  <Text style={styles.modalOverlaySubText} numberOfLines={2}>
                    {viewer.location}
                  </Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  date: {
    ...typography.h3,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  improperBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  improperBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#b45309',
  },
  timeContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
  },
  entriesContainer: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  entryItem: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  entryTitle: {
    // Replace typography.subtitle (not present) with a local equivalent
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  entryTimesRow: {
    flexDirection: 'row',
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  timeValue: {
    ...typography.h3,
  },
  timeRowWithThumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thumbWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginLeft: 6,
  },
  thumbPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  // Newly added missing styles used by details rows
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  hoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hoursBlock: {
    alignItems: 'center',
    flex: 1,
  },
  hoursLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  hoursValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  overtimeValue: {
    color: colors.secondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalOverlayBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalOverlayText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlaySubText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
});

export default AttendanceCard;