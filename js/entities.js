// 소형 네온 바이크 + 10초 무적 비행기 변신, 1~3연속 결합 장애물 & 점프 금지 공중 장애물, 보급/비행기 아이템 모듈

class NeonBike {
  constructor() {
    this.worldX = 120;
    this.screenXRatio = 0.20;
    this.y = 0;
    this.airHeight = 0;
    this.vy = 0;
    this.angle = 0;
    this.wheelRot = 0;

    // 점프 물리 파라미터
    this.isGrounded = true;
    this.isHoldingJump = false;
    this.jumpHoldTime = 0;
    this.maxJumpHoldTime = 0.34;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    // 비행기 변신 무적 모드 타이머 (10초간 자동 무적 비행)
    this.airplaneTimer = 0;
    this.postFlightShieldTimer = 0;

    // 아담하고 날렵한 차체 크기
    this.scale = 0.60;
    this.width = 34;
    this.height = 18;

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
    this.airplaneTimer = 0;
    this.postFlightShieldTimer = 0;
    this.trail = [];
    this.muzzleFlashTimer = 0;
  }

  activateAirplane(durationSec = 10.0) {
    this.airplaneTimer = durationSec;
    this.isGrounded = false;
    this.isHoldingJump = false;
    this.jumpBufferTimer = 0;
  }

  isAirplaneMode() {
    return this.airplaneTimer > 0;
  }

  isInvincible() {
    return this.airplaneTimer > 0 || this.postFlightShieldTimer > 0;
  }

  requestJump() {
    if (this.isAirplaneMode()) return; // 비행기 모드에서는 별도 조작 불필요
    this.jumpBufferTimer = 0.12;
    this.isHoldingJump = true;
  }

  releaseJump() {
    if (this.isHoldingJump) {
      this.isHoldingJump = false;
      if (!this.isGrounded && !this.isAirplaneMode() && this.vy > 105) {
        this.vy *= 0.42;
      }
    }
  }

  executeJump(road, canvasHeight) {
    const roadAngle = road.getRoadAngle(this.worldX, canvasHeight);
    const slopeBonus = roadAngle < 0 ? Math.abs(roadAngle) * 70 : 0;
    this.vy = 430 + slopeBonus;
    this.airHeight = 1;
    this.isGrounded = false;
    this.jumpHoldTime = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    window.soundManager.playJump(false);
  }

  getJumpHoldRatio() {
    if (this.isGrounded || this.isAirplaneMode()) return 0;
    return Math.min(1, this.jumpHoldTime / this.maxJumpHoldTime);
  }

  update(dt, speedPx, road, canvasHeight) {
    // 비행기 변신 중에는 초음속 부스트(1.32배 속도)로 자동 진행
    const effectiveSpeed = this.isAirplaneMode() ? speedPx * 1.32 : speedPx;
    this.worldX += effectiveSpeed * dt;
    this.wheelRot += (effectiveSpeed * dt) / 9;

    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer -= dt;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.postFlightShieldTimer > 0) this.postFlightShieldTimer -= dt;

    const groundY = road.getRoadY(this.worldX, canvasHeight);
    const groundAngle = road.getRoadAngle(this.worldX, canvasHeight);

    // 1. 비행기 변신 무적 자동비행 상태 처리
    if (this.airplaneTimer > 0) {
      this.airplaneTimer -= dt;
      this.isGrounded = false;
      // 도로 굴곡 위 약 68~86px 상공을 부드럽게 자동 순항
      const targetCruiseHeight = 76 + Math.sin(this.worldX * 0.01) * 10;
      this.airHeight += (targetCruiseHeight - this.airHeight) * Math.min(1, dt * 6.5);
      this.vy = 0;
      const targetJetAngle = groundAngle * 0.65 + Math.cos(this.worldX * 0.01) * 0.08;
      this.angle += (targetJetAngle - this.angle) * Math.min(1, dt * 10);

      // 10초 비행 종료 시 착륙 전환 및 1.5초 착지 보호막 부여
      if (this.airplaneTimer <= 0) {
        this.airplaneTimer = 0;
        this.postFlightShieldTimer = 1.5;
      }
    } else {
      // 2. 일반 오토바이 주행 및 점프 물리
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
          this.vy += 1170 * dt;
          if (prevHold < 0.13 && this.jumpHoldTime >= 0.13) {
            window.soundManager.playJump(true);
          }
        }

