(() => {
  const root = document.getElementById("icon-lab");
  const stage = document.getElementById("icon-stage");
  const showLabels = document.getElementById("show-labels");
  const showHitboxes = document.getElementById("show-hitboxes");
  const reduceMotion = document.getElementById("reduce-motion");
  const cellSize = document.getElementById("cell-size");
  const hitSize = document.getElementById("hit-size");
  const status = document.getElementById("lab-status");
  const profileName = document.getElementById("profile-name");
  const profileDetail = document.getElementById("profile-detail");
  const feedbackButtons = [...document.querySelectorAll("[data-feedback-style]")];
  const previewStateButtons = [...document.querySelectorAll("[data-preview-state]")];
  const spacingButtons = [...document.querySelectorAll("button[data-icon-spacing]")];
  const hitSizeButtons = [...document.querySelectorAll("button[data-icon-hit-size]")];
  const backgroundButtons = [...document.querySelectorAll("[data-background]")].filter((node) => node.tagName === "BUTTON");
  const icons = [...document.querySelectorAll(".lab-icon")];

  const PROFILES = {
    halo: ["图标光晕", "反馈只包围 56px 图标，名称保持干净。"],
    compact: ["紧凑内容框", "图标与单行名称形成不超过 88px 的内容表面。"],
    bare: ["纯净无边框", "只使用亮度与阴影表达可点击，不改变图标锚点。"],
  };

  const SPACING = {
    compact: { label: "COMPACT", cell: "88 × 100" },
    standard: { label: "STANDARD", cell: "100 × 112" },
    spacious: { label: "SPACIOUS", cell: "120 × 124" },
  };

  const HIT_SIZES = {
    small: { label: "SMALL", size: "72 × 80" },
    standard: { label: "STANDARD", size: "80 × 84" },
    large: { label: "LARGE", size: "84 × 88" },
  };

  let preferences = { feedbackStyle: "halo", showLabels: true, hitTargetSize: "standard" };
  let previewState = "normal";
  let spacing = "standard";
  const controller = DextIconFeedback.createDesktopIconFeedbackController(root, {
    preferences,
    tooltipDelay: 500,
  });

  function renderStatus() {
    status.textContent = `${preferences.feedbackStyle.toUpperCase()} · ${previewState.toUpperCase()} · ${SPACING[spacing].label} · HIT ${HIT_SIZES[preferences.hitTargetSize].label} · LABELS ${preferences.showLabels ? "ON" : "OFF"}`;
  }

  function setFeedbackStyle(style) {
    preferences = controller.setPreferences({ ...preferences, feedbackStyle: style });
    feedbackButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.feedbackStyle === style)));
    profileName.textContent = PROFILES[style][0];
    profileDetail.textContent = PROFILES[style][1];
    renderStatus();
  }

  function setPreviewState(state) {
    if (!previewStateButtons.some((button) => button.dataset.previewState === state)) return;
    previewState = state;
    root.dataset.iconPreviewState = state;
    controller.setEditing(state === "editing");
    controller.setDragging(state === "dragging");
    icons.forEach((icon) => {
      icon.classList.toggle("is-dragging", state === "dragging" && icon.dataset.previewActive === "true");
    });
    previewStateButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.previewState === state));
    });
    renderStatus();
  }

  function setSpacing(value) {
    if (!SPACING[value]) return;
    spacing = value;
    root.dataset.iconSpacing = value;
    spacingButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.iconSpacing === value));
    });
    const label = SPACING[value].cell;
    cellSize.textContent = `${label} layout cell`;
    icons.forEach((icon) => { icon.dataset.cellSize = label; });
    renderStatus();
  }

  function setHitTargetSize(value) {
    if (!HIT_SIZES[value]) return;
    preferences = controller.setPreferences({ ...preferences, hitTargetSize: value });
    hitSizeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.iconHitSize === value));
    });
    hitSize.textContent = `${HIT_SIZES[value].size} hit target`;
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

  backgroundButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stage.dataset.background = button.dataset.background;
      backgroundButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
  });

  showLabels.addEventListener("change", () => {
    preferences = controller.setPreferences({ ...preferences, showLabels: showLabels.checked });
    renderStatus();
  });

  showHitboxes.addEventListener("change", () => {
    root.dataset.debugHitboxes = String(showHitboxes.checked);
  });

  reduceMotion.addEventListener("change", () => {
    root.dataset.reducedMotion = String(reduceMotion.checked);
  });

  root.addEventListener("click", (event) => {
    const face = event.target.closest?.("[data-dext-icon-face]");
    if (!face || !root.contains(face)) return;
    const icon = face.closest(".lab-icon");
    root.querySelectorAll(".lab-icon").forEach((node) => {
      node.dataset.selected = String(node === icon);
      node.dataset.previewActive = String(node === icon);
      node.classList.toggle("is-dragging", previewState === "dragging" && node === icon);
    });
  });

  setPreviewState("normal");
  setSpacing("standard");
  setHitTargetSize("standard");
  renderStatus();
  window.iconLab = { ready: true, setPreviewState, setSpacing, setHitTargetSize };
})();
