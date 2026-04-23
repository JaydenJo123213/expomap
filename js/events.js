//  INPUT HANDLING
// ═══════════════════════════════════════
let spaceDown = false;

// touchmove 전용 rAF throttle — 다른 render() 호출에는 영향 없음
let _touchRafPending = false;
function scheduleRenderForTouch() {
  if (_touchRafPending) return;
  _touchRafPending = true;
  requestAnimationFrame(() => { _touchRafPending = false; render(); });
}

canvas.addEventListener('mousedown', (e) => {
  if (VIEWER_MODE) {
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    state._viewerClickStartX = e.clientX;
    state._viewerClickStartY = e.clientY;
    container.classList.add('panning');
    return;
  }

  const rect = container.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);

  // Export region 드래그
  if (state.exportRegionMode && e.button === 0) {
    state.exportRegionStart = { x: world.x, y: world.y };
    return;
  }

  if (spaceDown || e.button === 1) {
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    container.classList.add('panning');
    return;
  }

  // BG move mode
  if (state.bgMoveMode && state.bg.img && e.button === 0) {
    state.bgDragging = true;
    state.bgDragStartX = world.x;
    state.bgDragStartY = world.y;
    state.bgDragOriginX = state.bg.x;
    state.bgDragOriginY = state.bg.y;
    return;
  }

  // Calibration click
  if (state.bgCalMode && e.button === 0) {
    state.bgCalPoints.push({ x: world.x, y: world.y });
    if (state.bgCalPoints.length === 1) {
      showCalHint('Click point 2 on the background image');
    } else if (state.bgCalPoints.length >= 2) {
      hideCalHint();
      state.bgCalMode = false;
      render();
      openModal('modalCalDist');
    }
    render();
    return;
  }

  // Structure placement
  if (state.structMode && e.button === 0) {
    const snapped = { x: snapValue(world.x), y: snapValue(world.y) };
    if (state.structMode === 'column') {
      createStructure('column', { x: snapped.x, y: snapped.y, radius: 5 }); // 0.5m radius
    } else if (state.structMode === 'wall' || state.structMode === 'line' || state.structMode === 'arrow') {
      if (!state.wallStart) {
        state.wallStart = { x: snapped.x, y: snapped.y };
        showStructHint('Click second point to finish. Escape to cancel.');
      } else {
        createStructure(state.structMode, { x1: state.wallStart.x, y1: state.wallStart.y, x2: snapped.x, y2: snapped.y, thickness: state.structMode === 'wall' ? 3 : 2 });
        state.wallStart = null;
        showStructHint('Click to start new ' + state.structMode + '. Escape to exit.');
      }
    } else if (state.structMode === 'door') {
      createStructure('door', { x: snapped.x, y: snapped.y, w: 20, h: 5 }); // 2m × 0.5m
    } else if (state.structMode === 'rect') {
      // rect도 drag로 그리기: 시작점 기록
      if (!state.structDrawStart) {
        state.structDrawStart = { x: snapped.x, y: snapped.y };
        showStructHint('Drag to set rectangle size. Escape to cancel.');
      }
      // mouseup에서 완성
      return;
    } else if (state.structMode === 'circle') {
      createStructure('circle', { x: snapped.x, y: snapped.y, radius: 10 }); // 1m radius
    } else if (state.structMode === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        createStructure('text', { x: snapped.x, y: snapped.y, text: text, fontSize: 12, color: '#333' });
      }
    } else if (state.structMode === 'measureLine') {
      // 레이어 잠금 또는 숨김 상태면 그리기 불가
      if (state.layerLocked.measure || !state.showMeasure) return;
      const snap = snapToBoothEdge(world.x, world.y);
      state.measureLineDrawStart = { x: snap.x, y: snap.y };
      state.measureLinePreviewEnd = { x: snap.x, y: snap.y };
      render();
      return;
    }
    render();
    return;
  }

  if (state.mode === 'draw' && e.button === 0) {
    const snapped = { x: snapValue(world.x), y: snapValue(world.y) };
    state.isDrawing = true;
    state.drawStartX = snapped.x; state.drawStartY = snapped.y;
    state.drawCurrentX = snapped.x; state.drawCurrentY = snapped.y;
    return;
  }

  if (state.mode === 'baseNo' && e.button === 0) {
    const snapped = { x: snapValue(world.x), y: snapValue(world.y) };
    state.isBaseDrawing = true;
    state.baseDrawStartX = snapped.x; state.baseDrawStartY = snapped.y;
    state.baseDrawCurrentX = snapped.x; state.baseDrawCurrentY = snapped.y;
    return;
  }

  // ─── 배정논의 드로우 모드 ───
  if (state.mode === 'discuss' && e.button === 0) {
    // half-grid 강제 적용
    const sx = Math.round(world.x / HALF_GRID_PX) * HALF_GRID_PX;
    const sy = Math.round(world.y / HALF_GRID_PX) * HALF_GRID_PX;
    state.isDiscussDrawing = true;
    state.discussDrawStartX = sx; state.discussDrawStartY = sy;
    state.discussDrawCurrentX = sx; state.discussDrawCurrentY = sy;
    return;
  }

  if (state.mode === 'select' && e.button === 0) {
    // ─── 측정선 클릭 감지 (레이어 표시 중이고 잠금 아닐 때만) ───
    state.selectedMeasureLineId = null;
    if (state.showMeasure && !state.layerLocked.measure) {
      const HIT = 5; // world px
      const hit = state.measureLines.find(l =>
        distanceToSegment(world.x, world.y, l.x1, l.y1, l.x2, l.y2) < HIT
      );
      if (hit) {
        state.selectedMeasureLineId = hit.id;
        state.selectedIds.clear();
        state.selectedStructId = null;
        state.selectedBaseNoIds.clear();
        state.selectedDiscussIds.clear();
        state.selectedLogoId = null;
        render(); updateProps();
        return;
      }
    }

    // Structure resize handle check (선택된 struct가 있을 때 먼저 체크)
    if (state.selectedStructId) {
      const selS = state.structures.find(s => s.id === state.selectedStructId);
      if (selS && !selS.locked) {
        const handle = getStructHandleAt(selS, world.x, world.y);
        if (handle) {
          state.structResizing = true;
          state.structResizeHandle = handle.id;
          state.selectedIds.clear();
          state.selectedLogoId = null;
          render(); updateProps();
          return;
        }
      }
    }

    // Structure click/drag
    const clickedStruct = getStructAt(world.x, world.y);
    if (clickedStruct) {
      state.selectedStructId = clickedStruct.id;
      state.selectedIds.clear();
      state.selectedLogoId = null;
      if (!clickedStruct.locked) {
        state.structDragging = true;
        state.structDragStartX = world.x;
        state.structDragStartY = world.y;
        const c = getStructCenter(clickedStruct);
        state.structDragOriginX = c.x;
        state.structDragOriginY = c.y;
      }
      render(); updateProps();
      return;
    }

    // Logo click/drag/resize
    const clickedLogo = getLogoAt(world.x, world.y);
    if (clickedLogo) {
      state.selectedLogoId = clickedLogo.id;
      state.selectedIds.clear();
      // check resize handle
      const corner = getLogoResizeCorner(clickedLogo, world.x, world.y);
      if (corner) {
        state.logoResizing = true;
        state.logoResizeCorner = corner;
        state.logoDragStartX = world.x;
        state.logoDragStartY = world.y;
        state.logoDragOriginX = clickedLogo.w;
        state.logoDragOriginY = clickedLogo.h;
      } else {
        state.logoDragging = true;
        state.logoDragStartX = world.x;
        state.logoDragStartY = world.y;
        state.logoDragOriginX = clickedLogo.x;
        state.logoDragOriginY = clickedLogo.y;
      }
      render(); updateProps();
      return;
    }
    state.selectedLogoId = null;
    state.selectedStructId = null;

    // 배정논의 오버레이 클릭/드래그 (부스보다 높은 우선순위)
    const discussOv = getDiscussOverlayAt(world.x, world.y);
    if (discussOv && !state.layerLocked['discuss']) {
      // assignGuideMode: auto-select group if the overlay has groupId
      if (state.assignGuideMode) {
        state.selectedDiscussIds.clear();
        if (discussOv.groupId) {
          // Select all overlays with the same groupId
          state.discussOverlays.forEach(ov => {
            if (ov.groupId === discussOv.groupId) {
              state.selectedDiscussIds.add(ov.id);
            }
          });
        } else {
          // If no groupId, just select this one
          state.selectedDiscussIds.add(discussOv.id);
        }
        broadcastSelectionState();
        render(); updateProps();
        return;
      }

      // Normal mode (not assignGuideMode)
      if (e.shiftKey) {
        state.selectedIds.clear();
        state.selectedBaseNoIds.clear();
        if (state.selectedDiscussIds.has(discussOv.id)) state.selectedDiscussIds.delete(discussOv.id);
        else state.selectedDiscussIds.add(discussOv.id);
      } else {
        state.selectedIds.clear();
        state.selectedBaseNoIds.clear();
        if (!state.selectedDiscussIds.has(discussOv.id)) {
          state.selectedDiscussIds.clear();
          state.selectedDiscussIds.add(discussOv.id);
        }
      }

      // Check resize handle (bottom-right corner) — 단일선택 시만
      if (state.selectedDiscussIds.size === 1) {
        const resizeHandleSize = 8 / state.zoom;
        const isOnResizeHandle = (
          world.x >= discussOv.x + discussOv.w - resizeHandleSize &&
          world.x <= discussOv.x + discussOv.w &&
          world.y >= discussOv.y + discussOv.h - resizeHandleSize &&
          world.y <= discussOv.y + discussOv.h
        );
        if (isOnResizeHandle) {
          state.discussResizeHandle = 'se';
          state.discussResizeDragStartSX = sx;
          state.discussResizeDragStartSY = sy;
          state.discussResizeOriginW = discussOv.w;
          state.discussResizeOriginH = discussOv.h;
          broadcastSelectionState();
          render(); updateProps();
          return;
        }
      }

      // dragReady 세팅
      state.discussDragReady = true;
      state.discussDragStartSX = sx;
      state.discussDragStartSY = sy;
      state.discussDragOrigins = state.discussOverlays
        .filter(ov => state.selectedDiscussIds.has(ov.id))
        .map(ov => ({ id: ov.id, x: ov.x, y: ov.y }));
      broadcastSelectionState();
      render(); updateProps();
      return;
    }

    // Resize handle check BEFORE getBoothAt — handles extend outside booth boundary
    if (state.mode === 'select' && state.selectedIds.size === 1 && !state.layerLocked['booth']) {
      const selBooth = state.booths.find(b => state.selectedIds.has(b.id));
      if (selBooth) {
        const hitR = 7 / state.zoom;
        const boothHandles = [
          { id: 'nw', x: selBooth.x,                  y: selBooth.y               },
          { id: 'n',  x: selBooth.x + selBooth.w / 2, y: selBooth.y               },
          { id: 'ne', x: selBooth.x + selBooth.w,     y: selBooth.y               },
          { id: 'e',  x: selBooth.x + selBooth.w,     y: selBooth.y + selBooth.h / 2 },
          { id: 'se', x: selBooth.x + selBooth.w,     y: selBooth.y + selBooth.h  },
          { id: 's',  x: selBooth.x + selBooth.w / 2, y: selBooth.y + selBooth.h  },
          { id: 'sw', x: selBooth.x,                  y: selBooth.y + selBooth.h  },
          { id: 'w',  x: selBooth.x,                  y: selBooth.y + selBooth.h / 2 },
        ];
        const hitHandle = boothHandles.find(h =>
          Math.abs(world.x - h.x) <= hitR && Math.abs(world.y - h.y) <= hitR
        );
        if (hitHandle) {
          state.boothResizeHandle = hitHandle.id;
          state.boothResizeDragStartSX = sx;
          state.boothResizeDragStartSY = sy;
          state.boothResizeOrigins = state.booths
            .filter(b => state.selectedIds.has(b.id))
            .map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
          broadcastSelectionState();
          render(); updateProps();
          return;
        }
      }
    }

    // Booth click/drag (priority over BaseNo)
    const booth = getBoothAt(world.x, world.y);
    if (booth && !state.layerLocked['booth']) {
      // Alt+drag copy
      if (e.altKey) {
        if (!state.selectedIds.has(booth.id)) {
          state.selectedIds.clear();
          const group = getBoothGroup(booth.id);
          if (group && state.editingGroupId !== group.id) {
            group.boothIds.forEach(id => state.selectedIds.add(id));
          } else {
            state.selectedIds.add(booth.id);
          }
        }
        const sel = state.booths.filter(b => state.selectedIds.has(b.id));
        state.altDragClones = sel.map(b => ({ ...b, id: -b.id, _originX: b.x, _originY: b.y }));
        state.isAltDragging = true;
        state.altDragOriginSX = sx;
        state.altDragOriginSY = sy;
        render();
        return;
      }

      if (e.shiftKey) {
        state.selectedDiscussIds.clear();
        if (state.selectedIds.has(booth.id)) state.selectedIds.delete(booth.id);
        else state.selectedIds.add(booth.id);
      } else {
        state.selectedDiscussIds.clear();
        if (!state.selectedIds.has(booth.id)) {
          state.selectedIds.clear();
          const group = getBoothGroup(booth.id);
          if (group && state.editingGroupId !== group.id) {
            group.boothIds.forEach(id => state.selectedIds.add(id));
          } else {
            state.selectedIds.add(booth.id);
          }
        }
      }

      // Prepare drag-to-move
      state.dragReady = true;
      state.dragStartSX = sx;
      state.dragStartSY = sy;
      state.dragBoothsOrigin = state.booths
        .filter(b => state.selectedIds.has(b.id))
        .map(b => ({ id: b.id, x: b.x, y: b.y, cells: b.cells ? b.cells.map(c => ({...c})) : null }));
      broadcastSelectionState();
      render(); updateProps();
      return;
    }

    // BaseNo click / drag / resize (only if no booth)
    const baseNo = getBaseNoAt(world.x, world.y);
    if (baseNo && !state.layerLocked['baseNo']) {
      // Shift+클릭 다중선택
      if (e.shiftKey) {
        if (state.selectedBaseNoIds.has(baseNo.id)) state.selectedBaseNoIds.delete(baseNo.id);
        else state.selectedBaseNoIds.add(baseNo.id);
      } else {
        // 이미 선택된 블럭을 클릭하면 선택 유지 (드래그용)
        if (!state.selectedBaseNoIds.has(baseNo.id)) {
          state.selectedBaseNoIds.clear();
          state.selectedBaseNoIds.add(baseNo.id);
        }
      }

      // Check resize corner (right-bottom) — 단일선택 시만
      if (state.selectedBaseNoIds.size === 1) {
        const resizeHandleSize = 8 / state.zoom;
        const isOnResizeHandle = (
          world.x >= baseNo.x + baseNo.w - resizeHandleSize &&
          world.x <= baseNo.x + baseNo.w &&
          world.y >= baseNo.y + baseNo.h - resizeHandleSize &&
          world.y <= baseNo.y + baseNo.h
        );
        if (isOnResizeHandle) {
          state.baseNoResizeHandle = 'se';
          state.baseNoDragStartSX = sx;
          state.baseNoDragStartSY = sy;
          state.baseNoDragOriginW = baseNo.w;
          state.baseNoDragOriginH = baseNo.h;
        } else {
          state.baseNoDragReady = true;
          state.baseNoDragStartSX = sx;
          state.baseNoDragStartSY = sy;
          state.baseNoDragBoothsOrigin = state.baseNumbers
            .filter(bn => state.selectedBaseNoIds.has(bn.id))
            .map(bn => ({ id: bn.id, x: bn.x, y: bn.y }));
        }
      } else {
        // 다중선택 시 dragReady만
        state.baseNoDragReady = true;
        state.baseNoDragStartSX = sx;
        state.baseNoDragStartSY = sy;
        state.baseNoDragBoothsOrigin = state.baseNumbers
          .filter(bn => state.selectedBaseNoIds.has(bn.id))
          .map(bn => ({ id: bn.id, x: bn.x, y: bn.y }));
      }
      broadcastSelectionState();
      render(); updateProps();
      return;
    }

    // Clicked empty space → start marquee selection
    if (state.editingGroupId) { state.editingGroupId = null; }
    if (!e.shiftKey) {
      state.selectedIds.clear();
      state.selectedBaseNoIds.clear();
      state.selectedDiscussIds.clear();
    }
    state.selectedStructId = null;
    state.selectedLogoId = null;
    state.dragReady = false;
    state.isMarquee = true;
    state.marqueeStartX = world.x;
    state.marqueeStartY = world.y;
    state.marqueeEndX = world.x;
    state.marqueeEndY = world.y;
    if (!e.shiftKey) broadcastSelectionState(); // 빈 공간 클릭 → deselect broadcast
    render(); updateProps();
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (VIEWER_MODE) {
    const rect = container.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    broadcastCursorPosition(world.x, world.y);
    if (state.isPanning) {
      state.panX = e.clientX - state.panStartX;
      state.panY = e.clientY - state.panStartY;
      render();
    }
    return;
  }

  const rect = container.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);
  state.mouseX = world.x; state.mouseY = world.y;
  broadcastCursorPosition(world.x, world.y);

  document.getElementById('cursorPos').textContent = `X: ${pxToM(world.x).toFixed(1)}m  Y: ${pxToM(world.y).toFixed(1)}m`;

  // Export region 드래그 프리뷰
  if (state.exportRegionMode && state.exportRegionStart) {
    state.exportRegionCurrent = { x: world.x, y: world.y };
    render(); return;
  }

  if (state.isPanning) {
    state.panX = e.clientX - state.panStartX;
    state.panY = e.clientY - state.panStartY;
    render(); return;
  }

  // Logo dragging/resizing
  if (state.logoDragging && state.selectedLogoId) {
    const logo = state.logos.find(l => l.id === state.selectedLogoId);
    if (logo) {
      logo.x = state.logoDragOriginX + (world.x - state.logoDragStartX);
      logo.y = state.logoDragOriginY + (world.y - state.logoDragStartY);
      render();
    }
    return;
  }
  if (state.logoResizing && state.selectedLogoId) {
    const logo = state.logos.find(l => l.id === state.selectedLogoId);
    if (logo) {
      const dw = world.x - state.logoDragStartX;
      const dh = world.y - state.logoDragStartY;
      const newW = Math.max(10, state.logoDragOriginX + dw);
      const newH = Math.max(10, state.logoDragOriginY + dh);
      // 비율 유지: 너비 기준
      const aspect = state.logoDragOriginY / state.logoDragOriginX;
      logo.w = newW;
      logo.h = newW * aspect;
      render();
    }
    return;
  }

  // Struct resizing (핸들 드래그)
  if (state.structResizing && state.selectedStructId) {
    const s = state.structures.find(s => s.id === state.selectedStructId);
    if (s) {
      const snapped = { x: snapValue(world.x), y: snapValue(world.y) };
      applyStructResize(s, state.structResizeHandle, snapped.x, snapped.y);
      render(); updateProps();
    }
    return;
  }

  // Struct dragging
  if (state.structDragging && state.selectedStructId) {
    const s = state.structures.find(s => s.id === state.selectedStructId);
    if (s && !s.locked) {
      const dx = world.x - state.structDragStartX;
      const dy = world.y - state.structDragStartY;
      moveStruct(s, dx, dy);
      state.structDragStartX = world.x;
      state.structDragStartY = world.y;
      render();
    }
    return;
  }

  // Rect struct drawing preview
  if (state.structMode === 'rect' && state.structDrawStart) {
    state.structDrawCurrent = { x: snapValue(world.x), y: snapValue(world.y) };
    render();
    return;
  }

  // BG dragging
  if (state.bgDragging) {
    state.bg.x = state.bgDragOriginX + (world.x - state.bgDragStartX);
    state.bg.y = state.bgDragOriginY + (world.y - state.bgDragStartY);
    render(); return;
  }

  // 실측 선 드래그 프리뷰
  if (state.measureLineDrawStart) {
    const constrained = constrainToAxis(state.measureLineDrawStart, { x: world.x, y: world.y });
    state.measureLinePreviewEnd = snapEndAlongAxis(state.measureLineDrawStart, constrained);
    render(); return;
  }

  if (state.isDrawing) {
    const snapped = { x: snapValue(world.x), y: snapValue(world.y) };
    state.drawCurrentX = snapped.x; state.drawCurrentY = snapped.y;
    render(); return;
  }

  // BaseNo dragReady → isDragging (3px 임계값)
  if (state.baseNoDragReady) {
    const ddx = sx - state.baseNoDragStartSX, ddy = sy - state.baseNoDragStartSY;
    if (Math.abs(ddx) > 3 || Math.abs(ddy) > 3) {
      if (!state.baseNoDragging) { state.baseNoDragging = true; saveUndo(); }
      const wdx = ddx / state.zoom, wdy = ddy / state.zoom;
      state.baseNumbers.forEach(bn => {
        if (!state.selectedBaseNoIds.has(bn.id)) return;
        const orig = state.baseNoDragBoothsOrigin.find(o => o.id === bn.id);
        if (orig) { bn.x = snapValue(orig.x + wdx); bn.y = snapValue(orig.y + wdy); }
      });
      render(); return;
    }
  }

  // BaseNo resize handle (단일선택 시)
  if (state.baseNoResizeHandle) {
    const bn = state.baseNumbers.find(b => state.selectedBaseNoIds.has(b.id));
    if (bn) {
      const wdx = (sx - state.baseNoDragStartSX) / state.zoom;
      const wdy = (sy - state.baseNoDragStartSY) / state.zoom;
      bn.w = Math.max(GRID_PX, snapValue(state.baseNoDragOriginW + wdx));
      bn.h = Math.max(GRID_PX, snapValue(state.baseNoDragOriginH + wdy));
      render(); return;
    }
  }

  // Booth resize (8 directions, always snap to HALF_GRID_PX = 0.5m)
  if (state.boothResizeHandle) {
    const ddx = (sx - state.boothResizeDragStartSX) / state.zoom;
    const ddy = (sy - state.boothResizeDragStartSY) / state.zoom;
    const dir = state.boothResizeHandle;
    state.booths.forEach(b => {
      if (!state.selectedIds.has(b.id)) return;
      const orig = state.boothResizeOrigins.find(o => o.id === b.id);
      if (!orig) return;
      // Horizontal component
      if (dir === 'e' || dir === 'ne' || dir === 'se') {
        b.w = Math.max(GRID_PX, Math.round((orig.w + ddx) / HALF_GRID_PX) * HALF_GRID_PX);
      } else if (dir === 'w' || dir === 'nw' || dir === 'sw') {
        const newW = Math.max(GRID_PX, Math.round((orig.w - ddx) / HALF_GRID_PX) * HALF_GRID_PX);
        b.x = orig.x + orig.w - newW;
        b.w = newW;
      }
      // Vertical component
      if (dir === 's' || dir === 'sw' || dir === 'se') {
        b.h = Math.max(GRID_PX, Math.round((orig.h + ddy) / HALF_GRID_PX) * HALF_GRID_PX);
      } else if (dir === 'n' || dir === 'nw' || dir === 'ne') {
        const newH = Math.max(GRID_PX, Math.round((orig.h - ddy) / HALF_GRID_PX) * HALF_GRID_PX);
        b.y = orig.y + orig.h - newH;
        b.h = newH;
      }
      if (b.cells) b.cells = null;  // 리사이즈하면 비정형 형태 해제
    });
    render(); return;
  }

  // Drag to move
  // 배정논의 오버레이 드래그 & 리사이즈
  if (state.discussResizeHandle && state.selectedDiscussIds.size === 1) {
    const ddx = sx - state.discussResizeDragStartSX;
    const ddy = sy - state.discussResizeDragStartSY;
    const ov = state.discussOverlays.find(o => state.selectedDiscussIds.has(o.id));
    if (ov) {
      const newW = Math.max(HALF_GRID_PX, state.discussResizeOriginW + ddx / state.zoom);
      const newH = Math.max(HALF_GRID_PX, state.discussResizeOriginH + ddy / state.zoom);
      // half-grid snap
      ov.w = Math.round(newW / HALF_GRID_PX) * HALF_GRID_PX;
      ov.h = Math.round(newH / HALF_GRID_PX) * HALF_GRID_PX;
      render(); updateProps();
    }
    return;
  }

  if (state.discussDragReady) {
    const ddx = sx - state.discussDragStartSX, ddy = sy - state.discussDragStartSY;
    if (Math.abs(ddx) > 3 || Math.abs(ddy) > 3) {
      if (!state.discussDragging) { state.discussDragging = true; saveUndo(); }
      const wdx = ddx / state.zoom, wdy = ddy / state.zoom;
      state.discussOverlays.forEach(ov => {
        if (!state.selectedDiscussIds.has(ov.id)) return;
        const orig = state.discussDragOrigins.find(o => o.id === ov.id);
        if (orig) {
          const sx = Math.round((orig.x + wdx) / HALF_GRID_PX) * HALF_GRID_PX;
          const sy = Math.round((orig.y + wdy) / HALF_GRID_PX) * HALF_GRID_PX;
          ov.x = sx; ov.y = sy;
        }
      });
      render(); return;
    }
  }

  if (state.dragReady) {
    const ddx = sx - state.dragStartSX, ddy = sy - state.dragStartSY;
    if (Math.abs(ddx) > 3 || Math.abs(ddy) > 3) {
      if (state.locked) return;  // Prevent drag when locked
      if (!state.isDragging) { state.isDragging = true; saveUndo(); }
      const wdx = ddx / state.zoom, wdy = ddy / state.zoom;
      state.booths.forEach(b => {
        if (!state.selectedIds.has(b.id) || b.locked) return;
        const orig = state.dragBoothsOrigin.find(o => o.id === b.id);
        if (orig) {
          const nx = snapValue(orig.x + wdx), ny = snapValue(orig.y + wdy);
          const cdx = nx - orig.x, cdy = ny - orig.y;
          b.x = nx; b.y = ny;
          if (b.cells && orig.cells) {
            b.cells.forEach((cell, i) => { cell.x = orig.cells[i].x + cdx; cell.y = orig.cells[i].y + cdy; });
          }
        }
      });
      render(); return;
    }
  }

  // Alt drag clones
  if (state.isAltDragging) {
    const ddx = (sx - state.altDragOriginSX) / state.zoom;
    const ddy = (sy - state.altDragOriginSY) / state.zoom;
    state.altDragClones.forEach(b => {
      b.x = snapValue(b._originX + ddx);
      b.y = snapValue(b._originY + ddy);
    });
    render(); return;
  }

  // BaseNo preview
  if (state.isBaseDrawing) {
    const snapped = { x: snapValue(world.x), y: snapValue(world.y) };
    state.baseDrawCurrentX = snapped.x;
    state.baseDrawCurrentY = snapped.y;
    render(); return;
  }

  // 배정논의 드로우 프리뷰
  if (state.isDiscussDrawing) {
    const sx = Math.round(world.x / HALF_GRID_PX) * HALF_GRID_PX;
    const sy = Math.round(world.y / HALF_GRID_PX) * HALF_GRID_PX;
    state.discussDrawCurrentX = sx;
    state.discussDrawCurrentY = sy;
    render(); return;
  }

  // Marquee selection drag
  if (state.isMarquee) {
    state.marqueeEndX = world.x;
    state.marqueeEndY = world.y;
    render(); return;
  }

  // Wall preview follows cursor
  if (state.structMode === 'wall' && state.wallStart) {
    render(); return;
  }

  // 커서 모양: 핸들 위에서는 resize 커서
  if (state.mode === 'select' && state.selectedStructId && !state.structDragging && !state.structResizing) {
    const selS = state.structures.find(s => s.id === state.selectedStructId);
    if (selS && !selS.locked) {
      const h = getStructHandleAt(selS, world.x, world.y);
      const cursors = { nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize', n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize', p1:'crosshair', p2:'crosshair' };
      canvas.style.cursor = h ? (cursors[h.id] || 'crosshair') : '';
    } else {
      canvas.style.cursor = '';
    }
  }

  // 부스 리사이즈 핸들 커서
  if (state.mode === 'select' && state.selectedIds.size === 1 && !state.boothResizeHandle) {
    const selBooth = state.booths.find(b => state.selectedIds.has(b.id));
    if (selBooth) {
      const hitR = 7 / state.zoom;
      const bh = [
        { id: 'nw', x: selBooth.x,                  y: selBooth.y                  },
        { id: 'n',  x: selBooth.x + selBooth.w / 2, y: selBooth.y                  },
        { id: 'ne', x: selBooth.x + selBooth.w,     y: selBooth.y                  },
        { id: 'e',  x: selBooth.x + selBooth.w,     y: selBooth.y + selBooth.h / 2 },
        { id: 'se', x: selBooth.x + selBooth.w,     y: selBooth.y + selBooth.h     },
        { id: 's',  x: selBooth.x + selBooth.w / 2, y: selBooth.y + selBooth.h     },
        { id: 'sw', x: selBooth.x,                  y: selBooth.y + selBooth.h     },
        { id: 'w',  x: selBooth.x,                  y: selBooth.y + selBooth.h / 2 },
      ];
      const cursors = { nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize', n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize' };
      const hit = bh.find(h => Math.abs(world.x - h.x) <= hitR && Math.abs(world.y - h.y) <= hitR);
      canvas.style.cursor = hit ? cursors[hit.id] : '';
    }
  }

  const booth = getBoothAt(world.x, world.y);
  document.getElementById('boothInfo').textContent = booth
    ? `${booth.boothId || '(no ID)'}  ${booth.companyName ? booth.companyName + '  ' : ''}${pxToM(booth.w)}×${pxToM(booth.h)}m  ${booth.status}`
    : '';
});

