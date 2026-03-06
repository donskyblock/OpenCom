import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Linking, Platform, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { AuthScreen } from "./src/screens/AuthScreen";
import { ServersScreen } from "./src/screens/ServersScreen";
import { ChannelScreen } from "./src/screens/ChannelScreen";
import { DmsScreen } from "./src/screens/DmsScreen";
import { DmChatScreen } from "./src/screens/DmChatScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { parseDeepLink } from "./src/deeplinks";
import { initNotificationsSafe, registerForPushNotificationsAsync } from "./src/notifications";
import { loadPushToken, loadTokens, savePushToken } from "./src/storage";
import type { Channel, CoreServer, DeepLinkTarget, DmThreadApi, Friend, Guild } from "./src/types";
import { colors } from "./src/theme";

const Tab = createBottomTabNavigator();
const MainStack = createNativeStackNavigator();

function TabServers({ navigation }: { navigation: any }) {
  const onSelectChannel = useCallback(
    (server: CoreServer, guild: Guild, channel: Channel) => {
      navigation.navigate("Channel", { server, guild, channel });
    },
    [navigation]
  );
  return <ServersScreen onSelectChannel={onSelectChannel} />;
}

function TabDms({ navigation }: { navigation: any }) {
  const onSelectDm = useCallback(
    (thread: DmThreadApi) => {
      navigation.navigate("DmChat", { thread });
    },
    [navigation]
  );
  return <DmsScreen onSelectDm={onSelectDm} />;
}

function TabFriends({ navigation }: { navigation: any }) {
  const { api } = useAuth();
  const onOpenDm = useCallback(
    async (friend: Friend) => {
      try {
        const { threadId } = await api.openDm(friend.id);
        navigation.navigate("DmChat", {
          thread: {
            id: threadId,
            participantId: friend.id,
            name: friend.username,
            pfp_url: friend.pfp_url
          }
        });
      } catch {
        // Will show error in FriendsScreen via status
      }
    },
    [api, navigation]
  );
  return <FriendsScreen onOpenDm={onOpenDm} />;
}

function TabProfile() {
  const { setTokens } = useAuth();
  const onLogout = useCallback(async () => {
    await setTokens(null);
  }, [setTokens]);
  return <ProfileScreen onLogout={onLogout} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.sidebar },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.rail, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" }
      }}
    >
      <Tab.Screen name="Servers" component={TabServers} options={{ title: "Servers" }} />
      <Tab.Screen name="DMs" component={TabDms} options={{ title: "Messages" }} />
      <Tab.Screen name="Friends" component={TabFriends} options={{ title: "Friends" }} />
      <Tab.Screen name="Profile" component={TabProfile} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <MainStack.Screen name="Tabs" component={MainTabs} />
      <MainStack.Screen
        name="Channel"
        component={ChannelScreenWrapper}
        options={{ presentation: "card" }}
      />
      <MainStack.Screen
        name="DmChat"
        component={DmChatScreenWrapper}
        options={{ presentation: "card" }}
      />
    </MainStack.Navigator>
  );
}

function ChannelScreenWrapper({ route, navigation }: { route: any; navigation: any }) {
  const { server, guild, channel } = route.params;
  return (
    <ChannelScreen
      server={server}
      guild={guild}
      channel={channel}
      onBack={() => navigation.goBack()}
    />
  );
}

function DmChatScreenWrapper({ route, navigation }: { route: any; navigation: any }) {
  const { thread } = route.params;
  return <DmChatScreen thread={thread} onBack={() => navigation.goBack()} />;
}

function AppContent() {
  const { tokens, setTokens, me, setMe, refreshServers, api } = useAuth();
  const [booting, setBooting] = useState(true);
  const [status, setStatus] = useState("");
  const pendingDeepLinkRef = useRef<DeepLinkTarget | null>(null);

  const handleAuth = useCallback(
    async (email: string, username: string, password: string, mode: "login" | "register") => {
      if (mode === "register") {
        await api.register(email, username, password);
      }
      const login = await api.login(email, password);
      await setTokens({ accessToken: login.accessToken, refreshToken: login.refreshToken });
      setMe({ id: login.user.id, username: login.user.username });
      await refreshServers();
    },
    [api, setTokens, setMe, refreshServers]
  );

  const applyDeepLinkTarget = useCallback(
    async (target: DeepLinkTarget) => {
      if (target.kind === "login") {
        await setTokens(null);
        setMe(null);
        setStatus("Logged out.");
        return;
      }
      if (target.kind === "join") {
        if (!tokens) {
          pendingDeepLinkRef.current = target;
          setStatus("Sign in to accept invite.");
          return;
        }
        try {
          const joined = await api.joinInvite(target.code);
          await refreshServers();
          setStatus("Invite accepted.");
          pendingDeepLinkRef.current = null;
        } catch {
          setStatus("Invite join failed.");
        }
        return;
      }
      pendingDeepLinkRef.current = target;
    },
    [api, refreshServers, setTokens, setMe, tokens]
  );

  const handleIncomingUrl = useCallback(
    async (url: string) => {
      const target = parseDeepLink(url);
      if (!target) return;
      await applyDeepLinkTarget(target);
    },
    [applyDeepLinkTarget]
  );

  useEffect(() => {
    initNotificationsSafe();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadTokens();
      if (!alive) return;
      if (stored) {
        try {
          await refreshServers();
        } catch {
          await setTokens(null);
          setStatus("Session expired. Please sign in.");
        }
      }
      setBooting(false);

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) await handleIncomingUrl(initialUrl);
    })();

    const linkSub = Linking.addEventListener("url", (e) => void handleIncomingUrl(e.url));
    const notifTapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      const url = String((data.deepLink as string) || (data.url as string) || "");
      if (url) void handleIncomingUrl(url);
    });
    const notifReceiveSub = Notifications.addNotificationReceivedListener(() => {
      void refreshServers();
    });

    return () => {
      alive = false;
      linkSub.remove();
      notifTapSub.remove();
      notifReceiveSub.remove();
    };
  }, [handleIncomingUrl, refreshServers, setTokens]);

  useEffect(() => {
    if (!tokens?.accessToken) return;
    let alive = true;
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!alive || !token) return;
        const existing = await loadPushToken();
        if (token !== existing) {
          await api.registerPushToken(token);
          await savePushToken(token);
        }
      } catch {
        if (alive) setStatus((s) => s || "Push registration skipped.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, tokens?.accessToken]);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textDim, marginTop: 8 }}>Loading OpenCom...</Text>
      </View>
    );
  }

  if (!tokens) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <AuthScreen onLogin={handleAuth} status={status} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.brand,
          background: colors.background,
          card: colors.sidebar,
          text: colors.text,
          border: colors.border,
          notification: colors.brand
        },
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" },
          medium: { fontFamily: "System", fontWeight: "500" },
          bold: { fontFamily: "System", fontWeight: "700" },
          heavy: { fontFamily: "System", fontWeight: "900" }
        }
      } as any}
    >
      <StatusBar style="light" />
      <MainNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
