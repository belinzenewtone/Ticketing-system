import { Tabs } from 'expo-router';
import { Ticket, User } from 'lucide-react-native';

export default function PortalLayout() {
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
                name="index"
                options={{
                    title: 'My Tickets',
                    tabBarLabel: 'Tickets',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ticket size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <User size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
