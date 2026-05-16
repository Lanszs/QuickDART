import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchVerificationStatus } from '../api';
import { signOut } from '../lib/supabase';
import type { RootStackParamList } from '../navigation';
import { AppHeader, Button, Card, IconBadge, Screen } from '../components/ui';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VerificationPending'>;

const POLL_INTERVAL_MS = 10_000;

export default function VerificationPendingScreen({ navigation, route }: Props) {
    const submittedAt = route.params?.submittedAt;
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    const poll = useCallback(async () => {
        const status = await fetchVerificationStatus();
        if (!status) return;
        if (status.status === 'approved') {
            navigation.reset({ index: 0, routes: [{ name: 'Upload' }] });
        } else if (status.status === 'rejected') {
            navigation.reset({
                index: 0,
                routes: [{ name: 'IdVerification', params: { rejectionReason: status.rejection_reason } }],
            });
        } else if (status.status === 'unverified') {
            navigation.reset({ index: 0, routes: [{ name: 'IdVerification' }] });
        }
    }, [navigation]);

    useEffect(() => {
        poll();
        timer.current = setInterval(poll, POLL_INTERVAL_MS);
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') poll();
        });
        return () => {
            if (timer.current) clearInterval(timer.current);
            sub.remove();
        };
    }, [poll]);

    const onSignOut = async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    return (
        <View style={styles.flex}>
            <AppHeader subtitle="Verification pending" onSignOut={onSignOut} />
            <Screen contentStyle={styles.center}>
                <IconBadge icon="hourglass-outline" tone="warning" />
                <Text style={styles.title}>Awaiting review</Text>
                <Text style={styles.body}>
                    Your ID and selfie were submitted
                    {submittedAt ? ` on ${new Date(submittedAt).toLocaleString()}` : ''}. A commander
                    will review them shortly — this screen updates automatically once a decision is made.
                </Text>

                <Card style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <View style={styles.dotLive} />
                        <Text style={styles.statusText}>Checking for updates every 10 seconds</Text>
                    </View>
                </Card>

                <Button
                    title="Check now"
                    icon="refresh"
                    variant="secondary"
                    onPress={poll}
                    style={styles.btn}
                />
            </Screen>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { ...typography.display },
    body: { ...typography.subtitle, textAlign: 'center', marginTop: spacing.sm },
    statusCard: { marginTop: spacing.xxl, width: '100%' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, justifyContent: 'center' },
    dotLive: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
    statusText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    btn: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
