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

// ─── 헬퍼: 시작점용 근접 스냅 ───
// 1순위: 모서리(corner) 스냅 — 가장 가까운 모서리가 SNAP 이내면 x·y 동시 고정
// 2순위: 엣지(edge) 스냅  — x·y 독립적으로 근접 엣지에 붙임
function snapToBoothEdge(wx, wy) {
  const SNAP = 15;

  // ── 1순위: 모서리 스냅 (부스 + 사각형 기둥) ──
  let bestCornerDist = SNAP;
  let cornerSnap = null;

  const checkCorners = (corners) => {
    for (const [cx, cy] of corners) {
      const d = Math.hypot(wx - cx, wy - cy);
      if (d < bestCornerDist) { bestCornerDist = d; cornerSnap = { x: cx, y: cy }; }
    }
  };

  for (const booth of state.booths) {
    const r = getBoothOuterRect(booth);
    checkCorners([
      [r.x,       r.y      ],
      [r.x + r.w, r.y      ],
      [r.x,       r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ]);
  }
  for (const s of state.structures) {
    if (s.type !== 'column') continue;
    const e = getColumnEdges(s);
    checkCorners([
      [e.left,  e.top   ],
      [e.right, e.top   ],
      [e.left,  e.bottom],
      [e.right, e.bottom],
    ]);
  }

  if (cornerSnap) return cornerSnap;

  // ── 2순위: 엣지 스냅 (x·y 독립, 각 축별 가장 가까운 엣지) ──
  let sx = wx, sy = wy;
  let bestXDist = SNAP, bestYDist = SNAP;

  for (const booth of state.booths) {
    const r = getBoothOuterRect(booth);
    const dL = Math.abs(wx - r.x),       dR = Math.abs(wx - r.x - r.w);
    const dT = Math.abs(wy - r.y),       dB = Math.abs(wy - r.y - r.h);
    if (dL < bestXDist) { bestXDist = dL; sx = r.x; }
    if (dR < bestXDist) { bestXDist = dR; sx = r.x + r.w; }
    if (dT < bestYDist) { bestYDist = dT; sy = r.y; }
    if (dB < bestYDist) { bestYDist = dB; sy = r.y + r.h; }
  }
  for (const s of state.structures) {
    if (s.type !== 'column') continue;
    const e = getColumnEdges(s);
    const dL = Math.abs(wx - e.left),   dR = Math.abs(wx - e.right);
    const dT = Math.abs(wy - e.top),    dB = Math.abs(wy - e.bottom);
    if (dL < bestXDist) { bestXDist = dL; sx = e.left; }
    if (dR < bestXDist) { bestXDist = dR; sx = e.right; }
    if (dT < bestYDist) { bestYDist = dT; sy = e.top; }
    if (dB < bestYDist) { bestYDist = dB; sy = e.bottom; }
  }

  return { x: sx, y: sy };
}

// 기둥의 4방향 엣지 좌표 반환 (원형: 중심±반지름, 사각형: 중심±반크기)
function getColumnEdges(s) {
  if (s.columnShape === 'square') {
    const hw = (s.w || s.radius * 2) / 2;
    const hh = (s.h || s.radius * 2) / 2;
    return { left: s.x - hw, right: s.x + hw, top: s.y - hh, bottom: s.y + hh };
  }
  const r = s.radius || 5;
  return { left: s.x - r, right: s.x + r, top: s.y - r, bottom: s.y + r };
}

// ─── 헬퍼: 끝점용 교차 스냅 ───
// start→end 선분이 지나가는 부스 엣지 중 end(마우스)에 가장 가까운 것으로 스냅.
// 교차 엣지 없으면 근접 스냅(15px) 폴백.
function snapEndAlongAxis(start, end) {
  const isHoriz = Math.abs(end.y - start.y) < 0.5;
  const EPS = 0.5;
  const PROX = 15;

  let bestEdge = null;
  let bestDist = Infinity;

  const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);

  for (const booth of state.booths) {
    const r = getBoothOuterRect(booth);

    if (isHoriz) {
      // 선의 y가 부스 y범위 안에 있어야 교차 가능
      if (start.y < r.y - EPS || start.y > r.y + r.h + EPS) continue;
      for (const ex of [r.x, r.x + r.w]) {
        if (ex < minX - EPS || ex > maxX + EPS) continue; // 선분 범위 밖
        const dist = Math.abs(ex - end.x);
        if (dist < bestDist) { bestDist = dist; bestEdge = { x: ex, y: start.y }; }
      }
    } else {
      // 선의 x가 부스 x범위 안에 있어야 교차 가능
      if (start.x < r.x - EPS || start.x > r.x + r.w + EPS) continue;
      for (const ey of [r.y, r.y + r.h]) {
        if (ey < minY - EPS || ey > maxY + EPS) continue;
        const dist = Math.abs(ey - end.y);
        if (dist < bestDist) { bestDist = dist; bestEdge = { x: start.x, y: ey }; }
      }
    }
  }

  // 기둥 교차 스냅 (부스와 동일 로직, bounding box 기준)
  for (const s of state.structures) {
    if (s.type !== 'column') continue;
    const ce = getColumnEdges(s);

    if (isHoriz) {
      if (start.y < ce.top - EPS || start.y > ce.bottom + EPS) continue;
      for (const ex of [ce.left, ce.right]) {
        if (ex < minX - EPS || ex > maxX + EPS) continue;
        const dist = Math.abs(ex - end.x);
        if (dist < bestDist) { bestDist = dist; bestEdge = { x: ex, y: start.y }; }
      }
    } else {
      if (start.x < ce.left - EPS || start.x > ce.right + EPS) continue;
      for (const ey of [ce.top, ce.bottom]) {
        if (ey < minY - EPS || ey > maxY + EPS) continue;
        const dist = Math.abs(ey - end.y);
        if (dist < bestDist) { bestDist = dist; bestEdge = { x: start.x, y: ey }; }
      }
    }
  }

  if (bestEdge) return bestEdge;

  // 폴백: 근접 스냅 (부스 + 기둥 엣지)
  for (const booth of state.booths) {
    const r = getBoothOuterRect(booth);
    if (isHoriz) {
      if (start.y < r.y - EPS || start.y > r.y + r.h + EPS) continue;
      for (const ex of [r.x, r.x + r.w]) {
        if (Math.abs(ex - end.x) < PROX) return { x: ex, y: start.y };
      }
    } else {
      if (start.x < r.x - EPS || start.x > r.x + r.w + EPS) continue;
      for (const ey of [r.y, r.y + r.h]) {
        if (Math.abs(ey - end.y) < PROX) return { x: start.x, y: ey };
      }
    }
  }
  for (const s of state.structures) {
    if (s.type !== 'column') continue;
    const ce = getColumnEdges(s);
    if (isHoriz) {
      if (start.y < ce.top - EPS || start.y > ce.bottom + EPS) continue;
      for (const ex of [ce.left, ce.right]) {
        if (Math.abs(ex - end.x) < PROX) return { x: ex, y: start.y };
      }
    } else {
      if (start.x < ce.left - EPS || start.x > ce.right + EPS) continue;
      for (const ey of [ce.top, ce.bottom]) {
        if (Math.abs(ey - end.y) < PROX) return { x: start.x, y: ey };
      }
    }
  }

  return end;
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
  const label = pxToM(lengthPx).toFixed(1) + 'm';
  const fz = Math.max(9 / zoom, 5);

  ctx.font = `600 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
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
