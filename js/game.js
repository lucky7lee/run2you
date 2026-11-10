// 메인 게임 루프, 난이도 디렉터, 스마트폰 멀티터치 컨트롤, 최고 기록 관리 모듈

class Run2YouGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // 엔티티 및 시스템 초기화
    this.road = new window.NeonRoad();
    this.bike = new window.NeonBike();
    this.effects = new window.EffectsManager();

    this.obstacles = [];
    this.projectiles = [];
    this.items = [];

    // 게임 상태: 'menu' | 'playing' | 'paused' | 'gameover'
    this.state = 'menu';

    // 기록 및 스탯
    this.bestMeters = this.loadBestRecord();
    this.bestAtRunStart = this.bestMeters;
    this.hasCelebratedNewRecord = false;
    this.currentMeters = 0;
    this.destroyedCount = 0;

    // 무기 탄약 (총알: 3발 명중 시 파괴 / 바주카: 1발 명중 시 즉시 파괴)
    this.bulletAmmo = 6;
    this.bazookaAmmo = 1;
    this.bulletCooldown = 0;
    this.bazookaCooldown = 0;

    // 난이도 및 속도 제어
    this.level = 1;
    this.speedPx = 335;
    this.currentSectorId = 0;

    // 스폰 관리용 월드 X 커서
    this.nextObstacleWx = 680;
    this.nextItemWx = 520;

    // 화면 흔들림 이펙트
    this.shakeTime = 0;
    this.shakeIntensity = 0;

    // 배너 타이머
    this.bannerTimeout = null;

    this.lastFrameTime = performance.now();

    this.initDOM();
    this.initInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));

    // 배경 프리뷰를 위해 초기 상태 리셋 후 루프 시작
    this.resetRunState();
    this.state = 'menu';
    this.updateHUD();
    requestAnimationFrame((t) => this.loop(t));
  }

  loadBestRecord() {
    try {
      const saved = localStorage.getItem('run2you_best_meters');
      return saved ? Math.max(0, parseInt(saved, 10) || 0) : 0;
    } catch (e) {
      return 0;
    }
  }

  saveBestRecord(meters) {
    try {
      localStorage.setItem('run2you_best_meters', String(meters));
    } catch (e) {
      // 스토리지 제한 환경 무시
    }
  }

  initDOM() {
    this.elDistance = document.getElementById('hud-distance');
    this.elBest = document.getElementById('hud-best');
    this.elSectorBadge = document.getElementById('hud-sector-badge');
    this.elLevel = document.getElementById('hud-level');
    this.elSpeed = document.getElementById('hud-speed');
    this.elRoadStyle = document.getElementById('hud-road-style');

    this.elBulletBox = document.getElementById('hud-bullet-box');
    this.elBazookaBox = document.getElementById('hud-bazooka-box');
    this.elBulletCount = document.getElementById('hud-bullet-count');
    this.elBazookaCount = document.getElementById('hud-bazooka-count');

    this.elPadBulletAmmo = document.getElementById('pad-bullet-ammo');
    this.elPadBazookaAmmo = document.getElementById('pad-bazooka-ammo');

    this.btnJump = document.getElementById('btn-jump');
    this.btnBullet = document.getElementById('btn-bullet');
    this.btnBazooka = document.getElementById('btn-bazooka');

    this.elJumpMeterWrap = document.getElementById('jump-meter-wrap');
    this.elJumpMeterFill = document.getElementById('jump-meter-fill');
    this.elJumpMeterLabel = document.getElementById('jump-meter-label');

    this.elBanner = document.getElementById('center-banner');
    this.elBannerTitle = document.getElementById('banner-title');
    this.elBannerSub = document.getElementById('banner-sub');

    this.modalStart = document.getElementById('start-modal');
    this.modalPause = document.getElementById('pause-modal');
    this.modalGameOver = document.getElementById('gameover-modal');

    this.elStartBest = document.getElementById('start-best-score');
    this.elStartBest.textContent = `${this.bestMeters} m`;

    // 세로 모드에서 강제 가로 모드 실행 버튼
    const btnForceLandscape = document.getElementById('btn-force-landscape');
    if (btnForceLandscape) {
      btnForceLandscape.addEventListener('click', () => {
        document.body.classList.add('force-landscape');
        this.tryLockLandscape();
        setTimeout(() => this.resize(), 80);
      });
    }

    // 시작/재시작/일시정지 버튼 이벤트
    document.getElementById('btn-start-game').addEventListener('click', () => {
      window.soundManager.init();
      this.tryLockLandscape();
      this.startGame();
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      window.soundManager.init();
      this.startGame();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      if (this.state === 'playing') {
        this.pauseGame();
      } else if (this.state === 'paused') {
        this.resumeGame();
      }
    });

    document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-restart-pause').addEventListener('click', () => {
      this.modalPause.classList.add('hidden');
      this.startGame();
    });

    // 좌우 손 위치 바꾸기 버튼
    const toggleHandLayout = () => {
      const tc = document.getElementById('touch-controls');
      tc.classList.toggle('swapped');
    };
    document.getElementById('btn-swap-hand').addEventListener('click', toggleHandLayout);
    document.getElementById('btn-toggle-hand-modal').addEventListener('click', toggleHandLayout);

    // 사운드 토글 버튼
    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
      const on = window.soundManager.toggle();
      btnSound.textContent = on ? '🔊' : '🔇';
    });
  }

  tryLockLandscape() {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  initInput() {
    // 1. 점프 패드 멀티터치/포인터 바인딩 (누르는 시간에 따라 단거리/장거리 점프 제어)
    const onJumpStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.state !== 'playing') return;
      this.btnJump.classList.add('active');
      this.bike.requestJump();
    };

    const onJumpEnd = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.btnJump.classList.remove('active');
      this.bike.releaseJump();
    };

    this.btnJump.addEventListener('pointerdown', onJumpStart);
    this.btnJump.addEventListener('pointerup', onJumpEnd);
    this.btnJump.addEventListener('pointercancel', onJumpEnd);
    this.btnJump.addEventListener('pointerleave', onJumpEnd);

    // 2. 총알 발사 패드 (3발에 장애물 파괴)
    const onBulletFire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.state !== 'playing') return;
      this.btnBullet.classList.add('active');
      this.fireBullet();
      setTimeout(() => this.btnBullet.classList.remove('active'), 95);
    };
    this.btnBullet.addEventListener('pointerdown', onBulletFire);

    // 3. 바주카포 발사 패드 (1발에 장애물 즉시 파괴)
    const onBazookaFire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.state !== 'playing') return;
      this.btnBazooka.classList.add('active');
      this.fireBazooka();
      setTimeout(() => this.btnBazooka.classList.remove('active'), 120);
    };
    this.btnBazooka.addEventListener('pointerdown', onBazookaFire);

    // 4. 캔버스 빈 영역 터치 지원 (점프 쪽 화면 절반 터치 시에도 점프 작동)
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing') return;
      const isSwapped = document.getElementById('touch-controls').classList.contains('swapped');
      const rect = this.canvas.getBoundingClientRect();
      // 강제 가로 모드일 때는 화면 Y좌표가 가로 X축 역할을 함
      let normalizedX = (e.clientX - rect.left) / rect.width;
      if (document.body.classList.contains('force-landscape')) {
        normalizedX = (e.clientY - rect.top) / rect.height;
      }

      const isJumpSide = isSwapped ? normalizedX > 0.5 : normalizedX <= 0.5;
      if (isJumpSide) {
        this.btnJump.classList.add('active');
        this.bike.requestJump();
      } else {
        this.fireBullet();
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.bike.isHoldingJump) {
        this.btnJump.classList.remove('active');
        this.bike.releaseJump();
      }
    });

    // 키보드 보조 지원 (PC 브라우저에서 테스트할 때 편의 제공)
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') return;
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !e.repeat) {
        this.btnJump.classList.add('active');
        this.bike.requestJump();
      } else if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Enter') {
        this.fireBullet();
      } else if (e.code === 'KeyK' || e.code === 'KeyX') {
        this.fireBazooka();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.btnJump.classList.remove('active');
        this.bike.releaseJump();
      }
    });
  }

  resize() {
    const wrapper = document.getElementById('app-wrapper');
    const w = wrapper.clientWidth || window.innerWidth;
    const h = wrapper.clientHeight || window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
  }

  resetRunState() {
    this.obstacles = [];
    this.projectiles = [];
    this.items = [];
    this.effects.clear();

    this.bike.reset(this.road, this.height || 400);
    this.currentMeters = 0;
    this.destroyedCount = 0;
    this.bestAtRunStart = this.bestMeters;
    this.hasCelebratedNewRecord = false;

    // 시작 시 기본 제공 무장: 총알 6발 (장애물 2개 파괴 분량) + 바주카 1발
    this.bulletAmmo = 6;
    this.bazookaAmmo = 1;
    this.bulletCooldown = 0;
    this.bazookaCooldown = 0;

    this.level = 1;
    this.speedPx = 335;
    this.currentSectorId = 0;

    this.nextObstacleWx = 720;
    this.nextItemWx = 500;

    this.shakeTime = 0;
    this.updateHUD();
  }

  startGame() {
    this.resetRunState();
    this.modalStart.classList.add('hidden');
    this.modalPause.classList.add('hidden');
    this.modalGameOver.classList.add('hidden');
    this.state = 'playing';
    this.showBanner('SECTOR 01 · START!', '장애물 길이에 맞춰 점프하거나 총알(3발)·바주카(1발)로 파괴하세요!', '#00f3ff', 2200);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.bike.releaseJump();
    this.modalPause.classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.modalPause.classList.add('hidden');
    this.state = 'playing';
    this.lastFrameTime = performance.now();
  }

  triggerGameOver(obstacle) {
    this.state = 'gameover';
    this.bike.releaseJump();
    window.soundManager.playCrash();
    this.triggerShake(0.45, 14);
    this.effects.spawnExplosion(this.bike.worldX, this.bike.y - 16, '#ff2a85', 34, true);

    const isNewBest = this.currentMeters > this.bestAtRunStart && this.currentMeters > 0;
    if (this.currentMeters > this.bestMeters) {
      this.bestMeters = this.currentMeters;
      this.saveBestRecord(this.bestMeters);
    }

    // 게임오버 모달 데이터 채우기
    const ribbon = document.getElementById('new-record-ribbon');
    if (isNewBest) {
      ribbon.classList.remove('hidden');
    } else {
      ribbon.classList.add('hidden');
    }

    const reasonEl = document.getElementById('crash-reason');
    if (obstacle) {
      reasonEl.textContent = `[${obstacle.label}] 장애물과 충돌했습니다! (${obstacle.jumpHint} 또는 무기 활용)`;
    } else {
      reasonEl.textContent = '장애물과 충돌했습니다.';
    }

    document.getElementById('res-distance').textContent = `${this.currentMeters.toLocaleString()} m`;
    document.getElementById('res-best').textContent = `${this.bestMeters.toLocaleString()} m`;
    const kmh = Math.round(this.speedPx * 0.36);
    document.getElementById('res-level').textContent = `LV.${this.level} (${kmh} km/h)`;
    document.getElementById('res-destroyed').textContent = `${this.destroyedCount} 개`;
    this.elStartBest.textContent = `${this.bestMeters.toLocaleString()} m`;

    this.updateHUD();
    setTimeout(() => {
      if (this.state === 'gameover') {
        this.modalGameOver.classList.remove('hidden');
      }
    }, 520);
  }

  fireBullet() {
    if (this.bulletCooldown > 0) return;
    if (this.bulletAmmo <= 0) {
      this.effects.spawnFloatingText(this.bike.worldX, this.bike.y - 48, '총알 없음! 점프하세요!', '#ffe600');
      return;
    }

    this.bulletAmmo--;
    this.bulletCooldown = 0.14;
    this.bike.muzzleFlashTimer = 0.08;

    const fireHeight = Math.max(18, Math.min(44, this.bike.airHeight + 18));
    this.projectiles.push(new window.Projectile(this.bike.worldX + 26, fireHeight, 'bullet'));
    window.soundManager.playBulletFire();
    this.updateHUD();
  }

  fireBazooka() {
    if (this.bazookaCooldown > 0) return;
    if (this.bazookaAmmo <= 0) {
      this.effects.spawnFloatingText(this.bike.worldX, this.bike.y - 48, '바주카 없음!', '#ff2a85');
      return;
    }

    this.bazookaAmmo--;
    this.bazookaCooldown = 0.35;
    this.bike.muzzleFlashTimer = 0.16;

    const fireHeight = Math.max(22, Math.min(46, this.bike.airHeight + 22));
    this.projectiles.push(new window.Projectile(this.bike.worldX + 28, fireHeight, 'bazooka'));
    window.soundManager.playBazookaFire();
    this.triggerShake(0.15, 5);
    this.updateHUD();
  }

  triggerShake(duration, intensity) {
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  showBanner(title, sub, color = '#ffe600', durationMs = 2000) {
    this.elBannerTitle.textContent = title;
    this.elBannerTitle.style.color = color;
    this.elBannerSub.textContent = sub;
    this.elBanner.classList.remove('hidden');

    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.elBanner.classList.add('hidden');
    }, durationMs);
  }

  // 주행 거리(m)에 따라 속도와 난이도를 점진적·합리적으로 상승시키는 디렉터
  updateDifficultyAndSpeed(dt) {
    this.currentMeters = Math.floor(this.road.worldXToMeters(this.bike.worldX - 120));

    // 난이도 레벨 산정 (180m 단위로 상승, 최대 LV.10)
    const newLevel = Math.min(10, 1 + Math.floor(this.currentMeters / 180));
    if (newLevel > this.level) {
      this.level = newLevel;
      this.showBanner(`SPEED & LEVEL UP! (LV.${this.level})`, '속도가 빨라지고 새로운 장애물 패턴이 등장합니다!', '#39ff14', 1900);
    }

    // 도로 섹터 변경 감지 (250m 단위)
    const theme = this.road.getThemeByMeters(this.currentMeters);
    if (theme.id !== this.currentSectorId && this.currentMeters > 20) {
      this.currentSectorId = theme.id;
      this.showBanner(theme.sectorName, `새로운 선 도로 구간 진입: ${theme.styleName}`, theme.mainColor, 2200);
    }

    // 점진적이고 부드러운 목표 속도 곡선 (초반 335 px/s -> 후반 최대 590 px/s)
    // 급격하게 빨라지지 않고 거리 비례 완만한 로그+선형 복합 증가
    const targetSpeed = Math.min(590, 335 + this.currentMeters * 0.19);
    this.speedPx += (targetSpeed - this.speedPx) * Math.min(1, dt * 2.5);

    // 최고 기록 실시간 갱신 체크
    if (this.currentMeters > this.bestMeters) {
      this.bestMeters = this.currentMeters;
      this.saveBestRecord(this.bestMeters);

      if (this.bestAtRunStart > 0 && !this.hasCelebratedNewRecord) {
        this.hasCelebratedNewRecord = true;
        window.soundManager.playNewRecord();
        this.showBanner('★ NEW BEST RECORD! ★', `이전 최고 기록(${this.bestAtRunStart}m)을 넘어섰습니다!`, '#ffe600', 2600);
      }
    }
  }

  // 난이도에 맞춰 장애물의 종류(단거리/중거리/장거리/고압/초장거리)와 간격을 스마트하게 배치
  spawnWorldEntities(cameraX) {
    const spawnHorizon = cameraX + this.width + 260;

    // 1. 장애물 스폰
    while (this.nextObstacleWx < spawnHorizon) {
      const typeKey = this.pickObstacleTypeForLevel(this.level);
      const obs = new window.Obstacle(this.nextObstacleWx, typeKey);
      this.obstacles.push(obs);

      // 현재 속도에서도 무기 없이 점프만으로 100% 넘고 착지 후 재점프가 가능한 안전 간격 보장
      // 장거리 장애물 뒤에는 착지 여유 거리를 더 확보
      const minSafeLandingGap = this.speedPx * 0.72 + obs.width;
      const randomExtraGap = 150 + Math.random() * Math.max(90, 260 - this.level * 16);
      this.nextObstacleWx += minSafeLandingGap + randomExtraGap;
    }

    // 2. 무기 아이템(총알 & 바주카포) 스폰 (장애물 위치와 겹치지 않도록 스마트 배치)
    while (this.nextItemWx < spawnHorizon) {
      // 바주카포는 약 28% 확률, 총알 팩은 72% 확률로 등장
      const itemType = Math.random() < 0.28 ? 'bazooka' : 'bullet';

      // 해당 위치 근처에 장애물이 있는지 확인
      const overlappingObs = this.obstacles.find(
        (o) => this.nextItemWx >= o.worldX - 45 && this.nextItemWx <= o.worldX + o.width + 45
      );

      let spawnWx = this.nextItemWx;
      let floatH = 28;

      if (overlappingObs) {
        if (Math.random() < 0.55) {
          // 장애물 직전 안전 도로 위에 배치 -> 먹자마자 바로 장애물 사격 가능!
          spawnWx = overlappingObs.worldX - 95;
          floatH = 28;
        } else {
          // 장애물 상단 점프 궤적 위에 배치 -> 점프로 뛰어넘으면서 동시에 획득!
          spawnWx = overlappingObs.worldX + overlappingObs.width * 0.5;
          floatH = overlappingObs.height + 44;
        }
      } else {
        floatH = Math.random() < 0.3 ? 72 : 28;
      }

      this.items.push(new window.WeaponItem(spawnWx, itemType, floatH));
      this.nextItemWx += 360 + Math.random() * 250;
    }
  }

  pickObstacleTypeForLevel(level) {
    const r = Math.random();
    if (level === 1) {
      // LV.1: 단거리 가시(65%) + 중거리 바리케이드(35%) -> 짧은 점프와 기본 사격 연습
      return r < 0.65 ? 'short_spike' : 'medium_crate';
    } else if (level === 2) {
      // LV.2: 장거리 플라즈마 트랩 등장 (길게 누르는 롱점프 매칭)
      if (r < 0.40) return 'short_spike';
      if (r < 0.72) return 'medium_crate';
      return 'long_trench';
    } else if (level === 3) {
      // LV.3: 고압 레이저 파일런 추가
      if (r < 0.30) return 'short_spike';
      if (r < 0.55) return 'medium_crate';
      if (r < 0.82) return 'long_trench';
      return 'tall_pylon';
    } else {
      // LV.4+: 초장거리 헤비 벙커까지 전 종류가 밸런스 있게 등장
      if (r < 0.24) return 'short_spike';
      if (r < 0.46) return 'medium_crate';
      if (r < 0.70) return 'long_trench';
      if (r < 0.86) return 'tall_pylon';
      return 'mega_fortress';
    }
  }

  updateHUD() {
    this.elDistance.textContent = this.currentMeters.toLocaleString();
    this.elBest.textContent = this.bestMeters.toLocaleString();

    const theme = this.road.getThemeByMeters(this.currentMeters);
    this.elSectorBadge.textContent = theme.sectorName;
    this.elSectorBadge.style.color = theme.mainColor;
    this.elSectorBadge.style.borderColor = theme.mainColor + '66';

    this.elLevel.textContent = `LV.${this.level}`;
    const kmh = Math.round(this.speedPx * 0.36);
    this.elSpeed.textContent = `${kmh} km/h`;
    this.elRoadStyle.textContent = theme.styleName;

    // 탄약 수량 업데이트
    this.elBulletCount.textContent = this.bulletAmmo;
    this.elBazookaCount.textContent = this.bazookaAmmo;
    this.elPadBulletAmmo.textContent = this.bulletAmmo;
    this.elPadBazookaAmmo.textContent = this.bazookaAmmo;

    this.elBulletBox.classList.toggle('empty', this.bulletAmmo <= 0);
    this.elBazookaBox.classList.toggle('empty', this.bazookaAmmo <= 0);
    this.btnBullet.classList.toggle('disabled-pad', this.bulletAmmo <= 0);
    this.btnBazooka.classList.toggle('disabled-pad', this.bazookaAmmo <= 0);

    // 점프 게이지 미터 표시 (짧은 점프 vs 긴 점프 시각화)
    if (!this.bike.isGrounded && this.state === 'playing') {
      this.elJumpMeterWrap.classList.remove('hidden');
      const ratio = this.bike.getJumpHoldRatio();
      const pct = Math.max(18, Math.round(ratio * 100));
      this.elJumpMeterFill.style.width = `${pct}%`;
      if (ratio >= 0.75) {
        this.elJumpMeterLabel.textContent = 'MAX LONG JUMP!';
        this.elJumpMeterLabel.style.color = '#ffe600';
      } else if (ratio >= 0.35) {
        this.elJumpMeterLabel.textContent = 'LONG JUMP';
        this.elJumpMeterLabel.style.color = '#39ff14';
      } else {
        this.elJumpMeterLabel.textContent = 'SHORT HOP';
        this.elJumpMeterLabel.style.color = '#00f3ff';
      }
    } else {
      this.elJumpMeterWrap.classList.add('hidden');
    }
  }

  update(dt) {
    if (this.state === 'menu') {
      // 메뉴 화면에서도 배경 오토바이가 네온 도로를 자동 질주하는 데모 연출
      this.bike.update(dt, 260, this.road, this.height);
      return;
    }

    if (this.state !== 'playing') {
      this.effects.update(dt);
      if (this.shakeTime > 0) this.shakeTime -= dt;
      return;
    }

    if (this.bulletCooldown > 0) this.bulletCooldown -= dt;
    if (this.bazookaCooldown > 0) this.bazookaCooldown -= dt;
    if (this.shakeTime > 0) this.shakeTime -= dt;

    // 1. 속도 및 난이도 업데이트
    this.updateDifficultyAndSpeed(dt);

    // 2. 오토바이 물리 업데이트
    this.bike.update(dt, this.speedPx, this.road, this.height);
    const cameraX = this.bike.worldX - this.width * this.bike.screenXRatio;

    // 3. 전방 장애물 및 무기 아이템 스폰
    this.spawnWorldEntities(cameraX);

    // 4. 발사체 이동 및 장애물 명중 판정
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt, this.speedPx);

      if (!proj.active) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // 장애물과 충돌 검사
      for (let j = this.obstacles.length - 1; j >= 0; j--) {
        const obs = this.obstacles[j];
        if (obs.destroyed) continue;

        if (proj.worldX + 10 >= obs.worldX && proj.worldX - 10 <= obs.worldX + obs.width) {
          proj.active = false;
          const isDestroyed = obs.takeDamage(proj.damage);
          const obsCenterWx = obs.worldX + obs.width * 0.5;
          const obsGroundY = this.road.getRoadY(obsCenterWx, this.height);

          if (isDestroyed) {
            this.destroyedCount++;
            const isBazooka = proj.type === 'bazooka';
            window.soundManager.playExplosion(isBazooka);
            this.triggerShake(isBazooka ? 0.28 : 0.14, isBazooka ? 10 : 5);
            this.effects.spawnExplosion(
              obsCenterWx,
              obsGroundY - obs.height * 0.5,
              isBazooka ? '#ff2a85' : obs.color,
              isBazooka ? 30 : 18,
              isBazooka
            );
            this.effects.spawnFloatingText(
              obsCenterWx,
              obsGroundY - obs.height - 20,
              isBazooka ? '💥 BAZOOKA 1-SHOT!' : '⚡ DESTROYED!',
              isBazooka ? '#ff2a85' : '#ffe600'
            );
            this.obstacles.splice(j, 1);
          } else {
            // 총알 1~2발 적중 시 남은 체력 안내
            window.soundManager.playBulletHit(obs.hp);
            this.effects.spawnExplosion(proj.worldX, obsGroundY - obs.height * 0.5, '#ffe600', 7, false);
            this.effects.spawnFloatingText(
              obsCenterWx,
              obsGroundY - obs.height - 22,
              `HIT! (${3 - obs.hp}/3)`,
              '#ffe600'
            );
          }
          break;
        }
      }

      if (!proj.active) {
        this.projectiles.splice(i, 1);
      }
    }

    // 5. 무기 아이템 획득 판정
    const bikeScreenPos = {
      sx: this.bike.worldX - cameraX,
      sy: this.bike.y - 16
    };

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.update(dt);

      const { sx, sy } = item.getScreenPos(cameraX, this.road, this.height);
      const dx = bikeScreenPos.sx - sx;
      const dy = bikeScreenPos.sy - sy;
      const dist = Math.hypot(dx, dy);

      if (dist < 38) {
        window.soundManager.playPickup(item.type);
        if (item.type === 'bazooka') {
          this.bazookaAmmo += 1;
          this.effects.spawnFloatingText(item.worldX, sy - 14, '🚀 +1 BAZOOKA!', '#ff2a85');
          this.effects.spawnExplosion(item.worldX, sy, '#ff2a85', 12, false);
        } else {
          this.bulletAmmo += 6;
          this.effects.spawnFloatingText(item.worldX, sy - 14, '⚡ +6 BULLETS!', '#ffe600');
          this.effects.spawnExplosion(item.worldX, sy, '#ffe600', 12, false);
        }
        this.items.splice(i, 1);
        continue;
      }

      if (sx < -100) {
        this.items.splice(i, 1);
      }
    }

    // 6. 장애물 업데이트 및 오토바이 충돌 판정
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.update(dt);

      if (obs.checkCollision(this.bike, cameraX)) {
        this.triggerGameOver(obs);
        return;
      }

      // 화면 뒤로 지나간 장애물 정리
      if (obs.worldX + obs.width < cameraX - 120) {
        this.obstacles.splice(i, 1);
      }
    }

    // 7. 이펙트 업데이트 및 HUD 갱신
    this.effects.update(dt);
    this.updateHUD();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const cameraX = this.bike.worldX - this.width * this.bike.screenXRatio;

    ctx.save();
    // 화면 흔들림(Screen Shake) 적용
    if (this.shakeTime > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(dx, dy);
    }

    // 1. 네온 선 도로 및 배경 렌더링
    this.road.render(ctx, cameraX, this.width, this.height, this.bestAtRunStart, this.currentMeters);

    // 2. 무기 보급 아이템 렌더링
    for (const item of this.items) {
      item.render(ctx, cameraX, this.road, this.height);
    }

    // 3. 장애물 렌더링
    for (const obs of this.obstacles) {
      obs.render(ctx, cameraX, this.road, this.height);
    }

    // 4. 총알 & 바주카 발사체 렌더링
    for (const proj of this.projectiles) {
      proj.render(ctx, cameraX, this.road, this.height);
    }

    // 5. 오토바이 렌더링
    this.bike.render(ctx, cameraX, this.road, this.height);

    // 6. 폭발 파티클 및 플로팅 텍스트 렌더링
    this.effects.render(ctx, cameraX);

    ctx.restore();
  }

  loop(now) {
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Run2YouGame();
});
