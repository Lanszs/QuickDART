import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import * as Location from 'expo-location';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
    NominatimResult,
    ReportPayload,
    reverseGeocode,
    searchAddress,
    submitReport,
} from '../api';
import { generateAIDescription } from '../lib/generateAIDescription';
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from '../config';
import type { RootStackParamList } from '../navigation';
import { Button, Card, SectionLabel } from '../components/ui';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Details'>;

export default function DetailsScreen({ route, navigation }: Props) {
    const { asset, analysisResult } = route.params;

    const [locating, setLocating] = useState(true);
    const [location, setLocation] = useState('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [locationError, setLocationError] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isVideo = asset.type === 'video';

    const videoPlayer = useVideoPlayer(isVideo ? { uri: asset.uri } : null, (player) => {
        player.loop = false;
        player.muted = false;
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const perm = await Location.requestForegroundPermissionsAsync();
                if (!perm.granted) {
                    if (!cancelled) {
                        setLocating(false);
                        setLocation('');
                    }
                    return;
                }
                const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                if (cancelled) return;
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setLatitude(lat);
                setLongitude(lng);
                const address = await reverseGeocode(lat, lng);
                if (cancelled) return;
                if (address) {
                    setLocation(address);
                    setSelectedAddress(address);
                } else {
                    setLocation(`GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                }
            } catch {
                if (!cancelled) setLocation('');
            } finally {
                if (!cancelled) setLocating(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (
            !location ||
            location === selectedAddress ||
            location.startsWith('GPS:') ||
            location.includes('Requesting')
        ) {
            setSuggestions([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await searchAddress(location);
                setSuggestions(results);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [location, selectedAddress]);

    const handleSelectSuggestion = (item: NominatimResult) => {
        const shortName = item.display_name.split(',')[0];
        setLocation(shortName);
        setSelectedAddress(shortName);
        setLatitude(parseFloat(item.lat));
        setLongitude(parseFloat(item.lon));
        setSuggestions([]);
        setLocationError(false);
    };

    const onChangeLocation = (text: string) => {
        setLocation(text);
        setSelectedAddress('');
        if (text.trim() !== '') setLocationError(false);
    };

    const aiDescription = useMemo(
        () => generateAIDescription(analysisResult),
        [analysisResult]
    );

    const handleSubmit = async () => {
        if (!location.trim() || location.includes('Requesting')) {
            setLocationError(true);
            return;
        }
        const conf =
            typeof analysisResult.confidence === 'number'
                ? analysisResult.confidence
                : parseFloat(String(analysisResult.confidence));

        const payload: ReportPayload = {
            title: `Public Report: ${analysisResult.type}`,
            description: description.trim() || aiDescription,
            status: 'Pending',
            location,
            latitude: latitude ?? DEFAULT_LATITUDE,
            longitude: longitude ?? DEFAULT_LONGITUDE,
            damage_level: String(analysisResult.damage),
            image_url: String(analysisResult.image_url ?? ''),
            disaster_type: String(analysisResult.type),
            confidence: isNaN(conf) ? 0 : conf,
            analysis_metadata: JSON.stringify(analysisResult),
        };

        setSubmitting(true);
        try {
            await submitReport(payload);
            navigation.replace('Success', {
                disasterType: payload.disaster_type,
                damageLevel: payload.damage_level,
                mediaUrl: payload.image_url || asset.uri,
                isVideo,
            });
        } catch (err: any) {
            Alert.alert('Submission failed', err?.message ?? 'Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const confidenceText =
        typeof analysisResult.confidence === 'number'
            ? `${analysisResult.confidence.toFixed(1)}%`
            : `${parseFloat(String(analysisResult.confidence)).toFixed(1)}%`;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.previewBox}>
                    {!isVideo ? (
                        <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
                    ) : (
                        <VideoView
                            player={videoPlayer}
                            style={styles.preview}
                            contentFit="cover"
                            nativeControls
                        />
                    )}
                </View>

                <Card style={styles.card}>
                    <SectionLabel>AI analysis</SectionLabel>
                    <View style={styles.badgeRow}>
                        <View
                            style={[
                                styles.badge,
                                analysisResult.type === 'No Disaster' ? styles.badgeGreen : styles.badgeRed,
                            ]}
                        >
                            <Text style={styles.badgeText}>{String(analysisResult.type).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.confidenceLabel}>Confidence: {confidenceText}</Text>
                    </View>
                    <Row label="Damage level" value={String(analysisResult.damage)} />

                    {analysisResult.type_distribution && (
                        <DistributionBar
                            title="Disaster type distribution"
                            distribution={analysisResult.type_distribution as Record<string, number>}
                            colorMap={{ Earthquake: '#F59E0B', Fire: '#EF4444', Flood: '#3B82F6', 'No Disaster': '#22C55E' }}
                        />
                    )}
                    {analysisResult.damage_distribution && (
                        <DistributionBar
                            title="Damage distribution"
                            distribution={analysisResult.damage_distribution as Record<string, number>}
                            colorMap={{ Destroyed: '#DC2626', Major: '#F97316', Minor: '#EAB308', 'No Damage': '#22C55E' }}
                        />
                    )}
                </Card>

                <Card style={styles.card}>
                    <SectionLabel>Location</SectionLabel>
                    {locating ? (
                        <Text style={styles.locatingText}>Getting your GPS location…</Text>
                    ) : null}

                    <TextInput
                        style={[styles.input, locationError && styles.inputError]}
                        placeholder="Enter address or landmark"
                        placeholderTextColor={colors.textFaint}
                        value={location}
                        onChangeText={onChangeLocation}
                        autoCorrect={false}
                    />
                    {locationError ? <Text style={styles.errorText}>Location is required.</Text> : null}
                    {searching ? <Text style={styles.searchingText}>Searching…</Text> : null}

                    {suggestions.length > 0 ? (
                        <View style={styles.suggestions}>
                            <FlatList
                                data={suggestions}
                                keyExtractor={(item, idx) => `${item.lat}-${item.lon}-${idx}`}
                                renderItem={({ item }) => (
                                    <Pressable
                                        style={styles.suggestionItem}
                                        onPress={() => handleSelectSuggestion(item)}
                                    >
                                        <Text style={styles.suggestionText} numberOfLines={2}>
                                            {item.display_name}
                                        </Text>
                                    </Pressable>
                                )}
                                scrollEnabled={false}
                            />
                        </View>
                    ) : null}

                    {latitude !== null && longitude !== null ? (
                        <Text style={styles.coords}>
                            {latitude.toFixed(5)}, {longitude.toFixed(5)}
                        </Text>
                    ) : null}
                </Card>

                <Card style={styles.card}>
                    <SectionLabel>Description (optional)</SectionLabel>
                    <TextInput
                        style={[styles.input, styles.textarea]}
                        placeholder="Add details — leave blank to use the AI-generated summary."
                        placeholderTextColor={colors.textFaint}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                    />
                </Card>

                <Button
                    title="Submit report"
                    icon="send"
                    onPress={handleSubmit}
                    loading={submitting}
                    style={{ marginTop: spacing.xs }}
                />
            </ScrollView>
        </KeyboardAvoidingView>
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

function DistributionBar({
    title,
    distribution,
    colorMap,
}: {
    title: string;
    distribution: Record<string, number>;
    colorMap: Record<string, string>;
}) {
    const entries = Object.entries(distribution).filter(([, pct]) => pct > 0);
    if (entries.length === 0) return null;

    return (
        <View style={distStyles.wrapper}>
            <Text style={distStyles.title}>{title}</Text>
            <View style={distStyles.bar}>
                {entries.map(([name, pct]) => (
                    <View
                        key={name}
                        style={[distStyles.segment, { flex: pct, backgroundColor: colorMap[name] ?? colors.textFaint }]}
                    />
                ))}
            </View>
            <View style={distStyles.labels}>
                {entries.map(([name, pct]) => (
                    <View key={name} style={distStyles.labelItem}>
                        <View style={[distStyles.dot, { backgroundColor: colorMap[name] ?? colors.textFaint }]} />
                        <Text style={distStyles.labelText}>{name}: {pct}%</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const distStyles = StyleSheet.create({
    wrapper: { marginTop: spacing.md },
    title: { ...typography.sectionLabel, marginBottom: spacing.sm },
    bar: {
        flexDirection: 'row',
        height: 10,
        borderRadius: radius.sm,
        overflow: 'hidden',
        backgroundColor: colors.surfaceAlt,
    },
    segment: { height: 10 },
    labels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    labelItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4 },
    labelText: { fontSize: 11, color: colors.textMuted },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    previewBox: {
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: '#000',
        marginBottom: spacing.lg,
    },
    preview: { width: '100%', height: 200 },
    card: { marginBottom: spacing.md },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
    rowLabel: { color: colors.textMuted, fontSize: 14 },
    rowValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        fontSize: 15,
        color: colors.text,
        backgroundColor: colors.surface,
    },
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, fontWeight: '600' },
    textarea: { minHeight: 110 },
    locatingText: { color: colors.primary, fontSize: 13, marginBottom: spacing.sm },
    searchingText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
    suggestions: {
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceAlt,
    },
    suggestionText: { fontSize: 13, color: colors.text },
    coords: {
        marginTop: spacing.sm,
        fontSize: 11,
        color: colors.textFaint,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
    badgeRed: { backgroundColor: colors.danger },
    badgeGreen: { backgroundColor: colors.success },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    confidenceLabel: { fontSize: 13, color: colors.textMuted },
});
