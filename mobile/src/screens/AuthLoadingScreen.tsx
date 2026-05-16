import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { fetchVerificationStatus } from '../api';
import type { RootStackParamList } from '../navigation';
import { Brand } from '../components/ui';
import { gradients, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthLoading'>;

export default function AuthLoadingScreen({ navigation }: Props) {
    useEffect(() => {
        let active = true;

        const route = async () => {
            const { data } = await supabase.auth.getSession();
            if (!active) return;
            if (!data.session) {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                return;
            }
            const status = await fetchVerificationStatus();
            if (!active) return;
            if (!status || status.status === 'unverified') {
                navigation.reset({ index: 0, routes: [{ name: 'IdVerification' }] });
            } else if (status.status === 'rejected') {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'IdVerification', params: { rejectionReason: status.rejection_reason } }],
                });
            } else if (status.status === 'pending') {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'VerificationPending', params: { submittedAt: status.submitted_at } }],
                });
            } else {
                navigation.reset({ index: 0, routes: [{ name: 'Upload' }] });
            }
        };

        route();
        return () => { active = false; };
    }, [navigation]);

    return (
        <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.container}
        >
            <Brand size="lg" onDark />
            <ActivityIndicator size="large" color="#9DC0FF" style={{ marginTop: spacing.xxxl }} />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
