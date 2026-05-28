import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { analyzeFile } from '../api';
import { signOut } from '../lib/supabase';
import type { RootStackParamList } from '../navigation';
import { ActionTile, AppHeader, Card, Screen, SectionLabel } from '../components/ui';
import { colors, spacing, typography } from '../theme';

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

    const pickFromGallery = async (mediaTypes: ImagePicker.MediaType[]) => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Photo library access is required to attach media.');
            return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes,
            quality: 0.9,
            videoMaxDuration: 30,
        });
        if (!res.canceled && res.assets?.[0]) await handleAsset(res.assets[0]);
    };

    const openCamera = async (mediaTypes: ImagePicker.MediaType[]) => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required to capture media.');
            return;
        }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes,
            quality: 0.9,
            videoMaxDuration: 30,
        });
        if (!res.canceled && res.assets?.[0]) await handleAsset(res.assets[0]);
    };

    const onSignOut = async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    return (
        <View style={styles.flex}>
            <AppHeader subtitle="Report an incident" onSignOut={onSignOut} />
            <Screen scroll>
                {busy ? (
                    <Card style={styles.busyCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.busyText}>Analyzing media…</Text>
                        <Text style={styles.busySub}>Videos take longer — 10 frames are analyzed.</Text>
                    </Card>
                ) : (
                    <>
                        <Text style={styles.title}>Report an Incident</Text>
                        <Text style={styles.subtitle}>
                            Capture or attach a photo or video of the scene. Our AI assesses the
                            disaster type and damage automatically.
                        </Text>

                        <SectionLabel>Capture now</SectionLabel>
                        <ActionTile
                            icon="camera"
                            title="Take a photo"
                            subtitle="Use your camera to snap the scene"
                            onPress={() => openCamera(['images'])}
                            accent
                        />
                        <ActionTile
                            icon="videocam"
                            title="Record a video"
                            subtitle="Up to 30 seconds of footage"
                            onPress={() => openCamera(['videos'])}
                        />

                        <View style={{ height: spacing.lg }} />
                        <SectionLabel>From your device</SectionLabel>
                        <ActionTile
                            icon="image"
                            title="Choose a photo"
                            subtitle="Pick an existing image"
                            onPress={() => pickFromGallery(['images'])}
                        />
                        <ActionTile
                            icon="film"
                            title="Choose a video"
                            subtitle="Pick an existing clip"
                            onPress={() => pickFromGallery(['videos'])}
                        />

                        <View style={styles.footerRow}>
                            <Text style={styles.footer}>Reports are linked to your verified account.</Text>
                        </View>
                    </>
                )}
            </Screen>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    title: { ...typography.display, marginBottom: spacing.xs },
    subtitle: { ...typography.subtitle, marginBottom: spacing.xxl },
    busyCard: { alignItems: 'center', paddingVertical: spacing.huge, marginTop: spacing.huge },
    busyText: { marginTop: spacing.lg, color: colors.text, fontWeight: '800', fontSize: 17 },
    busySub: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 13 },
    footerRow: { marginTop: spacing.xxl, alignItems: 'center' },
    footer: { color: colors.textFaint, fontSize: 12.5 },
});
