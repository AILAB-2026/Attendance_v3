import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { apiService } from '@/lib/api';
import { useAttendance } from '@/hooks/use-attendance-store';

export type SiteProjectMeta = {
  siteName?: string;
  projectName?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (meta: SiteProjectMeta) => void;
  initial?: SiteProjectMeta;
};

// Options will be populated from assigned schedule

const SiteProjectModal = ({ visible, onClose, onConfirm, initial }: Props) => {
  const [siteName, setSiteName] = useState(initial?.siteName || '');
  const [projectName, setProjectName] = useState(initial?.projectName || '');
  const [siteOpen, setSiteOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [siteOptions, setSiteOptions] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [allProjectOptions, setAllProjectOptions] = useState<string[]>([]);
  const [siteProjectMap, setSiteProjectMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | undefined>();
  const [tasks, setTasks] = useState<Array<{ id: string; name: string; status: string }> | null>(null);
  const [tasksCache, setTasksCache] = useState<Record<string, Array<{ id: string; name: string; status: string }>>>({});
  const { user } = useAuth();
  const { getTodayAttendance } = useAttendance();

  useEffect(() => {
    setSiteName(initial?.siteName || '');
    setProjectName(initial?.projectName || '');
    setSiteOpen(false);
    setProjectOpen(false);
    setTasks(null);
    setTasksError(undefined);
    setTasksLoading(false);
  }, [initial, visible]);

  // Load assigned options when modal becomes visible
  useEffect(() => {
    const fetchAssigned = async () => {
      if (!visible) return;

      const companyCode = (user as any)?.companyCode;
      const employeeNo = user?.empNo;
      if (!companyCode || !employeeNo) return;

      const cacheKey = `@face_rec_options:${companyCode}:${employeeNo}`;
      const now = Date.now();
      const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
      const STALE_TTL = 5 * 60 * 1000; // 5 minutes - consider stale after this

      // STEP 1: Load from cache immediately (instant display)
      let cacheLoaded = false;
      let cacheTs = 0;
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { sites?: string[]; siteProjectMap?: Record<string, string[]>; ts?: number };
          cacheTs = parsed.ts || 0;
          if ((now - cacheTs) < TTL) {
            const sites = Array.isArray(parsed.sites) ? parsed.sites : [];
            const mapping = parsed.siteProjectMap || {};
            if (sites.length) {
              setSiteOptions(sites);
              setSiteProjectMap(mapping);
              // Collect all projects
              const allProjects = new Set<string>();
              Object.values(mapping).forEach(projects => projects.forEach(p => allProjects.add(p)));
              setAllProjectOptions(Array.from(allProjects));
              // Set initial project options
              if (siteName && mapping[siteName]) {
                setProjectOptions(mapping[siteName]);
              } else {
                setProjectOptions(Array.from(allProjects));
              }
              cacheLoaded = true;
            }
          } else {
            // Expired - remove cache
            try { await AsyncStorage.removeItem(cacheKey); } catch { }
          }
        }
      } catch { }

      // If cache is fresh enough (< 5 min), skip network fetch entirely
      if (cacheLoaded && (now - cacheTs) < STALE_TTL) {
        setLoading(false);
        return;
      }

      // STEP 2: If no cache or cache is stale, fetch from API in background
      // Only show loading if we don't have cached data
      if (!cacheLoaded) {
        setLoading(true);
      }

      try {
        // Use the OPTIMIZED single-call endpoint (no N+1 queries!)
        // Pass employeeNo to filter by assignment if x_site_popup is enabled
        console.log('🔍 Fetching sites with projects in single call...');
        const res = await apiService.getSitesWithProjects(companyCode, employeeNo);

        if (res?.success && res?.data?.sites) {
          const apiSites = res.data.sites;
          const siteProjectMapping = res.data.siteProjectMap || {};
          console.log(`✅ Received ${apiSites.length} sites with project mappings in single call`);

          // Extract site names
          const sites: string[] = apiSites.map(s => s.siteName).filter(Boolean);
          setSiteOptions(sites);
          setSiteProjectMap(siteProjectMapping);

          // Collect all unique projects
          const allProjects = new Set<string>();
          Object.values(siteProjectMapping).forEach(projects => {
            projects.forEach(p => allProjects.add(p));
          });
          setAllProjectOptions(Array.from(allProjects));

          // Set initial project options based on current site selection
          if (siteName && siteProjectMapping[siteName]) {
            setProjectOptions(siteProjectMapping[siteName]);
          } else {
            setProjectOptions(Array.from(allProjects));
          }

          // Persist for offline use
          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              sites,
              siteProjectMap: siteProjectMapping,
              ts: Date.now()
            }));
          } catch { }

          // Validate selections against new data
          if (siteName && sites.length && !sites.includes(siteName)) setSiteName('');
          if (projectName && allProjects.size && !allProjects.has(projectName)) setProjectName('');
        } else {
          console.warn('❌ Failed to fetch sites from optimized API');
        }
      } catch (e) {
        // Network failed - keep using cached data if available
        console.warn('Failed to load sites, using offline fallback if available:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAssigned();
  }, [visible]);

  // Filter projects based on selected site
  useEffect(() => {
    if (!siteName) {
      // No site selected, show all projects
      setProjectOptions(allProjectOptions);
    } else if (siteProjectMap[siteName]) {
      // Site selected, show only projects assigned to this site
      setProjectOptions(siteProjectMap[siteName]);
      // Clear project selection if it's not available for this site
      if (projectName && !siteProjectMap[siteName].includes(projectName)) {
        setProjectName('');
      }
    } else {
      // Site selected but no mapping found, show all projects
      setProjectOptions(allProjectOptions);
    }
  }, [siteName, siteProjectMap, allProjectOptions, projectName]);

  // Load tasks for selected project (with persistent cache for offline) when projectName changes
  useEffect(() => {
    const fetchTasks = async () => {
      if (!visible) return;
      const name = (projectName || '').trim();
      if (!name) { setTasks(null); setTasksError(undefined); return; }

      const companyCode = (user as any)?.companyCode;
      if (!companyCode) return;

      const tasksCacheKey = `@project_tasks:${companyCode}:${name}`;
      const now = Date.now();
      const TTL = 24 * 60 * 60 * 1000; // 24 hours

      // Check in-memory cache first
      if (tasksCache[name]) {
        setTasks(tasksCache[name]);
        setTasksError(undefined);
        return;
      }

      // Try persistent cache for offline support
      try {
        const cached = await AsyncStorage.getItem(tasksCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { items: any[]; ts: number };
          if (parsed.ts && (now - parsed.ts) < TTL) {
            setTasks(parsed.items);
            setTasksCache((prev) => ({ ...prev, [name]: parsed.items }));
            setTasksError(undefined);
            // Still try to fetch fresh data in background if online
            try {
              const res = await apiService.getProjectTasks(companyCode, name);
              const items = Array.isArray(res?.data) ? res.data! : [];
              setTasks(items);
              setTasksCache((prev) => ({ ...prev, [name]: items }));
              await AsyncStorage.setItem(tasksCacheKey, JSON.stringify({ items, ts: Date.now() }));
            } catch {
              // Ignore background fetch errors, use cached data
            }
            return;
          } else {
            // Expired cache
            try { await AsyncStorage.removeItem(tasksCacheKey); } catch { }
          }
        }
      } catch { }

      // No cache available, try fresh fetch
      try {
        setTasksLoading(true);
        setTasksError(undefined);
        const res = await apiService.getProjectTasks(companyCode, name);
        const items = Array.isArray(res?.data) ? res.data! : [];
        setTasks(items);
        setTasksCache((prev) => ({ ...prev, [name]: items }));
        // Persist for offline use
        try { await AsyncStorage.setItem(tasksCacheKey, JSON.stringify({ items, ts: Date.now() })); } catch { }
      } catch (e: any) {
        // Show offline-friendly message instead of network error
        setTasks([]);
        setTasksError('Tasks unavailable offline. Connect to internet to load.');
      } finally {
        setTasksLoading(false);
      }
    };
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, visible]);

  const canConfirm = siteName.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Select Site / Project</Text>

          <Text style={styles.label}>Site</Text>
          <TouchableOpacity style={styles.select} onPress={() => { setSiteOpen(!siteOpen); setProjectOpen(false); }}>
            <Text style={styles.selectValue}>{siteName || (loading ? 'Loading...' : (siteOptions.length ? 'Choose a site' : 'No assigned sites'))}</Text>
          </TouchableOpacity>
          {siteOpen && (
            <View style={styles.dropdown}>
              <FlatList
                data={siteOptions}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => { setSiteName(item); setSiteOpen(false); }}
                  >
                    <Text style={styles.optionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <Text style={styles.label}>Project (optional)</Text>
          <TouchableOpacity style={styles.select} onPress={() => { setProjectOpen(!projectOpen); setSiteOpen(false); }}>
            <Text style={styles.selectValue}>{projectName || (loading ? 'Loading...' : (projectOptions.length ? 'Choose a project' : 'No assigned projects'))}</Text>
          </TouchableOpacity>
          {projectOpen && (
            <View style={styles.dropdown}>
              <FlatList
                data={projectOptions}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => { setProjectName(item); setProjectOpen(false); }}
                  >
                    <Text style={styles.optionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Project tasks preview */}
          {!!projectName && (
            <View style={styles.tasksBox}>
              <Text style={styles.tasksTitle}>Project Tasks</Text>
              {tasksLoading && <Text style={styles.tasksMeta}>Loading tasks…</Text>}
              {!!tasksError && <Text style={[styles.tasksMeta, { color: '#f59e0b' }]}>{tasksError}</Text>}
              {(!tasksLoading && !tasksError && tasks && tasks.length === 0) && (
                <Text style={styles.tasksMeta}>No tasks found for this project.</Text>
              )}
              {!!tasks && tasks.length > 0 && (
                <View style={styles.taskList}>
                  {tasks.map((t) => (
                    <View key={t.id} style={styles.taskItem}>
                      <Text style={styles.taskName}>{t.name}</Text>
                      <Text style={[styles.taskStatus,
                      t.status === 'done' ? styles.taskStatusDone :
                        t.status === 'in-progress' ? styles.taskStatusInProgress :
                          t.status === 'blocked' ? styles.taskStatusBlocked : styles.taskStatusPending
                      ]}>{t.status}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirm, !canConfirm && styles.disabled]}
              onPress={() => onConfirm({ siteName: siteName || undefined, projectName: projectName || undefined })}
              disabled={!canConfirm}
            >
              <Text style={styles.confirmText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.card,
    padding: spacing.lg,
    ...shadows.card,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  select: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.select({ ios: spacing.md, android: spacing.sm, default: spacing.sm }),
    marginTop: spacing.xs,
    backgroundColor: colors.background,
  },
  selectValue: {
    ...typography.body,
  },
  dropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
    maxHeight: 200,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionText: {
    ...typography.body,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
    gap: spacing.md as any,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  cancel: {
    backgroundColor: colors.background,
  },
  confirm: {
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: 0.6,
  },
  cancelText: {
    ...typography.body,
    fontWeight: '600',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '700',
  },
  tasksBox: {
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tasksTitle: { ...typography.caption, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  tasksMeta: { ...typography.caption, color: colors.textSecondary },
  taskList: { marginTop: spacing.xs, gap: 6 },
  taskItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8 },
  taskName: { ...typography.caption, color: colors.text, fontWeight: '600', flex: 1, marginRight: spacing.md },
  taskStatus: { ...typography.caption, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, textTransform: 'capitalize' as any },
  taskStatusDone: { backgroundColor: '#16a34a22', color: '#16a34a' },
  taskStatusInProgress: { backgroundColor: '#0ea5e922', color: '#0ea5e9' },
  taskStatusBlocked: { backgroundColor: '#ef444422', color: '#ef4444' },
  taskStatusPending: { backgroundColor: '#a3a3a322', color: '#737373' },
});

export default SiteProjectModal;
