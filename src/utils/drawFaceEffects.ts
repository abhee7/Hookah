import type { FaceAnchors } from '../types/hookah';
import type { FaceEffect } from '../types/settings';

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSunglasses(ctx: CanvasRenderingContext2D, f: FaceAnchors) {
  const eyeDist = Math.hypot(f.eyeRight.x - f.eyeLeft.x, f.eyeRight.y - f.eyeLeft.y);
  const lensW = eyeDist * 0.9;
  const lensH = lensW * 0.72;
  const frame = Math.max(2, lensW * 0.07);

  ctx.save();
  ctx.translate(f.center.x, f.center.y);
  ctx.rotate(f.roll);

  // Temple arms
  ctx.strokeStyle = '#111';
  ctx.lineWidth = frame;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-eyeDist / 2 - lensW / 2, -lensH * 0.15);
  ctx.lineTo(-f.width * 0.52, -lensH * 0.05);
  ctx.moveTo(eyeDist / 2 + lensW / 2, -lensH * 0.15);
  ctx.lineTo(f.width * 0.52, -lensH * 0.05);
  ctx.stroke();

  // Bridge
  ctx.beginPath();
  ctx.moveTo(-eyeDist / 2 + lensW / 2 - frame, -lensH * 0.15);
  ctx.quadraticCurveTo(0, -lensH * 0.35, eyeDist / 2 - lensW / 2 + frame, -lensH * 0.15);
  ctx.stroke();

  // Lenses
  for (const side of [-1, 1]) {
    const cx = (side * eyeDist) / 2;
    roundedRect(ctx, cx - lensW / 2, -lensH / 2, lensW, lensH, lensH * 0.38);

    const g = ctx.createLinearGradient(cx - lensW / 2, -lensH / 2, cx + lensW / 2, lensH / 2);
    g.addColorStop(0, 'rgba(15, 12, 25, 0.93)');
    g.addColorStop(1, 'rgba(55, 25, 70, 0.88)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#0b0b0b';
    ctx.lineWidth = frame;
    ctx.stroke();

    // Glint
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(cx - lensW * 0.35, -lensH / 2);
    ctx.lineTo(cx - lensW * 0.1, -lensH / 2);
    ctx.lineTo(cx - lensW * 0.4, lensH / 2);
    ctx.lineTo(cx - lensW * 0.5, lensH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, f: FaceAnchors) {
  const cw = f.width * 0.82;
  const ch = f.width * 0.4;

  ctx.save();
  ctx.translate(f.forehead.x, f.forehead.y - f.width * 0.06);
  ctx.rotate(f.roll);

  ctx.beginPath();
  ctx.moveTo(-cw / 2, 0);
  const peaks = 5;
  for (let i = 0; i < peaks; i++) {
    const px = -cw / 2 + (cw * i) / (peaks - 1);
    const py = i === 2 ? -ch * 1.15 : -ch;
    ctx.lineTo(px, py);
    if (i < peaks - 1) {
      ctx.lineTo(px + cw / (peaks - 1) / 2, -ch * 0.5);
    }
  }
  ctx.lineTo(cw / 2, 0);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, -ch * 1.15, 0, 0);
  g.addColorStop(0, '#ffe082');
  g.addColorStop(0.5, '#ffb300');
  g.addColorStop(1, '#c68400');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#7a5200';
  ctx.lineWidth = Math.max(1.5, cw * 0.012);
  ctx.stroke();

  // Band
  ctx.fillStyle = 'rgba(120, 75, 0, 0.55)';
  ctx.fillRect(-cw / 2, -ch * 0.16, cw, ch * 0.16);

  // Jewels on the peaks
  const gems = ['#e53935', '#1e88e5', '#e53935', '#1e88e5', '#e53935'];
  for (let i = 0; i < peaks; i++) {
    const px = -cw / 2 + (cw * i) / (peaks - 1);
    const py = (i === 2 ? -ch * 1.15 : -ch) + cw * 0.04;
    ctx.beginPath();
    ctx.arc(px, py, cw * 0.032, 0, Math.PI * 2);
    ctx.fillStyle = gems[i];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawPartyHat(ctx: CanvasRenderingContext2D, f: FaceAnchors) {
  const bw = f.width * 0.55;
  const bh = f.width * 0.75;

  ctx.save();
  ctx.translate(f.forehead.x + f.width * 0.04, f.forehead.y - f.width * 0.04);
  ctx.rotate(f.roll + 0.22);

  // Cone
  ctx.beginPath();
  ctx.moveTo(-bw / 2, 0);
  ctx.lineTo(0, -bh);
  ctx.lineTo(bw / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, -bh);
  g.addColorStop(0, '#ec407a');
  g.addColorStop(1, '#8e24aa');
  ctx.fillStyle = g;
  ctx.fill();

  // Stripes (clipped to the cone)
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = bw * 0.1;
  for (let i = 0; i < 5; i++) {
    const y = -bh * (0.15 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(-bw, y + bw * 0.25);
    ctx.lineTo(bw, y - bw * 0.25);
    ctx.stroke();
  }
  ctx.restore();

  // Rim trim and pompom
  ctx.strokeStyle = '#fff59d';
  ctx.lineWidth = bw * 0.06;
  ctx.beginPath();
  ctx.moveTo(-bw / 2, 0);
  ctx.lineTo(bw / 2, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -bh, bw * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#ffee58';
  ctx.fill();

  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, f: FaceAnchors, timestampMs: number) {
  const bob = Math.sin(timestampMs * 0.003) * f.width * 0.015;

  ctx.save();
  ctx.translate(f.forehead.x, f.forehead.y - f.width * 0.26 + bob);
  ctx.rotate(f.roll);
  ctx.shadowColor = '#ffe082';
  ctx.shadowBlur = f.width * 0.15;
  ctx.strokeStyle = '#ffecb3';
  ctx.lineWidth = f.width * 0.035;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.width * 0.36, f.width * 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawFaceEffect(
  ctx: CanvasRenderingContext2D,
  effect: FaceEffect,
  face: FaceAnchors | null,
  timestampMs: number
) {
  if (!face || effect === 'none' || face.width < 20) return;
  switch (effect) {
    case 'sunglasses':
      drawSunglasses(ctx, face);
      break;
    case 'crown':
      drawCrown(ctx, face);
      break;
    case 'partyHat':
      drawPartyHat(ctx, face);
      break;
    case 'halo':
      drawHalo(ctx, face, timestampMs);
      break;
  }
}
