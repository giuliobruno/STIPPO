const DEFAULT_APP_ORIGIN = "http://localhost:3000";

async function getAppOrigin() {
  const { appOrigin } = await chrome.storage.sync.get({
    appOrigin: DEFAULT_APP_ORIGIN,
  });
  return String(appOrigin || DEFAULT_APP_ORIGIN).replace(/\/$/, "");
}

async function ensureBridgeMatches(origin) {
  // Dynamically register bridge for custom deploy origins (beyond localhost).
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: "stippo-bridge",
        matches: [`${origin}/*`],
        js: ["bridge.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
  } catch {
    // Already registered or unsupported — ignore.
  }
}

async function startClip(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.id || !tab.url || tab.url.startsWith("chrome://")) {
    throw new Error("Cannot clip this page. Open a normal website tab.");
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["overlay.css"],
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["overlay.js"],
  });

  await chrome.tabs.sendMessage(tab.id, {
    type: "STIPPO_START_CLIP",
    screenshotDataUrl: dataUrl,
    pageUrl: tab.url,
    pageTitle: tab.title || "",
  });
}

chrome.action.onClicked.addListener((tab) => {
  // Popup is default; keep as fallback if popup disabled.
  if (tab?.id) void startClip(tab.id).catch(console.error);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "clip-region") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await startClip(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "STIPPO_CLIP_START_FROM_POPUP") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab?.id) throw new Error("No active tab");
        return startClip(tab.id);
      })
      .then(() => sendResponse({ ok: true }))
      .catch((err) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
      );
    return true;
  }

  if (message?.type === "STIPPO_CLIP_RESULT") {
    (async () => {
      const origin = await getAppOrigin();
      await ensureBridgeMatches(origin);

      const pendingClip = {
        dataUrl: message.dataUrl,
        sourceUrl: message.sourceUrl || sender.tab?.url || "",
        sourceTitle: message.sourceTitle || sender.tab?.title || "",
        note: message.note || "",
        clipRect: message.clipRect || null,
        createdAt: Date.now(),
      };

      await chrome.storage.session.set({ pendingClip });

      const captureUrl = new URL(`${origin}/app/capture`);
      captureUrl.searchParams.set("source", "extension");
      if (pendingClip.sourceUrl) {
        captureUrl.searchParams.set("sourceUrl", pendingClip.sourceUrl);
      }
      if (pendingClip.sourceTitle) {
        captureUrl.searchParams.set("sourceTitle", pendingClip.sourceTitle);
      }

      await chrome.tabs.create({ url: captureUrl.toString() });
      sendResponse({ ok: true });
    })().catch((err) => {
      console.error(err);
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return true;
  }

  if (message?.type === "STIPPO_GET_PENDING_CLIP") {
    chrome.storage.session.get("pendingClip").then((data) => {
      sendResponse({ pendingClip: data.pendingClip || null });
    });
    return true;
  }

  if (message?.type === "STIPPO_CLEAR_PENDING_CLIP") {
    chrome.storage.session.remove("pendingClip").then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});
