import type { Particle } from '../types/hookah';
import type { SmokeColor, SmokeStyle } from '../types/settings';

export interface SmokeSource {
  x: number;
  y: number;
  scale?: number; // size multiplier for this source (e.g. smaller wisps from the nose)
}

export interface SmokeOptions {
  style: SmokeStyle;
  color: SmokeColor;
  density: number;
  slowMotion: boolean;
  lite?: boolean; // fewer particles for phones
}

// Four gradient stops (core -> edge) per colour, as "r, g, b"
const PALETTES: Record<SmokeColor, [string, string, string, string]> = {
  white: ['255, 255, 255', '245, 248, 255', '235, 242, 255', '215, 230, 255'],
  mint: ['220, 255, 240', '150, 240, 200', '110, 225, 185', '80, 210, 170'],
  berry: ['255, 225, 240', '255, 150, 200', '240, 100, 170', '220, 70, 150'],
  blue: ['225, 240, 255', '140, 190, 255', '100, 160, 250', '70, 130, 240'],
  gold: ['255, 245, 215', '255, 215, 130', '250, 190, 90', '240, 170, 60'],
  violet: ['240, 225, 255', '200, 150, 255', '170, 110, 245', '140, 80, 230']
};

const RING_INTERVAL_FRAMES = 24;

export class VapourParticleSystem {
  private particles: Particle[] = [];
  private maxParticles = 260; // Ample pool to support central plume + wide atmospheric scatter
  private frameCount = 0;
  private ringTimer = RING_INTERVAL_FRAMES;
  private idleFrames = 0;
  private slowToggle = false;

  private options: SmokeOptions = { style: 'classic', color: 'white', density: 1, slowMotion: false };

  setOptions(options: SmokeOptions) {
    this.options = options;
  }

  /**
   * Emit realistic hookah smoke that flows from the given sources and scatters
   * broadly around the face, cheeks, shoulders, and surrounding air.
   */
  emit(sources: SmokeSource[], faceW: number = 160) {
    // A new exhale starts with a ring straight away
    if (this.idleFrames > 10) this.ringTimer = RING_INTERVAL_FRAMES;
    this.idleFrames = 0;

    this.frameCount++;
    this.ringTimer++;

    const { style, density } = this.options;
    const baseScale = Math.max(0.6, Math.min(2.0, faceW / 160));

    const emitRing = this.ringTimer >= RING_INTERVAL_FRAMES && (style === 'rings' || style === 'mix');
    if (emitRing) this.ringTimer = 0;

    // Denser smoke emits every frame, normal density every other frame (lite: always every other)
    const everyFrame = density >= 1.5 && !this.options.lite;
    const emitPuff = (style === 'classic' || style === 'mix') && (everyFrame || this.frameCount % 2 === 0);

    for (const src of sources) {
      const scale = baseScale * (src.scale ?? 1);
      if (emitPuff) this.emitPuff(src.x, src.y, scale);
      if (emitRing) this.emitRing(src.x, src.y, scale);
    }
  }

  private emitPuff(x: number, y: number, scale: number) {
    // Spawn 3 complementary particle types per burst:
    // 1. Central rising billow
    // 2. Left-curling scatter cloud (drifts around left cheek/shoulder)
    // 3. Right-curling scatter cloud (drifts around right cheek/shoulder)

    // Type 1: Central Plume
    this.spawnParticle({
      x: x + (Math.random() - 0.5) * 10 * scale,
      y,
      angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.5, // -90° ± 15° (Upward)
      speed: (2.8 + Math.random() * 2.2) * scale,
      size: (16 + Math.random() * 8) * scale,
      expansionRate: 1.1 * scale,
      alpha: 0.13 + Math.random() * 0.03,
      maxLife: 80 + Math.random() * 30,
      lateralBias: 0
    });

    // Type 2: Left Curl / Scatter (flows around face to the left)
    this.spawnParticle({
      x: x - Math.random() * 8 * scale,
      y: y + (Math.random() - 0.5) * 6,
      angle: -Math.PI / 2 - (0.35 + Math.random() * 0.55), // -110° to -145° (Left-Up)
      speed: (2.2 + Math.random() * 2.0) * scale,
      size: (20 + Math.random() * 12) * scale,
      expansionRate: 1.35 * scale,
      alpha: 0.11 + Math.random() * 0.03,
      maxLife: 95 + Math.random() * 35,
      lateralBias: -1
    });

    // Type 3: Right Curl / Scatter (flows around face to the right)
    this.spawnParticle({
      x: x + Math.random() * 8 * scale,
      y: y + (Math.random() - 0.5) * 6,
      angle: -Math.PI / 2 + (0.35 + Math.random() * 0.55), // -70° to -35° (Right-Up)
      speed: (2.2 + Math.random() * 2.0) * scale,
      size: (20 + Math.random() * 12) * scale,
      expansionRate: 1.35 * scale,
      alpha: 0.11 + Math.random() * 0.03,
      maxLife: 95 + Math.random() * 35,
      lateralBias: 1
    });
  }

