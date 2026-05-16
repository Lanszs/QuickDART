import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchVerificationStatus } from '../api';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation';

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
        await supabase.auth.signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <ActivityIndicator size="large" color="#d97706" />
                <Text style={styles.title}>Awaiting review</Text>
                <Text style={styles.subtitle}>
                    Your ID and selfie were submitted
                    {submittedAt ? ` on ${new Date(submittedAt).toLocaleString()}` : ''}.
                    A Commander will review them shortly. This screen will update
                    automatically once a decision is made.
                </Text>
                <Pressable onPress={poll} style={styles.refreshBtn}>
                    <Text style={styles.refreshBtnText}>Check now</Text>
                </Pressable>
                <Pressable onPress={onSignOut}>
                    <Text style={styles.signOut}>Sign out</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        width: '100%',
        maxWidth: 420,
    },
    title: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 16 },
    subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    refreshBtn: {
        marginTop: 20,
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    refreshBtnText: { color: '#ffffff', fontWeight: '700' },
    signOut: { marginTop: 16, color: '#6b7280', fontSize: 13, fontWeight: '600' },
});
