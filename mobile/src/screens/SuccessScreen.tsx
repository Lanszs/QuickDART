import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from '../lib/supabase';
import type { RootStackParamList } from '../navigation';
import { AppHeader, Button, Card, IconBadge, Screen } from '../components/ui';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export default function SuccessScreen({ navigation, route }: Props) {
    const { disasterType, damageLevel } = route.params;

    const onSignOut = async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    return (
        <View style={styles.flex}>
            <AppHeader subtitle="Report submitted" onSignOut={onSignOut} />
            <Screen contentStyle={styles.center}>
                <IconBadge icon="checkmark-circle" tone="success" />
                <Text style={styles.title}>Report submitted</Text>
                <Text style={styles.subtitle}>
                    Thank you. Emergency responders have been notified and your report is in the queue.
                </Text>

                <Card style={styles.summary}>
                    <Row label="Disaster type" value={disasterType} />
                    <View style={styles.hr} />
                    <Row label="Damage level" value={damageLevel} />
                </Card>

                <Button
                    title="Submit another report"
                    icon="add-circle-outline"
                    onPress={() => navigation.replace('Upload')}
                    style={styles.btn}
                />
            </Screen>
        </View>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: { ...typography.display },
    subtitle: { ...typography.subtitle, marginTop: spacing.sm, textAlign: 'center' },
    summary: { marginTop: spacing.xxl, width: '100%' },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
    rowLabel: { color: colors.textMuted, fontSize: 14 },
    rowValue: { color: colors.text, fontWeight: '800', fontSize: 14 },
    hr: { height: 1, backgroundColor: colors.border },
    btn: { marginTop: spacing.xxl, alignSelf: 'stretch' },
});
