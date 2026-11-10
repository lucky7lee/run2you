// 소형화된 네온 오토바이, 10종의 다양한 장애물(위험 경고 테마), 명확히 구분되는 보급 아이템(총알/바주카포) 모듈

class NeonBike {
  constructor() {
    this.worldX = 120;
    this.screenXRatio = 0.20;
    this.y = 0;
    this.airHeight = 0;
    this.vy = 0;
    this.angle = 0;
    this.wheelRot = 0;

    // 점프 물리 파라미터 (짧은 점프 vs 긴 점프 정밀 제어)
    this.isGrounded = true;
    this.isHoldingJump = false;
    this.jumpHoldTime = 0;
    this.maxJumpHoldTime = 0.33;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    // 축소된 차체 크기 (기존 대비 약 60% 크기로 아담하고 날렵하게 조정)
    this.scale = 0.60;
    this.width = 34;
    this.height = 20;

    this.trail = [];
    this.muzzleFlashTimer = 0;
  }

  reset(road, canvasHeight) {
    this.worldX = 120;
    this.airHeight = 0;
    this.y = road.getRoadY(this.worldX, canvasHeight);
    this.vy = 0;
    this.angle = 0;
    this.isGrounded = true;
    this.isHoldingJump = false;
    this.jumpHoldTime = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.trail = [];
    this.muzzleFlashTimer = 0;
  }

  requestJump() {
    this.jumpBufferTimer = 0.12;
    this.isHoldingJump = true;
  }

  releaseJump() {
    if (this.isHoldingJump) {
      this.isHoldingJump = false;
      if (!this.isGrounded && this.vy > 105) {
        this.vy *= 0.42;
      }
    }
  }

  executeJump(road, canvasHeight) {
    const roadAngle = road.getRoadAngle(this.worldX, canvasHeight);
    const slopeBonus = roadAngle < 0 ? Math.abs(roadAngle) * 70 : 0;
    this.vy = 425 + slopeBonus;
    this.airHeight = 1;
    this.isGrounded = false;
    this.jumpHoldTime = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    window.soundManager.playJump(false);
  }

  getJumpHoldRatio() {
    if (this.isGrounded) return 0;
    return Math.min(1, this.jumpHoldTime / this.maxJumpHoldTime);
  }

  update(dt, speedPx, road, canvasHeight) {
    this.worldX += speedPx * dt;
    this.wheelRot += (speedPx * dt) / 9;
    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer -= dt;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

    const groundY = road.getRoadY(this.worldX, canvasHeight);
    const groundAngle = road.getRoadAngle(this.worldX, canvasHeight);

    if (this.isGrounded) {
      this.coyoteTimer = 0.085;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }

    if (this.jumpBufferTimer > 0 && (this.isGrounded || this.coyoteTimer > 0)) {
      this.executeJump(road, canvasHeight);
    }

    if (!this.isGrounded) {
      if (this.isHoldingJump && this.jumpHoldTime < this.maxJumpHoldTime && this.vy > 0) {
        const prevHold = this.jumpHoldTime;
        this.jumpHoldTime += dt;
        this.vy += 1160 * dt;
        if (prevHold < 0.13 && this.jumpHoldTime >= 0.13) {
          window.soundManager.playJump(true);
        }
      }

      const gravity = this.vy > 0 ? 1550 : 1900;
      this.vy -= gravity * dt;
      this.airHeight += this.vy * dt;

      if (this.airHeight <= 0) {
        this.airHeight = 0;
        this.vy = 0;
        this.isGrounded = true;
        this.angle = groundAngle;
      } else {
        const targetAirAngle = groundAngle * 0.5 + Math.max(-0.42, Math.min(0.32, -this.vy * 0.00075 - 0.1));
        this.angle += (targetAirAngle - this.angle) * Math.min(1, dt * 10);
      }
    } else {
      this.airHeight = 0;
      this.vy = 0;
      this.angle += (groundAngle - this.angle) * Math.min(1, dt * 18);
    }

    this.y = groundY - this.airHeight;

    this.trail.push({
      wx: this.worldX - 15,
      y: this.y - 6,
      alpha: 0.85,
      isLongJump: !this.isGrounded && this.jumpHoldTime > 0.12
    });
    if (this.trail.length > 16) {
      this.trail.shift();
    }
    for (const t of this.trail) {
      t.alpha -= dt * 3.4;
    }
  }

