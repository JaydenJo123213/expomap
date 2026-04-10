// ─── 실측 레이어 ───────────────────────────────────────────────
const MEASURE_COLOR = '#1E88E5';
const MEASURE_FILL  = 'rgba(30,136,229,0.15)';

function _drawDimLine(ctx, x1, y1, x2, y2, zoom) {
  const TICK = 4 / zoom;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len < 0.5) return;
  const px = -dy / len, py = dx / len;
  ctx.strokeStyle = MEASURE_COLOR;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1 + px*TICK, y1 + py*TICK); ctx.lineTo(x1 - px*TICK, y1 - py*TICK); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2 + px*TICK, y2 + py*TICK); ctx.lineTo(x2 - px*TICK, y2 - py*TICK); ctx.stroke();
}

// 수평 치수선 (라벨 가로)
function drawDimension(ctx, x1, y1, x2, y2, label, zoom) {
  _drawDimLine(ctx, x1, y1, x2, y2, zoom);
  const mx = (x1+x2)/2, my = (y1+y2)/2;
  const fz = Math.max(9/zoom, 5);
  ctx.font = `600 ${fz}px Pretendard, sans-serif`;
  const tw = ctx.measureText(label).width;
  const ph = 2/zoom, pw = 3/zoom;
  ctx.fillStyle = MEASURE_FILL;
  ctx.fillRect(mx - tw/2 - pw, my - fz/2 - ph, tw + pw*2, fz + ph*2);
  ctx.fillStyle = MEASURE_COLOR;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, mx, my);
}

