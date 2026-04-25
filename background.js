// Developed by Ayyappa Yarlagadda | Version 1.5

const MAX_REQUESTS = 300;
let requestBodies = {}; // Temporary store for bodies

// Capture Request Body
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.requestBody) {
      let bodyStr = "";
      if (details.requestBody.raw && details.requestBody.raw[0]) {
        try {
          bodyStr = new TextDecoder("utf-8").decode(details.requestBody.raw[0].bytes);
        } catch(e) {}
      } else if (details.requestBody.formData) {
        bodyStr = new URLSearchParams(details.requestBody.formData).toString();
      }
      if (bodyStr) requestBodies[details.requestId] = bodyStr;
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Capture Headers and finalize request object
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    // Background just filters out the absolute noise. 
    // UI toggles will handle the rest live!
    const excludedTypes = ["stylesheet", "font", "image", "media", "ping"];
    if (excludedTypes.includes(details.type)) {
      delete requestBodies[details.requestId]; // cleanup memory
      return;
    }
    
    if (!details.url.startsWith("http") && !details.url.startsWith("ws")) {
      delete requestBodies[details.requestId];
      return;
    }

    chrome.storage.local.get(["networkRequests"], (result) => {
      let requests = result.networkRequests || [];
      
      let urlObj;
      try { urlObj = new URL(details.url); } catch (e) { return; }

      const initiatorUrl = details.initiator || "Unknown Origin";
      const pathOnly = urlObj.pathname + urlObj.search;
      
      const newRequest = {
        id: details.requestId + '-' + Date.now(),
        method: details.method || "GET",
        url: details.url,
        path: pathOnly,
        origin: urlObj.origin,
        initiator: initiatorUrl,
        type: details.type,
        timeStamp: Date.now(),
        headers: details.requestHeaders || [],
        body: requestBodies[details.requestId] || null
      };

      // Cleanup
      delete requestBodies[details.requestId];

      const isDuplicate = requests.some(r => r.url === newRequest.url && r.method === newRequest.method);
      if (!isDuplicate) {
        requests.unshift(newRequest);
        if (requests.length > MAX_REQUESTS) requests.pop();
        chrome.storage.local.set({ networkRequests: requests });
      }
    });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ networkRequests: [] });
  requestBodies = {};
});
