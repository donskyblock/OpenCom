import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

type AuthMode = "login" | "register";

type AuthScreenProps = {
  onLogin: (email: string, username: string, password: string, mode: AuthMode) => Promise<void>;
  status: string;
};

export function AuthScreen({ onLogin, status }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === "register" && !username.trim()) return;
    setWorking(true);
    try {
      await onLogin(email.trim(), username.trim(), password, mode);
    } finally {
      setWorking(false);
    }
  }, [email, username, password, mode, onLogin]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            OpenCom keeps your teams, communities, and updates in one place.
          </Text>

          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, mode === "login" && styles.toggleBtnActive]}
              onPress={() => setMode("login")}
            >
              <Text style={[styles.toggleText, mode === "login" && styles.toggleTextActive]}>
                Log in
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, mode === "register" && styles.toggleBtnActive]}
              onPress={() => setMode("register")}
            >
              <Text style={[styles.toggleText, mode === "register" && styles.toggleTextActive]}>
                Create account
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!working}
          />
          {mode === "register" && (
            <TextInput
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              editable={!working}
            />
          )}
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textDim}
            secureTextEntry
            autoCapitalize="none"
            editable={!working}
          />

          <Pressable
            style={[styles.primaryBtn, working && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={working}
          >
            {working ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "login" ? "Log in" : "Create account"}
              </Text>
            )}
          </Pressable>

          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  card: {
    backgroundColor: colors.sidebar,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 14,
    marginBottom: spacing.lg
  },
  toggleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.elev,
    alignItems: "center"
  },
  toggleBtnActive: { backgroundColor: colors.brand },
  toggleText: { color: colors.textSoft, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  status: { color: colors.textDim, fontSize: 13, marginTop: spacing.md, textAlign: "center" }
});
