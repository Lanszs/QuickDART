import { BACKEND_URL, NOMINATIM_USER_AGENT } from './config';
import type { AnalysisResult } from './lib/generateAIDescription';
import { getAccessToken } from './lib/supabase';

// ngrok free domains show a browser warning page unless this header is set.
const NGROK_HEADER = { 'ngrok-skip-browser-warning': '1' };

async function authHeader(): Promise<Record<string, string>> {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

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

    const auth = await authHeader();
    const res = await fetch(`${BACKEND_URL}/api/v1/analyze`, {
        method: 'POST',
        headers: { ...NGROK_HEADER, ...auth },
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
    const auth = await authHeader();
    const res = await fetch(`${BACKEND_URL}/api/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADER, ...auth },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(`Submit failed (${res.status})`);
    }
    return res.json();
}

// --- Civilian identity verification ---------------------------------------

export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export type VerificationState = {
    status: VerificationStatus;
    rejection_reason: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    full_name: string | null;
};

export const NON_CIVILIAN_ACCOUNT_ERROR = 'non_civilian_account';
const NON_CIVILIAN_DEFAULT_MESSAGE =
    'This account is registered for Authorized Personnel. Please use the Authorized Personnel login.';

export class NonCivilianAccountError extends Error {
    code = NON_CIVILIAN_ACCOUNT_ERROR;
    constructor(message?: string) {
        super(message || NON_CIVILIAN_DEFAULT_MESSAGE);
    }
}

export async function civilianSignup(email: string, password: string, fullName: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/v1/civilian/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADER },
        body: JSON.stringify({ email, password, full_name: fullName }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403 && body.status === NON_CIVILIAN_ACCOUNT_ERROR) {
            throw new NonCivilianAccountError(body.message);
        }
        throw new Error(body.error || `signup_failed_${res.status}`);
    }
}

export async function fetchVerificationStatus(): Promise<VerificationState | null> {
    const auth = await authHeader();
    if (!auth.Authorization) return null;
    const res = await fetch(`${BACKEND_URL}/api/v1/civilian/verification`, {
        headers: { ...NGROK_HEADER, ...auth },
    });
    if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body.status === NON_CIVILIAN_ACCOUNT_ERROR) {
            throw new NonCivilianAccountError(body.message);
        }
    }
    if (!res.ok) return null;
    return (await res.json()) as VerificationState;
}

export async function submitVerification(idAsset: PickedAsset, selfieAsset: PickedAsset): Promise<VerificationState> {
    const form = new FormData();
    form.append('id_document', {
        uri: idAsset.uri,
        name: guessFileName(idAsset.uri, idAsset.fileName),
        type: guessMimeType(idAsset.uri, idAsset.mimeType),
    } as unknown as Blob);
    form.append('selfie', {
        uri: selfieAsset.uri,
        name: guessFileName(selfieAsset.uri, selfieAsset.fileName),
        type: guessMimeType(selfieAsset.uri, selfieAsset.mimeType),
    } as unknown as Blob);

    const auth = await authHeader();
    const res = await fetch(`${BACKEND_URL}/api/v1/civilian/verification`, {
        method: 'POST',
        headers: { ...NGROK_HEADER, ...auth },
        body: form,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `verification_upload_failed_${res.status}`);
    }
    return (await res.json()) as VerificationState;
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
