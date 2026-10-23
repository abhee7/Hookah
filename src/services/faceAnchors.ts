import type { FaceAnchors, Point2D } from '../types/hookah';

type Landmark = { x: number; y: number; z?: number };

/**
 * Extracts a handful of stable anchor points (eyes, forehead, nostrils, head tilt)
 * from the MediaPipe face mesh so effects can be attached to each detected face.
 */
export class FaceAnchorDetector {
  // Smoothing history per face slot, so every person's effect is filtered separately
  private previous: Array<FaceAnchors | null> = [];
  private smoothing = 0.55; // 1 = no smoothing, lower = smoother but laggier

  /** One entry per detected face. */
  detectAll(
    faceLandmarksList: Landmark[][],
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean = true,
    offset: Point2D = { x: 0, y: 0 }
  ): FaceAnchors[] {
    const faces = faceLandmarksList || [];
    const results: FaceAnchors[] = [];
    const nextPrevious: Array<FaceAnchors | null> = [];

    faces.forEach((lm, i) => {
      const next = this.computeAnchors(lm, canvasWidth, canvasHeight, isMirrored, offset);
      if (!next) {
        nextPrevious[i] = null;
        return;
      }
      const prev = this.previous[i];
      const smoothed = prev ? this.blend(prev, next) : next;
      nextPrevious[i] = smoothed;
      results.push(smoothed);
    });

    this.previous = nextPrevious;
    return results;
  }

  /** Anchors of the first detected face (single-player use). */
  detect(
    faceLandmarksList: Landmark[][],
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean = true,
    offset: Point2D = { x: 0, y: 0 }
  ): FaceAnchors | null {
    return this.detectAll(faceLandmarksList, canvasWidth, canvasHeight, isMirrored, offset)[0] ?? null;
  }

  private computeAnchors(
    lm: Landmark[] | undefined,
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean,
    offset: Point2D
  ): FaceAnchors | null {
    if (!lm || lm.length < 468) return null;

    const toScreen = (i: number): Point2D => ({
      x: (isMirrored ? 1 - lm[i].x : lm[i].x) * canvasWidth + offset.x,
      y: lm[i].y * canvasHeight + offset.y
    });
    const mid = (a: Point2D, b: Point2D): Point2D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const eyeA = mid(toScreen(33), toScreen(133));
    const eyeB = mid(toScreen(263), toScreen(362));
    const [eyeLeft, eyeRight] = eyeA.x <= eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];

    const cheekA = toScreen(234);
    const cheekB = toScreen(454);

    return {
      center: mid(eyeLeft, eyeRight),
      roll: Math.atan2(eyeRight.y - eyeLeft.y, eyeRight.x - eyeLeft.x),
      width: Math.hypot(cheekA.x - cheekB.x, cheekA.y - cheekB.y),
      eyeLeft,
      eyeRight,
      forehead: toScreen(10),
      chin: toScreen(152),
      noseLeft: toScreen(98),
      noseRight: toScreen(327)
    };
  }

  private blend(a: FaceAnchors, b: FaceAnchors): FaceAnchors {
    const k = this.smoothing;
    const p = (u: Point2D, v: Point2D): Point2D => ({
      x: u.x + (v.x - u.x) * k,
      y: u.y + (v.y - u.y) * k
    });
    return {
      center: p(a.center, b.center),
      roll: a.roll + (b.roll - a.roll) * k,
      width: a.width + (b.width - a.width) * k,
      eyeLeft: p(a.eyeLeft, b.eyeLeft),
      eyeRight: p(a.eyeRight, b.eyeRight),
      forehead: p(a.forehead, b.forehead),
      chin: p(a.chin, b.chin),
      noseLeft: p(a.noseLeft, b.noseLeft),
      noseRight: p(a.noseRight, b.noseRight)
    };
  }
}