  /** A smoke ring: a circle of small puffs expanding outwards while drifting upwards. */
  private emitRing(x: number, y: number, scale: number) {
    const count = 22;
    const radius = 9 * scale;
    const burst = 1.5 * scale;
    const drift = -1.2 * scale;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.spawnParticle({
        x: x + Math.cos(a) * radius,
        y: y + Math.sin(a) * radius * 0.85,
        angle: a,
        speed: burst,
        driftY: drift,
        size: (9 + Math.random() * 3) * scale,
        expansionRate: 0.16 * scale,
        alpha: 0.2,
        maxLife: 85 + Math.random() * 10,
        lateralBias: 0,
        kind: 'ring'
      });
    }
  }

  private spawnParticle(p: {
    x: number;
    y: number;
    angle: number;
    speed: number;
    driftY?: number;
    size: number;
    expansionRate: number;
    alpha: number;
    maxLife: number;
    lateralBias: number;
    kind?: 'puff' | 'ring';
  }) {
    const cap = this.options.lite ? 110 : this.maxParticles;
    if (this.particles.length >= cap) {
      this.particles.shift();
    }

    this.particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.angle) * p.speed,
      vy: Math.sin(p.angle) * p.speed + (p.driftY ?? 0),
      size: p.size,
      alpha: p.alpha,
      maxLife: p.maxLife,
      life: 0,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.025,
      expansionRate: p.expansionRate,
      lateralBias: p.lateralBias,
      kind: p.kind ?? 'puff'
    });
  }

  update() {
    this.idleFrames++;

    // Slow motion: advance the simulation every other frame
    if (this.options.slowMotion) {
      this.slowToggle = !this.slowToggle;
      if (this.slowToggle) return;
    }

    const densityScale = this.options.density;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics: Move particles along velocity vectors
      p.x += p.vx;
      p.y += p.vy;

      if (p.kind === 'ring') {
        // Rings keep their shape: gentle drag, almost no turbulence
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.vy -= 0.012;
      } else {
        // Air drag slows initial burst
        p.vx *= 0.968;
        p.vy *= 0.972;

        // Gentle thermal rise lifts smoke upward continuously
        p.vy -= 0.042;

        // Atmospheric scatter: lateral curl spreads smoke around face & shoulders
        const bias = p.lateralBias || 0;
        if (bias !== 0) {
          p.vx += bias * 0.055;
        }

        // Organic sinusoidal atmospheric turbulence
        p.vx += Math.sin(p.life * 0.06 + p.rotation) * 0.085;
      }

      // Volumetric cloud expansion (grows from mouth size into wide billowy cloud)
      p.size += p.expansionRate || 1.1;
      p.rotation += p.rotSpeed;

      // Instant visibility with smooth late fade-out
      const progress = p.life / p.maxLife;
      let envelope: number;
      if (progress < 0.45) {
        envelope = 1.0; // 100% visible immediately from the mouth
      } else {
        envelope = Math.pow(1 - (progress - 0.45) / 0.55, 1.4);
      }
      const peak = p.kind === 'ring' ? 0.3 : 0.135;
      p.alpha = envelope * peak * densityScale;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.particles.length === 0) return;

    const [c0, c1, c2, c3] = PALETTES[this.options.color];

    ctx.save();
    for (const p of this.particles) {
      if (p.alpha <= 0.002) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Multi-stop soft feathered smoke puff: realistic hookah clouds
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      g.addColorStop(0, `rgba(${c0}, ${Math.min(1, p.alpha * 1.15)})`);
      g.addColorStop(0.28, `rgba(${c1}, ${Math.min(1, p.alpha * 0.9)})`);
      g.addColorStop(0.62, `rgba(${c2}, ${Math.min(1, p.alpha * 0.45)})`);
      g.addColorStop(1, `rgba(${c3}, 0)`);

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  clear() {
    this.particles = [];
  }

  getActiveParticleCount(): number {
    return this.particles.length;
  }
}
