(() => {
  const root = document.getElementById("icon-lab");
  const stage = document.getElementById("icon-stage");
  const showLabels = document.getElementById("show-labels");
  const showHitboxes = document.getElementById("show-hitboxes");
  const editingMode = document.getElementById("editing-mode");
  const reduceMotion = document.getElementById("reduce-motion");
  const dragToggle = document.getElementById("drag-toggle");
  const status = document.getElementById("lab-status");
  const profileName = document.getElementById("profile-name");
  const profileDetail = document.getElementById("profile-detail");
  const feedbackButtons = [...document.querySelectorAll("[data-feedback-style]")];
  const backgroundButtons = [...document.querySelectorAll("[data-background]")].filter((node) => node.tagName === "BUTTON");
  const draggableIcon = document.querySelector('[data-icon-id="hermes"]');

  const PROFILES = {
    halo: ["图标光晕", "反馈只包围 56px 图标，名称保持干净。"],
    compact: ["紧凑内容框", "图标与单行名称形成不超过 88px 的内容表面。"],
    bare: ["纯净无边框", "只使用亮度、阴影和轻微缩放表达可点击。"],
  };

  let preferences = { feedbackStyle: "halo", showLabels: true };
  let dragging = false;
  const controller = DextIconFeedback.createDesktopIconFeedbackController(root, {
    preferences,
    tooltipDelay: 500,
  });

  function renderStatus() {
    status.textContent = `${preferences.feedbackStyle.toUpperCase()} · LABELS ${preferences.showLabels ? "ON" : "OFF"}${dragging ? " · DRAGGING" : ""}`;
  }

  function setFeedbackStyle(style) {
    preferences = controller.setPreferences({ ...preferences, feedbackStyle: style });
    feedbackButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.feedbackStyle === style)));
    profileName.textContent = PROFILES[style][0];
    profileDetail.textContent = PROFILES[style][1];
    renderStatus();
  }

  function setDragging(active) {
    dragging = Boolean(active);
    draggableIcon.classList.toggle("is-dragging", dragging);
    controller.setDragging(dragging);
    dragToggle.textContent = dragging ? "结束拖动" : "模拟拖动";
    renderStatus();
  }

  feedbackButtons.forEach((button) => {
    button.addEventListener("click", () => setFeedbackStyle(button.dataset.feedbackStyle));
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

  editingMode.addEventListener("change", () => {
    controller.setEditing(editingMode.checked);
  });

  reduceMotion.addEventListener("change", () => {
    root.dataset.reducedMotion = String(reduceMotion.checked);
  });

  dragToggle.addEventListener("click", () => setDragging(!dragging));

  root.addEventListener("click", (event) => {
    const face = event.target.closest?.("[data-dext-icon-face]");
    if (!face || !root.contains(face)) return;
    const icon = face.closest(".lab-icon");
    root.querySelectorAll(".lab-icon").forEach((node) => {
      node.dataset.selected = String(node === icon);
    });
  });

  renderStatus();
  window.iconLab = { ready: true };
})();
