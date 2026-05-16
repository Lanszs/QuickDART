import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { submitVerification, type PickedAsset } from '../api';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'IdVerification'>;

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedAsset {
    return {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        type: asset.type,
    };
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
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.9,
        });
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
        // Front camera + no gallery option → forces a live capture.
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
        await supabase.auth.signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    const ready = idAsset && selfieAsset && !submitting;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
                <Text style={styles.brand}>Identity Verification</Text>
                <Pressable onPress={onSignOut}>
                    <Text style={styles.signOut}>Sign out</Text>
                </Pressable>
            </View>

            {rejectionReason ? (
                <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionTitle}>Previous submission rejected</Text>
                    <Text style={styles.rejectionText}>{rejectionReason}</Text>
                    <Text style={styles.rejectionHint}>Please re-upload your documents.</Text>
                </View>
            ) : null}

            <Text style={styles.intro}>
                Upload a clear photo of a government-issued ID and take a live selfie. A Commander
                will review your submission before you can submit reports.
            </Text>

            <Text style={styles.sectionLabel}>Government ID</Text>
            {idAsset ? (
                <View style={styles.previewBox}>
                    <Image source={{ uri: idAsset.uri }} style={styles.preview} resizeMode="contain" />
                    <Pressable onPress={() => setIdAsset(null)}>
                        <Text style={styles.retake}>Choose a different image</Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.btnRow}>
                    <Pressable style={[styles.secondaryBtn, styles.btnHalf]} onPress={captureIdFromCamera}>
                        <Text style={styles.secondaryBtnText}>Take Photo</Text>
                    </Pressable>
                    <Pressable style={[styles.secondaryBtn, styles.btnHalf]} onPress={pickIdFromGallery}>
                        <Text style={styles.secondaryBtnText}>From Gallery</Text>
                    </Pressable>
                </View>
            )}

            <Text style={styles.sectionLabel}>Live Selfie</Text>
            {selfieAsset ? (
                <View style={styles.previewBox}>
                    <Image source={{ uri: selfieAsset.uri }} style={styles.preview} resizeMode="contain" />
                    <Pressable onPress={() => setSelfieAsset(null)}>
                        <Text style={styles.retake}>Retake</Text>
                    </Pressable>
                </View>
            ) : (
                <Pressable style={styles.primaryBtn} onPress={captureSelfie}>
                    <Text style={styles.primaryBtnText}>Open Selfie Camera</Text>
                </Pressable>
            )}

            <Pressable
                style={[styles.submitBtn, !ready && styles.btnDisabled]}
                onPress={onSubmit}
                disabled={!ready}
            >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for review</Text>}
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    scroll: { padding: 20, paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    brand: { fontSize: 20, fontWeight: '800', color: '#111827' },
    signOut: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
    intro: { color: '#6b7280', fontSize: 14, marginBottom: 18, lineHeight: 20 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 18,
        marginBottom: 8,
    },
    btnRow: { flexDirection: 'row', gap: 10 },
    btnHalf: { flex: 1 },
    primaryBtn: {
        backgroundColor: '#111827',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    secondaryBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    secondaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    previewBox: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
    },
    preview: {
        width: '100%',
        height: 220,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
    },
    retake: { marginTop: 10, color: '#6b7280', fontSize: 13, fontWeight: '600' },
    submitBtn: {
        backgroundColor: '#16a34a',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 28,
    },
    btnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    rejectionBox: {
        backgroundColor: '#fee2e2',
        borderColor: '#fecaca',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    rejectionTitle: { color: '#991b1b', fontWeight: '800', fontSize: 14, marginBottom: 4 },
    rejectionText: { color: '#7f1d1d', fontSize: 13 },
    rejectionHint: { color: '#991b1b', fontSize: 12, marginTop: 6, fontWeight: '600' },
});
