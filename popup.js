// Developed by Ayyappa Yarlagadda | Version 1.5

document.addEventListener("DOMContentLoaded", () => {
  const requestList = document.getElementById("requestList");
  const exportBtn = document.getElementById("exportBtn");
  const clearBtn = document.getElementById("clearBtn");
  const selectAllCheckbox = document.getElementById("selectAll");
  const toggleAPI = document.getElementById("toggleAPI");
  const toggleJS = document.getElementById("toggleJS");
  const searchInput = document.getElementById("searchInput");
  const countBadge = document.getElementById("countBadge");

  let currentRequests = [];
  let filteredRequests = [];
  let deselectedIds = new Set();
  let lastViewedTime = 0;

  chrome.storage.local.get(["networkRequests", "apiOnlyUI", "filterJSUI", "lastViewedTime"], (result) => {
    currentRequests = result.networkRequests || [];
    lastViewedTime = result.lastViewedTime || 0;
    
    toggleAPI.checked = !!result.apiOnlyUI;
    toggleJS.checked = !!result.filterJSUI;
    
    applyFilters();
    chrome.storage.local.set({ lastViewedTime: Date.now() });
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.networkRequests) {
      currentRequests = changes.networkRequests.newValue || [];
      applyFilters();
    }
  });

  // UI Filter Listeners
  toggleAPI.addEventListener("change", (e) => {
    chrome.storage.local.set({ apiOnlyUI: e.target.checked });
    applyFilters();
  });
  toggleJS.addEventListener("change", (e) => {
    chrome.storage.local.set({ filterJSUI: e.target.checked });
    applyFilters();
  });
  searchInput.addEventListener("input", applyFilters);

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const isApiOnly = toggleAPI.checked;
    const isFilterJs = toggleJS.checked;

    filteredRequests = currentRequests.filter(req => {
      // Live Toggles
      if (isApiOnly && req.type !== "xmlhttprequest") return false;
      if (isFilterJs && req.type === "script") return false;
      
      // Live Search
      if (searchTerm) {
        return req.url.toLowerCase().includes(searchTerm) || 
               req.method.toLowerCase().includes(searchTerm);
      }
      return true;
    });

    renderList();
  }

  function generateCurl(req) {
    let curl = `curl '${req.url}' \n  -X ${req.method}`;
    req.headers.forEach(h => {
        let val = h.value.replace(/'/g, "'\\''");
        curl += ` \n  -H '${h.name}: ${val}'`;
    });
    if (req.body) {
        let body = req.body.replace(/'/g, "'\\''");
        curl += ` \n  --data-raw '${body}'`;
    }
    return curl;
  }

  function renderList() {
    requestList.innerHTML = "";
    countBadge.innerText = filteredRequests.length;

    if (filteredRequests.length === 0) {
      requestList.innerHTML = "<li class='empty'>No endpoints match your filters.</li>";
      selectAllCheckbox.disabled = true;
      return;
    }

    selectAllCheckbox.disabled = false;
    const allChecked = filteredRequests.every(req => !deselectedIds.has(req.id));
    selectAllCheckbox.checked = allChecked;

    filteredRequests.forEach((req) => {
      const isNew = req.timeStamp > lastViewedTime;
      const isChecked = !deselectedIds.has(req.id);
      
      const li = document.createElement("li");
      li.className = `request-item ${isNew ? 'new-req' : 'old-req'}`;
      
      const methodClass = req.method.toLowerCase();
      
      // Format headers for display
      const headersStr = req.headers.map(h => `<b>${h.name}:</b> ${h.value}`).join("<br>");
      const bodyStr = req.body ? `<div class="req-body-box"><b>Body:</b><pre>${req.body}</pre></div>` : "";
      
      li.innerHTML = `
        <div class="req-summary">
          <label class="checkbox-container item-checkbox">
            <input type="checkbox" class="req-checkbox" data-id="${req.id}" ${isChecked ? "checked" : ""}>
            <span class="checkmark"></span>
          </label>
          <div class="request-details">
            <div class="req-top">
              <span class="method-badge ${methodClass}">${req.method}</span>
              <span class="req-path" title="${req.url}">${req.path || "/"}</span>
              ${isNew ? '<span class="new-badge">NEW</span>' : ''}
            </div>
            <div class="req-bottom">
              <span class="req-dir" title="Origin: ${req.initiator}">📁 ${req.initiator}</span>
            </div>
          </div>
        </div>
        <div class="req-expanded" style="display: none;">
          <div class="req-headers-box">${headersStr}</div>
          ${bodyStr}
          <div class="expanded-actions">
            <button class="btn btn-secondary curl-btn" data-curl="">Copy as cURL (bash)</button>
          </div>
        </div>
      `;
      
      // Store curl data safely
      li.querySelector('.curl-btn').dataset.curl = generateCurl(req);
      requestList.appendChild(li);
    });

    // Expand/Collapse logic
    document.querySelectorAll(".req-summary").forEach(summary => {
      summary.addEventListener("click", (e) => {
        // Prevent toggle if clicking checkbox
        if (e.target.tagName.toLowerCase() === 'input' || e.target.classList.contains('checkmark')) return;
        const expanded = summary.nextElementSibling;
        expanded.style.display = expanded.style.display === "none" ? "block" : "none";
      });
    });

    // Copy cURL logic
    document.querySelectorAll(".curl-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        navigator.clipboard.writeText(e.target.dataset.curl);
        const originalText = e.target.innerText;
        e.target.innerText = "✓ Copied!";
        e.target.style.background = "#0cbb52";
        e.target.style.color = "white";
        setTimeout(() => {
          e.target.innerText = originalText;
          e.target.style.background = "";
          e.target.style.color = "";
        }, 1500);
      });
    });

    // Checkbox state tracking
    document.querySelectorAll(".req-checkbox").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const reqId = e.target.getAttribute("data-id");
        if (e.target.checked) deselectedIds.delete(reqId);
        else deselectedIds.add(reqId);
        
        const allCheckedNow = Array.from(document.querySelectorAll(".req-checkbox")).every(c => c.checked);
        selectAllCheckbox.checked = allCheckedNow;
      });
    });
  }

  selectAllCheckbox.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll(".req-checkbox").forEach(cb => {
      cb.checked = isChecked;
      const reqId = cb.getAttribute("data-id");
      if (isChecked) deselectedIds.delete(reqId);
      else deselectedIds.add(reqId);
    });
  });

  function generateHAR(selectedRequests) {
    const entries = selectedRequests.map(req => {
      let mimeType = "application/json";
      if (req.type === "script") mimeType = "application/javascript";
      else if (req.type === "main_frame" || req.type === "sub_frame") mimeType = "text/html";
      else if (req.type !== "xmlhttprequest") mimeType = "text/plain";

      return {
        startedDateTime: new Date(req.timeStamp).toISOString(),
        request: {
          method: req.method,
          url: req.url,
          httpVersion: "HTTP/1.1",
          headers: req.headers.map(h => ({ name: h.name, value: h.value })),
          queryString: [], 
          postData: req.body ? { mimeType: "text/plain", text: req.body } : undefined,
          cookies: [],
          headersSize: -1,
          bodySize: req.body ? req.body.length : -1
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [],
          content: { size: 0, mimeType: mimeType },
          headersSize: -1,
          bodySize: -1
        },
        cache: {},
        timings: { send: 0, wait: 0, receive: 0 },
        time: 0
      };
    });

    return JSON.stringify({
      log: {
        version: "1.2",
        creator: { name: "Pro API Exporter", version: "1.5" },
        entries: entries
      }
    }, null, 2);
  }

  exportBtn.addEventListener("click", () => {
    // Only export currently filtered requests that are checked
    const selectedRequests = filteredRequests.filter(req => !deselectedIds.has(req.id));
    if (selectedRequests.length === 0) return alert("Please select at least one endpoint!");
    
    const harData = generateHAR(selectedRequests);
    const blob = new Blob([harData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: `endpoints-export-${new Date().getTime()}.har`,
      saveAs: true
    });
  });

  clearBtn.addEventListener("click", () => {
    deselectedIds.clear();
    chrome.storage.local.set({ networkRequests: [], lastViewedTime: Date.now() });
  });
});