        const gravity = this.vy > 0 ? 1540 : 1880;
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
    }

    this.y = groundY - this.airHeight;

    this.trail.push({
      wx: this.worldX - 16,
      y: this.y - (this.isAirplaneMode() ? 2 : 6),
      alpha: 0.9,
      isAirplane: this.isAirplaneMode(),
      isLongJump: !this.isGrounded && this.jumpHoldTime > 0.12
    });
    if (this.trail.length > 20) {
      this.trail.shift();
    }
    for (const t of this.trail) {
      t.alpha -= dt * 3.2;
    }
  }

  render(ctx, cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    const sy = this.y;

    // 1. 공중 점프 시 착지 기준선 가이드
    if (!this.isGrounded && !this.isAirplaneMode()) {
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

    // 2. 네온 배기 트레일 (비행기 모드일 때는 황금/마젠타 부스터 궤적)
    if (this.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < this.trail.length; i++) {
        const p0 = this.trail[i - 1];
        const p1 = this.trail[i];
        if (p1.alpha <= 0) continue;
        ctx.beginPath();
        ctx.moveTo(p0.wx - cameraX, p0.y);
        ctx.lineTo(p1.wx - cameraX, p1.y);
        if (p1.isAirplane) {
          ctx.strokeStyle = `rgba(255, 215, 0, ${Math.max(0, p1.alpha)})`;
          ctx.lineWidth = 5;
        } else {
          ctx.strokeStyle = p1.isLongJump
            ? `rgba(57, 255, 20, ${Math.max(0, p1.alpha)})`
            : `rgba(0, 243, 255, ${Math.max(0, p1.alpha)})`;
          ctx.lineWidth = p1.isLongJump ? 3.2 : 2.2;
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. 비행기 변신 상태일 때 초음속 네온 제트기 렌더링
    if (this.isAirplaneMode()) {
      this.renderAirplane(ctx, sx, sy);
      return;
    }

    // 4. 일반 소형 네온 오토바이 렌더링
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // 비행 종료 직후 1.5초 보호막 깜빡임 표시
    if (this.postFlightShieldTimer > 0) {
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -10, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.scale(this.scale, this.scale);

    const wheelRadius = 11;
    const rearWheelX = -19;
    const frontWheelX = 20;
    const wheelY = -wheelRadius;

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

  // 10초 무적 비행기(초음속 네온 제트기) 렌더링
  renderAirplane(ctx, sx, sy) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // 무적 보호막 에너지 링
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.65)';
    ctx.fillStyle = 'rgba(255, 215, 0, 0.10)';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(2, -2, 34, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 후방 제트 엔진 애프터버너 불꽃
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.lineTo(-42 - Math.random() * 14, -7);
    ctx.lineTo(-36 - Math.random() * 10, -2);
    ctx.lineTo(-42 - Math.random() * 14, 3);
    ctx.closePath();
    ctx.fill();

    // 제트기 동체 및 델타 날개
    ctx.fillStyle = '#0a192f';
    ctx.strokeStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    ctx.moveTo(28, -2); // 기수(Nose)
    ctx.lineTo(8, -8);
    ctx.lineTo(-10, -18); // 상단 주익/수직미익
    ctx.lineTo(-22, -16);
    ctx.lineTo(-16, -6);
    ctx.lineTo(-24, -4);
    ctx.lineTo(-24, 2);
    ctx.lineTo(-8, 6);
    ctx.lineTo(-16, 13); // 하단 날개
    ctx.lineTo(-4, 12);
    ctx.lineTo(10, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 조종석 캐노피 글래스
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.ellipse(8, -4, 7, 3, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 상단 남은 비행 시간 카운트다운 표시
    ctx.save();
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`✈️ 무적 비행 ${this.airplaneTimer.toFixed(1)}s`, sx, sy - 26);
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

// 지상 장애물 10종 + 공중(땅 위 허공) 점프 금지 장애물 3종 정의
const OBSTACLE_TYPES = {
  short_spike: {
    key: 'short_spike',
    label: '삼각 가시 트랩',
    jumpHint: '짧은점프',
    width: 38,
    height: 30,
    color: '#ff1e42',
    isOverhead: false
  },
  saw_blade: {
    key: 'saw_blade',
    label: '회전 원형 톱날',
    jumpHint: '짧은점프',
    width: 42,
    height: 34,
    color: '#ff3b1f',
    isOverhead: false
  },
  laser_hurdle: {
    key: 'laser_hurdle',
    label: '고압 레이저 허들',
    jumpHint: '중간점프',
    width: 58,
    height: 35,
    color: '#ff0055',
    isOverhead: false
  },
  medium_crate: {
    key: 'medium_crate',
    label: '강철 장갑 바리케이드',
    jumpHint: '중간점프',
    width: 68,
    height: 34,
    color: '#ff5500',
    isOverhead: false
  },
  flame_geyser: {
    key: 'flame_geyser',
    label: '플라즈마 화염 분출기',
    jumpHint: '중간점프',
    width: 76,
    height: 38,
    color: '#ff2a00',
    isOverhead: false
  },
  long_trench: {
    key: 'long_trench',
    label: '장거리 가시 지대',
    jumpHint: '길게점프!',
    width: 128,
    height: 30,
    color: '#ff1744',
    isOverhead: false
  },
  crystal_cluster: {
    key: 'crystal_cluster',
    label: '블러드 크리스탈 암석군',
    jumpHint: '길게점프!',
    width: 136,
    height: 36,
    color: '#e60039',
    isOverhead: false
  },
  tall_pylon: {
    key: 'tall_pylon',
    label: '테슬라 고압 타워',
    jumpHint: '높게점프!',
    width: 46,
    height: 52,
    color: '#ff0066',
    isOverhead: false
  },
  spider_mech: {
    key: 'spider_mech',
    label: '보초 스파이더 포탑',
    jumpHint: '길게점프!',
    width: 96,
    height: 42,
    color: '#ff3300',
    isOverhead: false
  },
  mega_fortress: {
    key: 'mega_fortress',
    label: '초장거리 중장갑 벙커',
    jumpHint: '최대롱점프!',
    width: 162,
    height: 40,
    color: '#ff0033',
    isOverhead: false
  },

  // 땅 위(허공)에 떠 있어서 점프하면 부딪혀 죽고, 그냥 달려야 밑으로 통과되는 공중 장애물 3종
  overhead_drone: {
    key: 'overhead_drone',
    label: '공중 폭뢰 드론 (점프금지)',
    jumpHint: '점프금지! 그냥통과',
    width: 64,
    height: 36,
    bottomClearance: 28,
    color: '#ff8800',
    isOverhead: true
  },
  overhead_saw: {
    key: 'overhead_saw',
    label: '공중 회전 톱날 (점프금지)',
    jumpHint: '점프금지! 그냥통과',
    width: 72,
    height: 38,
    bottomClearance: 28,
    color: '#ffaa00',
    isOverhead: true
  },
  overhead_barrier: {
    key: 'overhead_barrier',
    label: '공중 고압 전기장 (점프금지)',
    jumpHint: '점프금지! 그냥통과',
    width: 96,
    height: 36,
    bottomClearance: 28,
    color: '#ff6600',
    isOverhead: true
  }
};

class Obstacle {
  // subTypes 배열로 1개 단독, 또는 2개·3개가 동시에 다닥다닥 붙어 있는 복합 장애물 생성 지원
  constructor(worldX, typeOrSubTypes) {
    const subKeys = Array.isArray(typeOrSubTypes) ? typeOrSubTypes : [typeOrSubTypes];
    this.subSpecs = subKeys.map((k) => OBSTACLE_TYPES[k] || OBSTACLE_TYPES.short_spike);
    this.clusterCount = this.subSpecs.length;

    const first = this.subSpecs[0];
    this.worldX = worldX;
    this.typeKey = first.key;
    this.isOverhead = Boolean(first.isOverhead);
    this.bottomClearance = first.bottomClearance || 0;

    // 2개나 3개가 붙어 있을 때 전체 폭과 최대 높이 계산
    this.width = this.subSpecs.reduce((sum, s) => sum + s.width, 0);
    this.height = Math.max(...this.subSpecs.map((s) => s.height));
    this.color = first.color;

    if (this.isOverhead) {
      this.label = first.label;
      this.jumpHint = first.jumpHint;
    } else if (this.clusterCount === 2) {
      this.label = `2연속 장애물 (${this.subSpecs.map((s) => s.label.split(' ')[0]).join('+')})`;
      this.jumpHint = '2연속·길게점프!';
    } else if (this.clusterCount >= 3) {
      this.label = `3연속 복합 장애물`;
      this.jumpHint = '3연속·최대롱점프!';
    } else {
      this.label = first.label;
      this.jumpHint = first.jumpHint;
    }

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
    const bikeHalfW = 10;
    const bikeLeft = bike.worldX - bikeHalfW;
    const bikeRight = bike.worldX + bikeHalfW;

    const obsLeft = this.worldX + 3;
    const obsRight = this.worldX + this.width - 3;

    if (bikeRight < obsLeft || bikeLeft > obsRight) {
      return false;
    }

    // 1. 땅 위(허공) 공중 장애물: 그냥 달리면(airHeight < 11) 안전 통과! 점프하면(airHeight >= 11) 충돌해서 사망!
    if (this.isOverhead) {
      const topLimit = this.bottomClearance + this.height;
      if (bike.airHeight >= 11 && bike.airHeight <= topLimit + 8) {
        return true;
      }
      return false;
    }

    // 2. 일반 지상 장애물: 점프 높이가 장애물 높이보다 낮으면 충돌
    if (bike.airHeight < this.height - 5) {
      return true;
    }
    return false;
  }

  drawHazardBase(ctx, sx, groundY, width) {
    const baseH = 6;
    ctx.save();
    ctx.fillStyle = '#1a0508';
    ctx.strokeStyle = '#ff1e38';
    ctx.lineWidth = 1.2;
    ctx.fillRect(sx, groundY - baseH, width, baseH);
    ctx.strokeRect(sx, groundY - baseH, width, baseH);

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

  // 개별 모양 렌더링 헬퍼 (1~3개 연속 붙어 있을 때 각각 그리기 위함)
  renderSingleGroundShape(ctx, spec, subWorldX, cameraX, road, canvasHeight) {
    const sx = subWorldX - cameraX;
    const w = spec.width;
    const h = spec.height;
    const centerWx = subWorldX + w * 0.5;
    const centerGroundY = road.getRoadY(centerWx, canvasHeight);

    const activeColor = this.hitFlashTimer > 0 ? '#ffffff' : spec.color;
    ctx.strokeStyle = activeColor;
    ctx.fillStyle = this.hitFlashTimer > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(65, 6, 16, 0.85)';
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = this.hitFlashTimer > 0 ? 18 : 9;
    ctx.lineWidth = 2.1;

    if (spec.key === 'short_spike') {
      const count = 2;
      const stepW = w / count;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const wx1 = subWorldX + i * stepW;
        const wxMid = wx1 + stepW * 0.5;
        const wx2 = wx1 + stepW;
        ctx.moveTo(wx1 - cameraX, road.getRoadY(wx1, canvasHeight));
        ctx.lineTo(wxMid - cameraX, road.getRoadY(wxMid, canvasHeight) - h);
        ctx.lineTo(wx2 - cameraX, road.getRoadY(wx2, canvasHeight));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (spec.key === 'saw_blade') {
      const cx = sx + w * 0.5;
      const cy = centerGroundY - h * 0.45;
      const r = h * 0.52;
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
      ctx.restore();
    } else if (spec.key === 'laser_hurdle') {
      const leftY = road.getRoadY(subWorldX + 4, canvasHeight);
      const rightY = road.getRoadY(subWorldX + w - 4, canvasHeight);
      ctx.fillRect(sx, leftY - h, 7, h);
      ctx.strokeRect(sx, leftY - h, 7, h);
      ctx.fillRect(sx + w - 7, rightY - h, 7, h);
      ctx.strokeRect(sx + w - 7, rightY - h, 7, h);

      ctx.strokeStyle = '#ff0044';
      for (let b = 1; b <= 3; b++) {
        const hRatio = (b / 4) * h;
        const jitter = Math.sin(this.animTimer * 24 + b) * 2;
        ctx.beginPath();
        ctx.moveTo(sx + 7, leftY - hRatio);
        ctx.lineTo(sx + w * 0.5, (leftY + rightY) * 0.5 - hRatio + jitter);
        ctx.lineTo(sx + w - 7, rightY - hRatio);
        ctx.stroke();
      }
    } else if (spec.key === 'medium_crate') {
      const boxes = 2;
      const bw = w / boxes;
      for (let i = 0; i < boxes; i++) {
        const bx = subWorldX + i * bw;
        const by = road.getRoadY(bx + bw * 0.5, canvasHeight);
        const rx = bx - cameraX + 1.5;
        const ry = by - h;
        const rw = bw - 3;
        ctx.fillRect(rx, ry, rw, h);
        ctx.strokeRect(rx, ry, rw, h);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + rw, ry + h);
        ctx.moveTo(rx + rw, ry);
        ctx.lineTo(rx, ry + h);
        ctx.stroke();
      }
    } else if (spec.key === 'flame_geyser') {
      const nozzles = 3;
      const nw = w / nozzles;
      for (let i = 0; i < nozzles; i++) {
        const nx = sx + i * nw + nw * 0.5;
        const ny = road.getRoadY(subWorldX + (i + 0.5) * nw, canvasHeight);
        const flameH = h * (0.82 + Math.sin(this.animTimer * 14 + i * 2) * 0.18);
        ctx.fillStyle = 'rgba(255, 60, 0, 0.75)';
        ctx.beginPath();
        ctx.moveTo(nx - nw * 0.36, ny - 6);
        ctx.quadraticCurveTo(nx - nw * 0.2, ny - flameH * 0.6, nx, ny - flameH);
        ctx.quadraticCurveTo(nx + nw * 0.2, ny - flameH * 0.6, nx + nw * 0.36, ny - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (spec.key === 'long_trench') {
      const spikes = 6;
      const stepW = w / spikes;
      ctx.beginPath();
      ctx.moveTo(sx, road.getRoadY(subWorldX, canvasHeight));
      for (let i = 0; i < spikes; i++) {
        const wxMid = subWorldX + (i + 0.5) * stepW;
        const wxEnd = subWorldX + (i + 1) * stepW;
        ctx.lineTo(wxMid - cameraX, road.getRoadY(wxMid, canvasHeight) - h);
        ctx.lineTo(wxEnd - cameraX, road.getRoadY(wxEnd, canvasHeight));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (spec.key === 'crystal_cluster') {
      const peaks = [0.75, 1.0, 0.68, 0.95, 0.8];
      const pw = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const wx = subWorldX + (i + 0.5) * pw;
        const gy = road.getRoadY(wx, canvasHeight);
        const px = wx - cameraX;
        const ph = h * peaks[i];
        ctx.beginPath();
        ctx.moveTo(px - pw * 0.48, gy);
        ctx.lineTo(px - pw * 0.2, gy - ph * 0.85);
        ctx.lineTo(px + pw * 0.08, gy - ph);
        ctx.lineTo(px + pw * 0.48, gy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (spec.key === 'tall_pylon') {
      const by = centerGroundY;
      const rx = sx + 7;
      const rw = w - 14;
      const ry = by - h;
      ctx.fillRect(rx, ry + 10, rw, h - 10);
      ctx.strokeRect(rx, ry + 10, rw, h - 10);
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(sx + w * 0.5, ry + 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (spec.key === 'spider_mech') {
      const cx = sx + w * 0.5;
      const cy = centerGroundY - h * 0.58;
      ctx.beginPath();
      const legOffsets = [-0.42, -0.22, 0.22, 0.42];
      for (const off of legOffsets) {
        const footX = cx + w * off;
        const kneeX = cx + w * (off * 0.65);
        const footY = road.getRoadY(subWorldX + w * (0.5 + off), canvasHeight);
        ctx.moveTo(cx, cy);
        ctx.lineTo(kneeX, cy - 9);
        ctx.lineTo(footX, footY);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 14, Math.PI, 0);
      ctx.lineTo(cx + 16, cy + 5);
      ctx.lineTo(cx - 16, cy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const segs = 4;
      const sw = w / segs;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const wx = subWorldX + i * sw;
        const gy = road.getRoadY(wx, canvasHeight);
        if (i === 0) ctx.moveTo(wx - cameraX, gy);
        else ctx.lineTo(wx - cameraX, gy);
      }
      for (let i = segs; i >= 0; i--) {
        const wx = subWorldX + i * sw;
        const gy = road.getRoadY(wx, canvasHeight) - h - (i % 2 === 1 ? 6 : 0);
        ctx.lineTo(wx - cameraX, gy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 공중(땅 위 허공) 점프 금지 장애물 렌더링
  renderOverheadObstacle(ctx, sx, centerGroundY, road, canvasHeight) {
    const bottomY = centerGroundY - this.bottomClearance;
    const topY = bottomY - this.height;
    const cx = sx + this.width * 0.5;
    const cy = (bottomY + topY) * 0.5;

    ctx.save();

    // 1. 도로 바닥 위에 '그냥 주행 통과' 안전 통로 화살표 가이드 표시
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, centerGroundY - 3);
    ctx.lineTo(sx + this.width, centerGroundY - 3);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. 공중 장애물 본체 (드론 / 공중 톱날 / 공중 고압 전기장)
    const activeColor = this.hitFlashTimer > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = activeColor;
    ctx.fillStyle = 'rgba(70, 22, 0, 0.88)';
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.2;

    if (this.typeKey === 'overhead_drone') {
      // 공중 폭뢰 드론 + 하단 스파이크
      ctx.beginPath();
      ctx.roundRect(sx + 6, topY + 4, this.width - 12, this.height - 10, 8);
      ctx.fill();
      ctx.stroke();

      // 하단 가시 (점프하면 찔리는 부분 강조)
      const spikes = 4;
      const sw = (this.width - 12) / spikes;
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const x1 = sx + 6 + i * sw;
        ctx.moveTo(x1, bottomY - 6);
        ctx.lineTo(x1 + sw * 0.5, bottomY + 2);
        ctx.lineTo(x1 + sw, bottomY - 6);
      }
      ctx.stroke();
    } else if (this.typeKey === 'overhead_saw') {
      // 공중 매달린 회전 톱날 2개
      const saws = 2;
      const sw = this.width / saws;
      for (let s = 0; s < saws; s++) {
        const scx = sx + (s + 0.5) * sw;
        const r = 16;
        ctx.save();
        ctx.translate(scx, cy);
        ctx.rotate(-this.animTimer * 8);
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const rad = i % 2 === 0 ? r : r * 0.65;
          const a = (i * Math.PI) / 8;
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // 공중 고압 플라즈마 배리어
      ctx.fillRect(sx, topY, this.width, 10);
      ctx.strokeRect(sx, topY, this.width, 10);
      ctx.fillRect(sx, bottomY - 8, this.width, 8);
      ctx.strokeRect(sx, bottomY - 8, this.width, 8);

      ctx.strokeStyle = '#ffe600';
      ctx.beginPath();
      for (let x = sx + 6; x < sx + this.width - 4; x += 12) {
        ctx.moveTo(x, topY + 10);
        ctx.lineTo(x + (Math.random() - 0.5) * 8, cy);
        ctx.lineTo(x, bottomY - 8);
      }
      ctx.stroke();
    }

    // 3. 상단 HP 게이지 및 '⬇ 점프금지! 그냥통과' 강조 배지
    const badgeW = 92;
    const badgeH = 15;
    const badgeY = topY - 24;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.roundRect(cx - badgeW * 0.5, badgeY, badgeW, badgeH, 6);
    ctx.fill();

    ctx.fillStyle = '#050510';
    ctx.font = '900 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬇ 점프금지·그냥통과', cx, badgeY + badgeH * 0.5 + 0.5);

    ctx.restore();
  }

  render(ctx, cameraX, road, canvasHeight) {
    const sx = this.worldX - cameraX;
    if (sx + this.width < -60 || sx > ctx.canvas.width + 80) return;

    const centerWx = this.worldX + this.width * 0.5;
    const centerGroundY = road.getRoadY(centerWx, canvasHeight);

    if (this.isOverhead) {
      this.renderOverheadObstacle(ctx, sx, centerGroundY, road, canvasHeight);
      return;
    }

    ctx.save();
    // 1~3개 연속 붙어 있는 각 서브 장애물 렌더링
    let offsetWx = this.worldX;
    for (const spec of this.subSpecs) {
      this.renderSingleGroundShape(ctx, spec, offsetWx, cameraX, road, canvasHeight);
      offsetWx += spec.width;
    }

    // 하단 공통 노란/검정 위험 빗금 받침대
    this.drawHazardBase(ctx, sx, centerGroundY, this.width);

    // 상단 3칸 체력(HP) 게이지 & 힌트 표시
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
    ctx.fillStyle = this.clusterCount >= 2 ? '#ffe600' : '#ff8090';
    ctx.fillText(`⚠ ${this.jumpHint}`, uiX, uiY - 4);

    ctx.restore();
  }
}

class Projectile {
  constructor(worldX, heightOffset, type) {
    this.worldX = worldX;
    this.heightOffset = Math.max(12, Math.min(55, heightOffset));
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

// 보급 아이템 (총알 탄약통 / 바주카포 / 10초 무적 비행기 변신 아이템)
class WeaponItem {
  constructor(worldX, type, floatHeight = 38) {
    this.worldX = worldX;
    this.type = type; // 'bullet' | 'bazooka' | 'airplane'
    this.floatHeight = Math.max(34, floatHeight);
    this.bobPhase = Math.random() * Math.PI * 2;
    this.collected = false;
    this.boxSize = type === 'airplane' ? 34 : 28;
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
    if (sx < -70 || sx > ctx.canvas.width + 70) return;

    const isAirplane = this.type === 'airplane';
    const isBazooka = this.type === 'bazooka';
    const auraColor = isAirplane ? '#ffd700' : isBazooka ? '#00f3ff' : '#00ff88';

    ctx.save();

    // 1. 도로 바닥에서 보급 캡슐로 올라오는 홀로그램 빛기둥
    const beamGrad = ctx.createLinearGradient(sx, sy, sx, groundY);
    beamGrad.addColorStop(0, auraColor + '66');
    beamGrad.addColorStop(1, auraColor + '00');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(sx - 12, sy, 24, Math.max(0, groundY - sy));

    ctx.translate(sx, sy);

    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 18;

    // 2. 상단 홀로그램 낙하산/날개 아치
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -19, 17, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // 3. 보급 캡슐 본체
    const half = this.boxSize * 0.5;
    ctx.fillStyle = isAirplane ? 'rgba(40, 28, 4, 0.94)' : 'rgba(4, 24, 36, 0.92)';
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-half, -half, this.boxSize, this.boxSize, 8);
    ctx.fill();
    ctx.stroke();

    // 4. 캡슐 내부 아이콘 드로잉
    ctx.shadowBlur = 0;
    if (isAirplane) {
      // 황금/시안 제트 비행기 아이콘
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(2, -3);
      ctx.lineTo(-4, -10);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-4, -2);
      ctx.lineTo(-10, -2);
      ctx.lineTo(-10, 2);
      ctx.lineTo(-4, 2);
      ctx.lineTo(-8, 9);
      ctx.lineTo(-4, 10);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();
    } else if (!isBazooka) {
      for (let i = -1; i <= 1; i++) {
        const bx = i * 6.5;
        ctx.fillStyle = '#ffb700';
        ctx.fillRect(bx - 2, -2, 4, 9);
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.moveTo(bx - 2, -2);
        ctx.lineTo(bx, -8);
        ctx.lineTo(bx + 2, -2);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.save();
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(-3, -5, 6, 11);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(0, -12);
      ctx.lineTo(4, -5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, 3, 12, 3);
      ctx.restore();
    }

    // 5. 상단 이름표 배지
    const badgeW = isAirplane ? 102 : 68;
    const badgeH = 16;
    const badgeY = -half - 24;
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.roundRect(-badgeW * 0.5, badgeY, badgeW, badgeH, 99);
    ctx.fill();

    ctx.fillStyle = '#031018';
    ctx.font = '900 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelText = isAirplane ? '✈️ 비행기 변신 (10초 무적)' : isBazooka ? '🎁 바주카 +1' : '🎁 총알 +6';
    ctx.fillText(labelText, 0, badgeY + badgeH * 0.5 + 0.5);

    ctx.restore();
  }
}

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
