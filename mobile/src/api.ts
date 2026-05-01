import { BACKEND_URL, NOMINATIM_USER_AGENT } from './config';
import type { AnalysisResult } from './lib/generateAIDescription';

// ngrok free domains show a browser warning page unless this header is set.
const NGROK_HEADER = { 'ngrok-skip-browser-warning': '1' };

export type PickedAsset = {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    type?: string | null;
};

export type ReportPayload = {
    title: string;
    description: string;
    status: string;
    location: string;
    latitude: number;
    longitude: number;
    damage_level: string;
    image_url: string;
    disaster_type: string;
    confidence: number;
    analysis_metadata: string;
};

export type NominatimResult = {
    display_name: string;
    lat: string;
    lon: string;
};

function guessMimeType(uri: string, fallback?: string | null): string {
    if (fallback) return fallback;
    const ext = uri.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        heic: 'image/heic',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        mkv: 'video/x-matroska',
        webm: 'video/webm',
    };
    return map[ext] ?? 'application/octet-stream';
}

function guessFileName(uri: string, fallback?: string | null): string {
    if (fallback) return fallback;
    const last = uri.split('/').pop() ?? `upload_${Date.now()}`;
    return last.includes('.') ? last : `${last}.jpg`;
}

export async function analyzeFile(asset: PickedAsset): Promise<AnalysisResult> {
    const form = new FormData();
    const name = guessFileName(asset.uri, asset.fileName);
    const type = guessMimeType(asset.uri, asset.mimeType);

    // React Native FormData accepts { uri, name, type } objects.
    form.append('file', {
        uri: asset.uri,
        name,
        type,
    } as unknown as Blob);

    const res = await fetch(`${BACKEND_URL}/api/v1/analyze`, {
        method: 'POST',
        headers: NGROK_HEADER,
        body: form,
    });

    if (!res.ok) {
        let message = `Analyze failed (${res.status})`;
        try {
            const err = await res.json();
            if (err?.error) message = err.error;
        } catch {
            // ignore
        }
        throw new Error(message);
    }
    return (await res.json()) as AnalysisResult;
}

export async function submitReport(payload: ReportPayload): Promise<{ id: number } & Record<string, unknown>> {
    const res = await fetch(`${BACKEND_URL}/api/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADER },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(`Submit failed (${res.status})`);
    }
    return res.json();
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.display_name) {
        return String(data.display_name).split(',').slice(0, 4).join(',');
    }
    return null;
}

export async function searchAddress(query: string): Promise<NominatimResult[]> {
    const q = `${query}, Philippines`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`;
    const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_USER_AGENT } });
    if (!res.ok) return [];
    return (await res.json()) as NominatimResult[];
}
