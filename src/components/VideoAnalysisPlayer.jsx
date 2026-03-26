import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Layers, Box } from 'lucide-react';

const VideoAnalysisPlayer = ({ videoUrl, frameAnalyses, videoDuration, totalFrames }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animFrameRef = useRef(null);

    const [showOverlay, setShowOverlay] = useState(true);
    const [overlayMode, setOverlayMode] = useState('bbox'); // 'bbox' or 'heatmap'
    const [currentFrameData, setCurrentFrameData] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // Map video time to closest analyzed frame
    const getFrameForTime = useCallback((currentTime) => {
        if (!frameAnalyses || frameAnalyses.length === 0 || !videoDuration) return null;

        const frameInterval = videoDuration / totalFrames;
        const frameIndex = Math.min(
            Math.floor(currentTime / frameInterval),
            frameAnalyses.length - 1
        );
        return frameAnalyses[Math.max(0, frameIndex)];
    }, [frameAnalyses, videoDuration, totalFrames]);

    // Resize canvas to match video display size
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setCanvasSize({ width, height });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Draw overlays on canvas
    const drawOverlay = useCallback(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || !showOverlay) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        const frameData = getFrameForTime(video.currentTime);
        if (!frameData) return;

        setCurrentFrameData(frameData);

        if (overlayMode === 'bbox') {
            drawBoundingBoxes(ctx, frameData, width, height);
        } else {
            drawHeatmap(ctx, frameData, width, height);
        }

        // Draw frame info legend
        drawLegend(ctx, frameData, width, height);
    }, [showOverlay, overlayMode, getFrameForTime]);

    // Animation loop for smooth rendering
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => {
            const render = () => {
                drawOverlay();
                animFrameRef.current = requestAnimationFrame(render);
            };
            render();
        };

        const onPause = () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
            drawOverlay(); // Draw once more on pause
        };

        const onSeeked = () => drawOverlay();

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('timeupdate', drawOverlay);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('timeupdate', drawOverlay);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [drawOverlay]);

    // Redraw when canvas size or overlay settings change
    useEffect(() => {
        drawOverlay();
    }, [canvasSize, showOverlay, overlayMode, drawOverlay]);

    return (
        <div className="relative w-full h-full" ref={containerRef}>
            <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full object-cover"
            >
                Your browser does not support video playback.
            </video>

            {/* Canvas overlay */}
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 10 }}
            />

            {/* Controls overlay (bottom-left) */}
            <div className="absolute bottom-12 left-2 flex gap-1 z-20">
                <button
                    onClick={() => setShowOverlay(!showOverlay)}
                    className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors"
                    title={showOverlay ? "Hide AI overlay" : "Show AI overlay"}
                >
                    {showOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                {showOverlay && (
                    <button
                        onClick={() => setOverlayMode(overlayMode === 'bbox' ? 'heatmap' : 'bbox')}
                        className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors"
                        title={overlayMode === 'bbox' ? "Switch to heatmap" : "Switch to bounding box"}
                    >
                        {overlayMode === 'bbox' ? <Layers size={14} /> : <Box size={14} />}
                    </button>
                )}
            </div>

            {/* Frame timeline bar */}
            {frameAnalyses && frameAnalyses.length > 1 && (
                <div className="absolute bottom-1 left-12 right-12 h-1.5 bg-black/30 rounded-full z-20 flex overflow-hidden">
                    {frameAnalyses.map((frame, idx) => {
                        const typeColors = {
                            Earthquake: '#f59e0b',
                            Fire: '#ef4444',
                            Flood: '#3b82f6'
                        };
                        return (
                            <div
                                key={idx}
                                className="h-full cursor-pointer hover:opacity-80 transition-opacity"
                                title={`Frame ${idx + 1}: ${frame.type} (${frame.type_conf}%) - ${frame.damage}`}
                                onClick={() => {
                                    if (videoRef.current && videoDuration) {
                                        const time = (idx / totalFrames) * videoDuration;
                                        videoRef.current.currentTime = time;
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: typeColors[frame.type] || '#6b7280',
                                    borderRight: idx < frameAnalyses.length - 1 ? '1px solid rgba(0,0,0,0.3)' : 'none',
                                    pointerEvents: 'auto'
                                }}
                            />
                        );
                    })}
                </div>
            )}

            {/* Current frame info badge */}
            {showOverlay && currentFrameData && (
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg z-20 pointer-events-none">
                    <span className="font-bold">{currentFrameData.type}</span> {currentFrameData.type_conf}% | <span className="font-bold">{currentFrameData.damage}</span> {currentFrameData.damage_conf}%
                    {currentFrameData.damage_bboxes && currentFrameData.damage_bboxes.length > 1 && (
                        <span className="ml-1 text-indigo-300">| {currentFrameData.damage_bboxes.length} regions</span>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Drawing helper functions ---

function drawBoundingBoxes(ctx, frameData, width, height) {
    // Type bounding box (red/orange)
    if (frameData.type_bbox) {
        const bbox = frameData.type_bbox;
        const x = bbox.x * width;
        const y = bbox.y * height;
        const w = bbox.w * width;
        const h = bbox.h * height;

        // Semi-transparent fill
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.fillRect(x, y, w, h);

        // Border
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, w, h);

        // Label
        const label = `${frameData.type} ${frameData.type_conf}%`;
        drawLabel(ctx, label, x, y - 2, '#ef4444');
    }

    // Damage bounding boxes (blue/purple) — supports multiple regions
    const damageBboxes = frameData.damage_bboxes && frameData.damage_bboxes.length > 0
        ? frameData.damage_bboxes
        : (frameData.damage_bbox ? [frameData.damage_bbox] : []);

    damageBboxes.forEach((bbox, idx) => {
        const x = bbox.x * width;
        const y = bbox.y * height;
        const w = bbox.w * width;
        const h = bbox.h * height;

        // Opacity scales with intensity if available
        const alpha = bbox.intensity ? (0.08 + bbox.intensity * 0.12) : 0.12;
        ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        ctx.fillRect(x, y, w, h);

        // Border (dashed to differentiate)
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Label at bottom
        const regionLabel = damageBboxes.length > 1 ? ` #${idx + 1}` : '';
        const label = `${frameData.damage} ${frameData.damage_conf}%${regionLabel}`;
        drawLabel(ctx, label, x, y + h + 14, '#6366f1');
    });
}

function drawHeatmap(ctx, frameData, width, height) {
    const heatmapData = frameData.type_heatmap;
    if (!heatmapData || heatmapData.length === 0) return;

    const hH = heatmapData.length;
    const hW = heatmapData[0].length;
    const cellW = width / hW;
    const cellH = height / hH;

    for (let r = 0; r < hH; r++) {
        for (let c = 0; c < hW; c++) {
            const val = heatmapData[r][c];
            if (val < 0.1) continue; // Skip low activation

            // Jet-like colormap: blue -> cyan -> green -> yellow -> red
            const { red, green, blue } = jetColormap(val);
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${val * 0.55})`;
            ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
        }
    }

    // Label
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(width - 160, 4, 156, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('AI Attention Heatmap', width - 8, 17);
    ctx.textAlign = 'left';
}

function drawLabel(ctx, text, x, y, bgColor) {
    ctx.font = 'bold 11px sans-serif';
    const metrics = ctx.measureText(text);
    const padding = 4;
    const labelW = metrics.width + padding * 2;
    const labelH = 16;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y - labelH, labelW, labelH);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + padding, y - 4);
}

function drawLegend(ctx, frameData, width, height) {
    const legendY = height - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(4, legendY, 180, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AI Attention Region — model focus area', 8, legendY + 14);
}

function jetColormap(value) {
    // Maps 0-1 to a jet-like color (blue -> red)
    let red = 0, green = 0, blue = 0;
    if (value < 0.25) {
        blue = 255;
        green = Math.round(value * 4 * 255);
    } else if (value < 0.5) {
        green = 255;
        blue = Math.round((0.5 - value) * 4 * 255);
    } else if (value < 0.75) {
        green = 255;
        red = Math.round((value - 0.5) * 4 * 255);
    } else {
        red = 255;
        green = Math.round((1.0 - value) * 4 * 255);
    }
    return { red, green, blue };
}

export default VideoAnalysisPlayer;
