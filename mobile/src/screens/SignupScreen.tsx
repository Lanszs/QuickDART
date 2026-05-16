import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { civilianSignup } from '../api';
import type { RootStackParamList } from '../navigation';
import { AuthHero, Button, Card, Field, Notice } from '../components/ui';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const onSubmit = async () => {
        setError('');
        if (!fullName.trim()) {
            setError('Please enter your full name.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setBusy(true);
        try {
            const normEmail = email.trim().toLowerCase();
            await civilianSignup(normEmail, password, fullName.trim());
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: normEmail,
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
            style={styles.flex}
        >
            <ScrollView
                style={styles.flex}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <AuthHero title="Create account" subtitle="You'll verify your identity in the next step." />
                <View style={styles.body}>
                    <Card style={styles.card}>
                        {error ? <Notice tone="error" message={error} /> : null}

                        <Field
                            label="Full name"
                            icon="person-outline"
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Juan Dela Cruz"
                            editable={!busy}
                        />
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
                            placeholder="at least 8 characters"
                            editable={!busy}
                        />

                        <Button
                            title="Create account"
                            icon="person-add-outline"
                            onPress={onSubmit}
                            loading={busy}
                            style={{ marginTop: spacing.sm }}
                        />
                    </Card>

                    <Pressable onPress={() => navigation.goBack()} disabled={busy} hitSlop={8}>
                        <Text style={styles.linkText}>
                            Already have an account? <Text style={styles.linkStrong}>Log in</Text>
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    card: { marginTop: -spacing.xxl },
    linkText: { textAlign: 'center', marginTop: spacing.xxl, color: colors.textMuted, fontSize: 14.5 },
    linkStrong: { color: colors.primary, fontWeight: '800' },
});
