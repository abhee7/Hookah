import type { MouthState, Point2D } from '../types/hookah';

type Landmark = { x: number; y: number; z?: number };

export class MouthDetector {
  // Lowered threshold (0.15) for immediate, responsive mouth open detection
  private mouthOpenThreshold = 0.15;

  /** Mouth of the first detected face. */
  detectMouth(
    faceLandmarksList: Landmark[][],
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean = true,
    offset: Point2D = { x: 0, y: 0 }
  ): MouthState | null {
    if (!faceLandmarksList || faceLandmarksList.length === 0) {
      return null;
    }
    return this.computeMouth(faceLandmarksList[0], canvasWidth, canvasHeight, isMirrored, offset);
  }

  /** One entry per detected face (null where a face has no usable mouth landmarks). */
  detectMouths(
    faceLandmarksList: Landmark[][],
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean = true,
    offset: Point2D = { x: 0, y: 0 }
  ): Array<MouthState | null> {
    return (faceLandmarksList || []).map((lm) =>
      this.computeMouth(lm, canvasWidth, canvasHeight, isMirrored, offset)
    );
  }

  private computeMouth(
    landmarks: Landmark[] | undefined,
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean,
    offset: Point2D
  ): MouthState | null {
    if (!landmarks || landmarks.length < 300) return null;

    // Landmark indices for mouth
    const upperLipInner = landmarks[13];
    const lowerLipInner = landmarks[14];
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];

    if (!upperLipInner || !lowerLipInner || !leftCorner || !rightCorner) {
      return null;
    }

    // Horizontal mouth width in normalized coordinates
    const widthNorm = Math.sqrt(
      Math.pow(rightCorner.x - leftCorner.x, 2) +
      Math.pow(rightCorner.y - leftCorner.y, 2)
    );

    // Vertical opening height in normalized coordinates
    const heightNorm = Math.sqrt(
      Math.pow(lowerLipInner.x - upperLipInner.x, 2) +
      Math.pow(lowerLipInner.y - upperLipInner.y, 2)
    );

    const openRatio = heightNorm / (widthNorm + 0.0001);
    const isOpen = openRatio > this.mouthOpenThreshold;

    // Center in normalized space
    const centerNorm = {
      x: (leftCorner.x + rightCorner.x) / 2,
      y: (upperLipInner.y + lowerLipInner.y) / 2
    };

    // Convert to screen space (with visual mirroring)
    const center: Point2D = {
      x: (isMirrored ? 1 - centerNorm.x : centerNorm.x) * canvasWidth + offset.x,
      y: centerNorm.y * canvasHeight + offset.y
    };

    const width = widthNorm * canvasWidth;
    const height = heightNorm * canvasHeight;

    return {
      isOpen,
      center,
      openRatio,
      width,
      height
    };
  }
}
