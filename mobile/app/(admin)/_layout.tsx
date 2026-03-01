import { Tabs } from 'expo-router';
import { Ticket, CheckSquare, Grid, User } from 'lucide-react-native';

// Logout now lives in the Profile tab — no header button needed
export default function AdminLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#059669',
                tabBarInactiveTintColor: '#9ca3af',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopColor: '#f3f4f6',
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    height: 60,
                    paddingBottom: 8,
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="tickets"
                options={{
                    title: 'Tickets',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ticket size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tasks',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <CheckSquare size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Grid size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <User size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
