// 50단계(총 20분 완주) 레벨 구조 및 아주 높은 언덕·다채로운 굴곡을 가진 네온 선(Line) 도로 모듈

const ROAD_THEMES = [
  {
    id: 0,
    sectorName: 'NEON HIGHWAY',
    styleName: '복합 웨이브 & 고지대 언덕',
    mainColor: '#00f3ff',
    subColor: '#0066ff',
    underStyle: 'pillars',
    profile: 'high_hills',
    amp1: 42,
    freq1: 0.0022,
    amp2: 24,
    freq2: 0.0052
  },
  {
    id: 1,
    sectorName: 'MEGA PEAK HILLS',
    styleName: '초대형 급경사 대언덕',
    mainColor: '#a855f7',
    subColor: '#6366f1',
    underStyle: 'truss',
    profile: 'mega_peaks',
    amp1: 78,
    freq1: 0.0019,
    amp2: 32,
    freq2: 0.0048
  },
  {
    id: 2,
    sectorName: 'SKY TERRACE',
    styleName: '고원 절벽 & 급강하 단차',
    mainColor: '#38bdf8',
    subColor: '#0284c7',
    underStyle: 'circuit',
    profile: 'steep_terrace',
    amp1: 68,
    freq1: 0.0018,
    amp2: 26,
    freq2: 0.0055
  },
  {
    id: 3,
    sectorName: 'CAMELBACK RIDGE',
    styleName: '이중 낙타봉 & 깊은 계곡',
    mainColor: '#818cf8',
    subColor: '#4f46e5',
    underStyle: 'equalizer',
    profile: 'double_crest',
    amp1: 72,
    freq1: 0.0021,
    amp2: 35,
    freq2: 0.0062
  },
  {
    id: 4,
    sectorName: 'ROLLERCOASTER',
    styleName: '롤러코스터 급상승·급강하',
    mainColor: '#2dd4bf',
    subColor: '#0d9488',
    underStyle: 'laserGrid',
    profile: 'coaster',
    amp1: 84,
    freq1: 0.0024,
    amp2: 38,
    freq2: 0.0068
  },
  {
    id: 5,
    sectorName: 'TITAN SUMMIT',
    styleName: '타이탄 최고봉 산악도로',
    mainColor: '#c084fc',
    subColor: '#7e22ce',
    underStyle: 'truss',
    profile: 'mega_peaks',
    amp1: 92,
    freq1: 0.0017,
    amp2: 36,
    freq2: 0.0050
  },
  {
    id: 6,
    sectorName: 'QUANTUM STEP',
    styleName: '퀀텀 계단식 고저차 궤도',
    mainColor: '#60a5fa',
    subColor: '#2563eb',
    underStyle: 'pillars',
    profile: 'steep_terrace',
    amp1: 76,
    freq1: 0.0020,
    amp2: 30,
    freq2: 0.0058
  },
  {
    id: 7,
    sectorName: 'SYNTH CANYON',
    styleName: '신스웨이브 대협곡 능선',
    mainColor: '#e879f9',
    subColor: '#a21caf',
    underStyle: 'equalizer',
    profile: 'double_crest',
    amp1: 86,
    freq1: 0.0023,
    amp2: 40,
    freq2: 0.0066
  },
  {
    id: 8,
    sectorName: 'AERO BRIDGE',
    styleName: '초고속 스카이 다이브',
    mainColor: '#22d3ee',
    subColor: '#0891b2',
    underStyle: 'circuit',
    profile: 'coaster',
    amp1: 90,
    freq1: 0.0025,
    amp2: 42,
    freq2: 0.0072
  },
  {
    id: 9,
    sectorName: 'OVERDRIVE CORE',
    styleName: '파이널 익스트림 대언덕',
    mainColor: '#38ef7d',
    subColor: '#11998e',
    underStyle: 'laserGrid',
    profile: 'mega_peaks',
    amp1: 96,
    freq1: 0.0022,
    amp2: 44,
    freq2: 0.0075
  }
];

class NeonRoad {
  constructor() {
    this.baseGroundRatio = 0.66; // 높은 언덕과 깊은 골짜기를 모두 수용하도록 중심선 배치
    this.segmentStep = 12; // 급경사 언덕도 매끄러운 곡선으로 표현하도록 세밀하게 샘플링
    this.bgStars = [];
    this.initBackground();
    this.buildLevelTable();
  }

