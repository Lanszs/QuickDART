import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
            >
                <View style={styles.previewBox}>
                    {!isVideo ? (
                        <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
                    ) : (
                        <View style={[styles.preview, styles.videoPlaceholder]}>
                            <Text style={styles.videoLabel}>VIDEO</Text>
                        </View>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>AI Analysis</Text>
                    <View style={styles.badgeRow}>
                        <View style={[styles.badge, analysisResult.type === 'No Disaster' ? styles.badgeGreen : styles.badgeRed]}>
                            <Text style={styles.badgeText}>{String(analysisResult.type).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.confidenceLabel}>Confidence: {confidenceText}</Text>
                    </View>
                    <Row label="Damage level" value={String(analysisResult.damage)} />

                    {analysisResult.type_distribution && (
                        <DistributionBar
                            title="Disaster Type Distribution"
                            distribution={analysisResult.type_distribution as Record<string, number>}
                            colorMap={{ Earthquake: '#f59e0b', Fire: '#ef4444', Flood: '#3b82f6', 'No Disaster': '#22c55e' }}
                        />
                    )}
                    {analysisResult.damage_distribution && (
                        <DistributionBar
                            title="Damage Distribution"
                            distribution={analysisResult.damage_distribution as Record<string, number>}
                            colorMap={{ Destroyed: '#dc2626', Major: '#f97316', Minor: '#eab308', 'No Damage': '#22c55e' }}
                        />
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Location</Text>
                    {locating ? (
                        <View style={styles.locatingRow}>
                            <ActivityIndicator color="#2563eb" />
                            <Text style={styles.locatingText}>Getting your GPS location…</Text>
                        </View>
                    ) : null}

                    <TextInput
                        style={[styles.input, locationError && styles.inputError]}
                        placeholder="Enter address or landmark"
                        placeholderTextColor="#9ca3af"
                        value={location}
                        onChangeText={onChangeLocation}
                        autoCorrect={false}
                    />
                    {locationError ? (
                        <Text style={styles.errorText}>Location is required.</Text>
                    ) : null}

                    {searching ? (
                        <Text style={styles.searchingText}>Searching…</Text>
                    ) : null}

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
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Description (optional)</Text>
                    <TextInput
                        style={[styles.input, styles.textarea]}
                        placeholder="Add details — leave blank to use the AI-generated summary."
                        placeholderTextColor="#9ca3af"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                    />
                </View>

                <Pressable
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.submitBtnText}>Submit Report</Text>
                    )}
                </Pressable>
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
                        style={[distStyles.segment, { flex: pct, backgroundColor: colorMap[name] ?? '#9ca3af' }]}
                    />
                ))}
            </View>
            <View style={distStyles.labels}>
                {entries.map(([name, pct]) => (
                    <View key={name} style={distStyles.labelItem}>
                        <View style={[distStyles.dot, { backgroundColor: colorMap[name] ?? '#9ca3af' }]} />
                        <Text style={distStyles.labelText}>{name}: {pct}%</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const distStyles = StyleSheet.create({
    wrapper: { marginTop: 12 },
    title: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 },
    bar: {
        flexDirection: 'row',
        height: 10,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#f3f4f6',
    },
    segment: { height: 10 },
    labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    labelItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    labelText: { fontSize: 11, color: '#6b7280' },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    scroll: { padding: 16, paddingBottom: 48 },
    previewBox: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000',
        marginBottom: 16,
    },
    preview: { width: '100%', height: 200 },
    videoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    videoLabel: { color: '#fff', fontWeight: '800', letterSpacing: 2 },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cardTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { color: '#6b7280', fontSize: 14 },
    rowValue: { color: '#111827', fontSize: 14, fontWeight: '600' },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111827',
        backgroundColor: '#fff',
    },
    inputError: { borderColor: '#ef4444' },
    errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
    textarea: { minHeight: 110 },
    locatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    locatingText: { color: '#2563eb', fontSize: 13 },
    searchingText: { fontSize: 12, color: '#6b7280', marginTop: 6 },
    suggestions: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    suggestionText: { fontSize: 13, color: '#1f2937' },
    coords: { marginTop: 6, fontSize: 11, color: '#9ca3af', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    submitBtn: {
        marginTop: 8,
        backgroundColor: '#2563eb',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeRed: { backgroundColor: '#ef4444' },
    badgeGreen: { backgroundColor: '#22c55e' },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    confidenceLabel: { fontSize: 13, color: '#6b7280' },
});
