import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export default function SuccessScreen({ navigation, route }: Props) {
    const { disasterType, damageLevel } = route.params;

    return (
        <View style={styles.container}>
            <View style={styles.checkBubble}>
                <Text style={styles.check}>✓</Text>
            </View>

            <Text style={styles.title}>Report Submitted</Text>
            <Text style={styles.subtitle}>
                Thank you. Emergency responders have been notified.
            </Text>

            <View style={styles.summary}>
                <Row label="Disaster" value={disasterType} />
                <Row label="Damage" value={damageLevel} />
            </View>

            <Pressable
                style={styles.primaryBtn}
                onPress={() => navigation.replace('Upload')}
            >
                <Text style={styles.primaryBtnText}>Submit Another Report</Text>
            </Pressable>
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
    container: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', padding: 24 },
    checkBubble: {
        width: 96, height: 96, borderRadius: 48, backgroundColor: '#dcfce7',
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    check: { fontSize: 56, color: '#16a34a', fontWeight: '900' },
    title: { fontSize: 24, fontWeight: '800', color: '#111827' },
    subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, textAlign: 'center' },
    summary: {
        marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: '#fff',
        borderWidth: 1, borderColor: '#e5e7eb', width: '100%',
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { color: '#6b7280' },
    rowValue: { color: '#111827', fontWeight: '700' },
    primaryBtn: {
        marginTop: 24, backgroundColor: '#2563eb', paddingVertical: 16,
        paddingHorizontal: 28, borderRadius: 16, alignSelf: 'stretch', alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