  render(ctx, cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    const sy = this.y;

    // 1. 공중 점프 시 착지 기준선 가이드
    if (!this.isGrounded) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = this.jumpHoldTime > 0.12 ? 'rgba(57, 255, 20, 0.35)' : 'rgba(0, 243, 255, 0.28)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.2;
      const groundY = road.getRoadY(this.worldX, canvasHeight);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, groundY);
      ctx.stroke();
      ctx.restore();
    }

    // 2. 네온 배기 트레일
    if (this.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < this.trail.length; i++) {
        const p0 = this.trail[i - 1];
        const p1 = this.trail[i];
        if (p1.alpha <= 0) continue;
        ctx.beginPath();
        ctx.moveTo(p0.wx - cameraX, p0.y);
        ctx.lineTo(p1.wx - cameraX, p1.y);
        ctx.strokeStyle = p1.isLongJump
          ? `rgba(57, 255, 20, ${Math.max(0, p1.alpha)})`
          : `rgba(0, 243, 255, ${Math.max(0, p1.alpha)})`;
        ctx.lineWidth = p1.isLongJump ? 3.2 : 2.2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. 소형화된 네온 오토바이 본체 렌더링
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);
    ctx.scale(this.scale, this.scale);

    const wheelRadius = 11;
    const rearWheelX = -19;
    const frontWheelX = 20;
    const wheelY = -wheelRadius;

    // 헤드라이트 빔
    const beamGrad = ctx.createLinearGradient(frontWheelX + 4, wheelY - 12, frontWheelX + 80, wheelY - 4);
    beamGrad.addColorStop(0, 'rgba(0, 243, 255, 0.38)');
    beamGrad.addColorStop(1, 'rgba(0, 243, 255, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(frontWheelX + 2, wheelY - 14);
    ctx.lineTo(frontWheelX + 80, wheelY - 26);
    ctx.lineTo(frontWheelX + 80, wheelY + 4);
    ctx.closePath();
    ctx.fill();

    this.drawNeonWheel(ctx, rearWheelX, wheelY, wheelRadius, '#00f3ff');
    this.drawNeonWheel(ctx, frontWheelX, wheelY, wheelRadius, '#00f3ff');

    // 바이크 차체 프레임
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(rearWheelX, wheelY);
    ctx.lineTo(-4, wheelY - 11);
    ctx.lineTo(11, wheelY - 16);
    ctx.lineTo(frontWheelX, wheelY);
    ctx.moveTo(rearWheelX - 6, wheelY - 15);
    ctx.lineTo(-7, wheelY - 14);
    ctx.lineTo(8, wheelY - 21);
    ctx.lineTo(18, wheelY - 17);
    ctx.lineTo(11, wheelY - 10);
    ctx.closePath();
    ctx.stroke();

    // 사이버 라이더
    ctx.strokeStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-8, wheelY - 15);
    ctx.lineTo(-1, wheelY - 27);
    ctx.lineTo(11, wheelY - 20);
    ctx.moveTo(-8, wheelY - 15);
    ctx.lineTo(-2, wheelY - 7);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3, wheelY - 30, 4.5, 0, Math.PI * 2);
    ctx.fill();

    if (this.muzzleFlashTimer > 0) {
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(frontWheelX + 8, wheelY - 14);
      ctx.lineTo(frontWheelX + 26, wheelY - 19);
      ctx.lineTo(frontWheelX + 20, wheelY - 13);
      ctx.lineTo(frontWheelX + 28, wheelY - 9);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawNeonWheel(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.wheelRot);

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -r, Math.sin(a) * -r);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// 10종의 다양한 장애물 정의 (위험물 전용 적색/다크크림슨/주황 경고 컬러 및 고유 외형)
const OBSTACLE_TYPES = {
  short_spike: {
    key: 'short_spike',
    label: '삼각 가시 트랩',
    jumpHint: '짧은점프',
    width: 38,
    height: 30,
    color: '#ff1e42',
    minLevel: 1
  },
  saw_blade: {
    key: 'saw_blade',
    label: '회전 원형 톱날',
    jumpHint: '짧은점프',
    width: 42,
    height: 34,
    color: '#ff3b1f',
    minLevel: 1
  },
  laser_hurdle: {
    key: 'laser_hurdle',
    label: '고압 레이저 허들',
    jumpHint: '중간점프',
    width: 64,
    height: 36,
    color: '#ff0055',
    minLevel: 2
  },
  medium_crate: {
    key: 'medium_crate',
    label: '강철 장갑 바리케이드',
    jumpHint: '중간점프',
    width: 78,
    height: 34,
    color: '#ff5500',
    minLevel: 3
  },
  flame_geyser: {
    key: 'flame_geyser',
    label: '플라즈마 화염 분출기',
    jumpHint: '중간점프',
    width: 86,
    height: 40,
    color: '#ff2a00',
    minLevel: 5
  },
  long_trench: {
    key: 'long_trench',
    label: '장거리 가시 지대',
    jumpHint: '길게점프!',
    width: 132,
    height: 30,
    color: '#ff1744',
    minLevel: 7
  },
  crystal_cluster: {
    key: 'crystal_cluster',
    label: '블러드 크리스탈 암석군',
    jumpHint: '길게점프!',
    width: 144,
    height: 38,
    color: '#e60039',
    minLevel: 10
  },
  tall_pylon: {
    key: 'tall_pylon',
    label: '테슬라 고압 타워',
    jumpHint: '높게점프!',
    width: 48,
    height: 54,
    color: '#ff0066',
    minLevel: 14
  },
  spider_mech: {
    key: 'spider_mech',
    label: '보초 스파이더 포탑',
    jumpHint: '길게점프!',
    width: 112,
    height: 44,
    color: '#ff3300',
    minLevel: 18
  },
  mega_fortress: {
    key: 'mega_fortress',
    label: '초장거리 중장갑 벙커',
    jumpHint: '최대롱점프!',
    width: 168,
    height: 42,
    color: '#ff0033',
    minLevel: 24
  }
};

