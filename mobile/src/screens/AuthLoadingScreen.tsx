import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { fetchVerificationStatus } from '../api';
import type { RootStackParamList } from '../navigation';

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
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.text}>Checking your account...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
    text: { marginTop: 12, color: '#6b7280', fontSize: 14, fontWeight: '600' },
});