canvas.addEventListener('mouseup', (e) => {
  if (VIEWER_MODE) {
    state.isPanning = false;
    container.classList.remove('panning');
    const dx = Math.abs(e.clientX - state._viewerClickStartX);
    const dy = Math.abs(e.clientY - state._viewerClickStartY);
    if (dx < 5 && dy < 5) {
      const _r = container.getBoundingClientRect();
      const world = screenToWorld(e.clientX - _r.left, e.clientY - _r.top);
      const hit = [...state.booths].reverse().find(b =>
        b.status !== 'excluded' &&
        world.x >= b.x && world.x <= b.x + b.w &&
        world.y >= b.y && world.y <= b.y + b.h
      );
      if (hit) {
        state.viewerHoverId = hit.id;
        showViewerPopup(hit, e.clientX, e.clientY);
      } else {
        closeViewerPopup();
      }
      render();
    }
    return;
  }

  const _upRect = container.getBoundingClientRect();
  const _upSx = e.clientX - _upRect.left, _upSy = e.clientY - _upRect.top;
  const world = screenToWorld(_upSx, _upSy);

  // Export region 완성
  if (state.exportRegionMode && state.exportRegionStart) {
    const s = state.exportRegionStart, c = world;
    const x = Math.min(s.x, c.x), y = Math.min(s.y, c.y);
    const w = Math.abs(c.x - s.x), h = Math.abs(c.y - s.y);
    if (w > 10 && h > 10) {
      state.exportRegion = { x, y, w, h };
    }
    state.exportRegionMode = false;
    state.exportRegionStart = null;
    state.exportRegionCurrent = null;
    hideStructHint();
    updateExportRegionUI();
    if ((state.bg.storageUrl || state.bg.dataUrl) && !state.bg.img) {
      alert('배경 이미지를 불러오는 중입니다.\n잠시 후 다시 시도해 주세요.');
    } else {
      openModal('modalExport');
    }
    render();
    return;
  }

  if (state.isPanning) {
    state.isPanning = false;
    container.classList.remove('panning');
    return;
  }

  // Struct resize end
  if (state.structResizing) {
    saveUndo();
    state.structResizing = false;
    state.structResizeHandle = null;
    render(); updateProps();
    return;
  }

  // Struct drag end
  if (state.structDragging) {
    saveUndo();
    state.structDragging = false;
    return;
  }

  // 실측 선 확정
  if (state.measureLineDrawStart) {
    // mouseup 시점: 축 제한 → 부스 엣지 교차 스냅 순서로 끝점 확정
    const constrained = constrainToAxis(state.measureLineDrawStart, { x: world.x, y: world.y });
    const end = snapEndAlongAxis(state.measureLineDrawStart, constrained);
    const dx = end.x - state.measureLineDrawStart.x;
    const dy = end.y - state.measureLineDrawStart.y;
    const len = Math.hypot(dx, dy);
    if (len >= 5) { // 최소 0.5m
      saveUndo();
      const line = {
        id: state.nextMeasureLineId++,
        x1: state.measureLineDrawStart.x, y1: state.measureLineDrawStart.y,
        x2: end.x, y2: end.y
      };
      state.measureLines.push(line);
      state.selectedMeasureLineId = line.id;
      scheduleSave();
    }
    state.measureLineDrawStart = null;
    state.measureLinePreviewEnd = null;
    render(); updateProps();
    return;
  }

  // Rect struct drawing end
  if (state.structMode === 'rect' && state.structDrawStart) {
    const snapped = { x: snapValue(world.x), y: snapValue(world.y) };
    const sx = state.structDrawStart.x, sy = state.structDrawStart.y;
    const x = Math.min(sx, snapped.x), y = Math.min(sy, snapped.y);
    const w = Math.abs(snapped.x - sx), h = Math.abs(snapped.y - sy);
    if (w > 2 && h > 2) {
      createStructure('rect', { x, y, w, h, fill: 'rgba(200,200,200,0.3)', stroke: '#666' });
    }
    state.structDrawStart = null;
    state.structDrawCurrent = null;
    render();
    return;
  }

  // Logo drag/resize end
  if (state.logoDragging || state.logoResizing) {
    if (state.logoDragging || state.logoResizing) saveUndo();
    state.logoDragging = false;
    state.logoResizing = false;
    state.logoResizeCorner = null;
    return;
  }

  // BG drag end
  if (state.bgDragging) {
    state.bgDragging = false;
    updateBgFineTuneInputs();
    scheduleSave();
    return;
  }

  if (state.isDrawing) {
    state.isDrawing = false;
    const dx = state.drawCurrentX - state.drawStartX;
    const dy = state.drawCurrentY - state.drawStartY;
    const x = dx >= 0 ? state.drawStartX : state.drawCurrentX;
    const y = dy >= 0 ? state.drawStartY : state.drawCurrentY;
    const w = Math.abs(dx), h = Math.abs(dy);
    const minSize = state.snap === 'grid' ? GRID_PX : (state.snap === 'half' ? HALF_GRID_PX : 5);
    if (w >= minSize && h >= minSize) {
      const booth = createBooth(x, y, w, h);
      state.selectedIds.clear();
      state.selectedIds.add(booth.id);
    }
    render(); updateProps(); return;
  }

  if (state.baseNoResizeHandle) {
    saveUndo(); scheduleSave();
    state.baseNoResizeHandle = null;
    render(); updateProps(); return;
  }
  if (state.baseNoDragging) {
    state.baseNoDragging = false;
    state.baseNoDragReady = false;
    scheduleSave();
    render(); updateProps(); return;
  }
  if (state.baseNoDragReady) { state.baseNoDragReady = false; }

  // Booth resize end
  if (state.boothResizeHandle) {
    saveUndo(); scheduleSave();
    state.boothResizeHandle = null;
    state.boothResizeOrigins = [];
    if (state.measureLines.length > 0) showMeasureAlert();
    render(); updateProps(); return;
  }

  // 배정논의 리사이즈 끝
  if (state.discussResizeHandle) {
    state.discussResizeHandle = null;
    saveUndo(); scheduleSave();
    render(); updateProps(); return;
  }

  // 배정논의 드래그 끝
  if (state.discussDragging) {
    state.discussDragging = false;
    state.discussDragReady = false;
    saveUndo(); scheduleSave();
    render(); updateProps(); return;
  }
  if (state.discussDragReady) { state.discussDragReady = false; }

  if (state.isDragging) {
    state.isDragging = false;
    state.dragReady = false;
    if (state.measureLines.length > 0) showMeasureAlert();
    render(); updateProps(); return;
  }
  if (state.dragReady) { state.dragReady = false; }

  if (state.isAltDragging) {
    state.isAltDragging = false;
    if (state.altDragClones.length) {
      const dx = state.altDragClones[0].x - state.altDragClones[0]._originX;
      const dy = state.altDragClones[0].y - state.altDragClones[0]._originY;
      saveUndo();
      const newBooths = state.altDragClones.map(b => ({
        id: state.nextId++, x: b.x, y: b.y, w: b.w, h: b.h,
        boothId: '', status: 'available', companyUid: '', companyName: '', companyNameEn: '', groupId: null, memo: '', elecSide: '', otherSide: ''
      }));
      state.booths.push(...newBooths);
      state.altDragClones = [];
      state.selectedIds.clear();
      newBooths.forEach(nb => state.selectedIds.add(nb.id));
      state.lastCopyOp = { dx, dy };
      updateRepeatBadge();
      if (state.measureLines.length > 0) showMeasureAlert();
      broadcastSelectionState(); // alt-drag 복사 후 새 선택
      render(); updateProps();
    }
  }

  // Marquee selection end
  if (state.isMarquee) {
    state.isMarquee = false;
    const mx = Math.min(state.marqueeStartX, state.marqueeEndX);
    const my = Math.min(state.marqueeStartY, state.marqueeEndY);
    const mw = Math.abs(state.marqueeEndX - state.marqueeStartX);
    const mh = Math.abs(state.marqueeEndY - state.marqueeStartY);
    if (mw > 2 || mh > 2) {
      // booth marquee selection (booth 레이어가 잠겨있으면 제외)
      if (!state.layerLocked['booth']) {
        state.booths.forEach(b => {
          const bx2 = b.x + b.w, by2 = b.y + b.h;
          if (b.x < mx + mw && bx2 > mx && b.y < my + mh && by2 > my) {
            state.selectedIds.add(b.id);
          }
        });
      }
      // BaseNo marquee selection (baseNo 레이어가 잠겨있으면 제외)
      if (!state.layerLocked['baseNo']) {
        state.baseNumbers.forEach(bn => {
          const bx2 = bn.x + bn.w, by2 = bn.y + bn.h;
          if (bn.x < mx + mw && bx2 > mx && bn.y < my + mh && by2 > my) {
            state.selectedBaseNoIds.add(bn.id);
          }
        });
      }
      // 배정논의 오버레이 marquee selection (discuss 레이어가 잠겨있으면 제외)
      if (!state.layerLocked['discuss']) {
        state.discussOverlays.forEach(ov => {
          const ox2 = ov.x + ov.w, oy2 = ov.y + ov.h;
          if (ov.x < mx + mw && ox2 > mx && ov.y < my + mh && oy2 > my) {
            state.selectedDiscussIds.add(ov.id);
          }
        });
      }
    }
    broadcastSelectionState(); // marquee 선택 완료
    render(); updateProps();
  }

  if (state.isDiscussDrawing) {
    state.isDiscussDrawing = false;
    const dx = state.discussDrawCurrentX - state.discussDrawStartX;
    const dy = state.discussDrawCurrentY - state.discussDrawStartY;
    const x = dx >= 0 ? state.discussDrawStartX : state.discussDrawCurrentX;
    const y = dy >= 0 ? state.discussDrawStartY : state.discussDrawCurrentY;
    const w = Math.abs(dx), h = Math.abs(dy);
    if (w >= HALF_GRID_PX && h >= HALF_GRID_PX) {
      const label = prompt('배정논의 라벨 (업체명 또는 메모):', '');
      if (label !== null) {
        saveUndo();
        const ov = { id: state.nextDiscussOverlayId++, x, y, w, h, label: label.trim(), groupId: null };
        state.discussOverlays.push(ov);
        state.selectedDiscussIds.clear();
        state.selectedDiscussIds.add(ov.id);
        scheduleSave(); render(); updateProps();
      }
    }
    render(); return;
  }

  if (state.isBaseDrawing) {
    state.isBaseDrawing = false;
    const dx = state.baseDrawCurrentX - state.baseDrawStartX;
    const dy = state.baseDrawCurrentY - state.baseDrawStartY;
    const x = dx >= 0 ? state.baseDrawStartX : state.baseDrawCurrentX;
    const y = dy >= 0 ? state.baseDrawStartY : state.baseDrawCurrentY;
    const w = Math.abs(dx), h = Math.abs(dy);
    const minSize = state.snap === 'grid' ? GRID_PX : (state.snap === 'half' ? HALF_GRID_PX : 5);
    if (w >= minSize && h >= minSize) {
      const bn = createBaseNumber(x, y, w, h);
      const newNo = prompt('기본부스번호 입력:', '');
      if (newNo !== null) {
        saveUndo();
        bn.baseNo = newNo.trim();
        scheduleSave(); render(); updateProps();
      }
    }
    render(); return;
  }
});