  // 1단계부터 50단계까지 죽지 않고 달릴 때 총 20분(1,200초 = 단계당 정확히 24초)이 걸리도록 레벨별 도로 길이 설정
  buildLevelTable() {
    this.maxLevel = 50;
    this.secondsPerLevel = 24; // 50단계 * 24초 = 1,200초 (정확히 20분)
    this.levels = [];

    let cumulativePx = 0;
    let cumulativeMeters = 0;

    for (let lv = 1; lv <= this.maxLevel; lv++) {
      const progress = (lv - 1) / (this.maxLevel - 1); // 0.0 ~ 1.0
      // LV.1 속도 295 px/s (106 km/h) -> LV.50 속도 555 px/s (200 km/h)
      const speedPx = Math.round(295 + progress * 260);
      // 각 레벨을 통과하는 데 24초가 걸리도록 레벨별 도로 길이 산정
      const spanPx = speedPx * this.secondsPerLevel;
      const spanMeters = Math.round(spanPx / 28);

      const startPx = cumulativePx;
      const endPx = cumulativePx + spanPx;
      const startMeters = cumulativeMeters;
      const endMeters = cumulativeMeters + spanMeters;

      const theme = ROAD_THEMES[(lv - 1) % ROAD_THEMES.length];

      this.levels.push({
        level: lv,
        speedPx,
        spanPx,
        spanMeters,
        startPx,
        endPx,
        startMeters,
        endMeters,
        theme
      });

      cumulativePx = endPx;
      cumulativeMeters = endMeters;
    }

    this.totalClearPx = cumulativePx;
    this.totalClearMeters = cumulativeMeters; // 50단계 완주 총 거리 (약 18,214m, 20분 소요)
  }

  initBackground() {
    this.bgStars = [];
    for (let i = 0; i < 45; i++) {
      this.bgStars.push({
        xRatio: Math.random(),
        yRatio: Math.random() * 0.65,
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.65 + 0.2,
        speedFactor: Math.random() * 0.08 + 0.02
      });
    }
  }

  getLevelDataByMeters(meters) {
    for (let i = 0; i < this.levels.length; i++) {
      const lvData = this.levels[i];
      if (meters < lvData.endMeters) {
        const levelProgress = Math.max(0, Math.min(1, (meters - lvData.startMeters) / lvData.spanMeters));
        return {
          ...lvData,
          levelProgress,
          isClearedAll: false
        };
      }
    }
    const last = this.levels[this.levels.length - 1];
    return {
      ...last,
      levelProgress: 1,
      isClearedAll: true
    };
  }

  getThemeByMeters(meters) {
    return this.getLevelDataByMeters(meters).theme;
  }

  worldXToMeters(worldX) {
    return Math.max(0, worldX / 28);
  }

  metersToWorldX(meters) {
    return meters * 28;
  }

  // 아주 높은 언덕, 깊은 계곡, 이중 능선, 고원 단차 등 다채로운 도로 굴곡 계산
  getRoadY(worldX, canvasHeight) {
    const baseLine = canvasHeight * this.baseGroundRatio;

    // 초반 출발 구간 280px은 적응을 위해 완만하게 시작
    if (worldX < 280) {
      return baseLine;
    }

    const activeX = worldX - 280;
    const rampIn = Math.min(1, activeX / 400);

    const meters = this.worldXToMeters(activeX);
    const lvData = this.getLevelDataByMeters(meters);
    const themeA = lvData.theme;
    const nextThemeIdx = lvData.level % ROAD_THEMES.length;
    const themeB = ROAD_THEMES[nextThemeIdx];

    const blend = lvData.levelProgress > 0.88 ? (lvData.levelProgress - 0.88) / 0.12 : 0;

    const yA = this.evalWavePattern(activeX, themeA, canvasHeight);
    const yB = this.evalWavePattern(activeX, themeB, canvasHeight);
    const waveOffset = (yA * (1 - blend) + yB * blend) * rampIn;

    // 화면 상단 HUD와 하단 컨트롤 영역을 침범하지 않는 선에서 최대한 높고 깊은 언덕 허용
    const minY = canvasHeight * 0.35; // 아주 높은 언덕 꼭대기 한계선
    const maxY = canvasHeight * 0.82; // 깊은 골짜기 바닥 한계선
    return Math.max(minY, Math.min(maxY, baseLine + waveOffset));
  }

