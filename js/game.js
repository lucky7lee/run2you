// 메인 게임 루프, 50단계(20분 완주) 디렉터, 비행기 5회 랜덤 출현(10초 무적), 2~3연속 결합 및 공중(점프금지) 장애물 관리 모듈

class Run2YouGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.road = new window.NeonRoad();
    this.bike = new window.NeonBike();
    this.effects = new window.EffectsManager();

    this.obstacles = [];
    this.projectiles = [];
    this.items = [];

    // 게임 상태: 'menu' | 'playing' | 'paused' | 'gameover' | 'victory'
    this.state = 'menu';

    this.bestMeters = this.loadBestRecord();
    this.bestAtRunStart = this.bestMeters;
    this.hasCelebratedNewRecord = false;
    this.currentMeters = 0;
    this.destroyedCount = 0;
    this.runTimeSeconds = 0;

    // 무기 탄약
    this.bulletAmmo = 6;
    this.bazookaAmmo = 1;
    this.bulletCooldown = 0;
    this.bazookaCooldown = 0;

    // 50단계 레벨 및 속도 제어
    this.level = 1;
    this.maxLevel = 50;
    this.speedPx = 295;
    this.currentSectorId = 0;

    // 스폰 관리용 월드 X 커서 및 20분 주행 중 5회 랜덤 등장하는 비행기 아이템 스케줄 큐
    this.nextObstacleWx = 680;
    this.nextItemWx = 1150;
    this.airplaneSpawnWxQueue = [];

    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.bannerTimeout = null;
    this.lastFrameTime = performance.now();

    this.initDOM();
    this.initInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));

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
    this.elStartBest.textContent = `${this.bestMeters.toLocaleString()} m`;

    const btnForceLandscape = document.getElementById('btn-force-landscape');
    if (btnForceLandscape) {
      btnForceLandscape.addEventListener('click', () => {
        document.body.classList.add('force-landscape');
        this.tryLockLandscape();
        setTimeout(() => this.resize(), 80);
      });
    }

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

    const toggleHandLayout = () => {
      const tc = document.getElementById('touch-controls');
      tc.classList.toggle('swapped');
    };
    document.getElementById('btn-swap-hand').addEventListener('click', toggleHandLayout);
    document.getElementById('btn-toggle-hand-modal').addEventListener('click', toggleHandLayout);

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

    const onBulletFire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.state !== 'playing') return;
      this.btnBullet.classList.add('active');
      this.fireBullet();
      setTimeout(() => this.btnBullet.classList.remove('active'), 95);
    };
    this.btnBullet.addEventListener('pointerdown', onBulletFire);

    const onBazookaFire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.state !== 'playing') return;
      this.btnBazooka.classList.add('active');
      this.fireBazooka();
      setTimeout(() => this.btnBazooka.classList.remove('active'), 120);
    };
    this.btnBazooka.addEventListener('pointerdown', onBazookaFire);

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing') return;
      const isSwapped = document.getElementById('touch-controls').classList.contains('swapped');
      const rect = this.canvas.getBoundingClientRect();
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

  // 20분(50레벨) 전체 구간 동안 비행기 아이템이 랜덤하게 총 5번 등장하도록 스폰 위치 생성
  buildAirplaneSchedule() {
    this.airplaneSpawnWxQueue = [];
    const totalPx = this.road.totalClearPx;
    // 5개 구간으로 나누어 각 구간 내 랜덤 지점에 1개씩(총 5회) 배치
    // 첫 번째 비행기는 초반(레벨 2~7 사이)에서도 경험할 수 있게 배치
    const zones = [
      [0.02, 0.12],
      [0.18, 0.34],
      [0.38, 0.56],
      [0.60, 0.78],
      [0.82, 0.96]
    ];
    for (const [startRatio, endRatio] of zones) {
      const ratio = startRatio + Math.random() * (endRatio - startRatio);
      const wx = Math.round(320 + totalPx * ratio);
      this.airplaneSpawnWxQueue.push(wx);
    }
  }

  resetRunState() {
    this.obstacles = [];
    this.projectiles = [];
    this.items = [];
    this.effects.clear();

    this.bike.reset(this.road, this.height || 400);
    this.currentMeters = 0;
    this.destroyedCount = 0;
    this.runTimeSeconds = 0;
    this.bestAtRunStart = this.bestMeters;
    this.hasCelebratedNewRecord = false;

    this.bulletAmmo = 6;
    this.bazookaAmmo = 1;
    this.bulletCooldown = 0;
    this.bazookaCooldown = 0;

    this.level = 1;
    this.speedPx = 295;
    this.currentSectorId = 0;

    this.nextObstacleWx = 720;
    this.nextItemWx = 1150;
    this.buildAirplaneSchedule();

    this.shakeTime = 0;
    this.updateHUD();
  }

  startGame() {
    this.resetRunState();
    this.modalStart.classList.add('hidden');
    this.modalPause.classList.add('hidden');
    this.modalGameOver.classList.add('hidden');
    this.state = 'playing';
    this.showBanner(
      'STAGE 1 / 50 (20분 완주 챌린지)',
      '지상 장애물(⚠)은 점프! 공중 장애물(⬇)은 점프 금지·그냥 통과!',
      '#00f3ff',
      2500
    );
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

  formatTime(sec) {
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`;
  }

  triggerGameOver(obstacle, isFinalClear = false) {
    this.state = isFinalClear ? 'victory' : 'gameover';
    this.bike.releaseJump();

    if (isFinalClear) {
      window.soundManager.playNewRecord();
      this.effects.spawnExplosion(this.bike.worldX, this.bike.y - 24, '#00ff88', 40, true);
    } else {
      window.soundManager.playCrash();
      this.triggerShake(0.45, 14);
      this.effects.spawnExplosion(this.bike.worldX, this.bike.y - 12, '#ff1e38', 32, true);
    }

    const isNewBest = this.currentMeters > this.bestAtRunStart && this.currentMeters > 0;
    if (this.currentMeters > this.bestMeters) {
      this.bestMeters = this.currentMeters;
      this.saveBestRecord(this.bestMeters);
    }

    const ribbon = document.getElementById('new-record-ribbon');
    if (isNewBest || isFinalClear) {
      ribbon.textContent = isFinalClear
        ? '🏆 CONGRATULATIONS! 50단계 최종 완주 성공! 🏆'
        : '★ NEW BEST RECORD! 최고 기록 경신 ★';
      ribbon.classList.remove('hidden');
    } else {
      ribbon.classList.add('hidden');
    }

    const headingEl = document.querySelector('#gameover-modal .modal-heading');
    const reasonEl = document.getElementById('crash-reason');

    if (isFinalClear) {
      headingEl.textContent = 'STAGE 50 CLEAR!';
      headingEl.style.color = '#00ff88';
      reasonEl.textContent = `축하합니다! 총 주행 시간 ${this.formatTime(this.runTimeSeconds)} 동안 50단계를 모두 정복했습니다!`;
    } else {
      headingEl.textContent = 'CRASHED!';
      headingEl.style.color = '';
      if (obstacle) {
        if (obstacle.isTallOverhead) {
          reasonEl.textContent = `초고층 공중 장애물에 부딪혔습니다! 높게 솟은 공중 장애물은 점프하지 말고 그냥 달려야 통과됩니다!`;
        } else if (obstacle.isOverhead) {
          reasonEl.textContent = `공중 장애물에 부딪혔습니다! 점프하지 않고 밑으로 지나가거나 더 높이 점프해 뛰어넘으세요!`;
        } else {
          reasonEl.textContent = `장애물과 충돌했습니다! (주행 시간: ${this.formatTime(this.runTimeSeconds)})`;
        }
      } else {
        reasonEl.textContent = '장애물과 충돌했습니다.';
      }
    }

    document.getElementById('res-distance').textContent = `${this.currentMeters.toLocaleString()} m`;
    document.getElementById('res-best').textContent = `${this.bestMeters.toLocaleString()} m`;
    const kmh = Math.round(this.speedPx * 0.36);
    document.getElementById('res-level').textContent = `LV.${this.level} / 50 (${kmh} km/h)`;
    document.getElementById('res-destroyed').textContent = `${this.destroyedCount} 개`;
    this.elStartBest.textContent = `${this.bestMeters.toLocaleString()} m`;

    this.updateHUD();
    setTimeout(() => {
      if (this.state === 'gameover' || this.state === 'victory') {
        this.modalGameOver.classList.remove('hidden');
      }
    }, 520);
  }

  getTargetFireHeight() {
    // 전방 가장 가까운 장애물이 공중 장애물이면 발사 각도를 공중 장애물 하단/중심 높이로 자동 조준
    const aheadObs = this.obstacles.find((o) => o.worldX + o.width > this.bike.worldX);
    if (aheadObs && aheadObs.isOverhead) {
      return aheadObs.bottomClearance + Math.min(20, aheadObs.height * 0.5);
    }
    return Math.max(14, Math.min(38, this.bike.airHeight + 14));
  }

  fireBullet() {
    if (this.bulletCooldown > 0) return;
    if (this.bulletAmmo <= 0) {
      this.effects.spawnFloatingText(this.bike.worldX, this.bike.y - 36, '총알 없음! 점프/통과하세요!', '#ffe600');
      return;
    }

    this.bulletAmmo--;
    this.bulletCooldown = 0.14;
    this.bike.muzzleFlashTimer = 0.08;

    const fireHeight = this.getTargetFireHeight();
    this.projectiles.push(new window.Projectile(this.bike.worldX + 18, fireHeight, 'bullet'));
    window.soundManager.playBulletFire();
    this.updateHUD();
  }

  fireBazooka() {
    if (this.bazookaCooldown > 0) return;
    if (this.bazookaAmmo <= 0) {
      this.effects.spawnFloatingText(this.bike.worldX, this.bike.y - 36, '바주카 없음!', '#00f3ff');
      return;
    }

    this.bazookaAmmo--;
    this.bazookaCooldown = 0.35;
    this.bike.muzzleFlashTimer = 0.16;

    const fireHeight = this.getTargetFireHeight();
    this.projectiles.push(new window.Projectile(this.bike.worldX + 20, fireHeight, 'bazooka'));
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

  updateDifficultyAndSpeed(dt) {
    this.runTimeSeconds += dt;
    this.currentMeters = Math.floor(this.road.worldXToMeters(this.bike.worldX - 120));

    const lvData = this.road.getLevelDataByMeters(this.currentMeters);

    if (lvData.isClearedAll) {
      this.level = 50;
      this.triggerGameOver(null, true);
      return;
    }

    if (lvData.level > this.level) {
      this.level = lvData.level;
      const theme = lvData.theme;
      this.currentSectorId = theme.id;
      this.showBanner(
        `LEVEL ${this.level} / 50 진입!`,
        `굴곡 테마: ${theme.styleName} · 완주까지 ${51 - this.level}단계`,
        theme.mainColor,
        2100
      );
    }

    const targetSpeed = lvData.speedPx;
    this.speedPx += (targetSpeed - this.speedPx) * Math.min(1, dt * 2.5);

    if (this.currentMeters > this.bestMeters) {
      this.bestMeters = this.currentMeters;
      this.saveBestRecord(this.bestMeters);

      if (this.bestAtRunStart > 0 && !this.hasCelebratedNewRecord) {
        this.hasCelebratedNewRecord = true;
        window.soundManager.playNewRecord();
        this.showBanner('★ NEW BEST RECORD! ★', `이전 최고 기록(${this.bestAtRunStart.toLocaleString()}m)을 돌파했습니다!`, '#ffe600', 2600);
      }
    }
  }

  spawnWorldEntities(cameraX) {
    const spawnHorizon = cameraX + this.width + 260;

    // 1. 단독(1개), 2연속 결합, 3연속 결합 및 공중(점프금지) 장애물 스폰
    while (this.nextObstacleWx < spawnHorizon) {
      const specOrArray = this.pickObstacleSpecForLevel(this.level);
      const obs = new window.Obstacle(this.nextObstacleWx, specOrArray);
      this.obstacles.push(obs);

      const minSafeLandingGap = this.speedPx * 0.74 + obs.width;
      const levelTightness = Math.max(90, 250 - this.level * 3.1);
      const randomExtraGap = 145 + Math.random() * levelTightness;
      this.nextObstacleWx += minSafeLandingGap + randomExtraGap;
    }

    // 2. 20분 주행 중 랜덤하게 총 5번 등장하는 '비행기 변신 아이템' 체크 및 스폰
    while (this.airplaneSpawnWxQueue.length > 0 && this.airplaneSpawnWxQueue[0] < spawnHorizon) {
      const airplaneWx = this.airplaneSpawnWxQueue.shift();
      this.items.push(new window.WeaponItem(airplaneWx, 'airplane', 48));
    }

    // 3. 총알 & 바주카포 보급 아이템 스폰 (30% 빈도 유지)
    while (this.nextItemWx < spawnHorizon) {
      const itemType = Math.random() < 0.27 ? 'bazooka' : 'bullet';

      const overlappingObs = this.obstacles.find(
        (o) => this.nextItemWx >= o.worldX - 65 && this.nextItemWx <= o.worldX + o.width + 65
      );

      let spawnWx = this.nextItemWx;
      let floatH = 38;

      if (overlappingObs) {
        if (overlappingObs.isOverhead) {
          // 공중 장애물 구간에서는 점프하지 않고도 먹을 수 있도록 도로 바로 위에 낮게 배치
          spawnWx = overlappingObs.worldX - 90;
          floatH = 22;
        } else if (Math.random() < 0.55) {
          spawnWx = overlappingObs.worldX - 105;
          floatH = 36;
        } else {
          spawnWx = overlappingObs.worldX + overlappingObs.width * 0.5;
          floatH = overlappingObs.height + 48;
        }
      } else {
        floatH = Math.random() < 0.35 ? 72 : 36;
      }

      this.items.push(new window.WeaponItem(spawnWx, itemType, floatH));
      this.nextItemWx += 1240 + Math.random() * 780;
    }
  }

  // 레벨에 따라 단독 장애물, 2개 연속 결합, 3개 연속 결합, 낮은 공중 장애물(뛰어넘거나 밑으로 통과), 또는 초고층 공중 장애물(점프 시 사망) 선택
  pickObstacleSpecForLevel(level) {
    // 1) 레벨 2 이상부터 약 24% 확률로 땅 위(공중) 장애물 등장
    if (level >= 2 && Math.random() < 0.24) {
      const overheadPool = ['overhead_drone', 'overhead_saw']; // 낮아서 밑으로 가도 되고 점프로 뛰어넘어도 되는 공중 장애물
      if (level >= 3) overheadPool.push('overhead_tall_laser'); // 아주 높아서 점프하면 무조건 부딪혀 죽는 공중 장애물
      if (level >= 6) overheadPool.push('overhead_tall_monolith'); // 아주 높게 솟은 공중 가시 성벽
      return overheadPool[Math.floor(Math.random() * overheadPool.length)];
    }

    // 2) 2개나 3개가 동시에 붙어서 나오는 결합 장애물 확률 (레벨이 높을수록 2~3연속 빈도 증가)
    const clusterRoll = Math.random();
    const compactPool = ['short_spike', 'saw_blade'];
    if (level >= 2) compactPool.push('laser_hurdle');
    if (level >= 4) compactPool.push('medium_crate');

    // 3개 연속 붙어 있는 장애물 (레벨 4 이상에서 등장, 최대 롱점프 또는 무기로 돌파 가능하도록 단거리형 3종 결합)
    if (level >= 4 && clusterRoll < Math.min(0.22, 0.08 + level * 0.003)) {
      const s1 = compactPool[Math.floor(Math.random() * Math.min(2, compactPool.length))];
      const s2 = compactPool[Math.floor(Math.random() * Math.min(2, compactPool.length))];
      const s3 = compactPool[Math.floor(Math.random() * Math.min(2, compactPool.length))];
      return [s1, s2, s3];
    }

    // 2개 연속 붙어 있는 장애물 (레벨 2 이상에서 등장)
    if (level >= 2 && clusterRoll < Math.min(0.46, 0.22 + level * 0.005)) {
      const s1 = compactPool[Math.floor(Math.random() * compactPool.length)];
      const s2 = compactPool[Math.floor(Math.random() * compactPool.length)];
      return [s1, s2];
    }

    // 3) 단독 장애물 (10종 풀)
    const pool = ['short_spike', 'saw_blade'];
    if (level >= 2) pool.push('laser_hurdle');
    if (level >= 3) pool.push('medium_crate');
    if (level >= 5) pool.push('flame_geyser');
    if (level >= 7) pool.push('long_trench');
    if (level >= 10) pool.push('crystal_cluster');
    if (level >= 14) pool.push('tall_pylon');
    if (level >= 18) pool.push('spider_mech');
    if (level >= 24) pool.push('mega_fortress');

    if (Math.random() < 0.35 && pool.length >= 3) {
      const recentSlice = pool.slice(-3);
      return recentSlice[Math.floor(Math.random() * recentSlice.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  updateHUD() {
    this.elDistance.textContent = this.currentMeters.toLocaleString();
    this.elBest.textContent = this.bestMeters.toLocaleString();

    const lvData = this.road.getLevelDataByMeters(this.currentMeters);
    const theme = lvData.theme;
    const lvPct = Math.round(lvData.levelProgress * 100);

    if (this.bike.isAirplaneMode()) {
      this.elSectorBadge.textContent = `✈️ 무적 비행기 모드 작동 중! (${this.bike.airplaneTimer.toFixed(1)}초 남음)`;
      this.elSectorBadge.style.color = '#ffd700';
      this.elSectorBadge.style.borderColor = '#ffd700';
    } else {
      this.elSectorBadge.textContent = `STAGE ${String(this.level).padStart(2, '0')}/50 (${lvPct}%) · ${theme.sectorName}`;
      this.elSectorBadge.style.color = theme.mainColor;
      this.elSectorBadge.style.borderColor = theme.mainColor + '66';
    }

    this.elLevel.textContent = `LV.${this.level} / 50`;
    const effectiveSpeed = this.bike.isAirplaneMode() ? this.speedPx * 1.32 : this.speedPx;
    const kmh = Math.round(effectiveSpeed * 0.36);
    this.elSpeed.textContent = `${kmh} km/h`;
    this.elRoadStyle.textContent = theme.styleName;

    this.elBulletCount.textContent = this.bulletAmmo;
    this.elBazookaCount.textContent = this.bazookaAmmo;
    this.elPadBulletAmmo.textContent = this.bulletAmmo;
    this.elPadBazookaAmmo.textContent = this.bazookaAmmo;

    this.elBulletBox.classList.toggle('empty', this.bulletAmmo <= 0);
    this.elBazookaBox.classList.toggle('empty', this.bazookaAmmo <= 0);
    this.btnBullet.classList.toggle('disabled-pad', this.bulletAmmo <= 0);
    this.btnBazooka.classList.toggle('disabled-pad', this.bazookaAmmo <= 0);

    if (!this.bike.isGrounded && !this.bike.isAirplaneMode() && this.state === 'playing') {
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
      this.bike.update(dt, 250, this.road, this.height);
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

    this.updateDifficultyAndSpeed(dt);
    if (this.state !== 'playing') return;

    this.bike.update(dt, this.speedPx, this.road, this.height);
    const cameraX = this.bike.worldX - this.width * this.bike.screenXRatio;

    this.spawnWorldEntities(cameraX);

    // 발사체 이동 및 장애물 명중 판정
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt, this.speedPx);

      if (!proj.active) {
        this.projectiles.splice(i, 1);
        continue;
      }

      for (let j = this.obstacles.length - 1; j >= 0; j--) {
        const obs = this.obstacles[j];
        if (obs.destroyed) continue;

        if (proj.worldX + 10 >= obs.worldX && proj.worldX - 10 <= obs.worldX + obs.width) {
          proj.active = false;
          const isDestroyed = obs.takeDamage(proj.damage);
          const obsCenterWx = obs.worldX + obs.width * 0.5;
          const obsGroundY = this.road.getRoadY(obsCenterWx, this.height);
          const effectY = obs.isOverhead
            ? obsGroundY - obs.bottomClearance - obs.height * 0.5
            : obsGroundY - obs.height * 0.5;

          if (isDestroyed) {
            this.destroyedCount++;
            const isBazooka = proj.type === 'bazooka';
            window.soundManager.playExplosion(isBazooka);
            this.triggerShake(isBazooka ? 0.28 : 0.14, isBazooka ? 10 : 5);
            this.effects.spawnExplosion(
              obsCenterWx,
              effectY,
              isBazooka ? '#00f3ff' : obs.color,
              isBazooka ? 30 : 18,
              isBazooka
            );
            this.effects.spawnFloatingText(
              obsCenterWx,
              effectY - 20,
              isBazooka ? '💥 BAZOOKA 1-SHOT!' : '⚡ DESTROYED!',
              isBazooka ? '#00f3ff' : '#ffe600'
            );
            this.obstacles.splice(j, 1);
          } else {
            window.soundManager.playBulletHit(obs.hp);
            this.effects.spawnExplosion(proj.worldX, effectY, '#ffe600', 7, false);
            this.effects.spawnFloatingText(
              obsCenterWx,
              effectY - 22,
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

    // 아이템 획득 판정 (총알 / 바주카포 / 10초 무적 비행기)
    const bikeScreenPos = {
      sx: this.bike.worldX - cameraX,
      sy: this.bike.y - 10
    };

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.update(dt);

      const { sx, sy } = item.getScreenPos(cameraX, this.road, this.height);
      const dx = bikeScreenPos.sx - sx;
      const dy = bikeScreenPos.sy - sy;
      const dist = Math.hypot(dx, dy);

      if (dist < 38) {
        if (item.type === 'airplane') {
          window.soundManager.playNewRecord();
          this.bike.activateAirplane(10.0);
          this.effects.spawnFloatingText(item.worldX, sy - 20, '✈️ 비행기 변신! 10초 무적!', '#ffd700');
          this.effects.spawnExplosion(item.worldX, sy, '#ffd700', 26, true);
          this.showBanner(
            '✈️ 비행기 변신! (10초 무적 자동 비행)',
            '컨트롤 없이 10초간 초음속으로 모든 장애물을 격파하며 질주합니다!',
            '#ffd700',
            3000
          );
        } else if (item.type === 'bazooka') {
          window.soundManager.playPickup('bazooka');
          this.bazookaAmmo += 1;
          this.effects.spawnFloatingText(item.worldX, sy - 16, '🎁 바주카 +1 보급!', '#00f3ff');
          this.effects.spawnExplosion(item.worldX, sy, '#00f3ff', 12, false);
        } else {
          window.soundManager.playPickup('bullet');
          this.bulletAmmo += 6;
          this.effects.spawnFloatingText(item.worldX, sy - 16, '🎁 총알 +6 보급!', '#00ff88');
          this.effects.spawnExplosion(item.worldX, sy, '#00ff88', 12, false);
        }
        this.items.splice(i, 1);
        continue;
      }

      if (sx < -100) {
        this.items.splice(i, 1);
      }
    }

    // 장애물 업데이트 및 오토바이(또는 무적 비행기) 충돌/격파 판정
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.update(dt);

      // 비행기 무적 모드(또는 착륙 직후 보호막)일 때는 지나가는 경로의 모든 장애물을 자동 폭파!
      if (this.bike.isInvincible()) {
        if (obs.worldX <= this.bike.worldX + 44 && obs.worldX + obs.width >= this.bike.worldX - 30) {
          this.destroyedCount++;
          window.soundManager.playExplosion(false);
          const obsCenterWx = obs.worldX + obs.width * 0.5;
          const obsGroundY = this.road.getRoadY(obsCenterWx, this.height);
          this.effects.spawnExplosion(obsCenterWx, obsGroundY - 24, '#ffd700', 18, false);
          this.effects.spawnFloatingText(obsCenterWx, obsGroundY - 52, '✈️ 무적 격파!', '#ffd700');
          this.obstacles.splice(i, 1);
          continue;
        }
      } else if (obs.checkCollision(this.bike)) {
        this.triggerGameOver(obs, false);
        return;
      }

      if (obs.worldX + obs.width < cameraX - 120) {
        this.obstacles.splice(i, 1);
      }
    }

    this.effects.update(dt);
    this.updateHUD();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const cameraX = this.bike.worldX - this.width * this.bike.screenXRatio;

    ctx.save();
    if (this.shakeTime > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(dx, dy);
    }

    this.road.render(ctx, cameraX, this.width, this.height, this.bestAtRunStart, this.currentMeters);

    for (const item of this.items) {
      item.render(ctx, cameraX, this.road, this.height);
    }

    for (const obs of this.obstacles) {
      obs.render(ctx, cameraX, this.road, this.height);
    }

    for (const proj of this.projectiles) {
      proj.render(ctx, cameraX, this.road, this.height);
    }

    this.bike.render(ctx, cameraX, this.road, this.height);
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
