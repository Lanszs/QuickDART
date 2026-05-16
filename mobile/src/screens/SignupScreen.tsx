import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { civilianSignup } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const onSubmit = async () => {
        setError('');
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (!fullName.trim()) {
            setError('Please enter your full name.');
            return;
        }
        setBusy(true);
        try {
            await civilianSignup(email.trim().toLowerCase(), password, fullName.trim());
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });
            if (signInError) throw signInError;
            navigation.reset({ index: 0, routes: [{ name: 'IdVerification' }] });
        } catch (e: any) {
            const code = String(e?.message ?? 'unknown_error');
            if (code === 'email_already_registered') setError('That email is already registered. Try logging in instead.');
            else if (code === 'password_too_short') setError('Password must be at least 8 characters.');
            else setError(code);
        } finally {
            setBusy(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>You&apos;ll verify your identity right after.</Text>

                {error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <Text style={styles.label}>Full name</Text>
                <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Juan Dela Cruz"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    editable={!busy}
                />

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
                    placeholder="at least 8 characters"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    editable={!busy}
                />

                <Pressable style={[styles.primaryBtn, busy && styles.btnDisabled]} onPress={onSubmit} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
                </Pressable>

                <Pressable onPress={() => navigation.goBack()} disabled={busy}>
                    <Text style={styles.linkText}>
                        Already have an account? <Text style={styles.linkStrong}>Log in</Text>
                    </Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
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
    errorBox: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fecaca', marginBottom: 4 },
    errorText: { color: '#991b1b', fontSize: 13, fontWeight: '600' },
});