  evalWavePattern(x, theme, canvasHeight) {
    const heightScale = Math.min(1.12, Math.max(0.58, canvasHeight / 400));
    const p = theme.profile;

    // 주기적으로 등장하는 '초대형 높은 언덕(Mega Hill)' 융기 성분 (음수 Y가 화면 위쪽 = 높은 언덕)
    const hillPulse = Math.pow(Math.max(0, Math.sin(x * 0.00095 + 0.7)), 3);
    const megaHillBoost = -hillPulse * (theme.amp1 * 0.95);

    let rawWave = 0;

    if (p === 'mega_peaks') {
      // 초대형 급경사 대언덕 + 깊은 계곡
      const bigWave = Math.sin(x * theme.freq1) * theme.amp1;
      const subWave = Math.cos(x * theme.freq2) * theme.amp2;
      const sharpPeak = -Math.pow(Math.max(0, Math.sin(x * 0.0014)), 2) * 58;
      rawWave = bigWave * 0.85 + subWave * 0.45 + sharpPeak + megaHillBoost * 0.5;
    } else if (p === 'steep_terrace') {
      // 고원 절벽 & 계단식 급경사 슬로프
      const plateau = Math.tanh(Math.sin(x * theme.freq1) * 3.2) * (theme.amp1 * 0.9);
      const terraceStep = Math.tanh(Math.cos(x * 0.00085) * 4.0) * 42;
      const ripple = Math.sin(x * theme.freq2) * (theme.amp2 * 0.5);
      rawWave = plateau + terraceStep + ripple;
    } else if (p === 'double_crest') {
      // 낙타봉 이중 언덕 (연속 두 번 치솟는 높은 언덕)
      const s1 = Math.sin(x * theme.freq1);
      const doubleHump = (s1 - 0.45 * Math.sin(x * theme.freq1 * 2 + 0.8)) * theme.amp1;
      const detail = Math.cos(x * theme.freq2) * theme.amp2;
      rawWave = doubleHump + detail * 0.6 + megaHillBoost * 0.65;
    } else if (p === 'coaster') {
      // 롤러코스터 급상승·급강하 복합 지형
      const drop = Math.sin(x * theme.freq1) * theme.amp1;
      const loopWave = Math.sin(x * theme.freq2 * 1.15) * theme.amp2;
      const sub = Math.cos(x * 0.0011) * 45;
      rawWave = drop * 0.8 + loopWave * 0.75 + sub;
    } else {
      // high_hills: 완만한 웨이브를 달리다가 한 번씩 거대한 언덕이 솟구치는 지형
      const w1 = Math.sin(x * theme.freq1) * theme.amp1;
      const w2 = Math.cos(x * theme.freq2 + 1.3) * theme.amp2;
      rawWave = w1 + w2 + megaHillBoost * 1.1;
    }

    return rawWave * heightScale;
  }

  getRoadAngle(worldX, canvasHeight) {
    const delta = 8;
    const y1 = this.getRoadY(worldX - delta, canvasHeight);
    const y2 = this.getRoadY(worldX + delta, canvasHeight);
    return Math.atan2(y2 - y1, delta * 2);
  }