canvas.addEventListener('dblclick', (e) => {
  const rect = container.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);
  const booth = getBoothAt(world.x, world.y);
  if (!booth) return;
  const group = getBoothGroup(booth.id);
  if (group) {
    state.editingGroupId = group.id;
    state.selectedIds.clear();
    state.selectedIds.add(booth.id);
    let hint = document.getElementById('groupHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'groupHint';
      hint.className = 'group-hint';
      container.appendChild(hint);
    }
    hint.textContent = `Editing ${group.label} — click outside to exit`;
    hint.style.display = 'block';
    setTimeout(() => { if (hint) hint.style.display = 'none'; }, 2500);
    broadcastSelectionState();
    render(); updateProps();
  } else {
    const newId = prompt('Edit booth No.:', booth.boothId || '');
    if (newId !== null) { saveUndo(); booth.boothId = newId.trim(); render(); updateProps(); }
  }
});

// Zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = container.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const nz = Math.max(0.1, Math.min(10, state.zoom * delta));
  state.panX = sx - (sx - state.panX) * (nz / state.zoom);
  state.panY = sy - (sy - state.panY) * (nz / state.zoom);
  state.zoom = nz;
  if (VIEWER_MODE) {
    document.getElementById('viewerZoomDisplay').textContent = Math.round(nz * 100) + '%';
  } else {
    document.getElementById('zoomDisplay').textContent = Math.round(nz * 100) + '%';
  }
  render();
}, { passive: false });

