const testCasesCount = 6;

// Nested state: state[hwId].questions[qId] = { code, codeName, tests: {1..5} }
let state = {};
let tabCount = 0;
let currentTabId = 0;

let worker;
let messageCallbacks = {};
let messageId = 0;

function initWorker() {
    worker = new Worker("pyodide_worker.js");
    worker.onmessage = (event) => {
        const { id, success, pyodideLoaded, result, error } = event.data;
        if (pyodideLoaded) {
            console.log("Pyodide Engine Loaded.");
            return;
        }
        if (messageCallbacks[id]) {
            messageCallbacks[id](success ? { result } : { error });
            delete messageCallbacks[id];
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initWorker();

    document.getElementById('add-tab-btn').addEventListener('click', () => {
        addNewTab();
    });

    // Dark Mode init
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    let isDark = localStorage.getItem('theme') === 'dark';

    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.className = 'bi bi-sun-fill text-warning';
    }

    themeBtn.addEventListener('click', () => {
        isDark = !isDark;
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeIcon.className = 'bi bi-sun-fill text-warning';
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeIcon.className = 'bi bi-moon-stars-fill';
        }
    });

    // Initialize first tab HW0
    addNewTab();
});

// ─── HW TABS ─────────────────────────────────────────────────────────────────

function addNewTab(forceHwId = null) {
    const hwId = forceHwId !== null ? forceHwId : tabCount;
    if (hwId >= tabCount) tabCount = hwId + 1;
    const tabName = `HW${hwId}`;

    state[hwId] = { questionCount: 0, questions: {} };

    renderTabLink(hwId, tabName);
    renderTabContent(hwId);

    // Add the first question Q1 by default (only when not force-creating for folder upload)
    if (forceHwId === null) {
        addQuestion(hwId);
    }

    switchTab(hwId);
    return hwId;
}

function renderTabLink(hwId, tabName) {
    const tabsContainer = document.getElementById("hw-tabs");
    const addBtnContainer = document.getElementById("add-tab-container");

    const li = document.createElement('li');
    li.className = 'nav-item position-relative';
    li.role = 'presentation';
    li.id = `tab-${hwId}-li`;

    li.innerHTML = `
        <button class="nav-link pe-4" id="tab-${hwId}-link" data-bs-toggle="tab" data-bs-target="#tab-${hwId}-pane" type="button" role="tab" aria-controls="tab-${hwId}-pane" aria-selected="false">
            <i class="bi bi-folder2-open me-2"></i>${tabName}
        </button>
        <span class="tab-close-btn" onclick="event.stopPropagation(); deleteTab(${hwId})" title="Close Tab">&times;</span>
    `;

    tabsContainer.insertBefore(li, addBtnContainer);
}

function renderTabContent(hwId) {
    const contentContainer = document.getElementById("tab-content-container");

    const pane = document.createElement('div');
    pane.className = 'tab-pane fade';
    pane.id = `tab-${hwId}-pane`;
    pane.role = 'tabpanel';
    pane.setAttribute('aria-labelledby', `tab-${hwId}-link`);

    pane.innerHTML = `
        <div class="pt-2">
            <!-- Question Subtab Nav -->
            <ul class="nav nav-pills subtab-pills mb-4 d-flex align-items-center flex-wrap gap-2" id="q-tabs-${hwId}" role="tablist">
                <!-- Q tabs generated dynamically -->
                <li class="nav-item" role="presentation" id="add-q-container-${hwId}">
                    <button class="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center" onclick="addQuestion(${hwId})" title="Add Question" style="width: 28px; height: 28px;">
                        <i class="bi bi-plus"></i>
                    </button>
                </li>
            </ul>

            <!-- Question Content Panes -->
            <div class="tab-content" id="q-content-${hwId}">
                <!-- Q panes generated dynamically -->
            </div>
        </div>
    `;

    contentContainer.appendChild(pane);
}

function switchTab(hwId) {
    const tabTriggerEl = document.querySelector(`#tab-${hwId}-link`);
    if (tabTriggerEl) {
        let tab = new bootstrap.Tab(tabTriggerEl);
        tab.show();
        currentTabId = hwId;
    }
}

