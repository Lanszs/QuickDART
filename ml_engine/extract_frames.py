"""
Video Frame Extraction Tool for QuickDART ML Training.

Extracts frames from a video at a configurable interval (default: every 3 seconds)
to generate training images for fire damage classification.

Usage:
    python ml_engine/extract_frames.py path/to/video.mp4
    python ml_engine/extract_frames.py path/to/video.mp4 --interval 5 --output my_frames/
    python ml_engine/extract_frames.py path/to/video.mp4 --interval 2 --quality 90
"""

import os
import sys
import argparse
import cv2


def extract_frames(video_path, output_dir, interval_sec=3, quality=95):
    """
    Extract frames from a video file at regular intervals.

    Args:
        video_path: Path to the video file
        output_dir: Directory to save extracted frames
        interval_sec: Seconds between extracted frames (default 3)
        quality: JPEG quality 1-100 (default 95)

    Returns:
        Number of frames extracted
    """
    if not os.path.isfile(video_path):
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video: {video_path}")
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps if fps > 0 else 0

    print(f"Video: {video_path}")
    print(f"  Resolution: {int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
    print(f"  FPS: {fps:.1f}")
    print(f"  Duration: {duration_sec:.1f}s ({duration_sec/60:.1f} min)")
    print(f"  Total frames: {total_frames}")
    print(f"  Extracting 1 frame every {interval_sec}s -> ~{int(duration_sec / interval_sec)} frames expected")
    print()

    os.makedirs(output_dir, exist_ok=True)

    frame_interval = int(fps * interval_sec)
    extracted = 0
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            timestamp = frame_idx / fps
            filename = f"frame_{extracted:04d}_{timestamp:.1f}s.jpg"
            filepath = os.path.join(output_dir, filename)
            cv2.imwrite(filepath, frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
            extracted += 1

            if extracted % 50 == 0:
                print(f"  Extracted {extracted} frames...")

        frame_idx += 1

    cap.release()

    print(f"\nDone! Extracted {extracted} frames to: {output_dir}")
    return extracted


def main():
    parser = argparse.ArgumentParser(
        description="Extract frames from a video at regular intervals for ML training."
    )
    parser.add_argument('video', help='Path to video file')
    parser.add_argument('--interval', type=float, default=3,
                        help='Seconds between frames (default: 3)')
    parser.add_argument('--output', default='extracted_frames',
                        help='Output directory (default: extracted_frames/)')
    parser.add_argument('--quality', type=int, default=95,
                        help='JPEG quality 1-100 (default: 95)')

    args = parser.parse_args()
    extract_frames(args.video, args.output, args.interval, args.quality)


if __name__ == '__main__':
    main()