class Obstacle {
  constructor(worldX, typeKey) {
    const spec = OBSTACLE_TYPES[typeKey] || OBSTACLE_TYPES.short_spike;
    this.worldX = worldX;
    this.typeKey = spec.key;
    this.label = spec.label;
    this.jumpHint = spec.jumpHint;
    this.width = spec.width;
    this.height = spec.height;
    this.color = spec.color;

    this.maxHp = 3;
    this.hp = 3;
    this.hitFlashTimer = 0;
    this.animTimer = Math.random() * 10;
    this.destroyed = false;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.12;
    if (this.hp <= 0) {
      this.destroyed = true;
    }
    return this.destroyed;
  }

  update(dt) {
    this.animTimer += dt;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }
  }

  checkCollision(bike) {
    const bikeHalfW = 10; // 작아진 오토바이에 맞춘 정밀 히트박스
    const bikeLeft = bike.worldX - bikeHalfW;
    const bikeRight = bike.worldX + bikeHalfW;

    const obsLeft = this.worldX + 3;
    const obsRight = this.worldX + this.width - 3;

    if (bikeRight < obsLeft || bikeLeft > obsRight) {
      return false;
    }

    if (bike.airHeight < this.height - 5) {
      return true;
    }
    return false;
  }

  // 모든 장애물 하단에 공통 '위험 경고 받침대(노란/검정 빗금)'를 그려 아이템과 한눈에 구분되게 함
  drawHazardBase(ctx, sx, groundY, width) {
    const baseH = 6;
    ctx.save();
    ctx.fillStyle = '#1a0508';
    ctx.strokeStyle = '#ff1e38';
    ctx.lineWidth = 1.2;
    ctx.fillRect(sx, groundY - baseH, width, baseH);
    ctx.strokeRect(sx, groundY - baseH, width, baseH);

    // 노란색 위험 사선 줄무늬
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 4; x < width - 2; x += 9) {
      ctx.moveTo(sx + x, groundY);
      ctx.lineTo(sx + Math.min(width, x + 5), groundY - baseH);
    }
    ctx.stroke();
    ctx.restore();
  }

  render(ctx, cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    if (sx + this.width < -60 || sx > ctx.canvas.width + 80) return;

    const centerWx = this.worldX + this.width * 0.5;
    const centerGroundY = road.getRoadY(centerWx, canvasHeight);

    ctx.save();
    const activeColor = this.hitFlashTimer > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = activeColor;
    ctx.fillStyle = this.hitFlashTimer > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(65, 6, 16, 0.85)';
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = this.hitFlashTimer > 0 ? 20 : 10;
    ctx.lineWidth = 2.2;

    if (this.typeKey === 'short_spike') {
      // 1. 삼각 가시 트랩
      const count = 2;
      const stepW = this.width / count;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const wx1 = this.worldX + i * stepW;
        const wxMid = wx1 + stepW * 0.5;
        const wx2 = wx1 + stepW;
        const y1 = road.getRoadY(wx1, canvasHeight);
        const yMid = road.getRoadY(wxMid, canvasHeight) - this.height;
        const y2 = road.getRoadY(wx2, canvasHeight);
        ctx.moveTo(wx1 - cameraX, y1);
        ctx.lineTo(wxMid - cameraX, yMid);
        ctx.lineTo(wx2 - cameraX, y2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.typeKey === 'saw_blade') {
      // 2. 회전 원형 톱날
      const cx = sx + this.width * 0.5;
      const cy = centerGroundY - this.height * 0.45;
      const r = this.height * 0.52;
      const teeth = 10;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.animTimer * 7);
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const rad = i % 2 === 0 ? r : r * 0.68;
        const a = (i * Math.PI) / teeth;
        const tx = Math.cos(a) * rad;
        const ty = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff1e38';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (this.typeKey === 'laser_hurdle') {
      // 3. 고압 레이저 허들 (양쪽 기둥 + 붉은 레이저 빔 3줄)
      const leftY = road.getRoadY(this.worldX + 4, canvasHeight);
      const rightY = road.getRoadY(this.worldX + this.width - 4, canvasHeight);
      ctx.fillRect(sx, leftY - this.height, 8, this.height);
      ctx.strokeRect(sx, leftY - this.height, 8, this.height);
      ctx.fillRect(sx + this.width - 8, rightY - this.height, 8, this.height);
      ctx.strokeRect(sx + this.width - 8, rightY - this.height, 8, this.height);

      ctx.strokeStyle = '#ff0044';
      ctx.lineWidth = 2.5;
      for (let b = 1; b <= 3; b++) {
        const hRatio = (b / 4) * this.height;
        const jitter = Math.sin(this.animTimer * 24 + b) * 2;
        ctx.beginPath();
        ctx.moveTo(sx + 8, leftY - hRatio);
        ctx.lineTo(sx + this.width * 0.5, (leftY + rightY) * 0.5 - hRatio + jitter);
        ctx.lineTo(sx + this.width - 8, rightY - hRatio);
        ctx.stroke();
      }
    } else if (this.typeKey === 'medium_crate') {
      // 4. 강철 장갑 바리케이드
      const boxes = 2;
      const bw = this.width / boxes;
      for (let i = 0; i < boxes; i++) {
        const bx = this.worldX + i * bw;
        const by = road.getRoadY(bx + bw * 0.5, canvasHeight);
        const rx = bx - cameraX + 2;
        const ry = by - this.height;
        const rw = bw - 4;
        const rh = this.height;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.moveTo(rx + rw, ry);
        ctx.lineTo(rx, ry + rh);
        ctx.stroke();
      }
    } else if (this.typeKey === 'flame_geyser') {
      // 5. 플라즈마 화염 분출기 (바닥 노즐 3개에서 화염 기둥 분출)
      const nozzles = 3;
      const nw = this.width / nozzles;
      for (let i = 0; i < nozzles; i++) {
        const nx = sx + i * nw + nw * 0.5;
        const ny = road.getRoadY(this.worldX + (i + 0.5) * nw, canvasHeight);
        const flameH = this.height * (0.82 + Math.sin(this.animTimer * 14 + i * 2) * 0.18);

        ctx.fillStyle = 'rgba(255, 60, 0, 0.75)';
        ctx.beginPath();
        ctx.moveTo(nx - nw * 0.36, ny - 6);
        ctx.quadraticCurveTo(nx - nw * 0.2, ny - flameH * 0.6, nx, ny - flameH);
        ctx.quadraticCurveTo(nx + nw * 0.2, ny - flameH * 0.6, nx + nw * 0.36, ny - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (this.typeKey === 'long_trench') {
      // 6. 장거리 가시 지대
      const spikes = 6;
      const stepW = this.width / spikes;
      ctx.beginPath();
      const firstY = road.getRoadY(this.worldX, canvasHeight);
      ctx.moveTo(sx, firstY);
      for (let i = 0; i < spikes; i++) {
        const wxMid = this.worldX + (i + 0.5) * stepW;
        const wxEnd = this.worldX + (i + 1) * stepW;
        const yMid = road.getRoadY(wxMid, canvasHeight) - this.height;
        const yEnd = road.getRoadY(wxEnd, canvasHeight);
        ctx.lineTo(wxMid - cameraX, yMid);
        ctx.lineTo(wxEnd - cameraX, yEnd);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.typeKey === 'crystal_cluster') {
      // 7. 블러드 크리스탈 암석군 (비대칭 수정 기둥 5개)
      const peaks = [0.75, 1.0, 0.68, 0.95, 0.8];
      const pw = this.width / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const wx = this.worldX + (i + 0.5) * pw;
        const gy = road.getRoadY(wx, canvasHeight);
        const px = wx - cameraX;
        const ph = this.height * peaks[i];
        ctx.beginPath();
        ctx.moveTo(px - pw * 0.48, gy);
        ctx.lineTo(px - pw * 0.2, gy - ph * 0.85);
        ctx.lineTo(px + pw * 0.08, gy - ph);
        ctx.lineTo(px + pw * 0.48, gy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (this.typeKey === 'tall_pylon') {
      // 8. 테슬라 고압 타워
      const by = centerGroundY;
      const rx = sx + 8;
      const rw = this.width - 16;
      const ry = by - this.height;
      ctx.fillRect(rx, ry + 10, rw, this.height - 10);
      ctx.strokeRect(rx, ry + 10, rw, this.height - 10);
      for (let h = 14; h < this.height - 10; h += 12) {
        ctx.beginPath();
        ctx.moveTo(rx - 5, by - h);
        ctx.lineTo(rx + rw + 5, by - h);
        ctx.stroke();
      }
      // 상단 고압 코일 구체
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(sx + this.width * 0.5, ry + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.typeKey === 'spider_mech') {
      // 9. 보초 스파이더 포탑
      const cx = sx + this.width * 0.5;
      const cy = centerGroundY - this.height * 0.58;
      // 4개의 기계 다리
      ctx.beginPath();
      const legOffsets = [-0.42, -0.22, 0.22, 0.42];
      for (const off of legOffsets) {
        const footX = cx + this.width * off;
        const kneeX = cx + this.width * (off * 0.65);
        const footY = road.getRoadY(this.worldX + this.width * (0.5 + off), canvasHeight);
        ctx.moveTo(cx, cy);
        ctx.lineTo(kneeX, cy - 10);
        ctx.lineTo(footX, footY);
      }
      ctx.stroke();

      // 포탑 돔 몸체 & 붉은 센서 눈
      ctx.beginPath();
      ctx.arc(cx, cy, 16, Math.PI, 0);
      ctx.lineTo(cx + 18, cy + 6);
      ctx.lineTo(cx - 18, cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 3, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 10. 초장거리 중장갑 벙커
      const segs = 4;
      const sw = this.width / segs;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const wx = this.worldX + i * sw;
        const gy = road.getRoadY(wx, canvasHeight);
        if (i === 0) ctx.moveTo(wx - cameraX, gy);
        else ctx.lineTo(wx - cameraX, gy);
      }
      for (let i = segs; i >= 0; i--) {
        const wx = this.worldX + i * sw;
        const gy = road.getRoadY(wx, canvasHeight) - this.height - (i % 2 === 1 ? 7 : 0);
        ctx.lineTo(wx - cameraX, gy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 하단 노란/검정 위험 경고 줄무늬 받침대
    this.drawHazardBase(ctx, sx, centerGroundY, this.width);

    // 상단 3칸 체력(HP) 게이지 & 붉은 '⚠ 위험' 태그
    const uiX = sx + this.width * 0.5;
    const uiY = centerGroundY - this.height - 14;

    const pipW = 10;
    const pipH = 4.5;
    const pipGap = 3;
    const totalPipW = this.maxHp * pipW + (this.maxHp - 1) * pipGap;
    const startPipX = uiX - totalPipW * 0.5;

    ctx.shadowBlur = 0;
    for (let i = 0; i < this.maxHp; i++) {
      const px = startPipX + i * (pipW + pipGap);
      if (i < this.hp) {
        ctx.fillStyle = this.hp === 3 ? '#ff1e38' : this.hp === 2 ? '#ff7b00' : '#ffe600';
        ctx.fillRect(px, uiY, pipW, pipH);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(px, uiY, pipW, pipH);
      }
      ctx.strokeStyle = 'rgba(255, 120, 120, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(px, uiY, pipW, pipH);
    }

    ctx.font = '800 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8090';
    ctx.fillText(`⚠ ${this.jumpHint}`, uiX, uiY - 4);

    ctx.restore();
  }
}

// 도로 선 곡면을 따라 날아가는 총알 & 바주카포 발사체
class Projectile {
  constructor(worldX, heightOffset, type) {
    this.worldX = worldX;
    this.heightOffset = Math.max(12, Math.min(40, heightOffset));
    this.type = type;
    this.speed = type === 'bullet' ? 980 : 760;
    this.damage = type === 'bullet' ? 1 : 3;
    this.active = true;
    this.distanceTraveled = 0;
    this.maxRange = 850;
  }

  update(dt, bikeSpeed) {
    const move = (this.speed + bikeSpeed * 0.65) * dt;
    this.worldX += move;
    this.distanceTraveled += move;
    if (this.distanceTraveled > this.maxRange) {
      this.active = false;
    }
  }

  getScreenPos(cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    const roadY = road.getRoadY(this.worldX, canvasHeight);
    const sy = roadY - this.heightOffset;
    return { sx, sy };
  }

  render(ctx, cameraX, road, canvasHeight) {
    const { sx, sy } = this.getScreenPos(cameraX, road, canvasHeight);
    const angle = road.getRoadAngle(this.worldX, canvasHeight);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    if (this.type === 'bullet') {
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 16;

      ctx.fillStyle = '#ff9900';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-24 - Math.random() * 8, -4);
      ctx.lineTo(-20 - Math.random() * 6, 0);
      ctx.lineTo(-24 - Math.random() * 8, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#00f3ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(3, -5);
      ctx.lineTo(-10, -4);
      ctx.lineTo(-10, 4);
      ctx.lineTo(3, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// 장애물과 한눈에 구분되는 '공중 부양 홀로그램 보급 상자(총알 탄약통 / 바주카 런처)' 아이템
class WeaponItem {
  constructor(worldX, type, floatHeight = 38) {
    this.worldX = worldX;
    this.type = type; // 'bullet' | 'bazooka'
    this.floatHeight = Math.max(34, floatHeight);
    this.bobPhase = Math.random() * Math.PI * 2;
    this.collected = false;
    this.boxSize = 28;
  }

  update(dt) {
    this.bobPhase += dt * 4.2;
  }

  getScreenPos(cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    const groundY = road.getRoadY(this.worldX, canvasHeight);
    const sy = groundY - this.floatHeight + Math.sin(this.bobPhase) * 6;
    return { sx, sy, groundY };
  }

  render(ctx, cameraX, road, canvasHeight) {
    const { sx, sy, groundY } = this.getScreenPos(cameraX, road, canvasHeight);
    if (sx < -60 || sx > ctx.canvas.width + 60) return;

    const isBazooka = this.type === 'bazooka';
    // 장애물(적색)과 정반대인 밝은 에메랄드 그린(총알 보급) & 스카이 시안-골드(바주카 보급) 컬러 사용
    const auraColor = isBazooka ? '#00f3ff' : '#00ff88';
    const accentColor = isBazooka ? '#ffd700' : '#ffe600';

    ctx.save();

    // 1. 도로 바닥에서 보급 캡슐로 올라오는 부드러운 에메랄드/시안 홀로그램 빛기둥
    const beamGrad = ctx.createLinearGradient(sx, sy, sx, groundY);
    beamGrad.addColorStop(0, auraColor + '55');
    beamGrad.addColorStop(1, auraColor + '00');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(sx - 10, sy, 20, Math.max(0, groundY - sy));

    ctx.translate(sx, sy);

    // 2. 외곽 후광 오라 원 & 날개형 낙하산 홀로그램 아치
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 16;

    // 상단 미니 낙하산/윙 캐노피 (아이템임을 직관적으로 표현)
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -18, 16, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-13, -22);
    ctx.lineTo(-8, -14);
    ctx.moveTo(13, -22);
    ctx.lineTo(8, -14);
    ctx.stroke();

    // 3. 둥근 사각형 보급 캡슐 본체 (밝은 테두리 + 진한 네이비 배경)
    const half = this.boxSize * 0.5;
    ctx.fillStyle = 'rgba(4, 24, 36, 0.92)';
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-half, -half, this.boxSize, this.boxSize, 7);
    ctx.fill();
    ctx.stroke();

    // 4. 캡슐 내부에 실제 무기 모양 벡터 드로잉 (총알 3발 vs 바주카포 로켓)
    ctx.shadowBlur = 0;
    if (!isBazooka) {
      // 황금색 총알 탄약 3발 나란히 묘사
      for (let i = -1; i <= 1; i++) {
        const bx = i * 6.5;
        // 탄피
        ctx.fillStyle = '#ffb700';
        ctx.fillRect(bx - 2, -2, 4, 9);
        // 탄두
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.moveTo(bx - 2, -2);
        ctx.lineTo(bx, -8);
        ctx.lineTo(bx + 2, -2);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // 바주카포 로켓 탄두 & 발사관 묘사
      ctx.save();
      ctx.rotate(-Math.PI / 4);
      // 로켓 몸통
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(-3, -5, 6, 11);
      // 붉은/황금 탄두 노즈콘
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(0, -12);
      ctx.lineTo(4, -5);
      ctx.closePath();
      ctx.fill();
      // 날개 핀
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, 3, 12, 3);
      ctx.restore();
    }

    // 5. 상단 선명한 초록/하늘색 보급 캡슐 이름표 배지
    const badgeW = 68;
    const badgeH = 15;
    const badgeY = -half - 24;
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.roundRect(-badgeW * 0.5, badgeY, badgeW, badgeH, 99);
    ctx.fill();

    ctx.fillStyle = '#031018';
    ctx.font = '900 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isBazooka ? '🎁 바주카 +1' : '🎁 총알 +6', 0, badgeY + badgeH * 0.5 + 0.5);

    ctx.restore();
  }
}

// 파티클 및 충격파 / 플로팅 텍스트 매니저
class EffectsManager {
  constructor() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
  }

  clear() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
  }

  spawnExplosion(worldX, y, color, count = 18, isMega = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isMega ? 120 : 60) + Math.random() * (isMega ? 280 : 160);
      this.particles.push({
        worldX,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: Math.random() * (isMega ? 5 : 3.5) + 2,
        color: Math.random() > 0.3 ? color : '#ffffff',
        life: 1,
        decay: 1.5 + Math.random() * 1.4
      });
    }

    this.shockwaves.push({
      worldX,
      y,
      radius: 8,
      maxRadius: isMega ? 115 : 52,
      color,
      alpha: 1
    });
  }

  spawnFloatingText(worldX, y, text, color = '#00f3ff') {
    this.floatingTexts.push({
      worldX,
      y,
      text,
      color,
      alpha: 1,
      vy: -48
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.worldX += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += (s.maxRadius - s.radius) * Math.min(1, dt * 9);
      s.alpha -= dt * 2.6;
      if (s.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.y += f.vy * dt;
      f.alpha -= dt * 1.25;
      if (f.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx, cameraX) {
    ctx.save();
    for (const s of this.shockwaves) {
      const sx = s.worldX - cameraX;
      ctx.beginPath();
      ctx.arc(sx, s.y, s.radius, 0, Math.PI * 2);
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    for (const p of this.particles) {
      const sx = p.worldX - cameraX;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(sx - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }

    ctx.shadowBlur = 0;
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    for (const f of this.floatingTexts) {
      const sx = f.worldX - cameraX;
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, f.y);
    }
    ctx.restore();
  }
}

window.NeonBike = NeonBike;
window.Obstacle = Obstacle;
window.OBSTACLE_TYPES = OBSTACLE_TYPES;
window.Projectile = Projectile;
window.WeaponItem = WeaponItem;
window.EffectsManager = EffectsManager;