function deleteTab(hwId) {
    // Count remaining HW tabs
    const remainingTabs = Object.keys(state);
    if (remainingTabs.length <= 1) {
        alert("Cannot delete the last homework tab.");
        return;
    }
    if (!confirm(`Delete HW${hwId} and all its questions? This cannot be undone.`)) return;

    // Remove DOM
    const li = document.getElementById(`tab-${hwId}-li`);
    const pane = document.getElementById(`tab-${hwId}-pane`);

    // Remove associated modals
    if (state[hwId]) {
        for (let qId in state[hwId].questions) {
            for (let t = 1; t <= testCasesCount; t++) {
                const modal = document.getElementById(`diffModal-${hwId}-${qId}-${t}`);
                if (modal) modal.remove();
            }
        }
    }

    if (li) li.remove();
    if (pane) pane.remove();

    // Clean state
    delete state[hwId];

    // Switch to another existing tab
    const remaining = Object.keys(state);
    if (remaining.length > 0) {
        switchTab(parseInt(remaining[0]));
    }
}

// ─── QUESTION SUBTABS ────────────────────────────────────────────────────────

function addQuestion(hwId, forceQId = null) {
    const qId = forceQId !== null ? forceQId : state[hwId].questionCount;
    if (qId >= state[hwId].questionCount) state[hwId].questionCount = qId + 1;
    const qName = `Q${qId + 1}`;

    state[hwId].questions[qId] = { code: null, codeName: null, tests: {} };
    for (let t = 1; t <= testCasesCount; t++) {
        state[hwId].questions[qId].tests[t] = { input: null, inputName: null, expected: null, expectedName: null };
    }

    renderQuestionTabLink(hwId, qId, qName);
    renderQuestionContent(hwId, qId);
    setupDragAndDropForQuestion(hwId, qId);
    switchQuestion(hwId, qId);
    return qId;
}

function renderQuestionTabLink(hwId, qId, qName) {
    const qTabsContainer = document.getElementById(`q-tabs-${hwId}`);
    const addQContainer = document.getElementById(`add-q-container-${hwId}`);

    const li = document.createElement('li');
    li.className = 'nav-item position-relative';
    li.role = 'presentation';
    li.id = `q-tab-${hwId}-${qId}-li`;

    li.innerHTML = `
        <button class="nav-link subtab-link pe-4" id="q-tab-${hwId}-${qId}-link" data-bs-toggle="pill" data-bs-target="#q-pane-${hwId}-${qId}" type="button" role="tab">
            <i class="bi bi-question-circle me-1"></i>${qName}
        </button>
        <span class="subtab-close-btn" onclick="event.stopPropagation(); deleteQuestion(${hwId}, ${qId})" title="Close Question">&times;</span>
    `;

    qTabsContainer.insertBefore(li, addQContainer);
}

function deleteQuestion(hwId, qId) {
    const remainingQuestions = Object.keys(state[hwId].questions);
    if (remainingQuestions.length <= 1) {
        alert("Cannot delete the last question. Delete the homework tab instead.");
        return;
    }
    if (!confirm(`Delete Q${qId + 1}? This cannot be undone.`)) return;

    // Remove modals
    for (let t = 1; t <= testCasesCount; t++) {
        const modal = document.getElementById(`diffModal-${hwId}-${qId}-${t}`);
        if (modal) modal.remove();
    }

    // Remove DOM
    const li = document.getElementById(`q-tab-${hwId}-${qId}-li`);
    const pane = document.getElementById(`q-pane-${hwId}-${qId}`);
    if (li) li.remove();
    if (pane) pane.remove();

    // Clean state
    delete state[hwId].questions[qId];

    // Switch to another existing question
    const remaining = Object.keys(state[hwId].questions);
    if (remaining.length > 0) {
        switchQuestion(hwId, parseInt(remaining[0]));
    }
}

