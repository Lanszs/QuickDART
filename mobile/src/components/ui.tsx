import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, gradients, radius, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* -------------------------------------------------------------------------- */
/* Screen — safe-area aware page wrapper.                                      */
/* -------------------------------------------------------------------------- */
export function Screen({
  children,
  scroll = false,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  if (scroll) {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[styles.screen, styles.screenPad, { paddingBottom: insets.bottom }, contentStyle]}>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Brand — gradient logo mark + wordmark.                                      */
/* -------------------------------------------------------------------------- */
export function Brand({
  size = 'sm',
  onDark = false,
}: {
  size?: 'sm' | 'lg';
  onDark?: boolean;
}) {
  const lg = size === 'lg';
  const mark = lg ? 56 : 38;
  return (
    <View style={styles.brandRow}>
      <LinearGradient
        colors={onDark ? ['#FFFFFF', '#DCE7FB'] : gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.brandMark, { width: mark, height: mark, borderRadius: mark * 0.32 }]}
      >
        <Ionicons
          name="pulse"
          size={lg ? 30 : 21}
          color={onDark ? colors.primary : '#FFFFFF'}
        />
      </LinearGradient>
      <Text
        style={[
          lg ? styles.brandWordLg : styles.brandWord,
          { color: onDark ? colors.brandText : colors.text },
        ]}
      >
        Quick
        <Text style={{ color: onDark ? '#9DC0FF' : colors.primary }}>DART</Text>
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* AuthHero — branded gradient header for Login / Signup.                      */
/* -------------------------------------------------------------------------- */
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}
    >
      <Brand size="lg" onDark />
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------------- */
/* AppHeader — solid header with brand + optional sign-out.                     */
/* -------------------------------------------------------------------------- */
export function AppHeader({
  subtitle,
  onSignOut,
}: {
  subtitle?: string;
  onSignOut?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const confirmSignOut = () =>
    Alert.alert('Sign out', 'You will need to sign in again to submit reports.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View>
        <Brand size="sm" />
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {onSignOut ? (
        <Pressable
          onPress={confirmSignOut}
          hitSlop={10}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Button — gradient primary + variants, optional icon.                        */
/* -------------------------------------------------------------------------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;

  const content = (tint: string) => (
    <>
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tint} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.btnText, { color: tint }]}>{title}</Text>
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.btnShadow,
          isDisabled && styles.btnDisabled,
          pressed && !isDisabled && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          {content(colors.onPrimary)}
        </LinearGradient>
      </Pressable>
    );
  }

  const v = {
    secondary: { bg: colors.surface, brd: colors.borderStrong, fg: colors.text },
    ghost: { bg: 'transparent', brd: 'transparent', fg: colors.primary },
    danger: { bg: colors.dangerSoft, brd: '#F6C9C9', fg: colors.danger },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderWidth: 1, borderColor: v.brd },
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {content(v.fg)}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/* -------------------------------------------------------------------------- */
/* IconBadge — large circular tinted icon for status screens.                  */
/* -------------------------------------------------------------------------- */
export function IconBadge({
  icon,
  tone = 'primary',
}: {
  icon: IconName;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const map = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.iconBadge, { backgroundColor: map.bg }]}>
      <Ionicons name={icon} size={38} color={map.fg} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* ActionTile — large tappable tile (Upload screen).                           */
/* -------------------------------------------------------------------------- */
export function ActionTile({
  icon,
  title,
  subtitle,
  onPress,
  accent = false,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        accent && styles.tileAccent,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.tileIcon, accent && styles.tileIconAccent]}>
        <Ionicons name={icon} size={24} color={accent ? '#FFFFFF' : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tileTitle, accent && { color: '#FFFFFF' }]}>{title}</Text>
        <Text style={[styles.tileSub, accent && { color: 'rgba(255,255,255,0.8)' }]}>
          {subtitle}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={accent ? 'rgba(255,255,255,0.8)' : colors.textFaint}
      />
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Field — labeled input with leading icon + focus state.                      */
/* -------------------------------------------------------------------------- */
export function Field({
  label,
  error,
  icon,
  ...props
}: TextInputProps & { label: string; error?: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputBox,
          focused && styles.inputBoxFocused,
          error ? styles.inputBoxError : null,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.primary : colors.textFaint}
            style={{ marginRight: spacing.sm }}
          />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Notice — inline banner with icon.                                           */
/* -------------------------------------------------------------------------- */
export function Notice({
  tone = 'info',
  title,
  message,
}: {
  tone?: 'info' | 'error' | 'success' | 'warning';
  title?: string;
  message: string;
}) {
  const t = {
    info: { bg: colors.primarySoft, fg: colors.primaryDark, icon: 'information-circle' as IconName },
    error: { bg: colors.dangerSoft, fg: '#B42318', icon: 'alert-circle' as IconName },
    success: { bg: colors.successSoft, fg: '#067A55', icon: 'checkmark-circle' as IconName },
    warning: { bg: colors.warningSoft, fg: '#9A5B06', icon: 'warning' as IconName },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]}>
      <Ionicons name={t.icon} size={20} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text> : null}
        <Text style={[styles.noticeMsg, { color: t.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPad: { padding: spacing.xl },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.huge },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandMark: { alignItems: 'center', justifyContent: 'center', ...elevation.e1 },
  brandWord: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  brandWordLg: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },

  hero: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...elevation.e2,
  },
  heroTitle: { ...typography.hero, color: colors.brandText, marginTop: spacing.xxl },
  heroSubtitle: {
    fontSize: 14.5,
    color: colors.onBrand,
    marginTop: spacing.sm,
    lineHeight: 21,
    opacity: 0.85,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 6, marginLeft: 50 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  btn: {
    flexDirection: 'row',
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  btnShadow: { borderRadius: radius.md, ...elevation.e1 },
  btnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.e1,
  },
  sectionLabel: { ...typography.sectionLabel, marginBottom: spacing.md },

  iconBadge: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },

  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...elevation.e1,
  },
  tileAccent: { backgroundColor: colors.brandMid, borderColor: colors.brandMid, ...elevation.e2 },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconAccent: { backgroundColor: 'rgba(255,255,255,0.16)' },
  tileTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  fieldWrap: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.sectionLabel, marginBottom: spacing.sm },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  inputBoxFocused: { borderColor: colors.primary, backgroundColor: '#FFFFFF' },
  inputBoxError: { borderColor: colors.danger },
  input: { flex: 1, paddingVertical: spacing.md, fontSize: 16, color: colors.text },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, fontWeight: '600' },

  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  noticeTitle: { fontWeight: '800', fontSize: 14, marginBottom: 3 },
  noticeMsg: { fontSize: 13, lineHeight: 19 },
});
