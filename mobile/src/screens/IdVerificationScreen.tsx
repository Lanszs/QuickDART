import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { submitVerification, type PickedAsset } from '../api';
import { signOut } from '../lib/supabase';
import type { RootStackParamList } from '../navigation';
import { AppHeader, Button, Card, Notice, Screen } from '../components/ui';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'IdVerification'>;

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedAsset {
    return { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, type: asset.type };
}

export default function IdVerificationScreen({ navigation, route }: Props) {
    const rejectionReason = route.params?.rejectionReason ?? null;

    const [idAsset, setIdAsset] = useState<PickedAsset | null>(null);
    const [selfieAsset, setSelfieAsset] = useState<PickedAsset | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const pickIdFromGallery = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Photo library access is required.');
            return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
        if (!res.canceled && res.assets?.[0]) setIdAsset(toPicked(res.assets[0]));
    };

    const captureIdFromCamera = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required.');
            return;
        }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.9,
            cameraType: ImagePicker.CameraType.back,
        });
        if (!res.canceled && res.assets?.[0]) setIdAsset(toPicked(res.assets[0]));
    };

    const captureSelfie = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required for the selfie.');
            return;
        }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.9,
            cameraType: ImagePicker.CameraType.front,
        });
        if (!res.canceled && res.assets?.[0]) setSelfieAsset(toPicked(res.assets[0]));
    };

    const onSubmit = async () => {
        if (!idAsset || !selfieAsset) return;
        setSubmitting(true);
        try {
            const state = await submitVerification(idAsset, selfieAsset);
            navigation.reset({
                index: 0,
                routes: [{ name: 'VerificationPending', params: { submittedAt: state.submitted_at } }],
            });
        } catch (e: any) {
            Alert.alert('Upload failed', e?.message ?? 'Could not submit your documents.');
        } finally {
            setSubmitting(false);
        }
    };

    const onSignOut = async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    const ready = !!idAsset && !!selfieAsset && !submitting;

    const Step = ({ done, num, label }: { done: boolean; num: number; label: string }) => (
        <View style={styles.step}>
            <View style={[styles.stepDot, done && styles.stepDotDone]}>
                {done ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                    <Text style={styles.stepNum}>{num}</Text>
                )}
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{label}</Text>
        </View>
    );

    return (
        <View style={styles.flex}>
            <AppHeader subtitle="Identity verification" onSignOut={onSignOut} />
            <Screen scroll>
                {rejectionReason ? (
                    <Notice
                        tone="error"
                        title="Previous submission rejected"
                        message={`${rejectionReason}\n\nPlease re-upload your documents.`}
                    />
                ) : null}

                <Text style={styles.title}>Verify your identity</Text>
                <Text style={styles.lead}>
                    A commander reviews your documents before you can file reports. This keeps the
                    response queue trustworthy.
                </Text>

                <View style={styles.steps}>
                    <Step done={!!idAsset} num={1} label="Government ID" />
                    <View style={styles.stepBar} />
                    <Step done={!!selfieAsset} num={2} label="Live selfie" />
                </View>

                <Card style={styles.slot}>
                    <View style={styles.slotHead}>
                        <Ionicons name="card-outline" size={18} color={colors.primary} />
                        <Text style={styles.slotTitle}>Government ID</Text>
                        {idAsset ? (
                            <View style={styles.chip}>
                                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                <Text style={styles.chipText}>Added</Text>
                            </View>
                        ) : null}
                    </View>
                    {idAsset ? (
                        <>
                            <Image source={{ uri: idAsset.uri }} style={styles.preview} resizeMode="contain" />
                            <Pressable onPress={() => setIdAsset(null)} hitSlop={8} style={styles.changeBtn}>
                                <Ionicons name="refresh" size={15} color={colors.textMuted} />
                                <Text style={styles.changeText}>Choose a different image</Text>
                            </Pressable>
                        </>
                    ) : (
                        <View style={styles.btnRow}>
                            <Button title="Camera" icon="camera-outline" variant="secondary" onPress={captureIdFromCamera} style={styles.half} />
                            <Button title="Gallery" icon="images-outline" variant="secondary" onPress={pickIdFromGallery} style={styles.half} />
                        </View>
                    )}
                </Card>

                <Card style={styles.slot}>
                    <View style={styles.slotHead}>
                        <Ionicons name="happy-outline" size={18} color={colors.primary} />
                        <Text style={styles.slotTitle}>Live selfie</Text>
                        {selfieAsset ? (
                            <View style={styles.chip}>
                                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                <Text style={styles.chipText}>Added</Text>
                            </View>
                        ) : null}
                    </View>
                    {selfieAsset ? (
                        <>
                            <Image source={{ uri: selfieAsset.uri }} style={styles.preview} resizeMode="contain" />
                            <Pressable onPress={() => setSelfieAsset(null)} hitSlop={8} style={styles.changeBtn}>
                                <Ionicons name="refresh" size={15} color={colors.textMuted} />
                                <Text style={styles.changeText}>Retake</Text>
                            </Pressable>
                        </>
                    ) : (
                        <Button title="Open selfie camera" icon="camera-reverse-outline" variant="secondary" onPress={captureSelfie} />
                    )}
                </Card>

                <Button
                    title="Submit for review"
                    icon="shield-checkmark"
                    onPress={onSubmit}
                    loading={submitting}
                    disabled={!ready}
                    style={{ marginTop: spacing.lg }}
                />
            </Screen>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    title: { ...typography.display, marginBottom: spacing.xs },
    lead: { ...typography.subtitle, marginBottom: spacing.xl },

    steps: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
    step: { alignItems: 'center', gap: 6 },
    stepDot: {
        width: 30,
        height: 30,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1.5,
        borderColor: colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
    stepNum: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
    stepLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    stepLabelDone: { color: colors.text },
    stepBar: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: spacing.md, marginBottom: 18 },

    slot: { marginBottom: spacing.lg },
    slotHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    slotTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.successSoft,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        borderRadius: radius.pill,
    },
    chipText: { fontSize: 11, fontWeight: '800', color: colors.success },
    btnRow: { flexDirection: 'row', gap: spacing.md },
    half: { flex: 1 },
    preview: {
        width: '100%',
        height: 210,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
    },
    changeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: spacing.md,
    },
    changeText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
});