// Keyboard
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);

  if (e.code === 'Space' && !e.repeat) {
    if (inInput) return; // input 포커스 중엔 pan 모드 무시
    spaceDown = true; container.classList.add('panning'); e.preventDefault(); return;
  }
  if (inInput) return; // 다른 단축키도 input 중엔 무시

  if (!ctrl && !e.altKey) {
    if (e.key === 'v' || e.key === 'V') setMode('select');
    if (e.key === 'b' || e.key === 'B') setMode('draw');
    if (e.key === 'n' || e.key === 'N') setMode('discuss');
    if (e.key === 'g' && !ctrl) setSnap('grid');
    if (e.key === 'h' && !ctrl) setSnap('half');
    if (e.key === 'f' && !ctrl) setSnap('free');
    if (e.key === 'Escape') {
      if (state.bgCalMode) { cancelCalibration(); return; }
      if (state.bgMoveMode) { state.bgMoveMode = false; document.getElementById('btnBgMove').classList.remove('active'); container.classList.remove('bg-move'); hideStructHint(); return; }
      if (state.exportRegionMode) { state.exportRegionMode = false; state.exportRegionStart = null; state.exportRegionCurrent = null; hideStructHint(); render(); return; }
      if (state.measureLineDrawStart) { state.measureLineDrawStart = null; state.measureLinePreviewEnd = null; render(); return; }
      if (state.structMode) { state.structMode = null; state.wallStart = null; state.structDrawStart = null; state.structDrawCurrent = null; clearStructButtons(); hideStructHint(); render(); return; }
      if (state.editingGroupId) { state.editingGroupId = null; render(); return; }
      if (state.lastCopyOp) { state.lastCopyOp = null; updateRepeatBadge(); return; }
      state.selectedIds.clear(); state.selectedBaseNoIds.clear(); broadcastSelectionState(); render(); updateProps();
    }
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement !== document.body) return;
    if (state.selectedMeasureLineId !== null) {
      saveUndo();
      state.measureLines = state.measureLines.filter(l => l.id !== state.selectedMeasureLineId);
      state.selectedMeasureLineId = null;
      scheduleSave(); render(); updateProps();
      return;
    }
    if (state.selectedDiscussIds.size) {
      saveUndo();
      const ids = new Set(state.selectedDiscussIds);
      state.discussOverlays = state.discussOverlays.filter(ov => !ids.has(ov.id));
      state.selectedDiscussIds.clear();
      broadcastSelectionState();
      scheduleSave(); render(); updateProps();
      return;
    }
    if (state.selectedBaseNoIds.size) {
      saveUndo();
      const ids = new Set(state.selectedBaseNoIds);
      state.baseNumbers = state.baseNumbers.filter(bn => !ids.has(bn.id));
      state.selectedBaseNoIds.clear();
      broadcastSelectionState();
      scheduleSave(); render(); updateProps();
      return;
    }
    if (state.selectedStructId) {
      saveUndo();
      state.structures = state.structures.filter(s => s.id !== state.selectedStructId);
      state.selectedStructId = null; render();
      return;
    }
    if (state.selectedLogoId) {
      deleteLogo(state.selectedLogoId);
      return;
    }
    if (state.selectedIds.size) {
      saveUndo();
      const ids = new Set(state.selectedIds);
      state.booths = state.booths.filter(b => !ids.has(b.id));
      state.groups.forEach(g => { g.boothIds = g.boothIds.filter(id => !ids.has(id)); });
      state.groups = state.groups.filter(g => g.boothIds.length > 0);
      state.selectedIds.clear();
      broadcastSelectionState();
      render(); updateProps();
    }
  }

  // ── 방향키 이동 (snap 모드 연동) ──
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    const hasSelection = state.selectedIds.size || state.selectedBaseNoIds.size || state.selectedStructId;
    if (!hasSelection) return;
    e.preventDefault();
    const step = state.snap === 'grid' ? GRID_PX : state.snap === 'half' ? HALF_GRID_PX : 0.5;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    saveUndo();
    // 일반 부스
    if (state.selectedIds.size) {
      for (const b of state.booths) {
        if (!state.selectedIds.has(b.id)) continue;
        b.x += dx; b.y += dy;
        if (b.cells) b.cells.forEach(c => { c.x += dx; c.y += dy; });
      }
    }
    // 기본부스번호
    if (state.selectedBaseNoIds.size) {
      for (const bn of state.baseNumbers) {
        if (state.selectedBaseNoIds.has(bn.id)) { bn.x += dx; bn.y += dy; }
      }
    }
    // 구조물
    if (state.selectedStructId) {
      const s = state.structures.find(s => s.id === state.selectedStructId);
      if (s) {
        if (s.type === 'column' || s.type === 'circle') {
          s.x += dx; s.y += dy;
        } else if (s.type === 'wall' || s.type === 'line' || s.type === 'arrow') {
          s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy;
        } else {
          s.x += dx; s.y += dy;
        }
      }
    }
    if (state.selectedIds.size > 0 && state.measureLines.length > 0) showMeasureAlert();
    scheduleSave(); render(); updateProps();
    return;
  }

  if (ctrl && e.key === 'm') { e.preventDefault(); mergeSelected(); }

  if (ctrl && !e.shiftKey && e.key === 'd') {
    e.preventDefault();
    if (state.selectedIds.size > 0 || state.selectedBaseNoIds.size > 0) {
      if (state.lastCopyOp) repeatLastCopy();
      else if (state.selectedIds.size > 0) openDivideDialog();
    }
  }

  if (e.key === 'Enter') { e.preventDefault(); if (state.selectedIds.size > 0 || state.selectedBaseNoIds.size > 0) openNumericCopyDialog(); }
  if (ctrl && !e.shiftKey && e.key === 'g') { e.preventDefault(); groupSelected(); }
  if (ctrl && e.shiftKey && e.key === 'G') { e.preventDefault(); ungroupSelected(); }
  if (ctrl && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (ctrl && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
  if (ctrl && e.key === '0') { e.preventDefault(); fitAll(); }
  if (ctrl && e.key === '1') { e.preventDefault(); state.zoom = 1; state.panX = 100; state.panY = 100; document.getElementById('zoomDisplay').textContent = '100%'; render(); }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { spaceDown = false; container.classList.remove('panning'); }
});