function renderQuestionContent(hwId, qId) {
    const qContentContainer = document.getElementById(`q-content-${hwId}`);
    const modalsContainer = document.getElementById("modals-container");

    const pane = document.createElement('div');
    pane.className = 'tab-pane fade';
    pane.id = `q-pane-${hwId}-${qId}`;
    pane.role = 'tabpanel';
    pane.setAttribute('aria-labelledby', `q-tab-${hwId}-${qId}-link`);

    let html = `
        <div class="row">
            <!-- Code Upload -->
            <div class="col-12 mb-4">
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-primary text-white d-flex align-items-center py-3">
                        <div class="bg-white text-primary rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 40px; height: 40px;">
                            <i class="bi bi-filetype-py fs-4"></i>
                        </div>
                        <div>
                            <h5 class="card-title mb-0 fw-bold">Python Code</h5>
                            <small class="text-white text-opacity-75">Upload .py for HW${hwId} · Q${qId + 1}</small>
                        </div>
                    </div>
                    <div class="card-body bg-white p-4">
                        <input type="file" id="file-code-${hwId}-${qId}" accept=".py" style="display:none;" onchange="handleFileInput(this, 'code', ${hwId}, null, ${qId})">
                        <div id="code-drop-area-${hwId}-${qId}" class="drop-area mb-2 fs-5 p-5 text-secondary" onclick="document.getElementById('file-code-${hwId}-${qId}').click()">
                            <div>
                                <i class="bi bi-cloud-arrow-up display-4 d-block mb-3 text-primary opacity-50"></i>
                                <span class="fw-semibold">Drag & Drop Python Code (.py)</span><br>
                                <span class="fs-6 fw-normal opacity-75">or Click to Browse</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="d-flex align-items-center mb-4 text-secondary">
                    <hr class="flex-grow-1 opacity-25">
                    <h5 class="mx-3 mb-0 fw-bold"><i class="bi bi-list-check me-2"></i>Test Cases</h5>
                    <hr class="flex-grow-1 opacity-25">
                </div>
    `;

    let modalsHtml = "";

    for (let t = 1; t <= testCasesCount; t++) {
        html += `
            <div class="card mb-3 shadow-sm border-0 bg-transparent overflow-visible">
                <div class="card-body bg-white rounded p-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="card-title mb-0 text-primary fw-bold text-uppercase" style="letter-spacing: 1px; font-size: 0.85rem;">Test Case ${t}</h6>
                    </div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <input type="file" id="file-input-${hwId}-${qId}-${t}" accept=".txt" style="display:none;" onchange="handleFileInput(this, 'input', ${hwId}, ${t}, ${qId})">
                            <div id="input-drop-area-${hwId}-${qId}-${t}" class="drop-area p-3 text-secondary h-100 small" onclick="document.getElementById('file-input-${hwId}-${qId}-${t}').click()">
                                <div><i class="bi bi-file-earmark-text fs-4 mb-1 d-block"></i> Input File<br><code class="text-muted" style="font-size: 0.7rem;">hw${hwId}q${qId + 1}in${t}</code></div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <input type="file" id="file-expected-${hwId}-${qId}-${t}" accept=".txt" style="display:none;" onchange="handleFileInput(this, 'expected', ${hwId}, ${t}, ${qId})">
                            <div id="expected-drop-area-${hwId}-${qId}-${t}" class="drop-area p-3 text-secondary h-100 small" onclick="document.getElementById('file-expected-${hwId}-${qId}-${t}').click()">
                                <div><i class="bi bi-file-earmark-check fs-4 mb-1 d-block"></i> Expected File<br><code class="text-muted" style="font-size: 0.7rem;">hw${hwId}q${qId + 1}out${t}</code></div>
                            </div>
                        </div>
                    </div>
                    <div id="diff-result-${hwId}-${qId}-${t}" class="result mt-2 py-3 px-4 bg-light rounded d-flex justify-content-between align-items-center border-0 shadow-sm">
                        <div class="d-flex align-items-center">
                            <div class="bg-white border rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 32px; height: 32px;">
                                <i class="bi bi-activity text-secondary"></i>
                            </div>
                            <div>
                                <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px;">Result</small>
                                <span id="diff-status-${hwId}-${qId}-${t}" class="fw-bold text-dark" style="font-size: 1.05rem;">Not Run</span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-3 fw-semibold shadow-sm" data-bs-toggle="modal" data-bs-target="#diffModal-${hwId}-${qId}-${t}">
                            <i class="bi bi-eye me-1"></i> View Diff
                        </button>
                    </div>
                </div>
            </div>
        `;

        modalsHtml += `
        <div class="modal fade" id="diffModal-${hwId}-${qId}-${t}" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
              <div class="modal-header bg-white border-bottom position-sticky top-0 z-1 py-3 px-4">
                <h5 class="modal-title text-primary fw-bold d-flex align-items-center">
                    <i class="bi bi-distribute-vertical fs-4 me-2 bg-primary bg-opacity-10 rounded p-2"></i>
                    Diff for HW${hwId} · Q${qId + 1} - Test Case ${t}
                </h5>
                <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body bg-light p-4">
                <div class="diff-table-wrapper shadow-sm border" id="diff-content-${hwId}-${qId}-${t}">
                    <div class="text-center py-5 text-muted">
                        <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm mb-3" style="width: 80px; height: 80px;">
                            <i class="bi bi-code-slash display-4 pb-1 text-secondary opacity-50"></i>
                        </div>
                        <h5 class="fw-semibold text-dark">No Diff Available</h5>
                        <p class="mb-0">Run tests to generate the diff comparison table.</p>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        `;
    }

    html += `
            <div class="col-12 z-1 position-sticky bottom-0 bg-transparent pb-4 pt-3 d-flex justify-content-end pointer-events-none">
                <button onclick="clearQuestion(${hwId}, ${qId})" class="btn btn-outline-danger btn-lg shadow-sm px-4 py-3 fw-bold me-3 pointer-events-auto" style="border-radius: 50px;">
                    <i class="bi bi-trash3-fill me-2"></i> Clear All Files
                </button>
                <button id="run-button-${hwId}-${qId}" class="btn btn-primary btn-lg shadow-lg px-5 py-3 fw-bold text-uppercase pointer-events-auto" style="letter-spacing: 1px; border-radius: 50px;">
                    <i class="bi bi-play-fill me-2 fs-5"></i> Execute Q${qId + 1} Tests
                </button>
            </div>
        </div>
    `;

    pane.innerHTML = html;
    qContentContainer.appendChild(pane);
    modalsContainer.insertAdjacentHTML('beforeend', modalsHtml);
}

