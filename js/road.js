// 다양한 형태와 테마로 진화하는 네온 선(Line) 도로 생성 및 렌더링 모듈

const ROAD_THEMES = [
  {
    id: 0,
    sectorName: 'SECTOR 01 · NEON HIGHWAY',
    styleName: '완만한 네온 웨이브',
    mainColor: '#00f3ff',
    subColor: '#0066ff',
    underStyle: 'pillars', // 수직 네온 기둥
    amp1: 18,
    freq1: 0.0022,
    amp2: 8,
    freq2: 0.0055,
    stepMode: false
  },
  {
    id: 1,
    sectorName: 'SECTOR 02 · CYBER HILLS',
    styleName: '트러스 구릉지 도로',
    mainColor: '#ff2a85',
    subColor: '#9d00ff',
    underStyle: 'truss', // 삼각 트러스 구조선
    amp1: 42,
    freq1: 0.0028,
    amp2: 16,
    freq2: 0.0068,
    stepMode: false
  },
  {
    id: 2,
    sectorName: 'SECTOR 03 · SKY TERRACE',
    styleName: '단차 고원 & 슬로프',
    mainColor: '#39ff14',
    subColor: '#00b894',
    underStyle: 'circuit', // 디지털 서킷 라인
    amp1: 36,
    freq1: 0.0025,
    amp2: 22,
    freq2: 0.005,
    stepMode: true // 계단식 완만한 고원 단차 느낌 가미
  },
  {
    id: 3,
    sectorName: 'SECTOR 04 · COASTER RIDGE',
    styleName: '롤러코스터 급경사선',
    mainColor: '#ff8c00',
    subColor: '#ff0055',
    underStyle: 'equalizer', // 네온 이퀄라이저 바
    amp1: 54,
    freq1: 0.0033,
    amp2: 24,
    freq2: 0.0078,
    stepMode: false
  },
  {
    id: 4,
    sectorName: 'SECTOR 05 · OVERDRIVE ABYSS',
    styleName: '초고속 복합 파동선',
    mainColor: '#00ffcc',
    subColor: '#ff00e1',
    underStyle: 'laserGrid', // 복합 레이저 그리드
    amp1: 58,
    freq1: 0.0036,
    amp2: 28,
    freq2: 0.0085,
    stepMode: true
  }
];

class NeonRoad {
  constructor() {
    this.baseGroundRatio = 0.67; // 화면 높이 대비 기본 도로 중심 높이 비율
    this.segmentStep = 14; // 도로 선 샘플링 간격 (px)
    this.bgStars = [];
    this.bgMountains = [];
    this.initBackground();
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

    this.bgMountains = [];
    for (let i = 0; i < 16; i++) {
      this.bgMountains.push({
        index: i,
        heightFactor: 0.12 + Math.sin(i * 1.7) * 0.06 + (i % 3) * 0.03
      });
    }
  }

  // 주행 거리(m)에 따른 현재 도로 섹터 테마 반환 (250m마다 새로운 도로 모습으로 전환)
  getThemeByMeters(meters) {
    const idx = Math.floor(meters / 250) % ROAD_THEMES.length;
    return ROAD_THEMES[idx];
  }

  // 월드 X 좌표를 미터(m)로 변환 (1m = 28px)
  worldXToMeters(worldX) {
    return Math.max(0, worldX / 28);
  }

  metersToWorldX(meters) {
    return meters * 28;
  }

  // 특정 월드 X 좌표에서의 도로 높이(Y) 계산 (연속적이고 매끄러운 선 도로 보장)
  getRoadY(worldX, canvasHeight) {
    const baseLine = canvasHeight * this.baseGroundRatio;

    // 초반 320px 구간은 출발 적응을 위해 평탄한 도로 유지
    if (worldX < 320) {
      return baseLine;
    }

    const activeX = worldX - 320;
    const rampIn = Math.min(1, activeX / 450);

    // 섹터 간 부드러운 보간 (250m = 7000px 주기)
    const sectorSpanPx = 250 * 28;
    const rawSector = Math.max(0, worldX) / sectorSpanPx;
    const idxA = Math.floor(rawSector) % ROAD_THEMES.length;
    const idxB = (idxA + 1) % ROAD_THEMES.length;
    const frac = rawSector - Math.floor(rawSector);
    // 섹터 끝 15% 구간에서 다음 도로 형태로 매끄럽게 블렌딩
    const blend = frac > 0.85 ? (frac - 0.85) / 0.15 : 0;

    const yA = this.evalWavePattern(activeX, ROAD_THEMES[idxA], canvasHeight);
    const yB = this.evalWavePattern(activeX, ROAD_THEMES[idxB], canvasHeight);
    const waveOffset = yA * (1 - blend) + yB * blend;

    return baseLine + waveOffset * rampIn;
  }

  evalWavePattern(x, theme, canvasHeight) {
    // 작은 스마트폰 화면에서도 도로가 화면 밖이나 UI와 겹치지 않도록 진폭 스케일 조정
    const heightScale = Math.min(1.05, Math.max(0.58, canvasHeight / 420));
    let w1 = Math.sin(x * theme.freq1) * theme.amp1;
    let w2 = Math.cos(x * theme.freq2 + 1.3) * theme.amp2;

    if (theme.stepMode) {
      // 단차 고원(테라스) 느낌의 완만한 계단형 웨이브 합성
      const plateau = Math.tanh(Math.sin(x * 0.0019) * 2.6) * (theme.amp1 * 0.85);
      w1 = w1 * 0.4 + plateau * 0.6;
    }

    return (w1 + w2) * heightScale;
  }

