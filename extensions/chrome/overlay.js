(() => {
  if (window.__stippoClipOverlayActive) return;
  window.__stippoClipOverlayActive = true;

  let root = null;
  let start = null;
  let box = null;
  let screenshotDataUrl = "";
  let pageUrl = location.href;
  let pageTitle = document.title;
  let natural = { w: 0, h: 0 };

  function cleanup() {
    window.__stippoClipOverlayActive = false;
    root?.remove();
    root = null;
    chrome.runtime.onMessage.removeListener(onMessage);
  }

  function normalize(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    return { x, y, width, height };
  }

  async function finish(rectCss) {
    if (!rectCss || rectCss.width < 4 || rectCss.height < 4) {
      cleanup();
      return;
    }

    const img = await loadImage(screenshotDataUrl);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scaleX = img.naturalWidth / vw;
    const scaleY = img.naturalHeight / vh;

    const sx = Math.max(0, Math.round(rectCss.x * scaleX));
    const sy = Math.max(0, Math.round(rectCss.y * scaleY));
    const sw = Math.max(1, Math.round(rectCss.width * scaleX));
    const sh = Math.max(1, Math.round(rectCss.height * scaleY));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = canvas.toDataURL("image/png");

    chrome.runtime.sendMessage(
      {
        type: "STIPPO_CLIP_RESULT",
        dataUrl,
        sourceUrl: pageUrl,
        sourceTitle: pageTitle,
        clipRect: {
          x: sx,
          y: sy,
          width: sw,
          height: sh,
          imageWidth: img.naturalWidth,
          imageHeight: img.naturalHeight,
        },
      },
      () => cleanup()
    );
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function mount(payload) {
    root?.remove();
    root = null;
    start = null;
    window.__stippoClipOverlayActive = true;
    screenshotDataUrl = payload.screenshotDataUrl;
    pageUrl = payload.pageUrl || location.href;
    pageTitle = payload.pageTitle || document.title;

    root = document.createElement("div");
    root.id = "stippo-clip-root";
    root.innerHTML = `
      <div class="stippo-clip-banner">
        <span>Drag to clip for Stippo · Esc cancel</span>
        <button type="button" class="stippo-clip-cancel">Cancel</button>
      </div>
      <div class="stippo-clip-shade"></div>
      <div class="stippo-clip-box" hidden></div>
    `;
    document.documentElement.appendChild(root);

    box = root.querySelector(".stippo-clip-box");
    root.querySelector(".stippo-clip-cancel").addEventListener("click", cleanup);

    const shade = root.querySelector(".stippo-clip-shade");

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    };
    window.addEventListener("keydown", onKey, { once: true });

    shade.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY };
      box.hidden = false;
      box.style.left = `${start.x}px`;
      box.style.top = `${start.y}px`;
      box.style.width = "0px";
      box.style.height = "0px";
      shade.setPointerCapture(e.pointerId);
    });

    shade.addEventListener("pointermove", (e) => {
      if (!start) return;
      const r = normalize(start, { x: e.clientX, y: e.clientY });
      box.style.left = `${r.x}px`;
      box.style.top = `${r.y}px`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
    });

    shade.addEventListener("pointerup", (e) => {
      if (!start) return;
      const r = normalize(start, { x: e.clientX, y: e.clientY });
      start = null;
      void finish(r);
    });

    // Preload dimensions
    void loadImage(screenshotDataUrl).then((img) => {
      natural = { w: img.naturalWidth, h: img.naturalHeight };
    });
  }

  function onMessage(message) {
    if (message?.type === "STIPPO_START_CLIP") {
      mount(message);
    }
  }

  chrome.runtime.onMessage.addListener(onMessage);
})();