function switchQuestion(hwId, qId) {
    const tabTriggerEl = document.querySelector(`#q-tab-${hwId}-${qId}-link`);
    if (tabTriggerEl) {
        let tab = new bootstrap.Tab(tabTriggerEl);
        tab.show();
    }
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// ─── GLOBAL FOLDER DRAG & DROP ───────────────────────────────────────────────

document.addEventListener('dragover', (e) => {
    // Only activate global handler when NOT over a dropzone
    if (!e.target.closest('.drop-area')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
}, false);

document.addEventListener('drop', (e) => {
    if (!e.target.closest('.drop-area')) {
        handleGlobalDrop(e);
    }
}, false);

async function handleGlobalDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const items = e.dataTransfer.items;
    if (!items) return;

    const queue = [];
    for (let i = 0; i < items.length; i++) {
        let entry = items[i].webkitGetAsEntry();
        if (entry) queue.push(entry);
    }
    if (queue.length === 0) return;

    // Show loading toast
    const toast = showToast('<span class="spinner-border spinner-border-sm me-2"></span> Scanning folder...', 'bg-primary');

    try {
        const fileEntries = [];
        await scanFileTree(queue, fileEntries);
        console.log('[FolderUpload] Scanned files:', fileEntries.map(f => f.name));
        toast.querySelector('.toast-body').innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Distributing ${fileEntries.length} files...`;
        const filled = parseAndDistributeFiles(fileEntries);
        toast.remove();
        if (filled > 0) {
            showToast(`<i class="bi bi-check-circle-fill me-2"></i> Auto-filled ${filled} test files!`, 'bg-success', 3000);
        } else {
            showToast(`<i class="bi bi-info-circle-fill me-2"></i> No matching files found (expected pattern: hw1q1in1, hw1q2out3, etc.)`, 'bg-warning text-dark', 4000);
        }
    } catch (err) {
        toast.remove();
        console.error('Folder drop error:', err);
        showToast(`<i class="bi bi-exclamation-triangle-fill me-2"></i> Error: ${err.message}`, 'bg-danger', 4000);
    }
}

function showToast(html, bgClass, autoRemoveMs = 0) {
    const el = document.createElement('div');
    el.className = 'position-fixed bottom-0 end-0 p-3';
    el.style.zIndex = '1100';
    el.innerHTML = `
        <div class="toast show align-items-center text-white ${bgClass} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">${html}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.position-fixed').remove()"></button>
            </div>
        </div>`;
    document.body.appendChild(el);
    if (autoRemoveMs > 0) setTimeout(() => el.remove(), autoRemoveMs);
    return el;
}

async function scanFileTree(queue, fileEntries) {
    while (queue.length > 0) {
        let entry = queue.shift();
        if (entry.isFile) {
            await new Promise((resolve) => {
                entry.file(async (file) => {
                    // Accept .txt files and extensionless files (common in this naming convention)
                    if (file.name.endsWith('.txt') || file.name.endsWith('.py') || !file.name.includes('.')) {
                        try {
                            const { content } = await readFile(file);
                            fileEntries.push({ name: file.name, content });
                        } catch (e) { /* skip unreadable files */ }
                    }
                    resolve();
                });
            });
        } else if (entry.isDirectory) {
            let reader = entry.createReader();
            await new Promise((resolve) => {
                const readAll = () => {
                    reader.readEntries((entries) => {
                        if (entries.length > 0) {
                            queue.push(...entries);
                            readAll();
                        } else {
                            resolve();
                        }
                    });
                };
                readAll();
            });
        }
    }
}

function parseAndDistributeFiles(fileEntries) {
    // Regex: hw1q2in3.txt  OR  hw1q2out3  (with or without extension)
    const regex = /hw(\d+)q(\d+)(in|out)(\d+)/i;

    // Step 1: Parse all files
    const parsed = [];
    for (const file of fileEntries) {
        const match = file.name.match(regex);
        if (match) {
            parsed.push({
                hw: parseInt(match[1]),
                q: parseInt(match[2]),
                type: match[3].toLowerCase() === 'in' ? 'input' : 'expected',
                test: parseInt(match[4]),
                name: file.name,
                content: file.content
            });
        } else {
            console.log('[FolderUpload] Skipped (no regex match):', file.name);
        }
    }

    console.log('[FolderUpload] Parsed files:', parsed.map(p => `${p.name} -> HW${p.hw} Q${p.q} ${p.type} T${p.test}`));

    if (parsed.length === 0) return 0;

    // Step 2: Collect unique (hw, q) pairs and ensure tabs/subtabs exist
    const hwQPairs = new Map(); // hw -> Set of q values
    for (const p of parsed) {
        if (!hwQPairs.has(p.hw)) hwQPairs.set(p.hw, new Set());
        hwQPairs.get(p.hw).add(p.q);
    }

    // Create missing HW tabs and Q subtabs
    for (const [hw, qSet] of hwQPairs) {
        ensureTabExists(hw);
        for (const q of qSet) {
            ensureQuestionExists(hw, q - 1); // file Q1 = internal qId 0
        }
    }

    // Step 3: Fill test case slots
    let filledCount = 0;
    const failedSlots = [];
    for (const p of parsed) {
        const hwId = p.hw;
        const qId = p.q - 1; // file Q1 = internal index 0
        const t = p.test;

        if (!state[hwId] || !state[hwId].questions[qId]) { console.warn(`[FolderUpload] No state for HW${hwId} Q${qId}`); continue; }
        if (t < 1 || t > testCasesCount) { console.warn(`[FolderUpload] Test ${t} out of range for ${p.name}`); continue; }

        state[hwId].questions[qId].tests[t][p.type] = p.content;
        state[hwId].questions[qId].tests[t][p.type + 'Name'] = p.name;
        filledCount++;

        // Track for deferred UI update
        failedSlots.push(p);
    }

    // Deferred UI update: wait a tick for Bootstrap tab transitions to finish
    // before touching the dropzone DOM elements
    setTimeout(() => {
        for (const p of failedSlots) {
            updateFileUI(p.type, p.hw, p.q - 1, p.test, p.name);
        }
        console.log('[FolderUpload] UI updated for all', failedSlots.length, 'slots');
    }, 50);

    // Switch to the first filled HW tab
    const firstHw = parsed[0].hw;
    switchTab(firstHw);
    const firstQ = parsed[0].q - 1;
    switchQuestion(firstHw, firstQ);

    return filledCount;
}

function ensureTabExists(hwId) {
    if (!state[hwId]) {
        addNewTab(hwId);
    }
}

function ensureQuestionExists(hwId, qId) {
    if (!state[hwId].questions[qId]) {
        addQuestion(hwId, qId);
    }
}

function updateFileUI(type, hwId, qId, t, name) {
    let dropArea = document.getElementById(`${type}-drop-area-${hwId}-${qId}-${t}`);
    if (dropArea) {
        dropArea.innerHTML = `
            <div class="d-flex flex-column align-items-center text-success position-relative w-100 h-100 justify-content-center">
                <button onclick="removeFile(event, '${type}', ${hwId}, ${qId}, ${t})" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-1" title="Remove File" style="width: 24px; height: 24px; padding: 0;">
                    <i class="bi bi-x"></i>
                </button>
                <i class="bi bi-check-circle-fill fs-3 mb-1"></i><span class="fw-semibold text-truncate w-75">${name}</span>
            </div>`;
        dropArea.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        dropArea.onclick = null;
    }
}

function setupDragAndDropForQuestion(hwId, qId) {
    let codeDropArea = document.getElementById(`code-drop-area-${hwId}-${qId}`);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        codeDropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        codeDropArea.addEventListener(eventName, () => codeDropArea.classList.add('over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        codeDropArea.addEventListener(eventName, () => codeDropArea.classList.remove('over'), false);
    });

    codeDropArea.addEventListener('drop', (e) => handleCodeDrop(e, hwId, qId), false);

    for (let t = 1; t <= testCasesCount; t++) {
        let inputArea = document.getElementById(`input-drop-area-${hwId}-${qId}-${t}`);
        let expectedArea = document.getElementById(`expected-drop-area-${hwId}-${qId}-${t}`);

        [inputArea, expectedArea].forEach(area => {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                area.addEventListener(eventName, preventDefaults, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                area.addEventListener(eventName, () => area.classList.add('over'), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                area.addEventListener(eventName, () => area.classList.remove('over'), false);
            });
        });

        inputArea.addEventListener('drop', (e) => handleFileDrop(e, 'input', hwId, qId, t), false);
        expectedArea.addEventListener('drop', (e) => handleFileDrop(e, 'expected', hwId, qId, t), false);
    }

    document.getElementById(`run-button-${hwId}-${qId}`).addEventListener('click', () => runTestsForQuestion(hwId, qId));
}

// ─── FILE HANDLING ───────────────────────────────────────────────────────────

function readFile(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = (e) => resolve({ name: file.name, content: e.target.result });
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

async function handleCodeDrop(e, hwId, qId) {
    let dt = e.dataTransfer;
    let file = dt.files[0];
    if (!file) return;
    if (!file.name.endsWith('.py')) {
        alert('Please upload a .py file.');
        return;
    }

    try {
        let { name, content } = await readFile(file);
        state[hwId].questions[qId].code = content;
        state[hwId].questions[qId].codeName = name;
        e.target.innerHTML = `
            <div class="d-flex flex-column align-items-center text-success position-relative w-100 h-100 justify-content-center">
                <button onclick="removeFile(event, 'code', ${hwId}, ${qId})" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-2" title="Remove File" style="width: 28px; height: 28px; padding: 0;">
                    <i class="bi bi-x"></i>
                </button>
                <i class="bi bi-check-circle-fill display-5 mb-2"></i><span class="fw-bold fs-5">${name}</span>
            </div>`;
        e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        e.target.onclick = null;
    } catch (err) {
        alert("Failed to read file.");
    }
}

async function handleFileDrop(e, type, hwId, qId, t) {
    let dt = e.dataTransfer;
    let file = dt.files[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
        alert('Please upload a .txt file.');
        return;
    }

    try {
        let { name, content } = await readFile(file);
        state[hwId].questions[qId].tests[t][type] = content;
        state[hwId].questions[qId].tests[t][type + 'Name'] = name;
        e.target.innerHTML = `
            <div class="d-flex flex-column align-items-center text-success position-relative w-100 h-100 justify-content-center">
                <button onclick="removeFile(event, '${type}', ${hwId}, ${qId}, ${t})" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-1" title="Remove File" style="width: 24px; height: 24px; padding: 0;">
                    <i class="bi bi-x"></i>
                </button>
                <i class="bi bi-check-circle-fill fs-3 mb-1"></i><span class="fw-semibold text-truncate w-75">${name}</span>
            </div>`;
        e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        e.target.onclick = null;
    } catch (err) {
        alert("Failed to read file.");
    }
}

async function handleFileInput(inputElement, type, hwId, t, qId) {
    if (!inputElement.files || inputElement.files.length === 0) return;
    let file = inputElement.files[0];
    let dropArea = inputElement.nextElementSibling;

    if (type === 'code') {
        if (!file.name.endsWith('.py')) {
            alert('Please upload a .py file.');
            inputElement.value = '';
            return;
        }
        await handleCodeDrop({ dataTransfer: { files: [file] }, target: dropArea }, hwId, qId);
    } else {
        if (!file.name.endsWith('.txt')) {
            alert('Please upload a .txt file.');
            inputElement.value = '';
            return;
        }
        await handleFileDrop({ dataTransfer: { files: [file] }, target: dropArea }, type, hwId, qId, t);
    }
}

// ─── FILE REMOVAL ────────────────────────────────────────────────────────────

function removeFile(e, type, hwId, qId, t = null) {
    e.stopPropagation();

    if (type === 'code') {
        state[hwId].questions[qId].code = null;
        state[hwId].questions[qId].codeName = null;

        let dropArea = document.getElementById(`code-drop-area-${hwId}-${qId}`);
        dropArea.className = "drop-area mb-2 fs-5 p-5 text-secondary";
        dropArea.innerHTML = `
            <div>
                <i class="bi bi-cloud-arrow-up display-4 d-block mb-3 text-primary opacity-50"></i>
                <span class="fw-semibold">Drag & Drop Python Code (.py)</span><br>
                <span class="fs-6 fw-normal opacity-75">or Click to Browse</span>
            </div>`;
        dropArea.onclick = () => document.getElementById(`file-code-${hwId}-${qId}`).click();
        document.getElementById(`file-code-${hwId}-${qId}`).value = '';
    } else {
        state[hwId].questions[qId].tests[t][type] = null;
        state[hwId].questions[qId].tests[t][type + 'Name'] = null;

        let dropArea = document.getElementById(`${type}-drop-area-${hwId}-${qId}-${t}`);
        dropArea.className = "drop-area p-3 text-secondary h-100 small";
        let icon = type === 'input' ? 'bi-file-earmark-text' : 'bi-file-earmark-check';
        let txt = type === 'input' ? 'Input File' : 'Expected File';
        let hint = type === 'input' ? `hw${hwId}q${qId + 1}in${t}` : `hw${hwId}q${qId + 1}out${t}`;

        dropArea.innerHTML = `<div><i class="bi ${icon} fs-4 mb-1 d-block"></i> ${txt}<br><code class="text-muted" style="font-size: 0.7rem;">${hint}</code></div>`;
        dropArea.onclick = () => document.getElementById(`file-${type}-${hwId}-${qId}-${t}`).click();
        document.getElementById(`file-${type}-${hwId}-${qId}-${t}`).value = '';

        document.getElementById(`diff-status-${hwId}-${qId}-${t}`).innerHTML = 'Not Run';
        document.getElementById(`diff-content-${hwId}-${qId}-${t}`).innerHTML = `
            <div class="text-center py-5 text-muted">
                <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm mb-3" style="width: 80px; height: 80px;">
                    <i class="bi bi-code-slash display-4 pb-1 text-secondary opacity-50"></i>
                </div>
                <h5 class="fw-semibold text-dark">No Diff Available</h5>
                <p class="mb-0">Run tests to generate the diff comparison table.</p>
            </div>`;
    }
}

function clearQuestion(hwId, qId) {
    if (!confirm("Are you sure you want to clear all uploaded files for this question?")) return;

    if (state[hwId].questions[qId].code) {
        removeFile({ stopPropagation: () => { } }, 'code', hwId, qId);
    }

    for (let t = 1; t <= testCasesCount; t++) {
        if (state[hwId].questions[qId].tests[t].input) {
            removeFile({ stopPropagation: () => { } }, 'input', hwId, qId, t);
        }
        if (state[hwId].questions[qId].tests[t].expected) {
            removeFile({ stopPropagation: () => { } }, 'expected', hwId, qId, t);
        }
    }
}

// ─── EXECUTION ───────────────────────────────────────────────────────────────

function runPythonTest(codeStr, inputStr, expectedStr, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const id = ++messageId;
        messageCallbacks[id] = resolve;
        worker.postMessage({ id, codeStr, inputStr, expectedStr });

        setTimeout(() => {
            if (messageCallbacks[id]) {
                worker.terminate();
                initWorker();
                resolve({ error: "Timeout: Execution took too long (>" + timeoutMs / 1000 + "s) or an infinite loop occurred." });
                delete messageCallbacks[id];
            }
        }, timeoutMs);
    });
}

async function runTestsForQuestion(hwId, qId) {
    const btn = document.getElementById(`run-button-${hwId}-${qId}`);
    const q = state[hwId].questions[qId];

    if (!q.code) {
        alert(`Please upload a Python code file for HW${hwId} Q${qId + 1} first.`);
        return;
    }

    const missingPairs = [];
    const validTests = [];
    for (let t = 1; t <= testCasesCount; t++) {
        const hasInput = !!q.tests[t].input;
        const hasExpected = !!q.tests[t].expected;
        if (hasInput !== hasExpected) {
            missingPairs.push(t);
        } else if (hasInput && hasExpected) {
            validTests.push(t);
        }
    }

    if (missingPairs.length > 0) {
        alert(`For test case(s) ${missingPairs.join(', ')}, both input and expected output files must be provided.`);
        return;
    }

    if (validTests.length === 0) {
        alert("Please upload at least one complete test case (input and expected output).");
        return;
    }

    validTests.forEach(t => {
        document.getElementById(`diff-status-${hwId}-${qId}-${t}`).innerHTML = '<span class="spinner-border spinner-border-sm me-2 text-primary" role="status"></span> <span class="text-primary">Executing...</span>';
    });

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Processing...';
    btn.disabled = true;

    for (let t of validTests) {
        const inputStr = q.tests[t].input;
        const expectedStr = q.tests[t].expected;
        const codeStr = q.code;

        let response = await runPythonTest(codeStr, inputStr, expectedStr, 15000);

        let statusSpan = document.getElementById(`diff-status-${hwId}-${qId}-${t}`);
        let contentDiv = document.getElementById(`diff-content-${hwId}-${qId}-${t}`);

        if (response.error) {
            statusSpan.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-danger me-2"></i><span class="text-danger">${response.error}</span>`;
            contentDiv.innerHTML = `<div class="alert alert-danger m-3 border-0 shadow-sm"><i class="bi bi-x-octagon-fill me-2 fs-5"></i>${response.error}</div>`;
        } else {
            let res = response.result;
            let timeTaken = res.time ? res.time.toFixed(3) + 's' : '';
            let complexityInfo = timeTaken ? `<span class="badge bg-light text-secondary border fw-semibold ms-2" style="font-size: 0.75rem;"><i class="bi bi-stopwatch me-1"></i>${timeTaken}</span>` : '';

            contentDiv.innerHTML = res.diff_html || '';

            if (res.status === 'Identical!') {
                statusSpan.innerHTML = `<i class="bi bi-check-circle-fill text-success me-2 fs-5"></i><span class="text-success">Success</span>${complexityInfo}`;
            } else if (res.status === 'Different') {
                statusSpan.innerHTML = `<i class="bi bi-x-circle-fill text-danger me-2 fs-5"></i><span class="text-danger">Mismatched Output</span>${complexityInfo}`;
            } else if (res.status.startsWith('Error:')) {
                statusSpan.innerHTML = `<i class="bi bi-exclamation-octagon-fill text-warning me-2 fs-5"></i><span class="text-warning">${res.status}</span>${complexityInfo}`;
            } else {
                statusSpan.innerHTML = res.status + complexityInfo;
            }
        }
    }

    btn.innerHTML = '<i class="bi bi-check2-all me-2 fs-5"></i> Tests Completed';
    btn.classList.replace('btn-primary', 'btn-success');

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.replace('btn-success', 'btn-primary');
        btn.disabled = false;
    }, 3000);
}
