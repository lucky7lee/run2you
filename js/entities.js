// 오토바이, 장애물(길이/난이도별 5종), 총알/바주카 발사체, 아이템, 이펙트 엔티티 모듈

class NeonBike {
  constructor() {
    this.worldX = 120;
    this.screenXRatio = 0.21; // 화면 좌측 21% 지점에 오토바이 배치 (전방 시야 확보)
    this.y = 0;
    this.airHeight = 0; // 도로 선으로부터의 체공 높이 (경사로에서도 일정한 점프 스펙 보장)
    this.vy = 0;
    this.angle = 0;
    this.wheelRot = 0;

    // 점프 물리 파라미터 (짧은 점프 vs 긴 점프 정밀 제어)
    this.isGrounded = true;
    this.isHoldingJump = false;
    this.jumpHoldTime = 0;
    this.maxJumpHoldTime = 0.32; // 최대 홀드 시간(초) - 길게 누를수록 멀리/높이 도약
    this.coyoteTimer = 0; // 지면 이탈 직후 점프 허용 유예 시간
    this.jumpBufferTimer = 0; // 착지 직전 점프 선입력 버퍼

    // 차체 크기 (충돌 박스용)
    this.width = 56;
    this.height = 34;

    // 네온 잔상 트레일
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
      // 상승 중 버튼을 일찍 떼면 상승 속도를 즉시 감쇠시켜 짧은 점프(Short Hop) 구현
      if (!this.isGrounded && this.vy > 110) {
        this.vy *= 0.42;
      }
    }
  }

  executeJump(road, canvasHeight) {
    const roadAngle = road.getRoadAngle(this.worldX, canvasHeight);
    // 오르막 경사 탄력 보너스
    const slopeBonus = roadAngle < 0 ? Math.abs(roadAngle) * 75 : 0;
    this.vy = 430 + slopeBonus; // 양수(+)가 도로 위쪽 방향 상승 속도
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
    this.wheelRot += (speedPx * dt) / 14;
    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer -= dt;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

    const groundY = road.getRoadY(this.worldX, canvasHeight);
    const groundAngle = road.getRoadAngle(this.worldX, canvasHeight);

    if (this.isGrounded) {
      this.coyoteTimer = 0.085;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }

    // 점프 실행 판정 (지면 위 또는 코요테 타임 내)
    if (this.jumpBufferTimer > 0 && (this.isGrounded || this.coyoteTimer > 0)) {
      this.executeJump(road, canvasHeight);
    }

    if (!this.isGrounded) {
      // 점프 버튼을 길게 누르고 있는 동안 추가 부스트 양력 제공 -> 긴 장애물도 여유 있게 도약
      if (this.isHoldingJump && this.jumpHoldTime < this.maxJumpHoldTime && this.vy > 0) {
        const prevHold = this.jumpHoldTime;
        this.jumpHoldTime += dt;
        this.vy += 1160 * dt;
        if (prevHold < 0.13 && this.jumpHoldTime >= 0.13) {
          window.soundManager.playJump(true);
        }
      }

      // 중력 적용 (상승 중보다 하강 시 중력을 높여 경쾌한 조작감 제공)
      const gravity = this.vy > 0 ? 1560 : 1920;
      this.vy -= gravity * dt;
      this.airHeight += this.vy * dt;

      // 도로 선 착지 체크
      if (this.airHeight <= 0) {
        this.airHeight = 0;
        this.vy = 0;
        this.isGrounded = true;
        this.angle = groundAngle;
      } else {
        // 공중 자세 제어 (도약 시 앞바퀴를 살짝 드는 윌리 모션 후 도로 기울기에 맞춰 복귀)
        const targetAirAngle = groundAngle * 0.5 + Math.max(-0.42, Math.min(0.32, -this.vy * 0.00075 - 0.1));
        this.angle += (targetAirAngle - this.angle) * Math.min(1, dt * 10);
      }
    } else {
      this.airHeight = 0;
      this.vy = 0;
      this.angle += (groundAngle - this.angle) * Math.min(1, dt * 18);
    }

    this.y = groundY - this.airHeight;

    // 네온 부스터 잔상 저장
    this.trail.push({
      wx: this.worldX - 24,
      y: this.y - 10,
      alpha: 0.85,
      isLongJump: !this.isGrounded && this.jumpHoldTime > 0.12
    });
    if (this.trail.length > 18) {
      this.trail.shift();
    }
    for (const t of this.trail) {
      t.alpha -= dt * 3.2;
    }
  }

  getHitbox(cameraX) {
    const sx = this.worldX - cameraX;
    return {
      x: sx - 20,
      y: this.y - 30,
      w: 40,
      h: 28
    };
  }

  render(ctx, cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    const sy = this.y;

    // 1. 공중 점프 시 예상 착지 궤적 가이드 점선 표시 (긴 장애물 넘기 감각 극대화)
    if (!this.isGrounded) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = this.jumpHoldTime > 0.12 ? 'rgba(57, 255, 20, 0.38)' : 'rgba(0, 243, 255, 0.3)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      const groundY = road.getRoadY(this.worldX, canvasHeight);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, groundY);
      ctx.stroke();
      ctx.restore();
    }

    // 2. 네온 배기 트레일 렌더링
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
        ctx.lineWidth = p1.isLongJump ? 4.5 : 3;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. 오토바이 본체 (네온 벡터 라인 아트)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    const wheelRadius = 11;
    const rearWheelX = -19;
    const frontWheelX = 20;
    const wheelY = -wheelRadius;

    // 헤드라이트 네온 빔
    const beamGrad = ctx.createLinearGradient(frontWheelX + 4, wheelY - 12, frontWheelX + 95, wheelY - 4);
    beamGrad.addColorStop(0, 'rgba(0, 243, 255, 0.42)');
    beamGrad.addColorStop(1, 'rgba(0, 243, 255, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(frontWheelX + 2, wheelY - 14);
    ctx.lineTo(frontWheelX + 98, wheelY - 28);
    ctx.lineTo(frontWheelX + 98, wheelY + 6);
    ctx.closePath();
    ctx.fill();

    // 뒷바퀴 & 앞바퀴
    this.drawNeonWheel(ctx, rearWheelX, wheelY, wheelRadius, '#00f3ff');
    this.drawNeonWheel(ctx, frontWheelX, wheelY, wheelRadius, '#00f3ff');

    // 프레임 & 사이버 카울 (네온 마젠타 + 시안 조합)
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    // 스윙암 -> 엔진 코어 -> 프론트 포크
    ctx.moveTo(rearWheelX, wheelY);
    ctx.lineTo(-4, wheelY - 11);
    ctx.lineTo(11, wheelY - 16);
    ctx.lineTo(frontWheelX, wheelY);
    // 상단 탱크 & 테일 라인
    ctx.moveTo(rearWheelX - 6, wheelY - 15);
    ctx.lineTo(-7, wheelY - 14);
    ctx.lineTo(8, wheelY - 21);
    ctx.lineTo(18, wheelY - 17);
    ctx.lineTo(11, wheelY - 10);
    ctx.closePath();
    ctx.stroke();

    // 라이더 실루엣 (사이버 헬멧 & 숙인 라이딩 포즈)
    ctx.strokeStyle = '#ff2a85';
    ctx.shadowColor = '#ff2a85';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    // 등허리 ~ 어깨 ~ 팔
    ctx.moveTo(-8, wheelY - 15);
    ctx.lineTo(-1, wheelY - 27);
    ctx.lineTo(11, wheelY - 20);
    // 다리
    ctx.moveTo(-8, wheelY - 15);
    ctx.lineTo(-2, wheelY - 7);
    ctx.stroke();

    // 헬멧 바이저
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(3, wheelY - 30, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 총구 화염 이펙트 (사격 직후)
    if (this.muzzleFlashTimer > 0) {
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 16;
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
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // 휠 스포크 선
    ctx.lineWidth = 1.2;
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

// 장애물 정의 (길이 및 난이도 매칭 - 모든 장애물은 총알 3발 또는 바주카 1발로 파괴 가능)
const OBSTACLE_TYPES = {
  short_spike: {
    key: 'short_spike',
    label: '단거리 가시',
    jumpHint: '짧은 점프',
    width: 44,
    height: 36,
    color: '#ff2a85',
    minLevel: 1
  },
  medium_crate: {
    key: 'medium_crate',
    label: '듀얼 바리케이드',
    jumpHint: '중간 점프',
    width: 88,
    height: 40,
    color: '#ff7b00',
    minLevel: 1
  },
  long_trench: {
    key: 'long_trench',
    label: '장거리 플라즈마 트랩',
    jumpHint: '길게 점프!',
    width: 148,
    height: 34,
    color: '#ffe600',
    minLevel: 2
  },
  tall_pylon: {
    key: 'tall_pylon',
    label: '고압 레이저 파일런',
    jumpHint: '높게 점프!',
    width: 56,
    height: 62,
    color: '#bc13fe',
    minLevel: 3
  },
  mega_fortress: {
    key: 'mega_fortress',
    label: '초장거리 헤비 벙커',
    jumpHint: '최대 롱점프 / 바주카!',
    width: 184,
    height: 44,
    color: '#ff0055',
    minLevel: 4
  }
};

class Obstacle {
  constructor(worldX, typeKey) {
    const spec = OBSTACLE_TYPES[typeKey] || OBSTACLE_TYPES.short_spike;
    this.worldX = worldX; // 장애물 앞쪽(좌측) 기준 월드 X
    this.typeKey = spec.key;
    this.label = spec.label;
    this.jumpHint = spec.jumpHint;
    this.width = spec.width;
    this.height = spec.height;
    this.color = spec.color;

    // 총알 3번 맞춰야 파괴, 바주카는 1번에 3 데미지로 즉시 파괴
    this.maxHp = 3;
    this.hp = 3;
    this.hitFlashTimer = 0;
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
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }
  }

  // 도로 곡선을 따라 장애물의 충돌 영역 계산
  checkCollision(bike, cameraX) {
    const bikeHalfW = 16;
    const bikeLeft = bike.worldX - bikeHalfW;
    const bikeRight = bike.worldX + bikeHalfW;

    const obsLeft = this.worldX + 4;
    const obsRight = this.worldX + this.width - 4;

    // 수평 겹침 판정
    if (bikeRight < obsLeft || bikeLeft > obsRight) {
      return false;
    }

    // 오토바이의 도로 대비 체공 높이(airHeight)가 장애물 높이보다 낮으면 충돌
    if (bike.airHeight < this.height - 6) {
      return true;
    }
    return false;
  }

  render(ctx, cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    if (sx + this.width < -60 || sx > ctx.canvas.width + 80) return;

    const centerWx = this.worldX + this.width * 0.5;
    const centerGroundY = road.getRoadY(centerWx, canvasHeight);

    ctx.save();
    const activeColor = this.hitFlashTimer > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = activeColor;
    ctx.fillStyle = activeColor + '28';
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = this.hitFlashTimer > 0 ? 22 : 12;
    ctx.lineWidth = 2.4;

    if (this.typeKey === 'short_spike') {
      // 단거리 2연속 네온 스파이크 피라미드
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
    } else if (this.typeKey === 'medium_crate') {
      // 중거리 네온 X-바리케이드 박스 2개 연결
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
    } else if (this.typeKey === 'long_trench') {
      // 장거리 플라즈마 가시 지대 (도로 곡면을 따라 길게 늘어선 톱니 레이저)
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
    } else if (this.typeKey === 'tall_pylon') {
      // 고압 레이저 타워 (높은 수직 타워)
      const by = centerGroundY;
      const rx = sx + 6;
      const rw = this.width - 12;
      const ry = by - this.height;
      ctx.fillRect(rx, ry, rw, this.height);
      ctx.strokeRect(rx, ry, rw, this.height);
      // 가로 코일 선
      for (let h = 14; h < this.height; h += 14) {
        ctx.beginPath();
        ctx.moveTo(rx - 5, by - h);
        ctx.lineTo(rx + rw + 5, by - h);
        ctx.stroke();
      }
    } else {
      // 초장거리 헤비 벙커 (아머드 네온 월)
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
        const gy = road.getRoadY(wx, canvasHeight) - this.height - (i % 2 === 1 ? 8 : 0);
        ctx.lineTo(wx - cameraX, gy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 상단 3칸 체력(HP) 게이지 & 점프 길이 힌트 표시
    const uiX = sx + this.width * 0.5;
    const uiY = centerGroundY - this.height - 16;

    // 3칸 HP 블록 (총알 3발 파괴 시스템 시각화)
    const pipW = 11;
    const pipH = 5;
    const pipGap = 3;
    const totalPipW = this.maxHp * pipW + (this.maxHp - 1) * pipGap;
    const startPipX = uiX - totalPipW * 0.5;

    ctx.shadowBlur = 0;
    for (let i = 0; i < this.maxHp; i++) {
      const px = startPipX + i * (pipW + pipGap);
      if (i < this.hp) {
        ctx.fillStyle = this.hp === 3 ? '#ff2a85' : this.hp === 2 ? '#ff9900' : '#ffe600';
        ctx.fillRect(px, uiY, pipW, pipH);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(px, uiY, pipW, pipH);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(px, uiY, pipW, pipH);
    }

    // 점프 길이 가이드 태그 (단거리 vs 장거리 식별)
    ctx.font = '800 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.width >= 130 ? '#ffe600' : '#b8d4ff';
    ctx.fillText(this.jumpHint, uiX, uiY - 5);

    ctx.restore();
  }
}

// 도로 선 곡면을 따라 날아가는 총알 & 바주카포 발사체
class Projectile {
  constructor(worldX, heightOffset, type) {
    this.worldX = worldX;
    // 도로 위 일정 높이로 궤적을 유지하여 언덕/경사로 위 장애물도 정확히 타격
    this.heightOffset = Math.max(16, Math.min(48, heightOffset));
    this.type = type; // 'bullet' (데미지 1) | 'bazooka' (데미지 3 - 즉시 파괴)
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
      // 고속 레이저 총알
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(8, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 바주카 플라즈마 탄두
      ctx.shadowColor = '#ff2a85';
      ctx.shadowBlur = 18;

      // 후방 추진 화염
      ctx.fillStyle = '#ff9900';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-28 - Math.random() * 10, -5);
      ctx.lineTo(-24 - Math.random() * 8, 0);
      ctx.lineTo(-28 - Math.random() * 10, 5);
      ctx.closePath();
      ctx.fill();

      // 로켓 본체
      ctx.fillStyle = '#ff2a85';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(4, -6);
      ctx.lineTo(-12, -5);
      ctx.lineTo(-12, 5);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// 도로 위에서 획득하는 무기 보급 아이템 (총알 팩 & 바주카포)
class WeaponItem {
  constructor(worldX, type, floatHeight = 28) {
    this.worldX = worldX;
    this.type = type; // 'bullet' | 'bazooka'
    this.floatHeight = floatHeight;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.collected = false;
    this.radius = 16;
  }

  update(dt) {
    this.bobPhase += dt * 4.5;
  }

  getScreenPos(cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    const groundY = road.getRoadY(this.worldX, canvasHeight);
    const sy = groundY - this.floatHeight + Math.sin(this.bobPhase) * 5;
    return { sx, sy };
  }

  render(ctx, cameraX, road, canvasHeight) {
    const { sx, sy } = this.getScreenPos(cameraX, road, canvasHeight);
    if (sx < -50 || sx > ctx.canvas.width + 50) return;

    ctx.save();
    ctx.translate(sx, sy);

    const isBazooka = this.type === 'bazooka';
    const color = isBazooka ? '#ff2a85' : '#ffe600';

    // 외곽 회전 육각/원형 네온 링
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(8, 12, 28, 0.85)';
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 아이콘 및 라벨 텍스트
    ctx.shadowBlur = 0;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isBazooka ? '🚀' : '⚡', 0, -1);

    ctx.font = '900 9px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(isBazooka ? 'BAZOOKA +1' : 'BULLET +6', 0, -this.radius - 7);

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
