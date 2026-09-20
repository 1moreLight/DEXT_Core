(() => {
  const root = document.getElementById("icon-lab");
  const stage = document.getElementById("icon-stage");
  const showLabels = document.getElementById("show-labels");
  const showHitboxes = document.getElementById("show-hitboxes");
  const reduceMotion = document.getElementById("reduce-motion");
  const visualSize = document.getElementById("visual-size");
  const footprintSize = document.getElementById("footprint-size");
  const gapSize = document.getElementById("gap-size");
  const status = document.getElementById("lab-status");
  const profileName = document.getElementById("profile-name");
  const profileDetail = document.getElementById("profile-detail");
  const feedbackButtons = [...document.querySelectorAll("[data-feedback-style]")];
  const previewStateButtons = [...document.querySelectorAll("[data-preview-state]")];
  const spacingButtons = [...document.querySelectorAll("button[data-icon-spacing]")];
  const hitSizeButtons = [...document.querySelectorAll("button[data-icon-hit-size]")];
  const visualSizeButtons = [...document.querySelectorAll("button[data-icon-visual-size]")];
  const backgroundButtons = [...document.querySelectorAll("[data-background]")].filter((node) => node.tagName === "BUTTON");
  const icons = [...document.querySelectorAll(".lab-icon")];

  const PROFILES = {
    halo: ["图标光晕", "反馈只包围 56px 图标，名称保持干净。"],
    compact: ["紧凑内容框", "图标与单行名称形成不超过 88px 的内容表面。"],
    bare: ["纯净无边框", "只使用亮度与阴影表达可点击，不改变图标锚点。"],
  };

  const SPACING = {
    compact: { label: "COMPACT", gap: "4 × 12" },
    standard: { label: "STANDARD", gap: "20 × 28" },
    spacious: { label: "SPACIOUS", gap: "40 × 40" },
  };

  const HIT_SIZES = {
    small: { label: "SMALL", size: "72 × 80", hiddenSize: "64 × 64" },
    standard: { label: "STANDARD", size: "80 × 84", hiddenSize: "72 × 72" },
    large: { label: "LARGE", size: "84 × 88", hiddenSize: "80 × 80" },
  };

  const VISUAL_SIZES = {
    small: { label: "SMALL", pixels: 48 },
    standard: { label: "STANDARD", pixels: 56 },
    large: { label: "LARGE", pixels: 64 },
  };

  let preferences = {
    feedbackStyle: "halo",
    showLabels: true,
    hitTargetSize: "standard",
    visualSize: "standard",
  };
  const LONG_PRESS_MS = 300;
  const PRESS_MOVE_THRESHOLD = 8;
  let previewState = "interactive";
  let spacing = "standard";
  let activeIconLabel = icons.find((icon) => icon.dataset.previewActive === "true")
    ?.querySelector("[data-dext-icon-face]")?.getAttribute("aria-label") ?? "Hermes Studio";
  let interactiveEditing = false;
  let pendingPress = null;
  let activeDrag = null;
  let suppressNextClick = false;
  const controller = DextIconFeedback.createDesktopIconFeedbackController(root, {
    preferences,
    tooltipDelay: 500,
  });

  function renderStatus() {
    status.textContent = `${preferences.feedbackStyle.toUpperCase()} · ${previewState.toUpperCase()} · ${SPACING[spacing].label} · ICON ${VISUAL_SIZES[preferences.visualSize].label} · FRAME ${HIT_SIZES[preferences.hitTargetSize].label} · LABELS ${preferences.showLabels ? "ON" : "OFF"} · TARGET ${activeIconLabel.toUpperCase()}`;
  }

  function renderProfileDetail() {
    if (preferences.feedbackStyle === "halo") {
      profileDetail.textContent = `反馈只包围 ${VISUAL_SIZES[preferences.visualSize].pixels}px 图标，名称保持干净。`;
      return;
    }
    profileDetail.textContent = PROFILES[preferences.feedbackStyle][1];
  }

  function setFeedbackStyle(style) {
    preferences = controller.setPreferences({ ...preferences, feedbackStyle: style });
    feedbackButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.feedbackStyle === style)));
    profileName.textContent = PROFILES[style][0];
    renderProfileDetail();
    renderStatus();
  }

  function setPreviewState(state) {
    if (!previewStateButtons.some((button) => button.dataset.previewState === state)) return;
    cancelInteractiveGesture();
    previewState = state;
    interactiveEditing = false;
    root.dataset.interactiveEditing = "false";
    if (state === "interactive") {
      delete root.dataset.iconPreviewState;
      controller.setEditing(false);
      controller.setDragging(false);
    } else {
      root.dataset.iconPreviewState = state;
      controller.setEditing(state === "editing");
      controller.setDragging(state === "dragging");
    }
    icons.forEach((icon) => {
      icon.classList.toggle("is-dragging", state === "dragging" && icon.dataset.previewActive === "true");
    });
    previewStateButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.previewState === state));
    });
    renderStatus();
  }

  function setInteractiveEditing(active) {
    if (previewState !== "interactive") return;
    interactiveEditing = Boolean(active);
    root.dataset.interactiveEditing = String(interactiveEditing);
    controller.setEditing(interactiveEditing);
    if (!interactiveEditing) cancelInteractiveGesture();
  }

  function releasePointer(face, pointerId) {
    try {
      if (face?.hasPointerCapture?.(pointerId)) face.releasePointerCapture(pointerId);
    } catch {
      // A lost capture already restored the visual state.
    }
  }

  function clearPendingPress({ release = true } = {}) {
    if (!pendingPress) return;
    clearTimeout(pendingPress.timer);
    if (release) releasePointer(pendingPress.face, pendingPress.pointerId);
    pendingPress = null;
  }

  function finishDrag({ release = true } = {}) {
    if (!activeDrag) return;
    const { face, icon, pointerId } = activeDrag;
    activeDrag = null;
    icon.classList.remove("is-dragging");
    face.style.removeProperty("transform");
    if (!face.getAttribute("style")) face.removeAttribute("style");
    controller.setDragging(false);
    if (release) releasePointer(face, pointerId);
  }

  function cancelInteractiveGesture() {
    clearPendingPress();
    finishDrag();
    icons.forEach((icon) => {
      icon.classList.remove("is-dragging");
      const face = icon.querySelector("[data-dext-icon-face]");
      face?.style.removeProperty("transform");
      if (face && !face.getAttribute("style")) face.removeAttribute("style");
    });
    controller.setDragging(false);
  }

  function beginDrag(press, clientX = press.startX, clientY = press.startY) {
    clearTimeout(press.timer);
    pendingPress = null;
    activeDrag = {
      pointerId: press.pointerId,
      face: press.face,
      icon: press.icon,
      startX: press.startX,
      startY: press.startY,
    };
    press.icon.classList.add("is-dragging");
    controller.setDragging(true);
    updateDrag(clientX, clientY);
  }

  function updateDrag(clientX, clientY) {
    if (!activeDrag) return;
    const dx = clientX - activeDrag.startX;
    const dy = clientY - activeDrag.startY;
    activeDrag.face.style.transform = `translate(${dx}px, ${dy - 8}px) scale(1.06)`;
  }

  function onInteractivePointerDown(event) {
    if (previewState !== "interactive" || event.button !== 0 || event.isPrimary === false) return;
    const face = event.target.closest?.("[data-dext-icon-face]");
    if (!face || !root.contains(face)) return;
    const icon = face.closest(".lab-icon");
    if (!icon) return;

    suppressNextClick = false;
    cancelInteractiveGesture();
    const press = {
      pointerId: event.pointerId,
      face,
      icon,
      startX: event.clientX,
      startY: event.clientY,
      longPressed: interactiveEditing,
      timer: 0,
    };
    try { face.setPointerCapture(event.pointerId); } catch { /* capture is best effort */ }
    if (interactiveEditing) {
      beginDrag(press, event.clientX, event.clientY);
      return;
    }
    press.timer = setTimeout(() => {
      if (pendingPress !== press || previewState !== "interactive") return;
      press.longPressed = true;
      suppressNextClick = true;
      setInteractiveEditing(true);
    }, LONG_PRESS_MS);
    pendingPress = press;
  }

  function onInteractivePointerMove(event) {
    if (activeDrag?.pointerId === event.pointerId) {
      updateDrag(event.clientX, event.clientY);
      return;
    }
    if (!pendingPress || pendingPress.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pendingPress.startX, event.clientY - pendingPress.startY);
    if (pendingPress.longPressed && distance > 1) {
      suppressNextClick = true;
      beginDrag(pendingPress, event.clientX, event.clientY);
    } else if (!pendingPress.longPressed && distance > PRESS_MOVE_THRESHOLD) {
      suppressNextClick = true;
      clearPendingPress();
    }
  }

  function onInteractivePointerEnd(event, lostCapture = false) {
    if (activeDrag?.pointerId === event.pointerId) {
      suppressNextClick = true;
      finishDrag({ release: !lostCapture });
    }
    if (pendingPress?.pointerId === event.pointerId) {
      clearPendingPress({ release: !lostCapture });
    }
  }

  function setSpacing(value) {
    if (!SPACING[value]) return;
    spacing = value;
    root.dataset.iconSpacing = value;
    spacingButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.iconSpacing === value));
    });
    gapSize.textContent = `${SPACING[value].gap} gap`;
    renderStatus();
  }

  function renderFootprintSize() {
    const profile = HIT_SIZES[preferences.hitTargetSize];
    const size = preferences.showLabels ? profile.size : profile.hiddenSize;
    footprintSize.textContent = `${size} unified footprint`;
    icons.forEach((icon) => { icon.dataset.cellSize = size; });
  }

  function setHitTargetSize(value) {
    if (!HIT_SIZES[value]) return;
    preferences = controller.setPreferences({ ...preferences, hitTargetSize: value });
    hitSizeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.iconHitSize === value));
    });
    renderFootprintSize();
    renderStatus();
  }

  function setVisualSize(value) {
    if (!VISUAL_SIZES[value]) return;
    preferences = controller.setPreferences({ ...preferences, visualSize: value });
    visualSizeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.iconVisualSize === value));
    });
    visualSize.textContent = `${VISUAL_SIZES[value].pixels}px icon visual`;
    renderProfileDetail();
    renderStatus();
  }

  feedbackButtons.forEach((button) => {
    button.addEventListener("click", () => setFeedbackStyle(button.dataset.feedbackStyle));
  });

  previewStateButtons.forEach((button) => {
    button.addEventListener("click", () => setPreviewState(button.dataset.previewState));
  });

  spacingButtons.forEach((button) => {
    button.addEventListener("click", () => setSpacing(button.dataset.iconSpacing));
  });

  hitSizeButtons.forEach((button) => {
    button.addEventListener("click", () => setHitTargetSize(button.dataset.iconHitSize));
  });

  visualSizeButtons.forEach((button) => {
    button.addEventListener("click", () => setVisualSize(button.dataset.iconVisualSize));
  });

  backgroundButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stage.dataset.background = button.dataset.background;
      backgroundButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
  });

  showLabels.addEventListener("change", () => {
    preferences = controller.setPreferences({ ...preferences, showLabels: showLabels.checked });
    renderFootprintSize();
    renderStatus();
  });

  showHitboxes.addEventListener("change", () => {
    root.dataset.debugHitboxes = String(showHitboxes.checked);
  });

  reduceMotion.addEventListener("change", () => {
    root.dataset.reducedMotion = String(reduceMotion.checked);
  });

  root.addEventListener("pointerdown", onInteractivePointerDown);
  root.addEventListener("pointermove", onInteractivePointerMove);
  root.addEventListener("pointerup", (event) => onInteractivePointerEnd(event));
  root.addEventListener("pointercancel", (event) => onInteractivePointerEnd(event));
  root.addEventListener("lostpointercapture", (event) => onInteractivePointerEnd(event, true));

  stage.addEventListener("dblclick", (event) => {
    if (previewState !== "interactive" || event.target.closest?.("[data-dext-icon-face]")) return;
    setInteractiveEditing(false);
  });

  root.addEventListener("click", (event) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      return;
    }
    const face = event.target.closest?.("[data-dext-icon-face]");
    if (!face || !root.contains(face)) return;
    const icon = face.closest(".lab-icon");
    activeIconLabel = face.getAttribute("aria-label") || icon.dataset.iconId || "Icon";
    root.querySelectorAll(".lab-icon").forEach((node) => {
      node.dataset.selected = String(node === icon);
      node.dataset.previewActive = String(node === icon);
      node.classList.toggle("is-dragging", previewState === "dragging" && node === icon);
    });
    renderStatus();
  });

  setPreviewState("interactive");
  setSpacing("standard");
  setVisualSize("standard");
  setHitTargetSize("standard");
  renderStatus();
  window.iconLab = { ready: true, setPreviewState, setSpacing, setHitTargetSize, setVisualSize };
})();