// 수직 치수선 (라벨 90° 회전)
function drawDimensionVertical(ctx, x1, y1, x2, y2, label, zoom) {
  _drawDimLine(ctx, x1, y1, x2, y2, zoom);
  const mx = (x1+x2)/2, my = (y1+y2)/2;
  const fz = Math.max(9/zoom, 5);
  ctx.font = `600 ${fz}px Pretendard, sans-serif`;
  const tw = ctx.measureText(label).width;
  const ph = 2/zoom, pw = 3/zoom;
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(-Math.PI/2);
  ctx.fillStyle = MEASURE_FILL;
  ctx.fillRect(-tw/2 - pw, -fz/2 - ph, tw + pw*2, fz + ph*2);
  ctx.fillStyle = MEASURE_COLOR;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

// 서브1: 각 부스의 가로/세로 치수선 — 접촉 면 수 기준
// 4방향 중 딱 붙은 면이 3개 이상 → 내부 블럭 → 치수 표시 안 함
// 0~2면 접촉 → 외곽 부스 → 노출된 방향에 치수 표시
function drawMeasureBooths(ctx, zoom) {
  const OFFSET = 8;
  const EPS = 0.5;

  function touches(r, dir) {
    // 해당 방향으로 딱 붙어있는(gap ≈ 0) 부스 있으면 true
    return state.booths.some(o => {
      if (o.id === r._id) return false;
      const or = getBoothOuterRect(o);
      if (dir === 'N') return Math.abs((or.y + or.h) - r.y) < EPS && or.x < r.x + r.w && or.x + or.w > r.x;
      if (dir === 'S') return Math.abs(or.y - (r.y + r.h)) < EPS && or.x < r.x + r.w && or.x + or.w > r.x;
      if (dir === 'W') return Math.abs((or.x + or.w) - r.x) < EPS && or.y < r.y + r.h && or.y + or.h > r.y;
      if (dir === 'E') return Math.abs(or.x - (r.x + r.w)) < EPS && or.y < r.y + r.h && or.y + or.h > r.y;
    });
  }

  for (const b of state.booths) {
    const r = getBoothOuterRect(b);
    r._id = b.id; // touches()에서 자기 자신 제외용

    const touchN = touches(r, 'N');
    const touchS = touches(r, 'S');
    const touchW = touches(r, 'W');
    const touchE = touches(r, 'E');
    const touchCount = [touchN, touchS, touchW, touchE].filter(Boolean).length;

    // 3면 이상 접촉 → 내부 블럭, 치수 표시 안 함
    if (touchCount >= 3) continue;

    // 가로(너비): 위쪽(N)이 열려있으면 상단에 표시
    if (!touchN) {
      drawDimension(ctx, r.x, r.y - OFFSET, r.x + r.w, r.y - OFFSET, pxToM(r.w).toFixed(1) + 'm', zoom);
    }

    // 세로(높이): 좌측(W)이 열려있으면 좌측에 표시
    if (!touchW) {
      drawDimensionVertical(ctx, r.x - OFFSET, r.y, r.x - OFFSET, r.y + r.h, pxToM(r.h).toFixed(1) + 'm', zoom);
    }
  }
}

// 서브2: 부스 간 통로 폭
// 각 nearest-neighbor 쌍의 겹침 구간 끝-끝에만 표시 (관계없는 부스로 확장 안 함)
function drawMeasurePassageways(ctx, zoom) {
  const MAX_GAP = 100;
  const booths = state.booths;
  if (booths.length < 2) return;
  const drawn = new Set();

  for (let i = 0; i < booths.length; i++) {
    const a = getBoothOuterRect(booths[i]);
    const ax1 = a.x, ax2 = a.x + a.w, ay1 = a.y, ay2 = a.y + a.h;
    let nearSgap = Infinity, nearSb = null, nearSj = -1;
    let nearEgap = Infinity, nearEb = null, nearEj = -1;

    for (let j = 0; j < booths.length; j++) {
      if (i === j) continue;
      const b = getBoothOuterRect(booths[j]);
      const bx1 = b.x, bx2 = b.x + b.w, by1 = b.y, by2 = b.y + b.h;

      // 수평 겹침 → b가 a 아래
      if (Math.min(ax2, bx2) > Math.max(ax1, bx1)) {
        const gap = by1 - ay2;
        if (gap > 0 && gap <= MAX_GAP && gap < nearSgap) {
          nearSgap = gap; nearSb = b; nearSj = j;
        }
      }
      // 수직 겹침 → b가 a 오른쪽
      if (Math.min(ay2, by2) > Math.max(ay1, by1)) {
        const gap = bx1 - ax2;
        if (gap > 0 && gap <= MAX_GAP && gap < nearEgap) {
          nearEgap = gap; nearEb = b; nearEj = j;
        }
      }
    }

    // 수평 통로 (상하 gap): 겹침 X 범위 좌끝/우끝에 수직 치수선
    // 겹침 구간 >= 60px(6m)이면 양끝, 아니면 중앙 하나만
    if (nearSb) {
      const id1 = Math.min(booths[i].id, booths[nearSj].id);
      const id2 = Math.max(booths[i].id, booths[nearSj].id);
      const key = `${id1}:${id2}:V`;
      if (!drawn.has(key)) {
        drawn.add(key);
        const oxs = Math.max(ax1, nearSb.x);
        const oxe = Math.min(ax2, nearSb.x + nearSb.w);
        const label = pxToM(nearSgap).toFixed(1) + 'm';
        if (oxe - oxs >= 60) {
          // 겹침 구간 충분 → 양끝 표시
          drawDimensionVertical(ctx, oxs, ay2, oxs, ay2 + nearSgap, label, zoom);
          drawDimensionVertical(ctx, oxe, ay2, oxe, ay2 + nearSgap, label, zoom);
        } else {
          // 겹침 구간 좁음 → 중앙 하나만
          const midX = (oxs + oxe) / 2;
          drawDimensionVertical(ctx, midX, ay2, midX, ay2 + nearSgap, label, zoom);
        }
      }
    }

    // 수직 통로 (좌우 gap): 겹침 Y 범위 위끝/아래끝에 수평 치수선
    // 겹침 구간 >= 60px(6m)이면 양끝, 아니면 중앙 하나만
    if (nearEb) {
      const id1 = Math.min(booths[i].id, booths[nearEj].id);
      const id2 = Math.max(booths[i].id, booths[nearEj].id);
      const key = `${id1}:${id2}:H`;
      if (!drawn.has(key)) {
        drawn.add(key);
        const oys = Math.max(ay1, nearEb.y);
        const oye = Math.min(ay2, nearEb.y + nearEb.h);
        const label = pxToM(nearEgap).toFixed(1) + 'm';
        if (oye - oys >= 60) {
          // 겹침 구간 충분 → 양끝 표시
          drawDimension(ctx, ax2, oys, ax2 + nearEgap, oys, label, zoom);
          drawDimension(ctx, ax2, oye, ax2 + nearEgap, oye, label, zoom);
        } else {
          // 겹침 구간 좁음 → 중앙 하나만
          const midY = (oys + oye) / 2;
          drawDimension(ctx, ax2, midY, ax2 + nearEgap, midY, label, zoom);
        }
      }
    }
  }
}

// 서브3: 기둥 ↔ 부스 끝선 거리
function drawMeasureColumns(ctx, zoom) {
  const MAX_DIST = 150; // 15m 이내
  const columns = state.structures.filter(s => s.type === 'column' || s.type === 'circle');
  if (!columns.length) return;

  for (const col of columns) {
    const cx = col.x, cy = col.y, r = col.radius || 5;

    // 기둥이 속한 부스 찾기 (중심 기준)
    const enclosing = state.booths.find(b => {
      const rect = getBoothOuterRect(b);
      return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
    });

    // N/S/E/W 각 방향: [기둥 edge 좌표, 목표 좌표]
    const dirs = [
      { label: 'N', ex: cx, ey: cy - r, tx: cx, ty: null },
      { label: 'S', ex: cx, ey: cy + r, tx: cx, ty: null },
      { label: 'W', ex: cx - r, ey: cy, tx: null, ty: cy },
      { label: 'E', ex: cx + r, ey: cy, tx: null, ty: cy },
    ];

    for (const d of dirs) {
      if (enclosing) {
        const rect = getBoothOuterRect(enclosing);
        if (d.label === 'N') d.ty = rect.y;
        if (d.label === 'S') d.ty = rect.y + rect.h;
        if (d.label === 'W') d.tx = rect.x;
        if (d.label === 'E') d.tx = rect.x + rect.w;
      } else {
        // 해당 방향에서 가장 가까운 부스 edge 탐색
        let nearDist = MAX_DIST;
        for (const b of state.booths) {
          const rect = getBoothOuterRect(b);
          if (d.label === 'N' && rect.x <= cx && cx <= rect.x + rect.w) {
            const dist = (cy - r) - (rect.y + rect.h);
            if (dist >= 0 && dist < nearDist) { nearDist = dist; d.ty = rect.y + rect.h; }
          }
          if (d.label === 'S' && rect.x <= cx && cx <= rect.x + rect.w) {
            const dist = rect.y - (cy + r);
            if (dist >= 0 && dist < nearDist) { nearDist = dist; d.ty = rect.y; }
          }
          if (d.label === 'W' && rect.y <= cy && cy <= rect.y + rect.h) {
            const dist = (cx - r) - (rect.x + rect.w);
            if (dist >= 0 && dist < nearDist) { nearDist = dist; d.tx = rect.x + rect.w; }
          }
          if (d.label === 'E' && rect.y <= cy && cy <= rect.y + rect.h) {
            const dist = rect.x - (cx + r);
            if (dist >= 0 && dist < nearDist) { nearDist = dist; d.tx = rect.x; }
          }
        }
      }

      // 목표점이 없거나 거리가 무의미하면 스킵
      const tx = d.tx ?? d.ex, ty = d.ty ?? d.ey;
      const dist = Math.sqrt((tx-d.ex)**2 + (ty-d.ey)**2);
      if (dist < 0.5 || dist > MAX_DIST) continue;

      // 부스 안 기둥: 각 축(N/S, E/W)에서 더 짧은 방향(더 가까운 벽)만 표시
      if (enclosing) {
        const rect = getBoothOuterRect(enclosing);
        const distN = (cy - r) - rect.y;
        const distS = (rect.y + rect.h) - (cy + r);
        const distW = (cx - r) - rect.x;
        const distE = (rect.x + rect.w) - (cx + r);
        if (d.label === 'N' && distN > distS) continue;
        if (d.label === 'S' && distS > distN) continue;
        if (d.label === 'W' && distW > distE) continue;
        if (d.label === 'E' && distE > distW) continue;
      }

      const label = pxToM(dist).toFixed(1) + 'm';
      if (d.label === 'N' || d.label === 'S') {
        drawDimension(ctx, d.ex - 4/zoom, d.ey, tx - 4/zoom, ty, label, zoom);
      } else {
        drawDimensionVertical(ctx, d.ex, d.ey - 4/zoom, tx, ty - 4/zoom, label, zoom);
      }
    }
  }
}

function drawMeasureLayer(ctx, zoom) {
  if (!state.showMeasure) return;
  ctx.globalAlpha = 1;
  ctx.save();
  drawMeasureBooths(ctx, zoom);
  drawMeasurePassageways(ctx, zoom);
  drawMeasureColumns(ctx, zoom);
  ctx.restore();
}
// ────────────────────────────────────────────────────────────────
