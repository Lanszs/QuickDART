export type AnalysisResult = {
    type: string;
    damage: string;
    confidence: number | string;
    damage_confidence?: number | string;
    image_url?: string;
    source?: 'image' | 'video';
    type_distribution?: Record<string, number>;
    damage_distribution?: Record<string, number>;
    consensus_override?: boolean;
    [key: string]: unknown;
};

export function generateAIDescription(result: AnalysisResult | null | undefined): string {
    if (!result) return 'No analysis data available.';

    const type = result.type;
    const damage = result.damage;
    const conf = typeof result.confidence === 'number' ? result.confidence : parseFloat(String(result.confidence));
    const damageConf = typeof result.damage_confidence === 'number' ? result.damage_confidence : 0;
    const isVideo = result.source === 'video';

    const severityNarrative: Record<string, string> = {
        Destroyed: 'Severe structural collapse and destruction observed. Infrastructure appears critically compromised with widespread debris. Immediate emergency response is strongly recommended — area may be unsafe for civilians.',
        Major: 'Significant structural damage detected. Visible signs of heavy impact including partial collapse, large cracks, or major displacement of building materials. Urgent assessment by field teams is recommended.',
        Minor: 'Limited damage observed. Some cosmetic or superficial damage is visible, such as cracked walls, broken windows, or minor debris. The area appears largely intact but should be inspected.',
        'No Damage': 'No visible signs of structural damage detected in the analyzed media. The area appears unaffected by the reported disaster event.',
    };

    const disasterContext: Record<string, string> = {
        Flood: 'Water inundation is visible in the area. Standing floodwater may pose risks including contamination, electrical hazards, and road inaccessibility.',
        Fire: 'Evidence of fire damage is present. Burn marks, smoke residue, and charred materials indicate active or recent fire activity in the area.',
        Earthquake: 'Seismic damage patterns are evident. Indicators include ground displacement, structural fracturing, and foundation instability.',
        'No Disaster': 'The analyzed media does not show indicators of a natural disaster event.',
    };

    const parts: string[] = [];

    if (type === 'No Disaster') {
        parts.push(disasterContext['No Disaster']);
        parts.push(severityNarrative['No Damage']);
    } else {
        parts.push(disasterContext[type] || `A ${String(type).toLowerCase()} event has been identified in the area.`);
        parts.push(severityNarrative[damage] || `Damage level classified as ${damage}.`);
    }

    if (result.consensus_override) {
        parts.push('Note: The AI initially detected possible disaster indicators, but confidence was too low to make a reliable classification. The system has determined this is most likely not a disaster scene. If this assessment seems incorrect, please submit for manual review.');
    }

    if (type !== 'No Disaster') {
        if (conf >= 85 && damageConf >= 85) {
            parts.push('AI classification confidence is high — the assessment is considered reliable.');
        } else if (conf >= 60) {
            parts.push('AI classification shows moderate confidence. Manual verification by field personnel is advised to confirm the assessment.');
        } else {
            parts.push('AI classification confidence is low. This report requires manual verification — conditions may differ from the automated assessment.');
        }
    }

    if (isVideo && result.type_distribution) {
        const activeTypes = Object.entries(result.type_distribution)
            .filter(([name, pct]) => pct > 0 && name !== 'No Disaster')
            .sort((a, b) => b[1] - a[1]);
        if (activeTypes.length > 1) {
            parts.push(
                `Video analysis indicates compound disaster indicators: ${activeTypes
                    .map(([n, p]) => `${n} (${p}%)`)
                    .join(', ')}. Multiple hazard types may be present simultaneously.`
            );
        }
    }

    if (isVideo && result.damage_distribution) {
        const activeDamage = Object.entries(result.damage_distribution)
            .filter(([, pct]) => pct > 0)
            .sort((a, b) => b[1] - a[1]);
        if (activeDamage.length > 1) {
            const hasVaried = activeDamage[0][1] < 70;
            if (hasVaried) {
                parts.push(
                    `Damage levels vary across the footage (${activeDamage
                        .map(([n, p]) => `${n}: ${p}%`)
                        .join(', ')}), suggesting the affected area has uneven impact zones. Responders should be prepared for mixed conditions.`
                );
            }
        }
    }

    return parts.join(' ');
}
