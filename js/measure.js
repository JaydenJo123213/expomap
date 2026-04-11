// ─── 실측 레이어 (사용자 직접 그리는 측정선) ──────────────────────
const MEASURE_COLOR   = '#1E88E5';
const MEASURE_SEL_COLOR = '#FF6B2B';
const MEASURE_PREVIEW = 'rgba(30,136,229,0.55)';
const MEASURE_FILL    = 'rgba(30,136,229,0.13)';

// ─── 헬퍼: 점 → 선분 최단 거리 (클릭 감지용) ───
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx*dx + dy*dy;
  if (lenSq < 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1)*dx + (py - y1)*dy) / lenSq));
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}

// ─── 헬퍼: 부스 엣지 스냅 ───
// 가장 가까운 부스 left/right/top/bottom 엣지에 자동으로 붙임
function snapToBoothEdge(wx, wy) {
  const SNAP = 15; // world px
  let sx = wx, sy = wy;

  for (const booth of state.booths) {
    const r = getBoothOuterRect(booth);
    const left = r.x, right = r.x + r.w, top = r.y, bottom = r.y + r.h;

    if (Math.abs(wx - left)   < SNAP && Math.abs(wx - left)   < Math.abs(sx - left))   sx = left;
    if (Math.abs(wx - right)  < SNAP && Math.abs(wx - right)  < Math.abs(sx - right))  sx = right;
    if (Math.abs(wy - top)    < SNAP && Math.abs(wy - top)    < Math.abs(sy - top))    sy = top;
    if (Math.abs(wy - bottom) < SNAP && Math.abs(wy - bottom) < Math.abs(sy - bottom)) sy = bottom;
  }

  return { x: sx, y: sy };
}

// ─── 헬퍼: 수직/수평 강제 ───
// |dx| >= |dy| → 수평선 (y 고정), 그 외 → 수직선 (x 고정)
function constrainToAxis(start, end) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dx >= dy) return { x: end.x, y: start.y };
  return { x: start.x, y: end.y };
}

// ─── 내부: 치수선 하나 그리기 ───
function _drawMeasureLine(ctx, x1, y1, x2, y2, zoom, color) {
  const TICK = 8 / zoom;
  const isHoriz = Math.abs(y2 - y1) < 0.5;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([]);

  // 본선
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 끝점 tick (수직선이면 가로 tick, 수평선이면 세로 tick)
  ctx.lineWidth = 1.5 / zoom;
  if (isHoriz) {
    ctx.beginPath();
    ctx.moveTo(x1, y1 - TICK/2); ctx.lineTo(x1, y1 + TICK/2);
    ctx.moveTo(x2, y2 - TICK/2); ctx.lineTo(x2, y2 + TICK/2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1 - TICK/2, y1); ctx.lineTo(x1 + TICK/2, y1);
    ctx.moveTo(x2 - TICK/2, y2); ctx.lineTo(x2 + TICK/2, y2);
    ctx.stroke();
  }

  // 길이 라벨
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const lengthPx = isHoriz ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
  const label = pxToM(lengthPx).toFixed(2) + 'm';
  const fz = Math.max(9 / zoom, 5);

  ctx.font = `600 ${fz}px Pretendard, sans-serif`;
  const tw = ctx.measureText(label).width;
  const ph = 2/zoom, pw = 3/zoom;
  const OFFSET = 10 / zoom;

  ctx.save();
  if (isHoriz) {
    // 수평선: 라벨을 선 위에
    ctx.fillStyle = MEASURE_FILL;
    ctx.fillRect(mx - tw/2 - pw, my - OFFSET - fz/2 - ph, tw + pw*2, fz + ph*2);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my - OFFSET);
  } else {
    // 수직선: 라벨 90° 회전, 선 왼쪽에
    ctx.translate(mx - OFFSET, my);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = MEASURE_FILL;
    ctx.fillRect(-tw/2 - pw, -fz/2 - ph, tw + pw*2, fz + ph*2);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
  }
  ctx.restore();
}

// ─── 메인 렌더 함수 ───
function drawMeasureLayer(ctx, zoom) {
  if (!state.showMeasure) return;
  ctx.save();

  // 저장된 측정선들
  for (const line of state.measureLines) {
    const isSelected = line.id === state.selectedMeasureLineId;
    _drawMeasureLine(ctx, line.x1, line.y1, line.x2, line.y2, zoom,
      isSelected ? MEASURE_SEL_COLOR : MEASURE_COLOR);

    // 선택 시 양 끝점에 작은 원
    if (isSelected) {
      ctx.fillStyle = MEASURE_SEL_COLOR;
      ctx.beginPath(); ctx.arc(line.x1, line.y1, 3/zoom, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(line.x2, line.y2, 3/zoom, 0, Math.PI*2); ctx.fill();
    }
  }

  // 드래그 중 프리뷰
  if (state.measureLineDrawStart && state.measureLinePreviewEnd) {
    const { x: x1, y: y1 } = state.measureLineDrawStart;
    const { x: x2, y: y2 } = state.measureLinePreviewEnd;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > 1) {
      ctx.strokeStyle = MEASURE_PREVIEW;
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5/zoom, 4/zoom]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);

      // 스냅 포인트 표시
      ctx.fillStyle = MEASURE_PREVIEW;
      ctx.beginPath(); ctx.arc(x1, y1, 3/zoom, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y2, 3/zoom, 0, Math.PI*2); ctx.fill();
    }
  }

  ctx.restore();
}
// ────────────────────────────────────────────────────────────────
