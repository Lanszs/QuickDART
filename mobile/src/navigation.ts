import type { AnalysisResult } from './lib/generateAIDescription';
import type { PickedAsset } from './api';

export type RootStackParamList = {
    AuthLoading: undefined;
    Login: undefined;
    Signup: undefined;
    IdVerification: { rejectionReason?: string | null } | undefined;
    VerificationPending: { submittedAt?: string | null } | undefined;
    Upload: undefined;
    Details: {
        asset: PickedAsset;
        analysisResult: AnalysisResult;
    };
    Success: {
        disasterType: string;
        damageLevel: string;
    };
};
