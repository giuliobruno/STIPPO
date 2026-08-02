/**
 * Injects a pending Chrome-extension clip into the Stippo capture page.
 * CaptureForm listens for window message type STIPPO_PENDING_CLIP.
 */
(function bridgePendingClip() {
  const path = location.pathname || "";
  if (!path.includes("/app/capture")) return;

  chrome.runtime.sendMessage({ type: "STIPPO_GET_PENDING_CLIP" }, (response) => {
    const clip = response?.pendingClip;
    if (!clip?.dataUrl) return;

    const payload = {
      type: "STIPPO_PENDING_CLIP",
      dataUrl: clip.dataUrl,
      sourceUrl: clip.sourceUrl || "",
      sourceTitle: clip.sourceTitle || "",
      note: clip.note || "",
      clipRect: clip.clipRect || null,
    };

    window.postMessage(payload, "*");

    // Also stash in IndexedDB for React hydration races
    try {
      const req = indexedDB.open("stippo-clip", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("pending")) {
          db.createObjectStore("pending");
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("pending", "readwrite");
        tx.objectStore("pending").put(payload, "clip");
        tx.oncomplete = () => {
          db.close();
          window.postMessage(payload, "*");
        };
      };
    } catch {
      // ignore
    }

    chrome.runtime.sendMessage({ type: "STIPPO_CLEAR_PENDING_CLIP" });
  });
})();
