import { Tabs, useRouter } from "expo-router";
import { MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TouchableOpacity, Image, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { events } from '@/lib/events';
import colors from '@/constants/colors';

import { useAuth } from "@/hooks/use-auth";
import { apiService } from "@/lib/api";


const HeaderLogo = ({ companyCode }: { companyCode?: string }) => {
  const getCompanyLogo = () => {
    const code = companyCode?.toUpperCase() || '';
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
    <Image
      source={getCompanyLogo()}
      style={{ width: 80, height: 40, resizeMode: 'contain', marginLeft: 16 }}
    />
  );
};

export default function TabLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const modules = (user as any)?.modules;
  const isModuleHidden = (key: string) => modules ? modules[key] === false : false;

  const [scheduleBadge, setScheduleBadge] = useState<number | undefined>(undefined);
  const [scheduleHasTasks, setScheduleHasTasks] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>(undefined);


  const todayStr = useMemo(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  useEffect(() => {
    const companyCode = (user as any)?.companyCode;
    if (companyCode) {
      // Construct logo URL endpoint based on company code from login
      const logoUrl = apiService.getCompanyLogoUrl(companyCode);
      setCompanyLogoUrl(logoUrl);
    } else {
      setCompanyLogoUrl(undefined);
    }
  }, [user]);

  const refreshScheduleBadge = useCallback(async () => {
    try {
      const companyCode = (user as any)?.companyCode;
      const empNo = user?.empNo;
      if (!companyCode || !empNo) { setScheduleBadge(undefined); return; }
      const res = await apiService.getAssignedSchedule(companyCode, empNo, todayStr);
      const list = Array.isArray(res?.data) ? res.data : [];
      // Derive projects for today and compute remaining tasks (>0 and status != 'done')
      const projects = Array.from(new Set(list.map((a: any) => String(a.projectName || '').trim()).filter(Boolean))) as string[];
      let remainingProjects = 0;
      for (const pn of projects) {
        try {
          const t = await apiService.getProjectTasks(companyCode, pn);
          const items = Array.isArray(t?.data) ? t.data : [];
          const remaining = items.filter((it: any) => String(it.status).toLowerCase() !== 'done');
          if (remaining.length > 0) remainingProjects += 1;
        } catch { }
      }
      setScheduleBadge(remainingProjects > 0 ? remainingProjects : undefined);
      setScheduleHasTasks(remainingProjects > 0);
    } catch {
      setScheduleBadge(undefined);
      setScheduleHasTasks(false);
    }
  }, [user, todayStr]);

  useEffect(() => { refreshScheduleBadge(); }, [refreshScheduleBadge]);
  useFocusEffect(useCallback(() => { refreshScheduleBadge(); }, [refreshScheduleBadge]));
  useEffect(() => {
    const off = events.on('schedule:tasks-updated', () => {
      refreshScheduleBadge();
    });
    return off;
  }, [refreshScheduleBadge]);



  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitleStyle: { fontWeight: '700' },
          tabBarLabelStyle: { fontWeight: '700' },
          headerLeft: () => <HeaderLogo companyCode={(user as any)?.companyCode} />,
          headerRight: () => (

            <TouchableOpacity
              onPress={() => router.replace('/(tabs)')}
              style={{
                marginRight: 16,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary + '15',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <MaterialIcons name="home" size={24} color={colors.primary} />
            </TouchableOpacity >
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            headerShown: false,
            href: null,
            tabBarStyle: { display: 'none' },
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            href: isModuleHidden('attendance') ? null : undefined,
            title: "Clock In/Out",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="access-time" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            href: isModuleHidden('history') ? null : undefined,
            title: "History",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="history" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leave"
          options={{
            href: isModuleHidden('leave') ? null : undefined,
            title: "Leave",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="event-note" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            href: isModuleHidden('schedule') ? null : undefined,
            title: "Schedule",
            tabBarBadge: scheduleBadge,
            tabBarIcon: ({ color, size }) => (
              <View style={{ width: size, height: size }}>
                <MaterialIcons name="assignment" size={size} color={color} />
                {scheduleHasTasks && (
                  <View style={{ position: 'absolute', right: -2, top: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="toolbox"
          options={{
            title: "Meetings",
            href: null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="groups" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="survey"
          options={{
            title: "Survey",
            href: isModuleHidden('survey') ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="assignment" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="feedback"
          options={{
            title: "Feedback",
            href: isModuleHidden('feedback') ? null : undefined,
            headerShown: true, // Show the Tab Header (Logo, etc)
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="feedback" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="payslips"
          options={{
            title: "Payroll",
            href: isModuleHidden('payroll') ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="money-bill-wave" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            href: null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="bar-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="manage"
          options={{
            title: 'Manage',
            // Hide tab for non-managers by setting href to null
            href: ((String((user as any)?.role || '').toLowerCase() === 'manager' || String((user as any)?.role || '').toLowerCase() === 'admin') ? undefined : null) as any,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="admin-panel-settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs >

    </>
  );
}
