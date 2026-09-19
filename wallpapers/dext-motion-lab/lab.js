(() => {
  const stage = document.getElementById("motion-stage");
  const widget = document.getElementById("demo-widget");
  const dock = document.getElementById("demo-dock");
  const reorderPlaceholder = document.getElementById("reorder-placeholder");
  const reduceMotion = document.getElementById("reduce-motion");
  const editDone = document.getElementById("edit-done");
  const status = document.getElementById("motion-status");
  const detail = document.getElementById("motion-detail");
  const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ORIGIN_X = 24;
  const ORIGIN_Y = 24;
  const CELL_W = 92;
  const CELL_H = 108;
  const GRID = { cellWidth: CELL_W, cellHeight: CELL_H, columns: 11, rows: 5 };
  const COLORS = ["#9ef0c5", "#9fc5ff", "#f6c177", "#c4a7e7", "#eb8f8f", "#8bd5ca"];

  const baseIcons = [
    ["alpha", "A", 0, 0], ["bravo", "B", 1, 0], ["charlie", "C", 2, 0], ["golf", "G", 3, 0],
    ["delta", "D", 0, 1], ["echo", "E", 1, 1], ["foxtrot", "F", 2, 1], ["hotel", "H", 3, 1],
  ].map(([id, glyph, x, y], index) => ({
    id,
    label: id[0].toUpperCase() + id.slice(1),
    glyph,
    color: COLORS[index % COLORS.length],
    icon_png: "",
    launch: { target: `C:\\DextLab\\${id}.exe`, args: "", workdir: "C:\\DextLab" },
    x,
    y,
  }));

  let icons = cloneIcons(baseIcons);
  let pending = Promise.resolve();
  let scenarioToken = 0;
  let widgetDrag = null;
  let iconDrag = null;
  let widgetPress = null;
  let iconPress = null;
  let editMode = false;
  let previewActive = false;

  function cloneIcons(source) {
    return source.map((icon) => ({ ...icon, launch: { ...icon.launch } }));
  }

  function positionFor(icon, dense = false) {
    if (dense) return { left: ORIGIN_X + icon.x * 68, top: ORIGIN_Y + icon.y * 58 };
    return { left: ORIGIN_X + icon.x * CELL_W, top: ORIGIN_Y + icon.y * CELL_H };
  }

  function motionItems(source = icons, dense = false) {
    return DextLayoutMotionApi.createMotionItems(source, (icon) => positionFor(icon, dense));
  }

  function pointInside(clientX, clientY, rect) {
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function setDropZone(value = "idle") {
    stage.dataset.dropZone = value;
  }

  function showPlaceholder(target) {
    const position = positionFor(target);
    reorderPlaceholder.style.left = `${position.left}px`;
    reorderPlaceholder.style.top = `${position.top}px`;
    reorderPlaceholder.dataset.active = "true";
  }

  function hidePlaceholder() {
    reorderPlaceholder.dataset.active = "false";
  }

  function widgetObstacle() {
    return {
      x: widget.offsetLeft - ORIGIN_X,
      y: widget.offsetTop - ORIGIN_Y,
      width: widget.offsetWidth,
      height: widget.offsetHeight,
    };
  }

  function pointerTargetCell(event) {
    const rect = stage.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left - ORIGIN_X - 36) / CELL_W);
    const y = Math.round((event.clientY - rect.top - ORIGIN_Y - 42) / CELL_H);
    if (x < 0 || x >= GRID.columns || y < 0 || y >= GRID.rows) return null;
    return { x, y };
  }

  function updateDraggedFace(drag, event) {
    const rect = drag.node.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2 - 6;
    drag.face.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.06)`;
  }

  function clearDraggedFace(drag) {
    drag.node.classList.remove("is-dragging");
    drag.face.style.transform = "";
    hidePlaceholder();
    setDropZone();
  }

  function clearAllIconLifts() {
    for (const node of stage.querySelectorAll(".motion-icon.is-dragging")) {
      node.classList.remove("is-dragging");
      const face = node.querySelector(".motion-icon-face");
      if (face) face.style.transform = "";
    }
  }

  function createIconNode(item) {
    const node = document.createElement("div");
    node.className = "motion-icon";
    node.innerHTML = '<button type="button" class="motion-icon-face"><span class="glyph"></span><span class="label"></span></button>';
    const face = node.querySelector(".motion-icon-face");
    face.addEventListener("pointerdown", startIconPressOrDrag);
    face.addEventListener("pointermove", trackIconPress);
    face.addEventListener("pointerup", cancelIconPress);
    face.addEventListener("pointercancel", cancelIconPress);
    face.addEventListener("lostpointercapture", cancelIconPress);
    face.addEventListener("lostpointercapture", finishIconDrag);
    updateIconNode(node, item);
    return node;
  }

  function updateIconNode(node, item) {
    const icon = item.data;
    const face = node.querySelector(".motion-icon-face");
    node.dataset.iconId = icon.id;
    face.setAttribute("aria-label", `${icon.label} icon`);
    node.style.setProperty("--icon-accent", icon.color ?? COLORS[0]);
    node.querySelector(".glyph").textContent = icon.glyph ?? icon.label?.slice(0, 1) ?? "·";
    node.querySelector(".label").textContent = icon.label ?? icon.id;
  }

  function prefersReducedMotion() {
    return reduceMotion.checked || reducedMotionMedia.matches;
  }

  const motion = new DextLayoutMotion(stage, {
    createNode: createIconNode,
    updateNode: updateIconNode,
    reducedMotion: prefersReducedMotion,
  });

  function cancelMotion(options) {
    const result = motion.cancel(options);
    previewActive = false;
    return result;
  }

  function settleGestureBaseline() {
    cancelMotion({ restore: false });
  }

  function releasePointerCapture(element, pointerId) {
    try {
      if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    } catch (_error) {
      // The browser can release capture before reset reaches this cleanup path.
    }
  }

  function abortActiveInput({ restoreGesture = false } = {}) {
    const activeWidgetPress = widgetPress;
    const activeIconPress = iconPress;
    const activeWidgetDrag = widgetDrag;
    const activeIconDrag = iconDrag;

    widgetPress = null;
    iconPress = null;
    widgetDrag = null;
    iconDrag = null;

    if (activeWidgetPress) clearTimeout(activeWidgetPress.timer);
    if (activeIconPress) clearTimeout(activeIconPress.timer);
    if (activeIconDrag) clearDraggedFace(activeIconDrag);

    const activeDrag = activeIconDrag ?? activeWidgetDrag;
    if (restoreGesture && activeDrag) {
      cancelMotion({ restore: true });
      icons = cloneIcons(activeDrag.base);
      if (activeWidgetDrag) {
        widget.style.left = activeWidgetDrag.left;
        widget.style.top = activeWidgetDrag.top;
      }
    }

    releasePointerCapture(widget, activeWidgetPress?.pointerId ?? activeWidgetDrag?.pointerId);
    releasePointerCapture(activeIconDrag?.face, activeIconDrag?.pointerId);
    releasePointerCapture(activeIconPress?.face, activeIconPress?.pointerId);
  }

  function syncReducedMotion({ settle = false } = {}) {
    const reduced = prefersReducedMotion();
    document.body.classList.toggle("reduce-motion", reduced);
    if (!reduced || !settle) return;
    const mode = previewActive ? "preview" : "immediate";
    const result = motion.apply(motionItems(icons, stage.classList.contains("dense")), { mode });
    describe(result, "reduced motion");
  }

  function setNewHighlights(previousIds) {
    for (const node of stage.querySelectorAll(".motion-icon")) {
      node.dataset.newHighlight = String(!previousIds.has(node.dataset.iconId));
    }
  }

  function describe(result, label) {
    const nodeCount = stage.querySelectorAll(".motion-icon").length;
    status.textContent = `revision ${result.revision} · ${nodeCount} nodes · ${label}`;
    detail.textContent = result.immediate
      ? "Final coordinates applied immediately; semantic state remains visible."
      : `${result.diff.move.length} move · ${result.diff.enter.length} enter · ${result.diff.exit.length} exit`;
  }

  function apply(source, { mode = "auto", excludeKeys = [], dense = false, label = mode } = {}) {
    const previousIds = new Set(icons.map((icon) => icon.id));
    icons = cloneIcons(source);
    const result = motion.apply(motionItems(icons, dense), { mode, excludeKeys });
    previewActive = mode === "preview";
    setNewHighlights(previousIds);
    describe(result, label);
    return result;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function afterFrames(callback) {
    requestAnimationFrame(() => requestAnimationFrame(callback));
  }

  function track(work) {
    pending = Promise.resolve(work).catch((error) => {
      status.textContent = `degraded · ${error.message}`;
      detail.textContent = "The engine fell back without blocking the stage.";
    });
    return pending;
  }

  function reset({ keepRevision = false } = {}) {
    ++scenarioToken;
    abortActiveInput();
    stage.dataset.conflict = "false";
    setDropZone();
    hidePlaceholder();
    clearAllIconLifts();
    stage.classList.remove("dense");
    widget.style.left = "744px";
    widget.style.top = "368px";
    widget.style.width = "";
    widget.style.height = "";
    widget.classList.remove("is-compact");
    setEditing(false);
    const result = apply(baseIcons, { mode: "immediate", label: "reset" });
    if (!keepRevision) detail.textContent = "Stable nodes. Final coordinates land before motion begins.";
    return result;
  }

  function moved(...changes) {
    const next = cloneIcons(icons);
    for (const [id, x, y] of changes) {
      const icon = next.find((entry) => entry.id === id);
      if (icon) Object.assign(icon, { x, y });
    }
    return next;
  }

  function runScenario(name) {
    if (name !== "reset") abortActiveInput({ restoreGesture: true });
    clearAllIconLifts();
    hidePlaceholder();
    setDropZone();
    document.querySelectorAll("[data-scenario]").forEach((button) => {
      button.dataset.active = String(button.dataset.scenario === name);
    });
    stage.dataset.conflict = "false";
    const token = ++scenarioToken;

    if (name === "reset") {
      const result = reset();
      track(result.finished);
      return;
    }

    setEditing(true);

    if (name === "widget-single") {
      widget.classList.add("is-compact");
      widget.style.left = "18px";
      widget.style.top = "16px";
      afterFrames(() => {
        if (token !== scenarioToken) return;
        const result = apply(moved(["alpha", 0, 2]), { mode: "preview", label: "widget pushes one" });
        track(result.finished);
      });
      return;
    }

    if (name === "widget-multi") {
      widget.classList.remove("is-compact");
      widget.style.width = "";
      widget.style.height = "";
      widget.style.left = "18px";
      widget.style.top = "16px";
      afterFrames(() => {
        if (token !== scenarioToken) return;
        const result = apply(moved(["alpha", 0, 2], ["bravo", 1, 2], ["delta", 0, 3], ["echo", 1, 3]), {
          mode: "preview",
          label: "widget pushes four",
        });
        track(result.finished);
      });
      return;
    }

    if (name === "zigzag") {
      const sequence = async () => {
        const first = apply(moved(["alpha", 2, 2]), { mode: "preview", label: "rapid 1/3" });
        await sleep(52);
        if (token !== scenarioToken) return;
        const second = apply(moved(["alpha", 0, 3]), { mode: "preview", label: "rapid 2/3" });
        await sleep(52);
        if (token !== scenarioToken) return;
        const third = apply(moved(["alpha", 4, 2]), { mode: "preview", label: "rapid 3/3" });
        await Promise.all([first.finished, second.finished, third.finished]);
      };
      track(sequence());
      return;
    }

    if (name === "icon-reorder") {
      const solved = DextLayout.resolveIconReorder(icons, 0, { x: 2, y: 0 }, GRID, [widgetObstacle()]);
      if (!solved.committed) return;
      const node = stage.querySelector('[data-icon-id="alpha"]');
      const face = node?.querySelector(".motion-icon-face");
      if (node && face) {
        node.classList.add("is-dragging");
        face.style.transform = "translate3d(0, -8px, 0) scale(1.06)";
      }
      showPlaceholder({ x: 2, y: 0 });
      const draggedKey = motionItems(solved.icons).find((item) => item.data.id === "alpha")?.key;
      const preview = apply(solved.icons, {
        mode: "preview",
        excludeKeys: draggedKey ? [draggedKey] : [],
        label: "reorder path preview",
      });
      track((async () => {
        await preview.finished;
        await sleep(320);
        if (token !== scenarioToken) return;
        const committed = apply(solved.icons, { label: "reorder path committed" });
        node?.classList.remove("is-dragging");
        if (face) face.style.transform = "";
        hidePlaceholder();
        await committed.finished;
      })());
      return;
    }

    if (name === "add") {
      const next = cloneIcons(icons);
      if (!next.some((icon) => icon.id === "india")) {
        next.push({
          id: "india", label: "India", glyph: "I", color: COLORS[2], icon_png: "",
          launch: { target: "C:\\DextLab\\india.exe", args: "", workdir: "C:\\DextLab" }, x: 4, y: 1,
        });
      }
      const result = apply(next, { label: "add icon" });
      track(result.finished);
      return;
    }

    if (name === "remove") {
      const result = apply(icons.filter((icon) => icon.id !== "hotel"), { label: "remove icon" });
      track(result.finished);
      return;
    }

    if (name === "remove-reenter") {
      const original = cloneIcons(icons);
      const sequence = async () => {
        const leaving = apply(icons.filter((icon) => icon.id !== "india"), { label: "exit interrupted" });
        await sleep(58);
        if (token !== scenarioToken) return;
        const returning = apply(original, { label: "re-enter current revision" });
        await Promise.all([leaving.finished, returning.finished]);
      };
      track(sequence());
      return;
    }

    if (name === "cancel") {
      const result = apply(moved(["alpha", 4, 3], ["bravo", 5, 3]), { mode: "preview", label: "preview before cancel" });
      track((async () => {
        await sleep(70);
        if (token !== scenarioToken) return;
        const rollback = cancelMotion({ restore: true });
        if (rollback) {
          icons = cloneIcons(baseIcons);
          describe(rollback, "cancel restored");
          await rollback.finished;
        }
        await result.finished;
      })());
      return;
    }

    if (name === "no-space") {
      widget.classList.remove("is-compact");
      widget.style.left = "18px";
      widget.style.top = "16px";
      widget.style.width = "820px";
      widget.style.height = "510px";
      const result = apply(moved(["alpha", 6, 3], ["bravo", 7, 3], ["charlie", 8, 3]), {
        mode: "preview",
        label: "checking capacity",
      });
      track((async () => {
        await sleep(72);
        if (token !== scenarioToken) return;
        stage.dataset.conflict = "true";
        const rollback = cancelMotion({ restore: true });
        if (rollback) {
          icons = cloneIcons(baseIcons);
          describe(rollback, "no legal layout · rollback");
          await rollback.finished;
        }
        await result.finished;
      })());
      return;
    }

    if (name === "stress") {
      stage.classList.add("dense");
      const hundred = Array.from({ length: 100 }, (_, index) => ({
        id: `stress-${index + 1}`,
        label: `${index + 1}`,
        glyph: String((index % 9) + 1),
        color: COLORS[index % COLORS.length],
        icon_png: "",
        launch: { target: `C:\\DextLab\\stress-${index + 1}.exe`, args: "", workdir: "C:\\DextLab" },
        x: index % 10,
        y: Math.floor(index / 10),
      }));
      const entered = apply(hundred, { dense: true, label: "100 nodes entering" });
      track((async () => {
        await sleep(48);
        if (token !== scenarioToken) return;
        const shifted = hundred.map((icon) => ({ ...icon, x: (icon.x + 1) % 10 }));
        const movedResult = apply(shifted, { dense: true, label: "100 nodes pressure pass" });
        await Promise.all([entered.finished, movedResult.finished]);
        describe(movedResult, "100 nodes stable");
      })());
    }
  }

  function startWidgetDrag(event) {
    if (event.button !== 0) return;
    settleGestureBaseline();
    const rect = widget.getBoundingClientRect();
    widgetDrag = {
      pointerId: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      base: cloneIcons(icons),
      preview: null,
      left: widget.style.left,
      top: widget.style.top,
    };
    widget.setPointerCapture(event.pointerId);
  }

  function setEditing(next) {
    editMode = Boolean(next);
    document.body.classList.toggle("editing", editMode);
    stage.dataset.editing = String(editMode);
    editDone.hidden = !editMode;
    if (editMode) detail.textContent = "Edit mode · inner icons jiggle while the outer positioner owns layout motion.";
  }

  function startWidgetPressOrDrag(event) {
    if (event.button !== 0) return;
    if (editMode) {
      startWidgetDrag(event);
      return;
    }
    widgetPress = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        widgetPress = null;
        setEditing(true);
      }, 500),
    };
    widget.setPointerCapture(event.pointerId);
  }

  function trackWidgetPress(event) {
    if (widgetPress && event.pointerId === widgetPress.pointerId
      && Math.hypot(event.clientX - widgetPress.x, event.clientY - widgetPress.y) > 8) {
      clearTimeout(widgetPress.timer);
      widgetPress = null;
    }
    moveWidget(event);
  }

  function cancelWidgetPress(event) {
    if (!widgetPress || event.pointerId !== widgetPress.pointerId) return;
    clearTimeout(widgetPress.timer);
    widgetPress = null;
  }

  function moveWidget(event) {
    if (!widgetDrag || event.pointerId !== widgetDrag.pointerId) return;
    const stageRect = stage.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    let left = Math.max(0, Math.min(stageRect.width - widget.offsetWidth, event.clientX - stageRect.left - widgetDrag.dx));
    let top = Math.max(0, Math.min(stageRect.height - widget.offsetHeight, event.clientY - stageRect.top - widgetDrag.dy));
    const dockLeft = dockRect.left - stageRect.left;
    const dockRight = dockRect.right - stageRect.left;
    const dockTop = dockRect.top - stageRect.top;
    const overlapsDockHorizontally = left < dockRight && left + widget.offsetWidth > dockLeft;
    if (overlapsDockHorizontally && top + widget.offsetHeight > dockTop - 8) {
      top = Math.max(0, dockTop - widget.offsetHeight - 8);
      setDropZone("blocked");
    } else {
      setDropZone();
    }
    widget.style.left = `${left}px`;
    widget.style.top = `${top}px`;
    const solved = DextLayout.resolveWidgetIconAvoidance(
      widgetDrag.base,
      [{ x: left - ORIGIN_X, y: top - ORIGIN_Y, width: widget.offsetWidth, height: widget.offsetHeight }],
      GRID,
    );
    stage.dataset.conflict = String(!solved.committed);
    if (solved.committed) {
      widgetDrag.preview = solved.icons;
      const result = apply(solved.icons, { mode: "preview", label: `live Widget preview · ${solved.moved.length} moved` });
      track(result.finished);
    }
  }

  function finishWidgetDrag(event) {
    if (!widgetDrag || event.pointerId !== widgetDrag.pointerId) return;
    const drag = widgetDrag;
    widgetDrag = null;
    setDropZone();
    const canceled = event.type !== "pointerup";
    if (!canceled && drag.preview && stage.dataset.conflict !== "true") {
      const result = apply(drag.preview, { label: "Widget layout committed" });
      track(result.finished);
    } else {
      const rollback = cancelMotion({ restore: true });
      icons = cloneIcons(drag.base);
      widget.style.left = drag.left;
      widget.style.top = drag.top;
      stage.dataset.conflict = "false";
      if (rollback) track(rollback.finished);
    }
  }

  function startIconDrag(event) {
    if (event.button !== 0) return;
    const slot = event.currentTarget.closest(".motion-icon");
    const id = slot?.dataset.iconId;
    const index = icons.findIndex((icon) => icon.id === id);
    if (index < 0 || !slot) return;
    settleGestureBaseline();
    iconDrag = {
      pointerId: event.pointerId,
      id,
      index,
      base: cloneIcons(icons),
      preview: null,
      targetKey: null,
      valid: true,
      node: slot,
      face: event.currentTarget,
    };
    slot.classList.add("is-dragging");
    showPlaceholder(icons[index]);
    setDropZone("valid");
    updateDraggedFace(iconDrag, event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startIconPressOrDrag(event) {
    if (event.button !== 0) return;
    if (editMode) {
      startIconDrag(event);
      return;
    }
    iconPress = {
      pointerId: event.pointerId,
      face: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        iconPress = null;
        setEditing(true);
      }, 500),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function trackIconPress(event) {
    if (iconPress && event.pointerId === iconPress.pointerId
      && Math.hypot(event.clientX - iconPress.x, event.clientY - iconPress.y) > 8) {
      clearTimeout(iconPress.timer);
      iconPress = null;
    }
  }

  function cancelIconPress(event) {
    if (!iconPress || event.pointerId !== iconPress.pointerId) return;
    clearTimeout(iconPress.timer);
    iconPress = null;
  }

  function restoreIconPathPreview(drag, event) {
    if (!drag.preview) return;
    drag.preview = null;
    const draggedKey = motionItems(drag.base).find((item) => item.data.id === drag.id)?.key;
    const result = apply(drag.base, {
      mode: "preview",
      excludeKeys: draggedKey ? [draggedKey] : [],
      label: "reorder target blocked",
    });
    updateDraggedFace(drag, event);
    track(result.finished);
  }

  function moveIcon(event) {
    if (!iconDrag || event.pointerId !== iconDrag.pointerId) return;
    const drag = iconDrag;
    updateDraggedFace(drag, event);
    const dockRect = dock.getBoundingClientRect();
    const widgetRect = widget.getBoundingClientRect();
    const target = pointerTargetCell(event);
    if (!target || pointInside(event.clientX, event.clientY, dockRect)
      || pointInside(event.clientX, event.clientY, widgetRect)) {
      drag.valid = false;
      drag.targetKey = null;
      restoreIconPathPreview(drag, event);
      hidePlaceholder();
      setDropZone("blocked");
      return;
    }
    const targetKey = `${target.x}:${target.y}`;
    if (drag.valid && drag.targetKey === targetKey) return;
    const solved = DextLayout.resolveIconReorder(drag.base, drag.index, target, GRID, [widgetObstacle()]);
    if (!solved.committed) {
      drag.valid = false;
      drag.targetKey = null;
      restoreIconPathPreview(drag, event);
      hidePlaceholder();
      setDropZone("blocked");
      return;
    }
    drag.valid = true;
    drag.targetKey = targetKey;
    drag.preview = solved.icons;
    showPlaceholder(target);
    setDropZone("valid");
    const draggedKey = motionItems(solved.icons).find((item) => item.data.id === drag.id)?.key;
    const result = apply(solved.icons, {
      mode: "preview",
      excludeKeys: draggedKey ? [draggedKey] : [],
      label: `reorder preview · ${solved.moved.length} moved`,
    });
    updateDraggedFace(drag, event);
    track(result.finished);
  }

  function finishIconDrag(event) {
    if (!iconDrag || event.pointerId !== iconDrag.pointerId) return;
    const drag = iconDrag;
    iconDrag = null;
    const canceled = event.type !== "pointerup";
    if (!canceled && drag.preview && drag.valid) {
      const result = apply(drag.preview, { label: "icon reorder committed" });
      track(result.finished);
    } else {
      const rollback = cancelMotion({ restore: true });
      icons = cloneIcons(drag.base);
      if (rollback) {
        describe(rollback, canceled ? "icon drag canceled" : "icon drag restored");
        track(rollback.finished);
      }
    }
    clearDraggedFace(drag);
  }

  widget.addEventListener("pointerdown", startWidgetPressOrDrag);
  widget.addEventListener("pointermove", trackWidgetPress);
  widget.addEventListener("pointerup", cancelWidgetPress);
  widget.addEventListener("pointerup", finishWidgetDrag);
  widget.addEventListener("pointercancel", cancelWidgetPress);
  widget.addEventListener("pointercancel", finishWidgetDrag);
  widget.addEventListener("lostpointercapture", cancelWidgetPress);
  widget.addEventListener("lostpointercapture", finishWidgetDrag);
  stage.addEventListener("pointermove", moveIcon);
  stage.addEventListener("pointerup", finishIconDrag);
  stage.addEventListener("pointercancel", finishIconDrag);
  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => runScenario(button.dataset.scenario));
  });
  editDone.addEventListener("click", () => setEditing(false));
  reduceMotion.addEventListener("change", () => syncReducedMotion({ settle: true }));
  reducedMotionMedia.addEventListener?.("change", () => syncReducedMotion({ settle: true }));
  syncReducedMotion();

  const initial = motion.apply(motionItems(icons), { mode: "initial" });
  for (const node of stage.querySelectorAll(".motion-icon")) node.dataset.newHighlight = "true";
  describe(initial, "ready");

  window.motionLab = {
    ready: true,
    runScenario,
    async waitForIdle() {
      await pending;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
  };
})();
