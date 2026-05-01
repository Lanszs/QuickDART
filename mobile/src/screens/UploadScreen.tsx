import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { analyzeFile } from '../api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Upload'>;

export default function UploadScreen({ navigation }: Props) {
    const [busy, setBusy] = useState(false);

    const handleAsset = async (asset: ImagePicker.ImagePickerAsset) => {
        setBusy(true);
        try {
            const result = await analyzeFile({
                uri: asset.uri,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
                type: asset.type,
            });
            navigation.navigate('Details', {
                asset: {
                    uri: asset.uri,
                    fileName: asset.fileName,
                    mimeType: asset.mimeType,
                    type: asset.type,
                },
                analysisResult: result,
            });
        } catch (err: any) {
            Alert.alert('Analysis failed', err?.message ?? 'Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    const pickFromGallery = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Photo library access is required to attach media.');
            return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.9,
            videoMaxDuration: 30,
        });
        if (!res.canceled && res.assets?.[0]) {
            await handleAsset(res.assets[0]);
        }
    };

    const openCamera = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required to capture media.');
            return;
        }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.9,
            videoMaxDuration: 30,
        });
        if (!res.canceled && res.assets?.[0]) {
            await handleAsset(res.assets[0]);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.brand}>
                    QuickDART <Text style={styles.brandAccent}>Public</Text>
                </Text>
            </View>

            <View style={styles.body}>
                <Text style={styles.title}>Report an Incident</Text>
                <Text style={styles.subtitle}>
                    Help emergency responders by uploading a photo or video.
                </Text>

                {busy ? (
                    <View style={styles.busyBox}>
                        <ActivityIndicator size="large" color="#2563eb" />
                        <Text style={styles.busyText}>Analyzing media…</Text>
                        <Text style={styles.busySubtext}>
                            Videos take longer (10 frames analyzed).
                        </Text>
                    </View>
                ) : (
                    <>
                        <Pressable style={styles.primaryBtn} onPress={openCamera}>
                            <Text style={styles.primaryBtnText}>Open Camera</Text>
                        </Pressable>

                        <View style={styles.dividerRow}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.divider} />
                        </View>

                        <Pressable style={styles.secondaryBtn} onPress={pickFromGallery}>
                            <Text style={styles.secondaryBtnText}>Choose from Gallery</Text>
                        </Pressable>
                    </>
                )}
            </View>

            <Text style={styles.footer}>
                Anonymous report — no login required.
                {Platform.OS === 'android' ? '\nMake sure the backend is reachable on your network.' : ''}
            </Text>
        </View>
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
    title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 32,
    },
    primaryBtn: {
        backgroundColor: '#111827',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 18,
        gap: 12,
    },
    divider: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
    dividerText: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
    secondaryBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    secondaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    busyBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingVertical: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    busyText: { marginTop: 12, color: '#2563eb', fontWeight: '700', fontSize: 16 },
    busySubtext: { marginTop: 4, color: '#9ca3af', fontSize: 12 },
    footer: {
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 12,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
});
