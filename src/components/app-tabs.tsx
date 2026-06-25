import React from 'react';
import { Tabs } from 'expo-router';
import { useApp } from '../AppContext';
import { LayoutDashboard, Clock, CalendarRange, LogOut } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function AppTabs() {
  const { user, logout } = useApp();
  
  if (!user) return null;
  const isManager = user.role === 'sube-muduru' || user.role === 'genel-mudur';

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#6366F1',
      tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: {
        backgroundColor: '#0F172A',
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
      },
      headerStyle: {
        backgroundColor: '#0F172A',
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        borderBottomWidth: 1,
      },
      headerTintColor: '#F8FAFC',
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerRight: () => (
        <TouchableOpacity onPress={logout} style={{ marginRight: 16 }}>
          <LogOut size={20} color="#F8FAFC" />
        </TouchableOpacity>
      ),
      // Set dark background for screens
      sceneStyle: {
        backgroundColor: '#0F172A',
      }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Panel',
          tabBarLabel: 'Panel',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="daily-tracking"
        options={{
          title: 'Günlük Takip',
          tabBarLabel: 'Günlük Takip',
          href: isManager ? '/daily-tracking' : null,
          tabBarIcon: ({ color, size }) => (
            <Clock size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: 'Planlama',
          tabBarLabel: 'Planlama',
          href: isManager ? '/planning' : null,
          tabBarIcon: ({ color, size }) => (
            <CalendarRange size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
