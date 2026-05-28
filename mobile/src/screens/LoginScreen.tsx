import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { fetchVerificationStatus, NonCivilianAccountError } from '../api';
import type { RootStackParamList } from '../navigation';
import { AuthHero, Button, Card, Field, Notice } from '../components/ui';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const routeByStatus = async () => {
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
    };

    const onSubmit = async () => {
        setError('');
        setBusy(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) throw signInError;
            await routeByStatus();
        } catch (e: any) {
            if (e instanceof NonCivilianAccountError) {
                await supabase.auth.signOut();
                setError(e.message);
            } else {
                setError(e?.message ?? 'Login failed.');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
        >
            <View style={styles.flex}>
                <AuthHero title="Welcome back" subtitle="Sign in to submit verified disaster reports." />
                <View style={styles.body}>
                    <Card style={styles.card}>
                        {error ? <Notice tone="error" message={error} /> : null}

                        <Field
                            label="Email"
                            icon="mail-outline"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            placeholder="you@example.com"
                            editable={!busy}
                        />
                        <Field
                            label="Password"
                            icon="lock-closed-outline"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholder="••••••••"
                            editable={!busy}
                        />

                        <Button
                            title="Log in"
                            icon="log-in-outline"
                            onPress={onSubmit}
                            loading={busy}
                            style={{ marginTop: spacing.sm }}
                        />
                    </Card>

                    <Pressable onPress={() => navigation.navigate('Signup')} disabled={busy} hitSlop={8}>
                        <Text style={styles.linkText}>
                            New to QuickDART? <Text style={styles.linkStrong}>Create an account</Text>
                        </Text>
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, paddingHorizontal: spacing.xl },
    card: { marginTop: -spacing.xxl },
    linkText: { textAlign: 'center', marginTop: spacing.xxl, color: colors.textMuted, fontSize: 14.5 },
    linkStrong: { color: colors.primary, fontWeight: '800' },
});
