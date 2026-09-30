import {
  GROUND_Y,
  PLAYER_CENTER_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GameState,
  type Obstacle,
  type Pickup,
} from './engine';
import type { SpriteFrame } from './sprites';

function drawCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 17 * scale, 0, Math.PI * 2);
  context.arc(x + 20 * scale, y - 9 * scale, 22 * scale, 0, Math.PI * 2);
  context.arc(x + 45 * scale, y, 16 * scale, 0, Math.PI * 2);
  context.arc(x + 26 * scale, y + 6 * scale, 20 * scale, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawRollingHill(
  context: CanvasRenderingContext2D,
  color: string,
  phase: number,
  amplitude: number,
  baseY: number,
  wavelength: number,
): void {
  context.beginPath();
  context.moveTo(0, WORLD_HEIGHT);

  for (let x = 0; x <= WORLD_WIDTH + 16; x += 16) {
    const wave =
      Math.sin((x + phase) / wavelength) * amplitude +
      Math.sin((x + phase * 0.56) / (wavelength * 0.53)) * amplitude * 0.25;
    context.lineTo(x, baseY + wave);
  }

  context.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawBackground(context: CanvasRenderingContext2D, state: GameState): void {
  const { palette } = state.level;
  const sky = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyBottom);
  context.fillStyle = sky;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sunX = 760 - ((state.distance * 0.035) % 1_260);
  context.save();
  context.globalAlpha = 0.78;
  context.fillStyle = palette.sun;
  context.beginPath();
  context.arc(sunX < -100 ? sunX + 1_260 : sunX, 92, 34, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const cloudOffset = (state.distance * 0.055) % 1_200;
  drawCloud(context, 110 - cloudOffset, 88, 0.75, 'rgba(255,255,255,0.65)');
  drawCloud(context, 490 - cloudOffset * 0.76, 128, 0.52, 'rgba(255,255,255,0.5)');
  drawCloud(context, 920 - cloudOffset * 0.6, 68, 0.62, 'rgba(255,255,255,0.55)');

  drawRollingHill(
    context,
    palette.backHill,
    (state.distance * 0.13) % 1_200,
    21,
    GROUND_Y - 84,
    115,
  );
  drawRollingHill(
    context,
    palette.frontHill,
    (state.distance * 0.24) % 1_200,
    15,
    GROUND_Y - 37,
    92,
  );

  const ground = context.createLinearGradient(0, GROUND_Y - 5, 0, WORLD_HEIGHT);
  ground.addColorStop(0, palette.groundLight);
  ground.addColorStop(0.13, palette.ground);
  ground.addColorStop(1, palette.ground);
  context.fillStyle = ground;
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

  context.fillStyle = 'rgba(255,255,255,0.3)';
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, 3);
  const dashOffset = state.distance % 96;
  for (let x = -96 - dashOffset; x < WORLD_WIDTH; x += 96) {
    context.fillStyle = 'rgba(236,239,200,0.26)';
    context.fillRect(x, GROUND_Y + 42, 42, 4);
  }

  const grassOffset = state.distance % 76;
  for (let x = -76 - grassOffset; x < WORLD_WIDTH; x += 76) {
    context.strokeStyle = 'rgba(236,239,200,0.3)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + 5, GROUND_Y + 13);
    context.lineTo(x + 1, GROUND_Y + 5);
    context.moveTo(x + 9, GROUND_Y + 13);
    context.lineTo(x + 12, GROUND_Y + 6);
    context.stroke();
  }
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.arcTo(x + width, y, x + width, y + height, corner);
  context.arcTo(x + width, y + height, x, y + height, corner);
  context.arcTo(x, y + height, x, y, corner);
  context.arcTo(x, y, x + width, y, corner);
  context.closePath();
}

function drawStump(context: CanvasRenderingContext2D, obstacle: Obstacle): void {
  const { x, width } = obstacle;
  const height = 48;
  const y = GROUND_Y - height;
  const bark = context.createLinearGradient(x, y, x + width, y + height);
  bark.addColorStop(0, '#9c6947');
  bark.addColorStop(0.55, '#b77d4d');
  bark.addColorStop(1, '#754f42');
  roundedRect(context, x, y + 6, width, height - 4, 13);
  context.fillStyle = bark;
  context.fill();

  context.fillStyle = '#e5c18c';
  context.beginPath();
  context.ellipse(x + width / 2, y + 8, width / 2 - 2, 9, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#b17b52';
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(x + width / 2, y + 8, width / 4, 4, 0, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = 'rgba(73,50,39,0.58)';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x + 13, y + 25);
  context.lineTo(x + 23, y + 30);
  context.moveTo(x + width - 20, y + 23);
  context.lineTo(x + width - 11, y + 31);
  context.stroke();
}

function drawArch(context: CanvasRenderingContext2D, obstacle: Obstacle): void {
  const { x, width } = obstacle;
  const postWidth = 13;
  context.fillStyle = '#855c57';
  roundedRect(context, x + 7, GROUND_Y - 66, postWidth, 66, 5);
  context.fill();
  roundedRect(context, x + width - postWidth - 7, GROUND_Y - 66, postWidth, 66, 5);
  context.fill();

  context.fillStyle = '#f3e5c4';
  roundedRect(context, x, GROUND_Y - 81, width, 23, 10);
  context.fill();
  context.fillStyle = '#df8a71';
  roundedRect(context, x + 5, GROUND_Y - 78, width - 10, 11, 6);
  context.fill();

  context.fillStyle = 'rgba(255,249,221,0.9)';
  context.beginPath();
  context.arc(x + width / 2, GROUND_Y - 47, 5, 0, Math.PI * 2);
  context.fill();
}

function drawGap(context: CanvasRenderingContext2D, obstacle: Obstacle): void {
  const { x, width } = obstacle;
  context.fillStyle = '#2f4e50';
  context.fillRect(x, GROUND_Y - 1, width, WORLD_HEIGHT - GROUND_Y + 1);
  context.fillStyle = 'rgba(20,39,44,0.42)';
  context.beginPath();
  context.moveTo(x, GROUND_Y + 3);
  context.lineTo(x + width, GROUND_Y + 3);
  context.lineTo(x + width - 18, WORLD_HEIGHT);
  context.lineTo(x + 17, WORLD_HEIGHT);
  context.closePath();
  context.fill();
  context.strokeStyle = 'rgba(239,239,205,0.55)';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x + 3, GROUND_Y);
  context.lineTo(x + width - 3, GROUND_Y);
  context.stroke();
}

function drawObstacle(context: CanvasRenderingContext2D, obstacle: Obstacle): void {
  if (obstacle.type === 'gap') {
    drawGap(context, obstacle);
  } else if (obstacle.type === 'arch') {
    drawArch(context, obstacle);
  } else {
    drawStump(context, obstacle);
  }
}

function drawPickup(context: CanvasRenderingContext2D, pickup: Pickup, elapsed: number): void {
  const bob = Math.sin(elapsed * 5 + pickup.id) * 4;
  const y = pickup.y + bob;
  context.save();
  context.shadowColor = '#fff4ad';
  context.shadowBlur = 16;
  const glow = context.createRadialGradient(pickup.x, y, 2, pickup.x, y, 19);
  glow.addColorStop(0, '#fff8ca');
  glow.addColorStop(0.52, '#f8cf72');
  glow.addColorStop(1, 'rgba(239,166,78,0.08)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(pickup.x, y, 18, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;

  context.fillStyle = '#f1b94f';
  context.beginPath();
  context.arc(pickup.x, y, 10, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#fff4c5';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(pickup.x, y, 7, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = '#73996b';
  context.beginPath();
  context.ellipse(pickup.x + 6, y - 11, 6, 3, -0.6, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawRunner(
  context: CanvasRenderingContext2D,
  state: GameState,
  frames: SpriteFrame[] | null,
  now: number,
): void {
  const jumping = state.player.jumpHeight > 0;
  const sliding = state.player.slideRemaining > 0;
  const shadowScale = Math.max(0.42, 1 - state.player.jumpHeight / 220);
  context.save();
  context.globalAlpha = 0.22;
  context.fillStyle = '#273b3b';
  context.beginPath();
  context.ellipse(
    PLAYER_CENTER_X,
    GROUND_Y + 3,
    42 * shadowScale,
    8 * shadowScale,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  const frame =
    frames && frames.length > 0
      ? frames[Math.floor(state.elapsed * 13) % frames.length]
      : undefined;
  if (!frame) {
    drawFallbackRunner(context, state, sliding);
    return;
  }

  const blinking =
    state.invulnerability > 0 && Math.floor(now / 80) % 2 === 0;
  context.save();
  context.globalAlpha = blinking ? 0.5 : 1;

  if (sliding) {
    context.drawImage(frame, PLAYER_CENTER_X - 64, GROUND_Y - 72, 128, 72);
  } else {
    const maxWidth = 126;
    const maxHeight = 120;
    const scale = Math.min(maxWidth / frame.width, maxHeight / frame.height);
    const width = frame.width * scale;
    const height = frame.height * scale;
    const x = PLAYER_CENTER_X - width / 2;
    const y = GROUND_Y - height - state.player.jumpHeight;
    context.drawImage(frame, x, y, width, height);
  }

  context.restore();

  if (jumping) {
    context.save();
    context.globalAlpha = 0.28;
    context.fillStyle = '#fff4d4';
    context.beginPath();
    context.arc(PLAYER_CENTER_X - 44, GROUND_Y - 36 - state.player.jumpHeight, 4, 0, Math.PI * 2);
    context.arc(PLAYER_CENTER_X + 46, GROUND_Y - 52 - state.player.jumpHeight, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawFallbackRunner(
  context: CanvasRenderingContext2D,
  state: GameState,
  sliding: boolean,
): void {
  const height = sliding ? 67 : 106;
  const width = sliding ? 104 : 84;
  const x = PLAYER_CENTER_X - width / 2;
  const y = GROUND_Y - height - state.player.jumpHeight;
  context.save();
  context.fillStyle = '#f6ead6';
  context.strokeStyle = '#434348';
  context.lineWidth = 7;
  context.beginPath();
  context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, -0.16, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#262a2d';
  context.beginPath();
  context.ellipse(x + width * 0.38, y + height * 0.39, width * 0.33, height * 0.38, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#fff9e9';
  context.beginPath();
  context.arc(x + width * 0.69, y + height * 0.32, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#cf9571';
  context.beginPath();
  context.moveTo(x + width * 0.86, y + height * 0.42);
  context.lineTo(x + width + 12, y + height * 0.5);
  context.lineTo(x + width * 0.83, y + height * 0.58);
  context.closePath();
  context.fill();
  context.restore();
}

export function drawGameScene(
  context: CanvasRenderingContext2D,
  state: GameState,
  frames: SpriteFrame[] | null,
  now: number,
): void {
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawBackground(context, state);

  for (const pickup of state.pickups) {
    drawPickup(context, pickup, state.elapsed);
  }
  for (const obstacle of state.obstacles) {
    drawObstacle(context, obstacle);
  }

  drawRunner(context, state, frames, now);

  context.fillStyle = 'rgba(255,255,255,0.16)';
  context.fillRect(0, WORLD_HEIGHT - 2, WORLD_WIDTH, 2);
}
