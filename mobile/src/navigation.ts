import type { AnalysisResult } from './lib/generateAIDescription';
import type { PickedAsset } from './api';

export type RootStackParamList = {
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