  // 특정 월드 X 좌표에서의 도로 기울기(라디안 각도) 계산
  getRoadAngle(worldX, canvasHeight) {
    const delta = 8;
    const y1 = this.getRoadY(worldX - delta, canvasHeight);
    const y2 = this.getRoadY(worldX + delta, canvasHeight);
    return Math.atan2(y2 - y1, delta * 2);
  }

  render(ctx, cameraX, canvasWidth, canvasHeight, bestRecordMeters, currentMeters) {
    const theme = this.getThemeByMeters(currentMeters);

    // 1. 배경 네온 별 & 원경 마운틴 와이어프레임
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

    // 3. 도로 아래 네온 그리드/구조물 장식 (섹터마다 다른 도로 외형 연출)
    this.renderUnderStructure(ctx, points, canvasHeight, theme);

    // 4. 도로 아래 은은한 그라데이션 필
    ctx.save();
    const grad = ctx.createLinearGradient(0, canvasHeight * 0.45, 0, canvasHeight);
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

    // 5. 보조 하단 네온 라인 (이중 네온 선 효과)
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p.sx, p.sy + 9);
      else ctx.lineTo(p.sx, p.sy + 9);
    }
    ctx.strokeStyle = theme.subColor;
    ctx.lineWidth = 2;
    ctx.setLineDash(theme.stepMode ? [14, 8] : []);
    ctx.stroke();
    ctx.restore();

    // 6. 메인 네온 도로 선 (글로우 + 코어 화이트 라인)
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.strokeStyle = theme.mainColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = theme.mainColor;
    ctx.shadowBlur = 16;
    ctx.stroke();

    // 중심 하이라이트 밝은 선
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    // 7. 거리 표지판 (100m 단위) 및 내 최고 기록(BEST RECORD) 네온 비콘 표시
    this.renderMilestones(ctx, cameraX, canvasWidth, canvasHeight, bestRecordMeters, theme);
  }

  renderBackground(ctx, cameraX, canvasWidth, canvasHeight, theme) {
    ctx.save();
    // 별 입자
    for (const s of this.bgStars) {
      const px = ((s.xRatio * canvasWidth - cameraX * s.speedFactor) % canvasWidth + canvasWidth) % canvasWidth;
      const py = s.yRatio * canvasHeight;
      ctx.fillStyle = `rgba(200, 240, 255, ${s.alpha})`;
      ctx.fillRect(px, py, s.size, s.size);
    }

    // 원경 네온 산맥 (패럴랙스 선)
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
    ctx.strokeStyle = theme.subColor + '44';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  renderUnderStructure(ctx, points, canvasHeight, theme) {
    ctx.save();
    ctx.strokeStyle = theme.mainColor + '40';
    ctx.lineWidth = 1.2;

    if (theme.underStyle === 'pillars') {
      // 일정 간격 수직 네온 기둥
      for (let i = 0; i < points.length; i += 4) {
        const p = points[i];
        if (Math.floor(p.wx / this.segmentStep) % 4 === 0) {
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy + 9);
          ctx.lineTo(p.sx, canvasHeight);
          ctx.stroke();
        }
      }
    } else if (theme.underStyle === 'truss') {
      // 지그재그 다리 트러스 선
      ctx.beginPath();
      for (let i = 0; i < points.length - 2; i += 2) {
        const p1 = points[i];
        const p2 = points[i + 2];
        ctx.moveTo(p1.sx, p1.sy + 9);
        ctx.lineTo((p1.sx + p2.sx) * 0.5, p1.sy + 38);
        ctx.lineTo(p2.sx, p2.sy + 9);
      }
      ctx.stroke();
    } else if (theme.underStyle === 'circuit') {
      // 디지털 서킷 노드 라인
      for (let i = 0; i < points.length; i += 3) {
        const p = points[i];
        if (Math.floor(p.wx / this.segmentStep) % 3 === 0) {
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy + 9);
          ctx.lineTo(p.sx, p.sy + 26);
          ctx.lineTo(p.sx - 12, p.sy + 38);
          ctx.stroke();
          ctx.fillStyle = theme.mainColor + '88';
          ctx.fillRect(p.sx - 14, p.sy + 36, 4, 4);
        }
      }
    } else if (theme.underStyle === 'equalizer') {
      // 이퀄라이저 네온 바
      for (let i = 0; i < points.length; i += 2) {
        const p = points[i];
        const barLen = 14 + Math.abs(Math.sin(p.wx * 0.03)) * 36;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy + 12);
        ctx.lineTo(p.sx, p.sy + 12 + barLen);
        ctx.stroke();
      }
    } else {
      // 복합 사선 레이저 그리드
      ctx.beginPath();
      for (let i = 0; i < points.length; i += 3) {
        const p = points[i];
        ctx.moveTo(p.sx, p.sy + 9);
        ctx.lineTo(p.sx - 28, canvasHeight);
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
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + 22);
      ctx.stroke();

      ctx.fillStyle = 'rgba(240, 246, 255, 0.7)';
      ctx.fillText(`${m}m`, sx, sy + 34);
    }

    // 이전 최고 기록(BEST RECORD) 위치에 빛나는 황금 네온 폴대 표시
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
        ctx.lineTo(bestSx, bestSy - 95);
        ctx.stroke();

        // 깃발 배너
        ctx.fillStyle = '#ffe600';
        ctx.fillRect(bestSx - 38, bestSy - 114, 76, 18);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#050510';
        ctx.font = '900 10px sans-serif';
        ctx.fillText(`★ BEST ${bestRecordMeters}m`, bestSx, bestSy - 101);
      }
    }
    ctx.restore();
  }
}

window.NeonRoad = NeonRoad;