// ─── Touch Events (Viewer Mode) ───
let touchStartX = 0, touchStartY = 0;
let touchStartDistance = 0;
let isTouchDragging = false;

// 어드민 모드 터치 상태
let adminTouchStartX = 0, adminTouchStartY = 0;
let adminTouchStartDistance = 0;
let adminTouchDragging = false;
let adminWasPinching = false;

function getDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchMidpoint(touches) {
  let x = 0, y = 0;
  for (let t of touches) { x += t.clientX; y += t.clientY; }
  return { x: x / touches.length, y: y / touches.length };
}

canvas.addEventListener('touchstart', (e) => {
  if (!VIEWER_MODE) {
    // 어드민 모드: 패널/드로어 위 터치는 무시
    if (e.target.closest('#panelRight, #sidebarPanel, #mobileBackdrop')) return;
    e.preventDefault();
    adminTouchDragging = false;
    if (e.touches.length === 1) {
      adminTouchStartX = e.touches[0].clientX;
      adminTouchStartY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      adminWasPinching = true;
      adminTouchStartDistance = getDistance(e.touches[0], e.touches[1]);
    }
    return;
  }
  e.preventDefault();

  if (e.touches.length === 1) {
    // 한 손가락: 드래그 준비
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isTouchDragging = false;
  } else if (e.touches.length === 2) {
    // 두 손가락: 핀치줌 준비
    touchStartDistance = getDistance(e.touches[0], e.touches[1]);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!VIEWER_MODE) {
    if (e.target.closest('#panelRight, #sidebarPanel')) return;
    e.preventDefault();
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - adminTouchStartX;
      const dy = e.touches[0].clientY - adminTouchStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) adminTouchDragging = true;
      if (adminTouchDragging) {
        state.panX += dx; state.panY += dy;
        adminTouchStartX = e.touches[0].clientX;
        adminTouchStartY = e.touches[0].clientY;
        scheduleRenderForTouch();
      }
    } else if (e.touches.length === 2) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const distanceDelta = currentDistance - adminTouchStartDistance;
      const zoomFactor = 1 + distanceDelta * 0.005;
      const newZoom = Math.max(0.1, Math.min(state.zoom * zoomFactor, 10));
      const midpoint = getTouchMidpoint(e.touches);
      const rect = canvas.getBoundingClientRect();
      const canvasMidX = midpoint.x - rect.left;
      const canvasMidY = midpoint.y - rect.top;
      const zoomChange = newZoom / state.zoom;
      state.panX = canvasMidX - (canvasMidX - state.panX) * zoomChange;
      state.panY = canvasMidY - (canvasMidY - state.panY) * zoomChange;
      state.zoom = newZoom;
      adminTouchStartDistance = currentDistance;
      scheduleRenderForTouch();
    }
    return;
  }
  e.preventDefault();

  if (e.touches.length === 1) {
    // 한 손가락: 드래그
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isTouchDragging = true;
    }

    if (isTouchDragging) {
      state.panX += dx;
      state.panY += dy;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      scheduleRenderForTouch();
    }
  } else if (e.touches.length === 2) {
    // 두 손가락: 핀치줌
    const currentDistance = getDistance(e.touches[0], e.touches[1]);
    const distanceDelta = currentDistance - touchStartDistance;

    // 핀치줌 민감도 조정 (0.005 = 적당함)
    const zoomFactor = 1 + distanceDelta * 0.005;
    const newZoom = Math.max(0.1, Math.min(state.zoom * zoomFactor, 10));

    // 핀치 중심점을 기준으로 줌
    const midpoint = getTouchMidpoint(e.touches);
    const rect = canvas.getBoundingClientRect();
    const canvasMidX = midpoint.x - rect.left;
    const canvasMidY = midpoint.y - rect.top;

    // 줌 중심 유지
    const zoomChange = newZoom / state.zoom;
    state.panX = canvasMidX - (canvasMidX - state.panX) * zoomChange;
    state.panY = canvasMidY - (canvasMidY - state.panY) * zoomChange;

    state.zoom = newZoom;
    touchStartDistance = currentDistance;
    const vzd = document.getElementById('viewerZoomDisplay');
    if (vzd) vzd.textContent = Math.round(state.zoom * 100) + '%';
    scheduleRenderForTouch();
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (!VIEWER_MODE) {
    if (e.target.closest('#panelRight, #sidebarPanel')) return;
    // 탭 감지 → 부스 선택 (드래그·핀치가 없었을 때만)
    if (!adminTouchDragging && !adminWasPinching && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        clientX: t.clientX, clientY: t.clientY,
        bubbles: true, cancelable: true, button: 0, buttons: 1
      }));
      canvas.dispatchEvent(new MouseEvent('mouseup', {
        clientX: t.clientX, clientY: t.clientY,
        bubbles: true, cancelable: true, button: 0
      }));
      // 선택된 요소가 없으면 바텀시트 열지 않음
      const hasSelection = state.selectedIds.size > 0 ||
        state.selectedStructId !== null ||
        state.selectedBaseNoIds.size > 0 ||
        state.selectedDiscussIds.size > 0 ||
        state.selectedMeasureLineId !== null;
      if (!hasSelection && typeof closeMobileSheet === 'function') closeMobileSheet();
    }
    adminTouchDragging = false;
    if (e.touches.length === 0) adminWasPinching = false;
    if (e.touches.length < 2) adminTouchStartDistance = 0;
    return;
  }
  isTouchDragging = false;
  if (e.touches.length < 2) touchStartDistance = 0;
});

