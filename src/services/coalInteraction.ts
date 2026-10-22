import type { Point2D } from '../types/hookah';
import type { VideoViewport } from '../utils/videoViewport';

type Landmark = { x: number; y: number; z?: number };

export interface CoalUpdate {
  heat: number; // 0..1
  fanning: boolean; // open palm over the coal
  freshCoal: boolean; // pinch gesture just added fresh coal
  active: boolean; // a hand is inside the interaction zone
  zoneRadius: number;
}

/**
 * Second-hand charcoal control.
 *  - Open palm hovering over the coal  -> fans it: heat rises gradually
 *  - Pinch near the coal               -> adds a fresh coal: heat jumps to max
 * The hand that is holding the hose is ignored. Heat slowly cools back to a resting level.
 */
export class CoalManager {
  private heat = 0.35;
  private readonly restHeat = 0.35;
  private freshCooldownUntil = 0;

  getHeat(): number {
    return this.heat;
  }

  update(
    handLandmarks: Landmark[][],
    pipeHeld: boolean,
    pipeHandCenter: Point2D | null,
    coalPos: Point2D,
    view: VideoViewport,
    screenHeight: number,
    isMirrored: boolean = true
  ): CoalUpdate {
    const zoneRadius = Math.max(150, screenHeight * 0.22);
    const now = performance.now();

    const hands = (handLandmarks || [])
      .filter((lm) => lm && lm.length >= 21)
      .map((lm) => {
        const palmIdx = [0, 5, 9, 13, 17];
        const palm: Point2D = {
          x: (isMirrored ? 1 - avg(lm, palmIdx, 'x') : avg(lm, palmIdx, 'x')) * view.width + view.offsetX,
          y: avg(lm, palmIdx, 'y') * view.height + view.offsetY
        };

        const curled = [
          [8, 5],
          [12, 9],
          [16, 13],
          [20, 17]
        ].filter(([tip, mcp]) => dist(lm[tip], lm[0]) < dist(lm[mcp], lm[0]) * 1.25).length;
        const isPinch = dist(lm[4], lm[8]) < 0.075 && curled <= 2;
        const isOpen = curled <= 1 && !isPinch;

        return { palm, isPinch, isOpen };
      });

    // Drop the hand that is holding the hose
    let candidates = hands;
    if (pipeHeld && pipeHandCenter && hands.length > 0) {
      let skip = 0;
      let best = Infinity;
      hands.forEach((h, i) => {
        const d = Math.hypot(h.palm.x - pipeHandCenter.x, h.palm.y - pipeHandCenter.y);
        if (d < best) {
          best = d;
          skip = i;
        }
      });
      candidates = hands.filter((_, i) => i !== skip);
    }

    // Nearest candidate inside the zone
    let target: (typeof hands)[number] | null = null;
    let nearest = zoneRadius;
    for (const h of candidates) {
      const d = Math.hypot(h.palm.x - coalPos.x, h.palm.y - coalPos.y);
      if (d < nearest) {
        nearest = d;
        target = h;
      }
    }

    let fanning = false;
    let freshCoal = false;

    if (target?.isPinch && this.heat < 0.9 && now > this.freshCooldownUntil) {
      this.heat = 1;
      this.freshCooldownUntil = now + 1500;
      freshCoal = true;
    } else if (target?.isOpen) {
      fanning = true;
      this.heat = Math.min(1, this.heat + 0.014);
    }

    if (!fanning && this.heat > this.restHeat) {
      this.heat = Math.max(this.restHeat, this.heat - 0.0012);
    }

    return { heat: this.heat, fanning, freshCoal, active: target !== null, zoneRadius };
  }
}

function avg(lm: Landmark[], idx: number[], axis: 'x' | 'y'): number {
  return idx.reduce((sum, i) => sum + lm[i][axis], 0) / idx.length;
}

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
