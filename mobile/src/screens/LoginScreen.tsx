import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { fetchVerificationStatus } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const onSubmit = async () => {
        setError('');
        setBusy(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) throw signInError;
            const status = await fetchVerificationStatus();
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
        } catch (e: any) {
            setError(e?.message ?? 'Login failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <View style={styles.header}>
                <Text style={styles.brand}>
                    QuickDART <Text style={styles.brandAccent}>Civilian</Text>
                </Text>
            </View>

            <View style={styles.body}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to submit verified reports.</Text>

                {error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <Text style={styles.label}>Email</Text>
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    editable={!busy}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    editable={!busy}
                />

                <Pressable style={[styles.primaryBtn, busy && styles.btnDisabled]} onPress={onSubmit} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Log in</Text>}
                </Pressable>

                <Pressable onPress={() => navigation.navigate('Signup')} disabled={busy}>
                    <Text style={styles.linkText}>
                        New here? <Text style={styles.linkStrong}>Create an account</Text>
                    </Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    brand: { fontSize: 18, fontWeight: '800', color: '#1f2937' },
    brandAccent: { color: '#2563eb' },
    body: { flex: 1, padding: 24, justifyContent: 'center' },
    title: { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 24 },
    label: { fontSize: 11, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 16,
        color: '#111827',
    },
    primaryBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
    },
    btnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    linkText: { textAlign: 'center', marginTop: 18, color: '#6b7280', fontSize: 14 },
    linkStrong: { color: '#2563eb', fontWeight: '700' },
    errorBox: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fecaca' },
    errorText: { color: '#991b1b', fontSize: 13, fontWeight: '600' },
});
