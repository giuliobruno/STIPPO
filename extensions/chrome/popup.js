const originInput = document.getElementById("origin");
const statusEl = document.getElementById("status");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

chrome.storage.sync.get({ appOrigin: "http://localhost:3000" }, (data) => {
  originInput.value = data.appOrigin || "http://localhost:3000";
});

document.getElementById("save").addEventListener("click", () => {
  const appOrigin = originInput.value.trim().replace(/\/$/, "") || "http://localhost:3000";
  chrome.storage.sync.set({ appOrigin }, () => {
    setStatus(`Saved ${appOrigin}`);
  });
});

document.getElementById("clip").addEventListener("click", () => {
  const appOrigin = originInput.value.trim().replace(/\/$/, "") || "http://localhost:3000";
  chrome.storage.sync.set({ appOrigin }, () => {
    setStatus("Starting clip…");
    chrome.runtime.sendMessage({ type: "STIPPO_CLIP_START_FROM_POPUP" }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, true);
        return;
      }
      if (!response?.ok) {
        setStatus(response?.error || "Clip failed", true);
        return;
      }
      setStatus("Draw a region on the page…");
      window.close();
    });
  });
});
