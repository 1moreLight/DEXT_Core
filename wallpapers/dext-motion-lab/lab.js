(() => {
  const stage = document.getElementById("motion-stage");
  const widget = document.getElementById("demo-widget");
  const reduceMotion = document.getElementById("reduce-motion");
  const status = document.getElementById("motion-status");
  const detail = document.getElementById("motion-detail");
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

  function createIconNode(item) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "motion-icon";
    node.innerHTML = '<span class="glyph"></span><span class="label"></span>';
    node.addEventListener("pointerdown", startIconDrag);
    updateIconNode(node, item);
    return node;
  }

  function updateIconNode(node, item) {
    const icon = item.data;
    node.dataset.iconId = icon.id;
    node.setAttribute("aria-label", `${icon.label} icon`);
    node.style.setProperty("--icon-accent", icon.color ?? COLORS[0]);
    node.querySelector(".glyph").textContent = icon.glyph ?? icon.label?.slice(0, 1) ?? "·";
    node.querySelector(".label").textContent = icon.label ?? icon.id;
  }

  const motion = new DextLayoutMotion(stage, {
    createNode: createIconNode,
    updateNode: updateIconNode,
    reducedMotion: () => reduceMotion.checked,
  });

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
    stage.dataset.conflict = "false";
    stage.classList.remove("dense");
    widget.style.left = "744px";
    widget.style.top = "368px";
    widget.style.width = "";
    widget.style.height = "";
    widget.classList.remove("is-compact");
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
        const second = apply(moved(["alpha", 0, 3]), { mode: "preview", label: "rapid 2/3" });
        await sleep(52);
        const third = apply(moved(["alpha", 4, 2]), { mode: "preview", label: "rapid 3/3" });
        await Promise.all([first.finished, second.finished, third.finished]);
      };
      track(sequence());
      return;
    }

    if (name === "icon-swap") {
      track((async () => {
        await sleep(80);
        if (token !== scenarioToken) return;
        const result = apply(moved(["alpha", 1, 0], ["bravo", 0, 0]), { mode: "preview", label: "stable-cell swap" });
        await result.finished;
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
        const rollback = motion.cancel({ restore: true });
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
        stage.dataset.conflict = "true";
        const rollback = motion.cancel({ restore: true });
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
        const shifted = hundred.map((icon) => ({ ...icon, x: (icon.x + 1) % 10 }));
        const movedResult = apply(shifted, { dense: true, label: "100 nodes pressure pass" });
        await Promise.all([entered.finished, movedResult.finished]);
        describe(movedResult, "100 nodes stable");
      })());
    }
  }

  function startWidgetDrag(event) {
    if (event.button !== 0) return;
    const rect = widget.getBoundingClientRect();
    widgetDrag = {
      pointerId: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      base: cloneIcons(icons),
      preview: null,
    };
    widget.setPointerCapture(event.pointerId);
  }

  function moveWidget(event) {
    if (!widgetDrag || event.pointerId !== widgetDrag.pointerId) return;
    const stageRect = stage.getBoundingClientRect();
    const left = Math.max(0, Math.min(stageRect.width - widget.offsetWidth, event.clientX - stageRect.left - widgetDrag.dx));
    const top = Math.max(0, Math.min(stageRect.height - widget.offsetHeight, event.clientY - stageRect.top - widgetDrag.dy));
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
    if (widgetDrag.preview && stage.dataset.conflict !== "true") {
      const result = apply(widgetDrag.preview, { label: "Widget layout committed" });
      track(result.finished);
    } else {
      const rollback = motion.cancel({ restore: true });
      icons = cloneIcons(widgetDrag.base);
      if (rollback) track(rollback.finished);
    }
    widgetDrag = null;
  }

  function startIconDrag(event) {
    if (event.button !== 0) return;
    const id = event.currentTarget.dataset.iconId;
    const source = icons.find((icon) => icon.id === id);
    if (!source) return;
    iconDrag = { pointerId: event.pointerId, id, base: cloneIcons(icons), targetId: null, timer: null, preview: null };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveIcon(event) {
    if (!iconDrag || event.pointerId !== iconDrag.pointerId) return;
    const underPointer = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".motion-icon");
    const targetId = underPointer?.dataset.iconId;
    if (!targetId || targetId === iconDrag.id) return;
    if (iconDrag.targetId === targetId) return;
    iconDrag.targetId = targetId;
    clearTimeout(iconDrag.timer);
    iconDrag.timer = setTimeout(() => {
      const next = cloneIcons(iconDrag.base);
      const source = next.find((icon) => icon.id === iconDrag.id);
      const target = next.find((icon) => icon.id === targetId);
      if (!source || !target) return;
      [source.x, target.x] = [target.x, source.x];
      [source.y, target.y] = [target.y, source.y];
      iconDrag.preview = next;
      const draggedKey = motionItems(next).find((item) => item.data.id === source.id)?.key;
      const result = apply(next, { mode: "preview", excludeKeys: draggedKey ? [draggedKey] : [], label: "80ms icon swap preview" });
      track(result.finished);
    }, 80);
  }

  function finishIconDrag(event) {
    if (!iconDrag || event.pointerId !== iconDrag.pointerId) return;
    clearTimeout(iconDrag.timer);
    if (iconDrag.preview) {
      const result = apply(iconDrag.preview, { label: "icon swap committed" });
      track(result.finished);
    } else {
      const rollback = motion.cancel({ restore: true });
      icons = cloneIcons(iconDrag.base);
      if (rollback) track(rollback.finished);
    }
    iconDrag = null;
  }

  widget.addEventListener("pointerdown", startWidgetDrag);
  widget.addEventListener("pointermove", moveWidget);
  widget.addEventListener("pointerup", finishWidgetDrag);
  widget.addEventListener("pointercancel", finishWidgetDrag);
  stage.addEventListener("pointermove", moveIcon);
  stage.addEventListener("pointerup", finishIconDrag);
  stage.addEventListener("pointercancel", finishIconDrag);
  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => runScenario(button.dataset.scenario));
  });

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
