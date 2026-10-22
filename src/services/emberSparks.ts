import type { Point2D } from '../types/hookah';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export class EmberSparks {
  private sparks: Spark[] = [];
  private maxSparks = 120;

  emit(x: number, y: number, count: number, spread: number = 24) {
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.maxSparks) this.sparks.shift();
      this.sparks.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread * 0.4,
        vx: (Math.random() - 0.5) * 1.8,
        vy: -(1.2 + Math.random() * 2.6),
        life: 0,
        maxLife: 30 + Math.random() * 35,
        size: 1.4 + Math.random() * 2
      });
    }
  }

  update() {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life++;
      if (s.life >= s.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx + Math.sin(s.life * 0.3 + s.maxLife) * 0.35;
      s.y += s.vy;
      s.vy += 0.02; // slight deceleration as they cool
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.sparks.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      const t = s.life / s.maxLife;
      const alpha = 1 - t;
      // yellow-white when fresh, deep orange as it fades
      const g = Math.round(210 - t * 130);
      ctx.fillStyle = `rgba(255, ${g}, 60, ${alpha})`;
      ctx.shadowColor = 'rgba(255, 120, 20, 0.9)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Soft pulsing ring that shows where the second hand can interact with the coal. */
export function drawCoalZone(
  ctx: CanvasRenderingContext2D,
  pos: Point2D,
  radius: number,
  heat: number,
  timestampMs: number
) {
  const pulse = 0.5 + 0.5 * Math.sin(timestampMs * 0.008);
  ctx.save();
  ctx.strokeStyle = `rgba(255, ${Math.round(150 + heat * 60)}, 40, ${0.3 + pulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius * (0.96 + pulse * 0.04), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