  render(ctx, cameraX, canvasWidth, canvasHeight, bestRecordMeters, currentMeters) {
    const theme = this.getThemeByMeters(currentMeters);

    // 1. 배경 네온 별 & 원경 산맥
    this.renderBackground(ctx, cameraX, canvasWidth, canvasHeight, theme);

    // 2. 도로 선 샘플링
    const startX = Math.floor(cameraX / this.segmentStep) * this.segmentStep - this.segmentStep;
    const endX = cameraX + canvasWidth + this.segmentStep * 2;

    const points = [];
    for (let wx = startX; wx <= endX; wx += this.segmentStep) {
      const sx = wx - cameraX;
      const sy = this.getRoadY(wx, canvasHeight);
      points.push({ wx, sx, sy });
    }

    if (points.length < 2) return;

    // 3. 도로 아래 구조물 장식
    this.renderUnderStructure(ctx, points, canvasHeight, theme);

    // 4. 도로 아래 은은한 그라데이션
    ctx.save();
    const grad = ctx.createLinearGradient(0, canvasHeight * 0.35, 0, canvasHeight);
    grad.addColorStop(0, theme.mainColor + '28');
    grad.addColorStop(0.5, theme.subColor + '12');
    grad.addColorStop(1, 'rgba(4, 4, 12, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].sx, canvasHeight);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(points[i].sx, points[i].sy);
    }
    ctx.lineTo(points[points.length - 1].sx, canvasHeight);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // 5. 보조 하단 네온 라인
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p.sx, p.sy + 7);
      else ctx.lineTo(p.sx, p.sy + 7);
    }
    ctx.strokeStyle = theme.subColor;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(theme.profile === 'steep_terrace' ? [12, 7] : []);
    ctx.stroke();
    ctx.restore();

    // 6. 메인 네온 도로 선
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.strokeStyle = theme.mainColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = theme.mainColor;
    ctx.shadowBlur = 14;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    // 7. 거리 표지판 및 최고 기록 비콘 표시
    this.renderMilestones(ctx, cameraX, canvasWidth, canvasHeight, bestRecordMeters, theme);
  }

  renderBackground(ctx, cameraX, canvasWidth, canvasHeight, theme) {
    ctx.save();
    for (const s of this.bgStars) {
      const px = ((s.xRatio * canvasWidth - cameraX * s.speedFactor) % canvasWidth + canvasWidth) % canvasWidth;
      const py = s.yRatio * canvasHeight;
      ctx.fillStyle = `rgba(200, 240, 255, ${s.alpha})`;
      ctx.fillRect(px, py, s.size, s.size);
    }

    const mountSpan = 160;
    const parallaxX = cameraX * 0.15;
    const firstIdx = Math.floor(parallaxX / mountSpan) - 1;
    const count = Math.ceil(canvasWidth / mountSpan) + 3;
    const horizonY = canvasHeight * 0.72;

    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const mIdx = firstIdx + i;
      const mx = mIdx * mountSpan - parallaxX;
      const hSeed = Math.abs(Math.sin(mIdx * 1.9 + 0.5)) * 0.18 + 0.05;
      const my = horizonY - canvasHeight * hSeed;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.strokeStyle = theme.subColor + '40';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  renderUnderStructure(ctx, points, canvasHeight, theme) {
    ctx.save();
    ctx.strokeStyle = theme.mainColor + '38';
    ctx.lineWidth = 1.1;

    if (theme.underStyle === 'pillars') {
      for (let i = 0; i < points.length; i += 4) {
        const p = points[i];
        if (Math.floor(p.wx / this.segmentStep) % 4 === 0) {
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy + 7);
          ctx.lineTo(p.sx, canvasHeight);
          ctx.stroke();
        }
      }
    } else if (theme.underStyle === 'truss') {
      ctx.beginPath();
      for (let i = 0; i < points.length - 2; i += 2) {
        const p1 = points[i];
        const p2 = points[i + 2];
        ctx.moveTo(p1.sx, p1.sy + 7);
        ctx.lineTo((p1.sx + p2.sx) * 0.5, p1.sy + 34);
        ctx.lineTo(p2.sx, p2.sy + 7);
      }
      ctx.stroke();
    } else if (theme.underStyle === 'circuit') {
      for (let i = 0; i < points.length; i += 3) {
        const p = points[i];
        if (Math.floor(p.wx / this.segmentStep) % 3 === 0) {
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy + 7);
          ctx.lineTo(p.sx, p.sy + 24);
          ctx.lineTo(p.sx - 10, p.sy + 34);
          ctx.stroke();
          ctx.fillStyle = theme.mainColor + '88';
          ctx.fillRect(p.sx - 12, p.sy + 32, 3.5, 3.5);
        }
      }
    } else if (theme.underStyle === 'equalizer') {
      for (let i = 0; i < points.length; i += 2) {
        const p = points[i];
        const barLen = 12 + Math.abs(Math.sin(p.wx * 0.03)) * 32;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy + 10);
        ctx.lineTo(p.sx, p.sy + 10 + barLen);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      for (let i = 0; i < points.length; i += 3) {
        const p = points[i];
        ctx.moveTo(p.sx, p.sy + 7);
        ctx.lineTo(p.sx - 24, canvasHeight);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  renderMilestones(ctx, cameraX, canvasWidth, canvasHeight, bestRecordMeters, theme) {
    const startMeter = Math.floor(this.worldXToMeters(cameraX) / 100) * 100;
    const endMeter = this.worldXToMeters(cameraX + canvasWidth) + 50;

    ctx.save();
    ctx.font = '800 10px sans-serif';
    ctx.textAlign = 'center';

    for (let m = Math.max(100, startMeter); m <= endMeter; m += 100) {
      const wx = this.metersToWorldX(m);
      const sx = wx - cameraX;
      if (sx < -40 || sx > canvasWidth + 40) continue;
      const sy = this.getRoadY(wx, canvasHeight);

      ctx.strokeStyle = theme.mainColor + '88';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + 20);
      ctx.stroke();

      ctx.fillStyle = 'rgba(240, 246, 255, 0.68)';
      ctx.fillText(`${m}m`, sx, sy + 32);
    }

    if (bestRecordMeters >= 15) {
      const bestWx = this.metersToWorldX(bestRecordMeters);
      const bestSx = bestWx - cameraX;
      if (bestSx >= -80 && bestSx <= canvasWidth + 80) {
        const bestSy = this.getRoadY(bestWx, canvasHeight);
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(bestSx, bestSy);
        ctx.lineTo(bestSx, bestSy - 90);
        ctx.stroke();

        ctx.fillStyle = '#ffe600';
        ctx.fillRect(bestSx - 38, bestSy - 108, 76, 18);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#050510';
        ctx.font = '900 10px sans-serif';
        ctx.fillText(`★ BEST ${bestRecordMeters}m`, bestSx, bestSy - 95);
      }
    }
    ctx.restore();
  }
}

window.NeonRoad = NeonRoad;
