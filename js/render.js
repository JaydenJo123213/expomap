// ─── Booth Content Drawing (shared) ───
function calcFontSize(c, text, maxW) {
  const refSize = 100;
  c.font = `600 ${refSize}px 'Spoqa Han Sans Neo', sans-serif`;
  const refWidth = c.measureText(text).width;
  if (refWidth === 0) return maxW * 0.3;
  return (maxW / refWidth) * refSize;
}

// 부스번호 폰트 크기: 수동 오버라이드 or 자동 계산
function getBoothNoFontSize(c, b) {
  if (b.boothNoFontSize != null) return b.boothNoFontSize;
  return calcFontSize(c, b.boothId, 26);
}

// 텍스트를 maxChars 글자씩 줄바꿈
function wrapText(text) {
  // </br> 로만 줄바꿈, 자동 줄바꿈 없음
  return text.split('</br>').map(s => s.trim());
}

// ─── 비정형 부스(ㄴ/ㄱ자) 렌더 헬퍼 ───
function fillBoothShape(ctx, b) {
  if (b.cells && b.cells.length > 1) {
    // 단일 path에 모든 셀 rect 추가 → 한번에 fill (alpha 겹침 없음)
    ctx.beginPath();
    b.cells.forEach(c => ctx.rect(c.x, c.y, c.w, c.h));
    ctx.fill();
  } else {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
}
function strokeBoothShape(ctx, b, zoom) {
  if (b.cells && b.cells.length > 1) {
    // 외곽선만 그리기: 각 변에서 다른 셀과 접하는 구간(부분 포함)을 빼고 나머지만 stroke
    const cells = b.cells;
    const EPS = 0.5;
    ctx.beginPath();
    for (const c of cells) {
      const r = c.x + c.w, bot = c.y + c.h;

      // 수평 변 (top, bottom)
      for (const [edgeY, adjFn] of [
        [c.y,  o => o.y + o.h],   // top: 접하는 셀의 하변 = c.y
        [bot,  o => o.y],         // bottom: 접하는 셀의 상변 = c.y+c.h
      ]) {
        const covered = [];
        for (const o of cells) {
          if (o === c) continue;
          if (Math.abs(edgeY - adjFn(o)) < EPS) {
            const ox1 = Math.max(c.x, o.x), ox2 = Math.min(r, o.x + o.w);
            if (ox2 > ox1 + EPS) covered.push([ox1, ox2]);
          }
        }
        for (const [sx1, sx2] of _subtractIntervals(c.x, r, covered)) {
          ctx.moveTo(sx1, edgeY); ctx.lineTo(sx2, edgeY);
        }
      }

      // 수직 변 (left, right)
      for (const [edgeX, adjFn] of [
        [c.x,  o => o.x + o.w],  // left: 접하는 셀의 우변 = c.x
        [r,    o => o.x],         // right: 접하는 셀의 좌변 = c.x+c.w
      ]) {
        const covered = [];
        for (const o of cells) {
          if (o === c) continue;
          if (Math.abs(edgeX - adjFn(o)) < EPS) {
            const oy1 = Math.max(c.y, o.y), oy2 = Math.min(bot, o.y + o.h);
            if (oy2 > oy1 + EPS) covered.push([oy1, oy2]);
          }
        }
        for (const [sy1, sy2] of _subtractIntervals(c.y, bot, covered)) {
          ctx.moveTo(edgeX, sy1); ctx.lineTo(edgeX, sy2);
        }
      }
    }
    ctx.stroke();
  } else {
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}
// [start, end] 구간에서 covered 구간들을 뺀 나머지 구간 배열 반환
function _subtractIntervals(start, end, covered) {
  if (!covered.length) return [[start, end]];
  covered.sort((a, b) => a[0] - b[0]);
  const result = [];
  let cur = start;
  for (const [a, b] of covered) {
    if (a > cur + 0.5) result.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < end - 0.5) result.push([cur, end]);
  return result;
}
// 텍스트 배치용 rect 반환
// textPlacement: 'auto'(면적최대 cell) | 'wide'(가로 암 전체) | 'tall'(세로 암 전체)
function getTextRect(b) {
  if (!b.cells || b.cells.length <= 1) return { x: b.x, y: b.y, w: b.w, h: b.h };
  const placement = b.textPlacement || 'auto';
  // L자 부스에 저장된 arm rect 활용 (dx/dy는 b.x/b.y 기준 상대 좌표)
  if (b.textRects) {
    const toAbs = r => ({ x: b.x + r.dx, y: b.y + r.dy, w: r.w, h: r.h });
    if (placement === 'wide' && b.textRects.wide) return toAbs(b.textRects.wide);
    if (placement === 'tall' && b.textRects.tall) return toAbs(b.textRects.tall);
    // auto: 면적 더 큰 암 선택
    if (b.textRects.wide && b.textRects.tall) {
      const wa = b.textRects.wide.w * b.textRects.wide.h;
      const ta = b.textRects.tall.w * b.textRects.tall.h;
      return toAbs(wa >= ta ? b.textRects.wide : b.textRects.tall);
    }
  }
  // fallback: cells 중 면적 최대 cell
  let best = b.cells[0], bestArea = 0;
  for (const c of b.cells) {
    const a = c.w * c.h;
    if (a > bestArea) { bestArea = a; best = c; }
  }
  return best;
}

function getBoothOuterRect(b) {
  if (!b.cells || b.cells.length === 0) return { x: b.x, y: b.y, w: b.w, h: b.h };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const c of b.cells) {
    x1 = Math.min(x1, c.x); y1 = Math.min(y1, c.y);
    x2 = Math.max(x2, c.x + c.w); y2 = Math.max(y2, c.y + c.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function drawBoothContent(c, b, zoom, textColor, isConstruction, skipElec = false, skipOther = false, boothNoColor = null) {
  const pad = 2;
  // 비정형 부스(ㄴ/ㄱ자)면 가장 큰 셀 기준으로 텍스트 배치
  const tr = getTextRect(b);
  const availW = tr.w - pad * 2;
  const availH = tr.h - pad * 2;
  const wm = pxToM(b.w), hm = pxToM(b.h);
  const area = getBoothAreaM2(b);  // 비정형 부스는 cells 실면적 사용
  // 언어에 따라 표시할 업체명 결정 (EN 모드에서 영문명 없으면 빈값)
  const isEnMode = state.lang === 'en';
  const displayName = isEnMode ? (b.companyNameEn || '') : b.companyName;
  const hasCompany = !!displayName;
  // 업체 배정 여부 (언어 무관 — 로고 표시 조건으로 사용)
  const hasAnyCompany = !!(b.companyName || b.companyNameEn);
  // 언어별 폰트 크기 오버라이드
  const fontSizeOverride = isEnMode ? (b.fontSizeEn ?? null) : (b.fontSize ?? null);
  const hasBoothNo = !!b.boothId;
  const isIrregularBooth = !!(b.cells && b.cells.length > 1);
  const showSize = wm >= 6 && hm >= 6 && !isIrregularBooth;

  c.fillStyle = textColor;

  // 로고 렌더링 (4부스 이상 & 로고 URL 있을 때 — EN 모드에서 영문명 없어도 로고는 표시)
  const shouldDrawLogo = area >= 36 && hasAnyCompany && b.companyLogoUrl;
  if (shouldDrawLogo && !isConstruction) {
    const logoImg = getLogoImage(b, state.logoCache);
    if (logoImg) {
      const scale = (b.logoScale ?? 100) / 100;
      const noReserve = hasBoothNo ? getBoothNoFontSize(c, b) + 4 : 0;
      const pos = b.logoPosition ?? 'top';
      const offsetX = (b.logoOffsetX ?? 0) * tr.w / 100;
      const offsetY = (b.logoOffsetY ?? 0) * tr.h / 100;

      // 로고 크기: 부스 짧은 변 × scale (aspect-ratio 유지)
      const baseSide = Math.min(tr.w, tr.h - noReserve);
      const imgAspect = logoImg.width / logoImg.height;
      let drawW, drawH;
      if (imgAspect >= 1) { drawW = baseSide * scale; drawH = drawW / imgAspect; }
      else                 { drawH = baseSide * scale; drawW = drawH * imgAspect; }

      // 로고 중심: pos별 기본 오프셋 + 사용자 오프셋
      const defOX = pos === 'left' ? -tr.w * 0.18 : pos === 'right' ? tr.w * 0.18 : 0;
      const defOY = pos === 'top'  ? -tr.h * 0.15 : pos === 'bottom' ? tr.h * 0.15 : 0;
      const logoCX = tr.x + tr.w / 2 + defOX + offsetX;
      const logoCY = tr.y + noReserve + (tr.h - noReserve) / 2 + defOY + offsetY;

      c.save();
      c.globalAlpha = 0.9;
      c.drawImage(logoImg, logoCX - drawW / 2, logoCY - drawH / 2, drawW, drawH);
      c.globalAlpha = 1;
      c.restore();

      // 텍스트: 로고 엣지 기준으로 배치 (gap = 로고와 텍스트 사이 거리, % 단위)
      const gapH = (b.logoGap ?? 5) * tr.h / 100;
      const gapW = (b.logoGap ?? 5) * tr.w / 100;
      let textRect;
      if (pos === 'top') {
        // 로고 하단 + gap → 텍스트
        const textY = logoCY + drawH / 2 + gapH;
        textRect = { x: tr.x, y: textY, w: tr.w, h: tr.y + tr.h - textY - tr.h * 0.02 };
      } else if (pos === 'bottom') {
        // 텍스트 → gap + 로고 상단
        const textBottom = logoCY - drawH / 2 - gapH;
        const textTop = tr.y + noReserve + tr.h * 0.02;
        textRect = { x: tr.x, y: textTop, w: tr.w, h: Math.max(0, textBottom - textTop) };
      } else if (pos === 'left') {
        // 로고 우측 + gap → 텍스트
        const textX = logoCX + drawW / 2 + gapW;
        textRect = { x: textX, y: tr.y + noReserve, w: tr.x + tr.w - textX - tr.w * 0.02, h: tr.h - noReserve };
      } else { // right
        // 텍스트 → gap + 로고 좌측
        const textRight = logoCX - drawW / 2 - gapW;
        const textLeft = tr.x + tr.w * 0.02;
        textRect = { x: textLeft, y: tr.y + noReserve, w: Math.max(0, textRight - textLeft), h: tr.h - noReserve };
      }

      const lines = wrapText(displayName);
      const longestLine = lines.reduce((a, ln) => a.length >= ln.length ? a : ln, '');
      if (textRect.w >= 20) {
        let fz = (fontSizeOverride != null)
          ? Math.max(1.5, Math.min(fontSizeOverride, 60))
          : (() => { let v = calcFontSize(c, longestLine || 'A', textRect.w * 0.9); if (textRect.h > 0) v = Math.min(v, (textRect.h / lines.length) / 1.25); return Math.max(1.5, Math.min(v, 12)); })();

        const lineH = fz * 1.25;
        const blockH = lines.length * lineH;
        const startY = textRect.y + (textRect.h - blockH) / 2 + fz * 0.5;

        c.fillStyle = textColor;
        c.font = `400 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        lines.forEach((line, i) => c.fillText(line, textRect.x + textRect.w / 2, startY + i * lineH));
      }

      // 부스번호: 좌상단
      if (hasBoothNo) {
        const noFz = getBoothNoFontSize(c, b);
        c.fillStyle = boothNoColor ?? textColor;
        c.font = `600 ${noFz}px 'Spoqa Han Sans Neo', sans-serif`;
        c.textAlign = 'left'; c.textBaseline = 'top';
        c.globalAlpha = 0.65;
        c.fillText(b.boothId, tr.x + pad, tr.y + pad);
        c.globalAlpha = 1;
      }
      // 전기 레이어 빨간 표시 + 뱃지 (로고 부스에서도 동작, 업체 배정된 부스만)
      if (!VIEWER_MODE && state.showElec && hasCompany && b.status !== 'facility' && b.status !== 'excluded') {
        const comp2 = state.companies.find(co => co.company_uid === b.companyUid);
        const hasElec2 = comp2 && ELEC_KEYS.some(k => (comp2[k] || 0) > 0);
        if (!hasElec2) {
          c.save();
          c.fillStyle = 'rgba(244, 67, 54, 0.15)';
          fillBoothShape(c, b);
          c.strokeStyle = '#F44336';
          c.lineWidth = 2 / zoom;
          c.setLineDash([4 / zoom, 3 / zoom]);
          strokeBoothShape(c, b, zoom);
          c.setLineDash([]);
          c.restore();
        }
      }
      // 사이즈 텍스트: 우하단 — showSize에 L자 제외 조건 이미 포함
      if (showSize) {
        const szFz = Math.max(1.5, Math.min(availH * 0.12, 10));
        c.fillStyle = textColor;
        c.font = `400 ${szFz}px 'Spoqa Han Sans Neo', sans-serif`;
        c.textAlign = 'right'; c.textBaseline = 'bottom';
        c.globalAlpha = 0.45;
        c.fillText(`${wm}×${hm}m`, tr.x + tr.w - pad, tr.y + tr.h - pad);
        c.globalAlpha = 1;
      }
      if (!skipElec) drawElecBadges(c, b, zoom);
      if (!skipOther) drawOtherBadges(c, b, zoom);
      drawBoothWarnings(c, b, zoom);
      return;
    }
  }

  if (isConstruction) {
    if (hasBoothNo) {
      let fz = Math.min(calcFontSize(c, b.boothId, availW * 0.9), availH * 0.35);
      fz = Math.max(2, Math.min(fz, 14));
      c.font = `400 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(b.boothId, tr.x + tr.w / 2, tr.y + tr.h * 0.4);
    }
    const dimText = `${wm}×${hm}m`;
    let dimFz = Math.min(calcFontSize(c, dimText, availW * 0.85), availH * 0.25);
    dimFz = Math.max(1.5, Math.min(dimFz, 10));
    c.font = `400 ${dimFz}px 'Spoqa Han Sans Neo', sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.globalAlpha = 0.6;
    c.fillText(dimText, tr.x + tr.w / 2, tr.y + tr.h * 0.65);
    c.globalAlpha = 1;
    return;
  }

  if (hasCompany) {
    const lines = wrapText(displayName);
    const longestLine = lines.reduce((a, b) => a.length >= b.length ? a : b, '');

    // 부스번호/사이즈 — 3m 부스 기준 고정 크기
    const noFz  = hasBoothNo ? getBoothNoFontSize(c, b) : 0;
    const szFz  = showSize   ? Math.min(availH * 0.12, 10) : 0;
    const topReserve    = hasBoothNo ? noFz + 2 : 0;
    const bottomReserve = showSize   ? szFz + 2 : 0;
    const textAreaH = availH - topReserve - bottomReserve;

    // 업체명 폰트: 가로 기준으로 구하고 세로로도 제한 (수동 설정 시 우선)
    let fz = (fontSizeOverride != null)
      ? Math.max(1.5, Math.min(fontSizeOverride, 60))
      : (() => { let v = calcFontSize(c, longestLine || 'A', availW * 0.9); if (textAreaH > 0) v = Math.min(v, (textAreaH / lines.length) / 1.25); return Math.max(1.5, Math.min(v, 16)); })();

    const lineH = fz * 1.25;
    const blockH = lines.length * lineH;
    const startY = tr.y + topReserve + pad + (textAreaH - blockH) / 2 + fz * 0.5;

    c.fillStyle = textColor;
    c.font = `400 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((line, i) => c.fillText(line, tr.x + tr.w / 2, startY + i * lineH));

    // Booth No.: 좌상단 (고정 작은 폰트)
    if (hasBoothNo) {
      c.fillStyle = boothNoColor ?? textColor;
      c.font = `600 ${noFz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.textAlign = 'left'; c.textBaseline = 'top';
      c.globalAlpha = 0.65;
      c.fillText(b.boothId, tr.x + pad, tr.y + pad);
      c.globalAlpha = 1;
    }

    // 사이즈: 우하단 (고정 작은 폰트)
    if (showSize) {
      c.font = `400 ${szFz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.globalAlpha = 0.45;
      c.fillText(`${wm}×${hm}m`, tr.x + tr.w - pad, tr.y + tr.h - pad);
      c.globalAlpha = 1;
    }
  } else if (hasBoothNo) {
    // Booth No.만 → 좌상단 (기본부스번호와 공존)
    const noFz = getBoothNoFontSize(c, b);
    c.fillStyle = boothNoColor ?? textColor;
    c.font = `600 ${noFz}px 'Spoqa Han Sans Neo', sans-serif`;
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.globalAlpha = 0.65;
    c.fillText(b.boothId, tr.x + pad, tr.y + pad);
    c.globalAlpha = 1;

    if (showSize) {
      const szText = `${wm}×${hm}m`;
      let szFz = Math.max(1.5, noFz * 0.4);
      szFz = Math.min(szFz, 8);
      c.font = `400 ${szFz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.globalAlpha = 0.45;
      c.fillText(szText, tr.x + tr.w - pad, tr.y + tr.h - pad);
      c.globalAlpha = 1;
    }
  }

  // 전기 레이어 ON일 때 전기 데이터 없는 부스 빨간 표시 (업체 배정된 부스만)
  if (!VIEWER_MODE && state.showElec && hasCompany && b.status !== 'facility' && b.status !== 'excluded') {
    const comp = state.companies.find(co => co.company_uid === b.companyUid);
    const hasElec = comp && ELEC_KEYS.some(k => (comp[k] || 0) > 0);
    if (!hasElec) {
      c.save();
      c.fillStyle = 'rgba(244, 67, 54, 0.15)';
      fillBoothShape(c, b);
      c.strokeStyle = '#F44336';
      c.lineWidth = 2 / zoom;
      c.setLineDash([4 / zoom, 3 / zoom]);
      strokeBoothShape(c, b, zoom);
      c.setLineDash([]);
      c.restore();
    }
  }

  // 전기내역 원 뱃지
  if (!skipElec) drawElecBadges(c, b, zoom);
  // 기타 원 뱃지
  if (!skipOther) drawOtherBadges(c, b, zoom);

  // 메모 인디케이터 — 좌하단 ✎ (관리자 모드에서만, 메모 있을 때)
  if (!VIEWER_MODE && b.memo && !state._exporting) {
    const memoFz = Math.max(3, Math.min(b.w, b.h) * 0.18);
    c.font = `${memoFz}px sans-serif`;
    c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.globalAlpha = 0.65;
    c.fillStyle = textColor;
    c.fillText('✎', b.x + 2, b.y + b.h - 2);
    c.globalAlpha = 1;
  }

  // Lock indicator for booths
  if (b.locked) {
    const lockFz = Math.max(3, Math.min(b.w, b.h) * 0.25);
    c.font = `${lockFz}px sans-serif`;
    c.textAlign = 'right'; c.textBaseline = 'top';
    c.fillText('🔒', b.x + b.w - 1, b.y + 1);
  }

  drawBoothWarnings(c, b, zoom);
}

// ─── 부스 경고 표시 (UID 미입력, 영문명 미입력) ───
function drawBoothWarnings(c, b, zoom) {
  if (VIEWER_MODE || state._exporting) return;
  const tr = getTextRect(b);
  // 배정완료인데 UID 없는 경우 — 빨간 테두리 + 우하단 ⚠ 경고
  if (b.status === 'assigned' && !b.companyUid) {
    c.strokeStyle = '#F44336';
    c.lineWidth = 2 / zoom;
    c.setLineDash([4 / zoom, 3 / zoom]);
    strokeBoothShape(c, b, zoom);
    c.setLineDash([]);
    const warnFz = Math.max(4, Math.min(tr.w, tr.h) * 0.28);
    c.font = `${warnFz}px sans-serif`;
    c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.fillText('⚠️', tr.x + tr.w - 1, tr.y + tr.h - 1);
  }
  // 배정완료인데 영문 업체명 없는 경우 — 주황 테두리 + 좌하단 EN 경고
  if (b.status === 'assigned' && b.companyName && !b.companyNameEn) {
    c.strokeStyle = '#FF9800';
    c.lineWidth = 1.5 / zoom;
    c.setLineDash([3 / zoom, 2 / zoom]);
    strokeBoothShape(c, b, zoom);
    c.setLineDash([]);
    const enFz = Math.max(3, Math.min(tr.w, tr.h) * 0.18);
    c.font = `600 ${enFz}px sans-serif`;
    c.fillStyle = '#FF9800';
    c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillText('EN', tr.x + 1, tr.y + tr.h - 1);
  }
}

// ─── 전기내역 원 뱃지 렌더 ───
function drawElecBadges(c, b, zoom) {
  if (VIEWER_MODE) return;
  if (!state.showElec) return;
  const comp = state.companies.find(co => co.company_uid === b.companyUid);
  if (!comp) return;
  const active = ELEC_TYPES.filter(t => (comp[t.key] || 0) > 0);
  if (!active.length) return;

  // 원 중심을 부스 테두리(변) 위에 걸쳐서 배치 — 업체명 침범 없음
  const r = GRID_PX * 0.27;  // 10% 축소
  const gap = r * 1.9;         // 5% 겹침 (diameter * 0.95)

  // elecSide 명시 없으면 자동: 좁으면 우측, 넓으면 하단
  const side = b.elecSide || (b.w <= GRID_PX * 2 ? 'right' : 'bottom');

  active.forEach((t, i) => {
    let cx, cy;
    if (side === 'right') {
      cx = b.x + b.w;
      cy = b.y + r + 2 + i * gap;
    } else if (side === 'left') {
      cx = b.x;
      cy = b.y + r + 2 + i * gap;
    } else if (side === 'top') {
      cx = b.x + r + 2 + i * gap;
      cy = b.y;
    } else { // bottom
      cx = b.x + r + 2 + i * gap;
      cy = b.y + b.h;
    }

    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fillStyle = t.color;
    c.fill();
    c.strokeStyle = t.border;
    c.lineWidth = 1 / zoom;
    c.stroke();

    const val = comp[t.key];
    const numStr = val > 99 ? '+' : String(val);
    const fz = r * 1.1; // world 기준 폰트 — zoom과 함께 커짐
    c.fillStyle = t.textColor;
    c.font = `700 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(numStr, cx, cy);
  });
}

function drawOtherBadges(c, b, zoom) {
  if (VIEWER_MODE) return;
  if (!state.showOther) return;
  const comp = state.companies.find(co => co.company_uid === b.companyUid);
  if (!comp) return;

  // 각 타입 값만큼 배지를 반복 생성
  const badges = [];
  OTHER_TYPES.forEach(t => {
    const count = Math.floor(comp[t.key] || 0);
    for (let i = 0; i < count; i++) badges.push(t);
  });
  if (!badges.length) return;

  const r = GRID_PX * 0.24;
  const gap = r * 1.9;
  const pad = r + 2;

  // otherSide: 자동이면 부스 가로/세로 크기로 결정
  const side = b.otherSide || (b.w <= GRID_PX * 2 ? 'right' : 'bottom');

  if (side === 'left' || side === 'right') {
    // 세로 방향 배치 (외부 테두리)
    badges.forEach((t, i) => {
      const cx = side === 'right' ? b.x + b.w : b.x;
      const cy = b.y + pad + i * gap;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fillStyle = t.color;
      c.fill();
      c.strokeStyle = t.border;
      c.lineWidth = 0.8 / zoom;
      c.stroke();
      const fz = r * 0.85;
      c.fillStyle = t.textColor;
      c.font = `700 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(t.label, cx, cy);
    });
  } else if (side === 'top') {
    // 가로 방향 배치 (상단 테두리)
    badges.forEach((t, i) => {
      const cx = b.x + pad + i * gap;
      const cy = b.y;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fillStyle = t.color;
      c.fill();
      c.strokeStyle = t.border;
      c.lineWidth = 0.8 / zoom;
      c.stroke();
      const fz = r * 0.85;
      c.fillStyle = t.textColor;
      c.font = `700 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(t.label, cx, cy);
    });
  } else {
    // bottom (default) — 부스 내부 하단에서 위로 격자 배치
    const maxPerRow = Math.max(1, Math.floor((b.w - pad * 2) / gap));
    badges.forEach((t, i) => {
      const col = i % maxPerRow;
      const row = Math.floor(i / maxPerRow);
      const cx = b.x + pad + col * gap;
      const cy = b.y + b.h - pad - row * gap;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fillStyle = t.color;
      c.fill();
      c.strokeStyle = t.border;
      c.lineWidth = 0.8 / zoom;
      c.stroke();
      const fz = r * 0.85;
      c.fillStyle = t.textColor;
      c.font = `700 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(t.label, cx, cy);
    });
  }
}

// ─── Draw Structures (shared) ───
function drawStructures(c, zoom, isConstruction) {
  const isSel = (s) => s.id === state.selectedStructId;
  c.globalAlpha = 1;  // 부스 반투명 상태에 영향받지 않도록
  state.structures.forEach(s => {
    const sel = isSel(s);
    const col = isConstruction ? '#333' : (s.color || '#888');
    const fillCol = isConstruction ? '#999' : (s.fillColor || '#5C5C5C');

    if (s.type === 'column' || s.type === 'circle') {
      c.fillStyle = fillCol;
      c.strokeStyle = sel ? '#4F8CFF' : col;
      c.lineWidth = (sel ? 2 : 1) / zoom;
      if (s.type === 'column' && s.columnShape === 'square') {
        const hw = (s.w || s.radius * 2) / 2;
        const hh = (s.h || s.radius * 2) / 2;
        c.fillRect(s.x - hw, s.y - hh, hw * 2, hh * 2);
        c.strokeRect(s.x - hw, s.y - hh, hw * 2, hh * 2);
      } else {
        c.beginPath();
        c.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    } else if (s.type === 'wall' || s.type === 'line') {
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.strokeStyle = sel ? '#4F8CFF' : col;
      c.lineWidth = (s.thickness || 3) / zoom;
      c.stroke();
    } else if (s.type === 'arrow') {
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.strokeStyle = sel ? '#4F8CFF' : col;
      c.lineWidth = (s.thickness || 2) / zoom;
      c.stroke();
      // arrowhead
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const headLen = 10 / zoom;
      c.beginPath();
      c.moveTo(s.x2, s.y2);
      c.lineTo(s.x2 - headLen * Math.cos(angle - 0.4), s.y2 - headLen * Math.sin(angle - 0.4));
      c.moveTo(s.x2, s.y2);
      c.lineTo(s.x2 - headLen * Math.cos(angle + 0.4), s.y2 - headLen * Math.sin(angle + 0.4));
      c.stroke();
    } else if (s.type === 'door') {
      c.fillStyle = isConstruction ? '#CC7700' : (s.fillColor || '#CC7700');
      c.fillRect(s.x, s.y, s.w, s.h);
      c.strokeStyle = sel ? '#4F8CFF' : (isConstruction ? '#FF9800' : '#FF9800');
      c.lineWidth = (sel ? 2 : 1) / zoom;
      c.strokeRect(s.x, s.y, s.w, s.h);
      c.beginPath();
      c.arc(s.x, s.y + s.h, s.w, -Math.PI/2, 0);
      c.lineWidth = 0.8 / zoom;
      c.setLineDash([2/zoom, 2/zoom]);
      c.stroke();
      c.setLineDash([]);
    } else if (s.type === 'rect') {
      c.fillStyle = s.fillColor || 'rgba(100,100,100,0.3)';
      c.fillRect(s.x, s.y, s.w, s.h);
      c.strokeStyle = sel ? '#4F8CFF' : (s.color || '#888');
      c.lineWidth = (sel ? 2 : 1) / zoom;
      c.strokeRect(s.x, s.y, s.w, s.h);
      // 텍스트 가운데 렌더링
      if (s.text) {
        const fz = Math.min(s.fontSize || 14, s.h * 0.6, s.w * 0.18);
        c.font = `${s.fontWeight || 600} ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
        c.fillStyle = s.color || '#E8EAED';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // 줄바꿈 지원
        const lines = s.text.split('</br>').map(l => l.trim());
        const lineH = fz * 1.3;
        const startY = s.y + s.h / 2 - (lines.length - 1) * lineH / 2;
        lines.forEach((line, i) => c.fillText(line, s.x + s.w / 2, startY + i * lineH));
      }
    } else if (s.type === 'text') {
      const fz = s.fontSize || 12;
      c.font = `${s.fontWeight || 600} ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
      c.fillStyle = sel ? '#4F8CFF' : (s.color || '#E8EAED');
      c.textAlign = 'left'; c.textBaseline = 'bottom';
      c.fillText(s.text || '', s.x, s.y);
      // measure for hit detection
      s.w = c.measureText(s.text || '').width;
      if (sel) {
        c.strokeStyle = '#4F8CFF';
        c.lineWidth = 1 / zoom;
        c.setLineDash([3/zoom, 3/zoom]);
        c.strokeRect(s.x, s.y - fz, s.w, fz + 4);
        c.setLineDash([]);
      }
    }

    // Lock indicator
    if (s.locked) {
      const center = getStructCenter(s);
      c.font = `${10/zoom}px sans-serif`;
      c.fillStyle = '#FF9800';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('🔒', center.x, center.y - 8/zoom);
    }

    // Resize handles (선택된 객체에만)
    if (sel && !s.locked) {
      const hs = 5 / zoom;
      getStructHandles(s).forEach(h => {
        c.fillStyle = '#fff';
        c.fillRect(h.x - hs, h.y - hs, hs*2, hs*2);
        c.strokeStyle = '#4F8CFF';
        c.lineWidth = 1.5 / zoom;
        c.strokeRect(h.x - hs, h.y - hs, hs*2, hs*2);
      });
    }
  });
}

// ═══════════════════════════════════════
// ─── 인접 블럭 거리 인디케이터 함수 ───
function drawNeighborDistances(ctx, state) {
  // 대상 바운딩 박스 결정
  let bx1, by1, bx2, by2;
  let excludeIds = new Set();

  if (state.isDragging && state.selectedIds.size > 0) {
    // 기존 부스 드래그
    const sel = state.booths.filter(b => state.selectedIds.has(b.id));
    if (!sel.length) return;
    bx1 = Math.min(...sel.map(b => b.x));
    by1 = Math.min(...sel.map(b => b.y));
    bx2 = Math.max(...sel.map(b => b.x + b.w));
    by2 = Math.max(...sel.map(b => b.y + b.h));
    excludeIds = state.selectedIds;
  } else if (state.baseNoDragging && state.selectedBaseNoIds.size > 0) {
    // 기본부스 드래그
    const sel = state.baseNumbers.filter(bn => state.selectedBaseNoIds.has(bn.id));
    if (!sel.length) return;
    bx1 = Math.min(...sel.map(b => b.x));
    by1 = Math.min(...sel.map(b => b.y));
    bx2 = Math.max(...sel.map(b => b.x + b.w));
    by2 = Math.max(...sel.map(b => b.y + b.h));
    // 기본부스가 아닌 일반 부스들을 이웃으로 사용
  } else if (state.isDrawing || state.isBaseDrawing) {
    // 새 부스 그리기 미리보기
    const startX = state.isDrawing ? state.drawStartX : state.baseDrawStartX;
    const startY = state.isDrawing ? state.drawStartY : state.baseDrawStartY;
    const curX = state.isDrawing ? state.drawCurrentX : state.baseDrawCurrentX;
    const curY = state.isDrawing ? state.drawCurrentY : state.baseDrawCurrentY;
    const dx = curX - startX, dy = curY - startY;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    bx1 = Math.min(startX, curX);
    by1 = Math.min(startY, curY);
    bx2 = Math.max(startX, curX);
    by2 = Math.max(startY, curY);
  } else {
    return;
  }

  // 같은 종류끼리만 이웃으로 비교
  const others = state.baseNoDragging
    ? state.baseNumbers.filter(bn => !state.selectedBaseNoIds.has(bn.id))
    : state.booths.filter(b => !excludeIds.has(b.id));
  if (!others.length) return;

  const midX = (bx1 + bx2) / 2, midY = (by1 + by2) / 2;
  const z = state.zoom;

  let distTop = Infinity, distBot = Infinity, distLeft = Infinity, distRight = Infinity;

  for (const o of others) {
    const ox2 = o.x + o.w, oy2 = o.y + o.h;
    const hOverlap = bx1 < ox2 && bx2 > o.x;
    const vOverlap = by1 < oy2 && by2 > o.y;

    if (hOverlap) {
      const dTop = by1 - oy2;
      if (dTop >= 0 && dTop < distTop) distTop = dTop;
      const dBot = o.y - by2;
      if (dBot >= 0 && dBot < distBot) distBot = dBot;
    }
    if (vOverlap) {
      const dLeft = bx1 - ox2;
      if (dLeft >= 0 && dLeft < distLeft) distLeft = dLeft;
      const dRight = o.x - bx2;
      if (dRight >= 0 && dRight < distRight) distRight = dRight;
    }
  }

  const fz = 9 / z;
  const drawDistLine = (x1, y1, x2, y2, dist) => {
    const dm = pxToM(dist);
    ctx.strokeStyle = '#FF5252';
    ctx.lineWidth = 1 / z;
    ctx.setLineDash([3 / z, 2 / z]);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
    const label = dm.toFixed(1) + 'm';
    ctx.font = `600 ${fz}px 'Spoqa Han Sans Neo', sans-serif`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(255,82,82,0.9)';
    ctx.fillRect(lx - tw / 2 - 2 / z, ly - fz / 2 - 1 / z, tw + 4 / z, fz + 2 / z);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);
  };

  if (distTop < Infinity) drawDistLine(midX, by1, midX, by1 - distTop, distTop);
  if (distBot < Infinity) drawDistLine(midX, by2, midX, by2 + distBot, distBot);
  if (distLeft < Infinity) drawDistLine(bx1, midY, bx1 - distLeft, midY, distLeft);
  if (distRight < Infinity) drawDistLine(bx2, midY, bx2 + distRight, midY, distRight);
}


// ─── 검색 마커 (밝은 이중 링 핑 애니메이션) ───
function drawSearchMarker(c, zoom) {
  if (!state.searchMarker) return;
  const { boothId, startTime } = state.searchMarker;
  const elapsed = Date.now() - startTime;
  const duration = 1200;
  if (elapsed >= duration) { state.searchMarker = null; return; }

  const booth = state.booths.find(b => b.id === boothId);
  if (!booth) return;

  // 외곽 링: 빠르게 퍼지며 페이드
  const t1 = elapsed / duration;
  const alpha1 = Math.pow(1 - t1, 1.2);
  const expand1 = (t1 * 28) / zoom;

  // 내부 링: 150ms 지연, 더 천천히
  const t2 = Math.max(0, (elapsed - 150) / (duration - 150));
  if (t2 > 0) {
    const alpha2 = Math.pow(1 - Math.min(t2, 1), 2) * 0.55;
    const expand2 = (Math.min(t2, 1) * 16) / zoom;
    c.save();
    c.strokeStyle = `rgba(0,225,255,${alpha2.toFixed(2)})`;
    c.lineWidth = 2 / zoom;
    c.strokeRect(booth.x - expand2, booth.y - expand2,
                 booth.w + expand2 * 2, booth.h + expand2 * 2);
    c.restore();
  }

  c.save();
  c.strokeStyle = `rgba(0,225,255,${alpha1.toFixed(2)})`;
  c.lineWidth = 3.5 / zoom;
  c.strokeRect(booth.x - expand1, booth.y - expand1,
               booth.w + expand1 * 2, booth.h + expand1 * 2);
  c.restore();

  if (!state._searchMarkerRafId) {
    state._searchMarkerRafId = requestAnimationFrame(() => {
      state._searchMarkerRafId = null;
      render();
    });
  }
}

//  RENDER
// ═══════════════════════════════════════
function render() {
  const dpr = getEffectiveDpr();
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  if (VIEWER_MODE) { renderViewer(w, h); updateStats(); return; }
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  // ── 1. Grid (모눈 — 맨 아래)
  drawGrid(w, h);

  // ── 2. Background image (도면)
  if (state.bg.img && state.bg.visible) {
    const rot = (state.bg.rotation || 0) * Math.PI / 180;
    if (rot !== 0) {
      const cx = state.bg.x + state.bg.w / 2;
      const cy = state.bg.y + state.bg.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.globalAlpha = state.bg.opacity;
      ctx.drawImage(state.bg.img, -state.bg.w/2, -state.bg.h/2, state.bg.w, state.bg.h);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      ctx.globalAlpha = state.bg.opacity;
      ctx.drawImage(state.bg.img, state.bg.x, state.bg.y, state.bg.w, state.bg.h);
      ctx.globalAlpha = 1;
    }
  }

  // ── 3. Base Numbers
  drawBaseNumbers(ctx, state.zoom);

  // ── 4. Logos
  drawLogos(ctx, state.zoom);

  // ── 5. Booths
  if (state.showBooths) {

  // Wall/Line/Arrow start point preview
  if ((state.structMode === 'wall' || state.structMode === 'line' || state.structMode === 'arrow') && state.wallStart) {
    ctx.beginPath();
    ctx.arc(state.wallStart.x, state.wallStart.y, 4 / state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#FF9800';
    ctx.fill();
    // preview line to cursor
    ctx.beginPath();
    ctx.moveTo(state.wallStart.x, state.wallStart.y);
    ctx.lineTo(state.mouseX, state.mouseY);
    ctx.strokeStyle = 'rgba(136,136,136,0.5)';
    ctx.lineWidth = (state.structMode === 'wall' ? 3 : 2) / state.zoom;
    ctx.setLineDash([4/state.zoom, 4/state.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Rect drawing preview
  if (state.structMode === 'rect' && state.structDrawStart && state.structDrawCurrent) {
    const rx = Math.min(state.structDrawStart.x, state.structDrawCurrent.x);
    const ry = Math.min(state.structDrawStart.y, state.structDrawCurrent.y);
    const rw = Math.abs(state.structDrawCurrent.x - state.structDrawStart.x);
    const rh = Math.abs(state.structDrawCurrent.y - state.structDrawStart.y);
    ctx.strokeStyle = 'rgba(100,100,255,0.6)';
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([4/state.zoom, 4/state.zoom]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  // Export region 드래그 프리뷰
  if (state.exportRegionMode && state.exportRegionStart && state.exportRegionCurrent) {
    const s = state.exportRegionStart, c = state.exportRegionCurrent;
    const rx = Math.min(s.x, c.x), ry = Math.min(s.y, c.y);
    const rw = Math.abs(c.x - s.x), rh = Math.abs(c.y - s.y);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2 / state.zoom;
    ctx.setLineDash([6/state.zoom, 4/state.zoom]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(255,215,0,0.07)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }
  // 저장된 export region 표시
  if (state.exportRegion && !state.exportRegionMode) {
    const r = state.exportRegion;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([6/state.zoom, 4/state.zoom]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    ctx.font = `${11/state.zoom}px 'Spoqa Han Sans Neo', sans-serif`;
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('📤 Export', r.x + 4/state.zoom, r.y - 2/state.zoom);
  }

  // Group fills
  state.groups.forEach(g => {
    const bounds = getGroupBounds(g);
    if (!bounds) return;
    const isEditing = state.editingGroupId === g.id;
    const pad = 4 / state.zoom;
    ctx.fillStyle = isEditing ? 'rgba(79,140,255,0.05)' : 'rgba(79,140,255,0.04)';
    ctx.fillRect(bounds.x - pad, bounds.y - pad, (bounds.x2 - bounds.x) + pad*2, (bounds.y2 - bounds.y) + pad*2);
  });

  // ── 5. 부스 (도면 위 — fill 반투명으로 도면이 비침)
  for (const b of state.booths) {
    const isSelected = state.selectedIds.has(b.id);
    const colors = STATUS_COLORS[b.status] || STATUS_COLORS.available;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = b.fillColor || colors.fill;
    fillBoothShape(ctx, b);
    ctx.globalAlpha = 1;
    if (isSelected) {
      ctx.fillStyle = 'rgba(79,140,255,0.15)';
      fillBoothShape(ctx, b);
    }
    ctx.strokeStyle = isSelected ? SELECTED_STROKE : colors.stroke;
    ctx.lineWidth = isSelected ? 2 / state.zoom : 1 / state.zoom;
    strokeBoothShape(ctx, b, state.zoom);

    // Resize handles for selected booths (8 directions)
    if (isSelected && state.selectedIds.size === 1) {
      const hs = 5 / state.zoom;
      const handles = [
        { x: b.x,           y: b.y           },  // nw
        { x: b.x + b.w / 2, y: b.y           },  // n
        { x: b.x + b.w,     y: b.y           },  // ne
        { x: b.x + b.w,     y: b.y + b.h / 2 },  // e
        { x: b.x + b.w,     y: b.y + b.h     },  // se
        { x: b.x + b.w / 2, y: b.y + b.h     },  // s
        { x: b.x,           y: b.y + b.h     },  // sw
        { x: b.x,           y: b.y + b.h / 2 },  // w
      ];
      handles.forEach(h => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
        ctx.strokeStyle = '#4F8CFF';
        ctx.lineWidth = 1.5 / state.zoom;
        ctx.strokeRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
      });
      // Size indicator while resizing
      if (state.boothResizeHandle) {
        const label = `${pxToM(b.w)}×${pxToM(b.h)}m`;
        const fontSize = Math.max(10, 12 / state.zoom);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const tx = b.x + b.w / 2;
        const ty = b.y - 6 / state.zoom;
        const tw = ctx.measureText(label).width;
        const pad = 3 / state.zoom;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(tx - tw / 2 - pad, ty - fontSize - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, tx, ty);
      }
    }

    // 부스 타입 오버레이 (조립=노랑, 자체시공=주황)
    if (state.showBoothType && b.boothType) {
      const opt = BOOTH_TYPE_OPTIONS.find(o => o.key === b.boothType);
      if (opt && opt.fill) {
        const cov = (b.boothTypeCoverage ?? 100) / 100;
        const dir = b.boothTypeDir || 'full';
        let ox = b.x, oy = b.y, ow = b.w, oh = b.h;
        if (dir === 'left')        { ow = b.w * cov; }
        else if (dir === 'right')  { ox = b.x + b.w * (1 - cov); ow = b.w * cov; }
        else if (dir === 'top')    { oh = b.h * cov; }
        else if (dir === 'bottom') { oy = b.y + b.h * (1 - cov); oh = b.h * cov; }
        ctx.fillStyle = opt.fill;
        ctx.fillRect(ox, oy, ow, oh);
        ctx.strokeStyle = opt.stroke;
        ctx.lineWidth = 1.5 / state.zoom;
        ctx.strokeRect(ox, oy, ow, oh);
      }
    }

    // text content (always show)
    drawBoothContent(ctx, b, state.zoom, colors.text, false);
  }

  // Group borders
  state.groups.forEach(g => {
    const bounds = getGroupBounds(g);
    if (!bounds) return;
    const isEditing = state.editingGroupId === g.id;
    const pad = 4 / state.zoom;
    ctx.strokeStyle = isEditing ? '#4F8CFF' : 'rgba(79,140,255,0.5)';
    ctx.lineWidth = (isEditing ? 2 : 1.5) / state.zoom;
    ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
    ctx.strokeRect(bounds.x - pad, bounds.y - pad, (bounds.x2 - bounds.x) + pad*2, (bounds.y2 - bounds.y) + pad*2);
    ctx.setLineDash([]);
    if (state.zoom > 0.5) {
      ctx.font = `600 ${10 / state.zoom}px 'Spoqa Han Sans Neo', sans-serif`;
      ctx.fillStyle = '#4F8CFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(g.label, bounds.x - pad, bounds.y - pad - 1 / state.zoom);
    }
  });

  // ── 원격 유저 선택 오버레이 (Figma-like per-user isolation) ──
  const remSelEntries = Object.entries(state.remoteSelections);
  if (remSelEntries.length > 0) {
    for (const b of state.booths) {
      for (const [uid, sel] of remSelEntries) {
        if (!sel.ids.has(b.id)) continue;
        ctx.save();
        ctx.strokeStyle = sel.color;
        ctx.lineWidth = 2.5 / state.zoom;
        ctx.setLineDash([5 / state.zoom, 3 / state.zoom]);
        strokeBoothShape(ctx, b, state.zoom);
        ctx.setLineDash([]);
        // 유저 이름 태그 (부스 우상단)
        if (state.zoom > 0.4) {
          const label = sel.name;
          ctx.font = `600 ${9 / state.zoom}px 'Spoqa Han Sans Neo', sans-serif`;
          const tw = ctx.measureText(label).width;
          const pad = 3 / state.zoom;
          const tagX = b.x + b.w - tw - pad * 2;
          const tagY = b.y - 14 / state.zoom;
          ctx.fillStyle = sel.color;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tw + pad * 2, 11 / state.zoom, 2 / state.zoom);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(label, tagX + pad, tagY + 1 / state.zoom);
        }
        ctx.restore();
        break; // 한 부스에 여러 유저가 선택 시 첫 번째만 표시
      }
    }
  }

  // Alt drag clones
  for (const b of state.altDragClones) {
    ctx.fillStyle = 'rgba(79,140,255,0.25)';
    fillBoothShape(ctx, b);
    ctx.strokeStyle = SELECTED_STROKE;
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
    strokeBoothShape(ctx, b, state.zoom);
    ctx.setLineDash([]);
  }
  } // end if (state.showBooths)

  // Calibration points
  if (state.bgCalPoints.length > 0) {
    state.bgCalPoints.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 / state.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#FF9800';
      ctx.fill();
      ctx.font = `600 ${10 / state.zoom}px sans-serif`;
      ctx.fillStyle = '#FF9800';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('P' + (i + 1), p.x + 8 / state.zoom, p.y);
    });
    if (state.bgCalPoints.length === 2) {
      ctx.beginPath();
      ctx.moveTo(state.bgCalPoints[0].x, state.bgCalPoints[0].y);
      ctx.lineTo(state.bgCalPoints[1].x, state.bgCalPoints[1].y);
      ctx.strokeStyle = '#FF9800';
      ctx.lineWidth = 1.5 / state.zoom;
      ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw preview / BaseNo preview / Discuss preview
  if (state.isDrawing || state.isBaseDrawing || state.isDiscussDrawing) {
    const dx = (state.isDrawing ? state.drawCurrentX : (state.isBaseDrawing ? state.baseDrawCurrentX : state.discussDrawCurrentX)) - (state.isDrawing ? state.drawStartX : (state.isBaseDrawing ? state.baseDrawStartX : state.discussDrawStartX));
    const dy = (state.isDrawing ? state.drawCurrentY : (state.isBaseDrawing ? state.baseDrawCurrentY : state.discussDrawCurrentY)) - (state.isDrawing ? state.drawStartY : (state.isBaseDrawing ? state.baseDrawStartY : state.discussDrawStartY));
    const sx = state.isDrawing ? state.drawStartX : (state.isBaseDrawing ? state.baseDrawStartX : state.discussDrawStartX);
    const sy = state.isDrawing ? state.drawStartY : (state.isBaseDrawing ? state.baseDrawStartY : state.discussDrawStartY);
    const rx = dx >= 0 ? sx : (state.isDrawing ? state.drawCurrentX : (state.isBaseDrawing ? state.baseDrawCurrentX : state.discussDrawCurrentX));
    const ry = dy >= 0 ? sy : (state.isDrawing ? state.drawCurrentY : (state.isBaseDrawing ? state.baseDrawCurrentY : state.discussDrawCurrentY));
    const rw = Math.abs(dx), rh = Math.abs(dy);
    ctx.fillStyle = state.isDiscussDrawing ? 'rgba(255,214,0,0.12)' : 'rgba(79,140,255,0.15)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = state.isDiscussDrawing ? '#FFD600' : '#4F8CFF';
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
    if (rw > 5 && rh > 5) {
      ctx.font = `600 ${11 / state.zoom}px 'Spoqa Han Sans Neo', sans-serif`;
      ctx.fillStyle = state.isDiscussDrawing ? '#FFD600' : '#4F8CFF';
      ctx.textAlign = 'center';
      const label = state.isDiscussDrawing ? '배정논의' : `${pxToM(rw)}m × ${pxToM(rh)}m`;
      ctx.fillText(label, rx + rw / 2, ry - 8 / state.zoom);
    }
  }

  // Marquee selection
  if (state.isMarquee) {
    const mx = Math.min(state.marqueeStartX, state.marqueeEndX);
    const my = Math.min(state.marqueeStartY, state.marqueeEndY);
    const mw = Math.abs(state.marqueeEndX - state.marqueeStartX);
    const mh = Math.abs(state.marqueeEndY - state.marqueeStartY);
    ctx.fillStyle = 'rgba(79,140,255,0.1)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#4F8CFF';
    ctx.lineWidth = 1 / state.zoom;
    ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
    ctx.strokeRect(mx, my, mw, mh);
    ctx.setLineDash([]);
  }

  // ── Structures (부스 위에 항상 렌더링)
  drawStructures(ctx, state.zoom, false);

  // ─── 배정논의 오버레이 레이어 ───
  drawDiscussOverlays(ctx, state.zoom);

  // ─── 인접 블럭 거리 인디케이터 (드래그 + 부스 그리기) ───
  drawNeighborDistances(ctx, state);

  // ─── 실측 레이어 ───
  drawMeasureLayer(ctx, state.zoom);

  // ─── 검색 마커 ───
  drawSearchMarker(ctx, state.zoom);

  ctx.restore();

  // BG 아직 로딩 중이면 좌하단에 인디케이터 표시 (스크린 좌표 고정)
  if (!state.bg.img && (state.bg.storageUrl || state.bg.dataUrl)) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = "12px 'Spoqa Han Sans Neo', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('도면 로딩 중...', 12, h - 36);
    ctx.restore();
  }

  // Show/hide assignGuideMode hint
  const hintEl = document.getElementById('assignGuideModeHint');
  if (state.assignGuideMode) {
    hintEl.style.display = 'block';
  } else {
    hintEl.style.display = 'none';
  }

  drawRemoteCursors();
  renderLayers();
  updateStats();
}

// ─── Viewer Render ───
function renderViewer(w, h) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  // 1. Background image — full opacity
  if (state.bg.img && state.bg.visible) {
    const rot = (state.bg.rotation || 0) * Math.PI / 180;
    if (rot !== 0) {
      const cx = state.bg.x + state.bg.w / 2;
      const cy = state.bg.y + state.bg.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(state.bg.img, -state.bg.w/2, -state.bg.h/2, state.bg.w, state.bg.h);
      ctx.restore();
    } else {
      ctx.drawImage(state.bg.img, state.bg.x, state.bg.y, state.bg.w, state.bg.h);
    }
  }

  // 2. Logos
  drawLogos(ctx, state.zoom);

  // 3. Booths — 상태 구분 없이 단일 스타일
  const searchEl = document.getElementById('viewerSearch');
  const searchTerm = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const _vAvail = VIEWER_STATUS_COLORS.available;
  for (const b of state.booths) {
    const isHighlighted = searchTerm && (
      b.boothId.toLowerCase().includes(searchTerm) ||
      b.companyName.toLowerCase().includes(searchTerm) ||
      (b.companyNameEn || '').toLowerCase().includes(searchTerm) ||
      b.companyUid.toLowerCase().includes(searchTerm)
    );
    const isHovered = state.viewerHoverId === b.id;

    // 공개도면: 모든 부스 기본 컬러 #f9e5de
    // showViewerAvailable ON → available 부스 노란색 / 클릭된 available 부스도 노란색
    // facility → 연한회색 #EFEFEF
    const isSelected = isHovered && b.status === 'spot';
    const _spotUnderOverlay = b.status === 'spot' && state.discussOverlays && state.discussOverlays.some(
      ov => b.x < ov.x + ov.w && b.x + b.w > ov.x && b.y < ov.y + ov.h && b.y + b.h > ov.y);
    const isAvailableHighlight = state.showViewerAvailable && b.status === 'spot' && !_spotUnderOverlay;
    let fill = b.status === 'facility' ? '#EFEFEF' : _vAvail.fill;
    let stroke = b.status === 'facility' ? '#111111' : _vAvail.stroke;
    if (isHighlighted) { fill = '#FFF9C4'; stroke = '#F57F17'; }
    else if (isSelected || isAvailableHighlight) { fill = '#FFD600'; stroke = '#F9A825'; }

    ctx.fillStyle = fill;
    fillBoothShape(ctx, b);

    ctx.strokeStyle = (isSelected || isHighlighted || isAvailableHighlight) ? stroke : _vAvail.stroke;
    ctx.lineWidth = (isSelected || isHighlighted) ? 2 / state.zoom : 0.5 / state.zoom;
    strokeBoothShape(ctx, b, state.zoom);

    // 부스 타입 오버레이 (viewer에서도 표시)
    if (state.showBoothType && b.boothType) {
      const opt = BOOTH_TYPE_OPTIONS.find(o => o.key === b.boothType);
      if (opt && opt.fill) {
        const cov = (b.boothTypeCoverage ?? 100) / 100;
        const dir = b.boothTypeDir || 'full';
        let ox = b.x, oy = b.y, ow = b.w, oh = b.h;
        if (dir === 'left')        { ow = b.w * cov; }
        else if (dir === 'right')  { ox = b.x + b.w * (1 - cov); ow = b.w * cov; }
        else if (dir === 'top')    { oh = b.h * cov; }
        else if (dir === 'bottom') { oy = b.y + b.h * (1 - cov); oh = b.h * cov; }
        ctx.fillStyle = opt.fill;
        ctx.fillRect(ox, oy, ow, oh);
        ctx.strokeStyle = opt.stroke;
        ctx.lineWidth = 1.5 / state.zoom;
        ctx.strokeRect(ox, oy, ow, oh);
      }
    }

    const textColor = isHighlighted ? '#5D4037' : isSelected ? '#7A5800' : '#111111';
    drawBoothContent(ctx, b, state.zoom, textColor, false, false, false, '#000000');
  }

  // BaseNumbers text only (outline hidden in viewer mode)
  drawBaseNumbers(ctx, state.zoom);

  // Structures (부스 위에 항상 렌더링)
  drawStructures(ctx, state.zoom, false);

  // ─── 검색 마커 ───
  drawSearchMarker(ctx, state.zoom);

  ctx.restore();
  drawRemoteCursors();
  const vzd = document.getElementById('viewerZoomDisplay');
  if (vzd) vzd.textContent = Math.round(state.zoom * 100) + '%';
}

function showViewerPopup(b, screenX, screenY) {
  const popup = document.getElementById('viewerPopup');
  document.getElementById('vpNo').textContent = b.boothId || '—';
  const vpDisplayName = state.lang === 'en' ? (b.companyNameEn || '') : b.companyName;
  document.getElementById('vpName').textContent = (vpDisplayName || '(미배정)').replace(/<\/br>/g, ' ');
  document.getElementById('vpStatus').innerHTML = '';
  const bw = pxToM(b.w), bh = pxToM(b.h);
  document.getElementById('vpSize').textContent = `${bw}m × ${bh}m (${getBoothAreaM2(b).toFixed(0)}㎡)`;
  if (b.companyUid) {
    document.getElementById('vpUidRow').style.display = '';
    document.getElementById('vpUid').textContent = b.companyUid;
  } else {
    document.getElementById('vpUidRow').style.display = 'none';
  }
  const vpW = 290, vpH = 170;
  let left = screenX + 14;
  let top = screenY - 20;
  if (left + vpW > window.innerWidth - 10) left = screenX - vpW - 14;
  if (top + vpH > window.innerHeight - 10) top = window.innerHeight - vpH - 10;
  if (top < 60) top = 60;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('open');
}

function closeViewerPopup() {
  document.getElementById('viewerPopup').classList.remove('open');
  state.viewerHoverId = null;
  render();
}

function drawGrid(screenW, screenH) {
  const tl = screenToWorld(0, 0);
  const br = screenToWorld(screenW, screenH);
  // 0.1m 세선 — 충분히 확대됐을 때만 표시 (너무 조밀해지면 off)
  if (state.zoom > 3) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5 / state.zoom;
    const sf = Math.floor(tl.x / FINE_GRID_PX) * FINE_GRID_PX, sf2 = Math.floor(tl.y / FINE_GRID_PX) * FINE_GRID_PX;
    ctx.beginPath();
    for (let x = sf; x < br.x; x += FINE_GRID_PX) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
    for (let y = sf2; y < br.y; y += FINE_GRID_PX) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
    ctx.stroke();
  }
  // 0.5m 선
  if (state.zoom > 0.8) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.5 / state.zoom;
    const sx = Math.floor(tl.x / HALF_GRID_PX) * HALF_GRID_PX, sy = Math.floor(tl.y / HALF_GRID_PX) * HALF_GRID_PX;
    ctx.beginPath();
    for (let x = sx; x < br.x; x += HALF_GRID_PX) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
    for (let y = sy; y < br.y; y += HALF_GRID_PX) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
    ctx.stroke();
  }
  // 3m 선
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5 / state.zoom;
  const sx2 = Math.floor(tl.x / GRID_PX) * GRID_PX, sy2 = Math.floor(tl.y / GRID_PX) * GRID_PX;
  ctx.beginPath();
  for (let x = sx2; x < br.x; x += GRID_PX) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
  for (let y = sy2; y < br.y; y += GRID_PX) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
  ctx.stroke();
  // 원점 축
  ctx.strokeStyle = 'rgba(79,140,255,0.2)';
  ctx.lineWidth = 1 / state.zoom;
  ctx.beginPath();
  ctx.moveTo(0, tl.y); ctx.lineTo(0, br.y);
  ctx.moveTo(tl.x, 0); ctx.lineTo(br.x, 0);
  ctx.stroke();
}

// ═══════════════════════════════════════
