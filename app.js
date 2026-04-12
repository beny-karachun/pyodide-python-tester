const testCasesCount = 6;

// Nested state: state[hwId].questions[qId] = { code, codeName, tests: {1..5} }
let state = {};
let tabCount = 0;
let currentTabId = 0;

let worker;
let messageCallbacks = {};
let messageId = 0;

// Code editor instances
const editorInstances = {};

function switchCodeMode(mode, hwId, qId) {
    const uploadPane = document.getElementById(`code-upload-pane-${hwId}-${qId}`);
    const editorPane = document.getElementById(`code-editor-pane-${hwId}-${qId}`);
    const uploadBtn = document.getElementById(`code-mode-upload-${hwId}-${qId}`);
    const editorBtn = document.getElementById(`code-mode-editor-${hwId}-${qId}`);
    const downloadBtn = document.getElementById(`code-mode-download-${hwId}-${qId}`);

    if (mode === 'editor') {
        uploadPane.classList.add('d-none');
        editorPane.classList.remove('d-none');
        uploadBtn.className = 'btn btn-sm btn-outline-light fw-semibold';
        editorBtn.className = 'btn btn-sm btn-light fw-semibold active';
        if (downloadBtn) downloadBtn.classList.remove('d-none');
        initCodeEditor(hwId, qId);
    } else {
        editorPane.classList.add('d-none');
        uploadPane.classList.remove('d-none');
        editorBtn.className = 'btn btn-sm btn-outline-light fw-semibold';
        uploadBtn.className = 'btn btn-sm btn-light fw-semibold active';
        if (downloadBtn) downloadBtn.classList.add('d-none');
    }
    if (state[hwId]?.questions[qId]) {
        state[hwId].questions[qId].codeMode = mode;
        saveState();
    }
}

function downloadCode(hwId, qId) {
    const q = state[hwId]?.questions?.[qId];
    if (!q || (!q.code && !q.codeName)) {
        alert('No code to download!');
        return;
    }
    const filename = q.codeName || `hw${hwId}q${qId + 1}.py`;
    const blob = new Blob([q.code || ''], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function initCodeEditor(hwId, qId) {
    const key = `${hwId}-${qId}`;
    if (editorInstances[key]) return; // already initialized

    const container = document.getElementById(`code-editor-${hwId}-${qId}`);
    const existingCode = state[hwId]?.questions?.[qId]?.code || '';

    container.innerHTML = `
        <div class="code-editor-wrapper">
            <div class="code-editor-toolbar">
                <span class="code-editor-dot" style="background:#ff5f57;"></span>
                <span class="code-editor-dot" style="background:#febc2e;"></span>
                <span class="code-editor-dot" style="background:#28c840;"></span>
                <span class="code-editor-filename">hw${hwId}q${qId + 1}.py</span>
                <span class="code-editor-lang">Python</span>
            </div>
            <div class="code-editor-body">
                <div class="code-editor-lines" id="code-lines-${hwId}-${qId}">1</div>
                <textarea class="code-editor-textarea" id="code-textarea-${hwId}-${qId}" 
                    spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
                    placeholder="# Write your Python code here...">${existingCode}</textarea>
            </div>
        </div>
    `;

    const textarea = document.getElementById(`code-textarea-${hwId}-${qId}`);
    const linesEl = document.getElementById(`code-lines-${hwId}-${qId}`);

    function updateLineNumbers() {
        const lines = textarea.value.split('\n').length;
        linesEl.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
    }

    let resetDebounce = null;
    function syncState() {
        state[hwId].questions[qId].code = textarea.value;
        state[hwId].questions[qId].codeName = `hw${hwId}q${qId + 1}.py`;
        // Debounced reset of test results when code changes
        clearTimeout(resetDebounce);
        resetDebounce = setTimeout(() => resetTestResults(hwId, qId), 500);
        saveState();
    }

    textarea.addEventListener('input', () => {
        updateLineNumbers();
        syncState();
    });

    textarea.addEventListener('scroll', () => {
        linesEl.scrollTop = textarea.scrollTop;
    });

    // Tab key inserts 4 spaces
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 4;
            updateLineNumbers();
            syncState();
        }
        // Auto-indent on Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const currentLine = textarea.value.substring(0, start).split('\n').pop();
            const indent = currentLine.match(/^\s*/)[0];
            const extra = currentLine.trimEnd().endsWith(':') ? '    ' : '';
            textarea.setRangeText('\n' + indent + extra, start, textarea.selectionEnd, 'end');
            updateLineNumbers();
            syncState();
        }
    });

    updateLineNumbers();
    if (existingCode) syncState();
    editorInstances[key] = true;
}

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

// ─── LOCALSTORAGE PERSISTENCE ────────────────────────────────────────────────

let saveDebounce = null;
function renameTab(hwId) {
    const newName = prompt("Enter new name for homework tab:", state[hwId]?.name || `HW${hwId}`);
    if (newName && newName.trim() !== "") {
        state[hwId].name = newName.trim();
        const btn = document.getElementById(`tab-${hwId}-link`);
        if (btn) {
            btn.innerHTML = `<i class="bi bi-folder2-open me-2"></i>${state[hwId].name}`;
        }
        saveState();
    }
}

function renameQuestion(hwId, qId) {
    const newName = prompt("Enter new name for question tab:", state[hwId]?.questions?.[qId]?.name || `Q${qId + 1}`);
    if (newName && newName.trim() !== "") {
        state[hwId].questions[qId].name = newName.trim();
        const btn = document.getElementById(`q-tab-${hwId}-${qId}-link`);
        if (btn) {
            btn.innerHTML = `<i class="bi bi-question-circle me-1"></i>${state[hwId].questions[qId].name}`;
        }
        saveState();
    }
}

function saveState() {
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => {
        try {
            const data = {
                tabCount,
                currentTabId,
                state
            };
            localStorage.setItem('pyTesterState', JSON.stringify(data));
            console.log('[Storage] State saved');
        } catch (e) {
            console.warn('[Storage] Failed to save state:', e);
        }
    }, 300);
}

function loadState() {
    try {
        const raw = localStorage.getItem('pyTesterState');
        if (!raw) return false;

        const data = JSON.parse(raw);
        if (!data.state || Object.keys(data.state).length === 0) return false;

        tabCount = data.tabCount || 0;
        currentTabId = data.currentTabId || 0;

        // Rebuild UI from saved state
        for (const hwIdStr of Object.keys(data.state)) {
            const hwId = parseInt(hwIdStr);
            const hw = data.state[hwId];

            state[hwId] = { name: hw.name || `HW${hwId}`, questionCount: hw.questionCount || 0, questions: {} };
            renderTabLink(hwId, state[hwId].name);
            renderTabContent(hwId);

            for (const qIdStr of Object.keys(hw.questions)) {
                const qId = parseInt(qIdStr);
                const q = hw.questions[qId];
                const qName = `Q${qId + 1}`;

                // Initialize question state with saved data
                state[hwId].questions[qId] = {
                    name: q.name || qName,
                    code: q.code || null,
                    codeName: q.codeName || null,
                    codeMode: q.codeMode || 'editor',
                    tests: {}
                };
                for (let t = 1; t <= testCasesCount; t++) {
                    state[hwId].questions[qId].tests[t] = {
                        input: q.tests?.[t]?.input || null,
                        inputName: q.tests?.[t]?.inputName || null,
                        expected: q.tests?.[t]?.expected || null,
                        expectedName: q.tests?.[t]?.expectedName || null
                    };
                }

                renderQuestionTabLink(hwId, qId, state[hwId].questions[qId].name);
                renderQuestionContent(hwId, qId);
                setupDragAndDropForQuestion(hwId, qId);

                // Restore code based on saved mode
                const savedMode = q.codeMode || 'editor';
                if (savedMode === 'upload' && q.code && q.codeName) {
                    // Switch to upload view and show the file indicator
                    switchCodeMode('upload', hwId, qId);
                    const dropArea = document.getElementById(`code-drop-area-${hwId}-${qId}`);
                    if (dropArea) {
                        dropArea.innerHTML = `
                            <div class="d-flex flex-column align-items-center text-success position-relative w-100 h-100 justify-content-center">
                                <button onclick="removeFile(event, 'code', ${hwId}, ${qId})" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-2" title="Remove File" style="width: 28px; height: 28px; padding: 0;">
                                    <i class="bi bi-x"></i>
                                </button>
                                <i class="bi bi-check-circle-fill display-5 mb-2"></i><span class="fw-bold fs-5">${q.codeName}</span>
                            </div>`;
                        dropArea.classList.add('border-success', 'bg-success', 'bg-opacity-10');
                        dropArea.onclick = null;
                    }
                } else if (q.code) {
                    // Restore code in inline editor
                    const textarea = document.getElementById(`code-textarea-${hwId}-${qId}`);
                    if (textarea) {
                        textarea.value = q.code;
                        textarea.dispatchEvent(new Event('input'));
                    }
                }

                // Restore file upload UI indicators
                for (let t = 1; t <= testCasesCount; t++) {
                    if (q.tests?.[t]?.input && q.tests[t].inputName) {
                        updateFileUI('input', hwId, qId, t, q.tests[t].inputName);
                    }
                    if (q.tests?.[t]?.expected && q.tests[t].expectedName) {
                        updateFileUI('expected', hwId, qId, t, q.tests[t].expectedName);
                    }
                }
            }
        }

        // Clear all manually-added active states before letting Bootstrap manage them
        document.querySelectorAll('#tab-content-container > .tab-pane').forEach(p => {
            p.classList.remove('show', 'active');
        });
        document.querySelectorAll('#hw-tabs .nav-link').forEach(l => {
            l.classList.remove('active');
        });

        // Activate the last used tab
        switchTab(currentTabId);
        if (state[currentTabId]) {
            const firstQ = Object.keys(state[currentTabId].questions)[0];
            if (firstQ !== undefined) switchQuestion(currentTabId, parseInt(firstQ));
        }

        console.log('[Storage] State restored from localStorage');
        return true;
    } catch (e) {
        console.error('[Storage] Failed to load state:', e);
        return false;
    }
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

    // Try to load saved state, otherwise create default tab
    if (!loadState()) {
        addNewTab();
    }
});


// ─── HW TABS ─────────────────────────────────────────────────────────────────

function addNewTab(forceHwId = null) {
    const hwId = forceHwId !== null ? forceHwId : tabCount;
    if (hwId >= tabCount) tabCount = hwId + 1;
    const tabName = `HW${hwId}`;

    state[hwId] = { name: tabName, questionCount: 0, questions: {} };

    renderTabLink(hwId, tabName);
    renderTabContent(hwId);

    // Add the first question Q1 by default (only when not force-creating for folder upload)
    if (forceHwId === null) {
        addQuestion(hwId);
    }

    switchTab(hwId);
    saveState();
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
        <button class="nav-link pe-4" id="tab-${hwId}-link" data-bs-toggle="tab" data-bs-target="#tab-${hwId}-pane" type="button" role="tab" aria-controls="tab-${hwId}-pane" aria-selected="false" ondblclick="renameTab(${hwId})" title="Double click to rename">
            <i class="bi bi-folder2-open me-2"></i>${tabName}
        </button>
        <span class="tab-close-btn" onclick="event.stopPropagation(); deleteTab(${hwId})" title="Close Tab">&times;</span>
    `;

    tabsContainer.insertBefore(li, addBtnContainer);
}

function renderTabContent(hwId) {
    const contentContainer = document.getElementById("tab-content-container");

    const isFirst = contentContainer.querySelectorAll('.tab-pane').length === 0;
    const pane = document.createElement('div');
    pane.className = isFirst ? 'tab-pane fade show active' : 'tab-pane fade';
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
        saveState();
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
    saveState();
}

// ─── QUESTION SUBTABS ────────────────────────────────────────────────────────

function addQuestion(hwId, forceQId = null) {
    const qId = forceQId !== null ? forceQId : state[hwId].questionCount;
    if (qId >= state[hwId].questionCount) state[hwId].questionCount = qId + 1;
    const qName = `Q${qId + 1}`;

    state[hwId].questions[qId] = { name: qName, code: null, codeName: null, codeMode: 'editor', tests: {} };
    for (let t = 1; t <= testCasesCount; t++) {
        state[hwId].questions[qId].tests[t] = { input: null, inputName: null, expected: null, expectedName: null };
    }

    renderQuestionTabLink(hwId, qId, qName);
    renderQuestionContent(hwId, qId);
    setupDragAndDropForQuestion(hwId, qId);
    switchQuestion(hwId, qId);
    saveState();
    return qId;
}

function renderQuestionTabLink(hwId, qId, qName) {
    const qTabsContainer = document.getElementById(`q-tabs-${hwId}`);
    const addQContainer = document.getElementById(`add-q-container-${hwId}`);

    const li = document.createElement('li');
    li.className = 'nav-item position-relative';
    li.role = 'presentation';
    li.id = `q-tab-${hwId}-${qId}-li`;

    const isFirstQ = qTabsContainer.querySelectorAll('.nav-link.subtab-link').length === 0;
    const activeClass = isFirstQ ? 'nav-link subtab-link pe-4 active' : 'nav-link subtab-link pe-4';

    li.innerHTML = `
        <button class="${activeClass}" id="q-tab-${hwId}-${qId}-link" data-bs-toggle="pill" data-bs-target="#q-pane-${hwId}-${qId}" type="button" role="tab" ondblclick="renameQuestion(${hwId}, ${qId})" title="Double click to rename">
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
    saveState();
}

function renderQuestionContent(hwId, qId) {
    const qContentContainer = document.getElementById(`q-content-${hwId}`);
    const modalsContainer = document.getElementById("modals-container");

    const isFirstQ = qContentContainer.querySelectorAll('.tab-pane').length === 0;
    const pane = document.createElement('div');
    pane.className = isFirstQ ? 'tab-pane fade show active' : 'tab-pane fade';
    pane.id = `q-pane-${hwId}-${qId}`;
    pane.role = 'tabpanel';
    pane.setAttribute('aria-labelledby', `q-tab-${hwId}-${qId}-link`);

    let html = `
        <div class="row">
            <!-- Code Upload / Editor -->
            <div class="col-12 mb-4">
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-primary text-white d-flex align-items-center justify-content-between py-3">
                        <div class="d-flex align-items-center">
                            <div class="bg-white text-primary rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 40px; height: 40px;">
                                <i class="bi bi-filetype-py fs-4"></i>
                            </div>
                            <div>
                                <h5 class="card-title mb-0 fw-bold">Python Code</h5>
                                <small class="text-white text-opacity-75">HW${hwId} · Q${qId + 1}</small>
                            </div>
                        </div>
                        <div class="btn-group" role="group">
                            <button type="button" class="btn btn-sm btn-outline-light fw-semibold" id="code-mode-upload-${hwId}-${qId}" onclick="switchCodeMode('upload', ${hwId}, ${qId})">
                                <i class="bi bi-cloud-arrow-up me-1"></i> Upload File
                            </button>
                            <button type="button" class="btn btn-sm btn-light fw-semibold active" id="code-mode-editor-${hwId}-${qId}" onclick="switchCodeMode('editor', ${hwId}, ${qId})">
                                <i class="bi bi-code-slash me-1"></i> Write Code
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-light fw-semibold border-start border-start-white border-opacity-25" id="code-mode-download-${hwId}-${qId}" onclick="downloadCode(${hwId}, ${qId})" title="Download .py file">
                                <i class="bi bi-download"></i>
                            </button>
                        </div>
                    </div>
                    <!-- Upload mode (hidden by default) -->
                    <div class="card-body bg-white p-4 d-none" id="code-upload-pane-${hwId}-${qId}">
                        <input type="file" id="file-code-${hwId}-${qId}" accept=".py" style="display:none;" onchange="handleFileInput(this, 'code', ${hwId}, null, ${qId})">
                        <div id="code-drop-area-${hwId}-${qId}" class="drop-area mb-2 fs-5 p-5 text-secondary" onclick="document.getElementById('file-code-${hwId}-${qId}').click()">
                            <div>
                                <i class="bi bi-cloud-arrow-up display-4 d-block mb-3 text-primary opacity-50"></i>
                                <span class="fw-semibold">Drag & Drop Python Code (.py)</span><br>
                                <span class="fs-6 fw-normal opacity-75">or Click to Browse</span>
                            </div>
                        </div>
                    </div>
                    <!-- Editor mode (shown by default) -->
                    <div class="card-body p-0" id="code-editor-pane-${hwId}-${qId}">
                        <div id="code-editor-${hwId}-${qId}" class="code-editor-container" style="min-height: 300px;"></div>
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
    // Auto-init the code editor since Write Code is the default mode
    initCodeEditor(hwId, qId);
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

    const files = e.dataTransfer.files;
    const items = e.dataTransfer.items;

    // Check if a single .zip file was dropped
    if (files.length === 1 && files[0].name.endsWith('.zip')) {
        return handleZipDrop(files[0]);
    }

    // Otherwise treat as folder drop
    if (!items) return;
    const queue = [];
    for (let i = 0; i < items.length; i++) {
        let entry = items[i].webkitGetAsEntry();
        if (entry) queue.push(entry);
    }
    if (queue.length === 0) return;

    const toast = showToast('<span class="spinner-border spinner-border-sm me-2"></span> Scanning folder...', 'bg-primary');
    try {
        const fileEntries = [];
        await scanFileTree(queue, fileEntries);
        console.log('[FolderUpload] Scanned files:', fileEntries.map(f => f.name));
        toast.querySelector('.toast-body').innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Searching with Orama (${fileEntries.length} files)...`;
        const filled = await parseAndDistributeFiles(fileEntries);
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

async function handleZipDrop(zipFile) {
    const toast = showToast('<span class="spinner-border spinner-border-sm me-2"></span> Extracting zip...', 'bg-primary');
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const fileEntries = [];

        const promises = [];
        zip.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return; // skip directories
            const fileName = relativePath.split('/').pop(); // get basename
            // Accept .txt, .py, and extensionless files
            if (fileName.endsWith('.txt') || fileName.endsWith('.py') || !fileName.includes('.')) {
                promises.push(
                    zipEntry.async('string').then(content => {
                        fileEntries.push({ name: fileName, content });
                    })
                );
            }
        });

        await Promise.all(promises);
        console.log('[ZipUpload] Extracted files:', fileEntries.map(f => f.name));
        toast.querySelector('.toast-body').innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Searching with Orama (${fileEntries.length} files)...`;
        const filled = await parseAndDistributeFiles(fileEntries);
        toast.remove();
        if (filled > 0) {
            showToast(`<i class="bi bi-check-circle-fill me-2"></i> Auto-filled ${filled} test files from zip!`, 'bg-success', 3000);
        } else {
            showToast(`<i class="bi bi-info-circle-fill me-2"></i> No matching files found in zip (expected: hw1q1in1, hw1q2out3, etc.)`, 'bg-warning text-dark', 4000);
        }
    } catch (err) {
        toast.remove();
        console.error('Zip extraction error:', err);
        showToast(`<i class="bi bi-exclamation-triangle-fill me-2"></i> Error extracting zip: ${err.message}`, 'bg-danger', 4000);
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

async function parseAndDistributeFiles(fileEntries) {
    // ─── Step 1: Load Orama (lazy, cached) ────────────────────────────────
    if (!window._orama) {
        console.log('[Orama] Loading Orama from CDN...');
        try {
            const mod = await import('https://cdn.jsdelivr.net/npm/@orama/orama@3.1.18/+esm');
            window._orama = mod;
            console.log('[Orama] Loaded successfully (v3)');
        } catch (e) {
            console.error('[Orama] CDN load failed:', e);
            // Graceful fallback to regex
            return regexFallback(fileEntries);
        }
    }

    const { create, insert, search } = window._orama;

    // ─── Step 2: Create Orama DB and index all dropped files ──────────────
    const db = create({
        schema: {
            fileName: 'string',     // full filename for searching
            content: 'string',      // file content
            fileIndex: 'number'     // index into fileEntries array
        }
    });

    for (let i = 0; i < fileEntries.length; i++) {
        insert(db, {
            fileName: fileEntries[i].name,
            content: fileEntries[i].content,
            fileIndex: i
        });
    }

    console.log(`[Orama] Indexed ${fileEntries.length} files into search DB`);

    // ─── Step 3: Build slot catalog and search for matches ────────────────
    // Collect unique (hw, q) from filenames for auto-tab creation.
    // We scan a reasonable range of hw/q values, searching Orama for each.
    const maxHw = 20;
    const maxQ = 20;
    const matched = []; // { hw, q, type, test, fileIndex, fileName, content, score }

    for (let hw = 0; hw <= maxHw; hw++) {
        for (let q = 1; q <= maxQ; q++) {
            for (let t = 1; t <= testCasesCount; t++) {
                // Search for input file: "hw{X}q{Y}in{Z}"
                const inputQuery = `hw${hw}q${q}in${t}`;
                const inputResult = search(db, {
                    term: inputQuery,
                    properties: ['fileName'],
                    limit: 1
                });

                if (inputResult.count > 0) {
                    const hit = inputResult.hits[0];
                    // Validate: the filename must actually contain the pattern
                    const fn = hit.document.fileName.toLowerCase();
                    if (fn.includes(inputQuery.toLowerCase())) {
                        matched.push({
                            hw, q, type: 'input', test: t,
                            fileIndex: hit.document.fileIndex,
                            fileName: hit.document.fileName,
                            content: fileEntries[hit.document.fileIndex].content,
                            score: hit.score
                        });
                    }
                }

                // Search for expected file: "hw{X}q{Y}out{Z}"
                const outputQuery = `hw${hw}q${q}out${t}`;
                const outputResult = search(db, {
                    term: outputQuery,
                    properties: ['fileName'],
                    limit: 1
                });

                if (outputResult.count > 0) {
                    const hit = outputResult.hits[0];
                    const fn = hit.document.fileName.toLowerCase();
                    if (fn.includes(outputQuery.toLowerCase())) {
                        matched.push({
                            hw, q, type: 'expected', test: t,
                            fileIndex: hit.document.fileIndex,
                            fileName: hit.document.fileName,
                            content: fileEntries[hit.document.fileIndex].content,
                            score: hit.score
                        });
                    }
                }
            }
        }
    }

    console.log(`[Orama] Matched ${matched.length} files via search: `,
        matched.map(m => `${m.fileName} → HW${m.hw} Q${m.q} ${m.type} T${m.test} (score: ${m.score.toFixed(2)
            })`));

    if (matched.length === 0) return 0;

    // ─── Step 4: Auto-create tabs & subtabs ───────────────────────────────
    const hwQPairs = new Map();
    for (const m of matched) {
        if (!hwQPairs.has(m.hw)) hwQPairs.set(m.hw, new Set());
        hwQPairs.get(m.hw).add(m.q);
    }

    for (const [hw, qSet] of hwQPairs) {
        ensureTabExists(hw);
        for (const q of qSet) {
            ensureQuestionExists(hw, q - 1);
        }
    }

    // ─── Step 5: Fill test case slots (state + deferred UI) ───────────────
    let filledCount = 0;
    const uiUpdates = [];

    for (const m of matched) {
        const hwId = m.hw;
        const qId = m.q - 1;
        const t = m.test;

        if (!state[hwId] || !state[hwId].questions[qId]) continue;
        if (t < 1 || t > testCasesCount) continue;

        state[hwId].questions[qId].tests[t][m.type] = m.content;
        state[hwId].questions[qId].tests[t][m.type + 'Name'] = m.fileName;
        filledCount++;
        uiUpdates.push(m);
    }

    // Deferred UI update to avoid Bootstrap transition interference
    setTimeout(() => {
        for (const m of uiUpdates) {
            updateFileUI(m.type, m.hw, m.q - 1, m.test, m.fileName);
        }
        console.log(`[Orama] UI updated for ${uiUpdates.length} slots`);
    }, 50);

    // Switch to first matched tab
    const firstHw = matched[0].hw;
    switchTab(firstHw);
    const firstQ = matched[0].q - 1;
    switchQuestion(firstHw, firstQ);

    return filledCount;
}

// Regex fallback if Orama CDN fails to load
function regexFallback(fileEntries) {
    const regex = /hw(\d+)q(\d+)(in|out)(\d+)/i;
    const parsed = [];
    for (const file of fileEntries) {
        const match = file.name.match(regex);
        if (match) {
            parsed.push({
                hw: parseInt(match[1]), q: parseInt(match[2]),
                type: match[3].toLowerCase() === 'in' ? 'input' : 'expected',
                test: parseInt(match[4]), name: file.name, content: file.content
            });
        }
    }
    if (parsed.length === 0) return 0;

    const hwQPairs = new Map();
    for (const p of parsed) {
        if (!hwQPairs.has(p.hw)) hwQPairs.set(p.hw, new Set());
        hwQPairs.get(p.hw).add(p.q);
    }
    for (const [hw, qSet] of hwQPairs) {
        ensureTabExists(hw);
        for (const q of qSet) ensureQuestionExists(hw, q - 1);
    }

    let filledCount = 0;
    const uiUpdates = [];
    for (const p of parsed) {
        const qId = p.q - 1, t = p.test;
        if (!state[p.hw]?.questions[qId]) continue;
        if (t < 1 || t > testCasesCount) continue;
        state[p.hw].questions[qId].tests[t][p.type] = p.content;
        state[p.hw].questions[qId].tests[t][p.type + 'Name'] = p.name;
        filledCount++;
        uiUpdates.push(p);
    }
    setTimeout(() => {
        for (const p of uiUpdates) updateFileUI(p.type, p.hw, p.q - 1, p.test, p.name);
    }, 50);

    if (parsed.length > 0) {
        switchTab(parsed[0].hw);
        switchQuestion(parsed[0].hw, parsed[0].q - 1);
    }
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

// Reset all test result UIs for a question (called when code changes)
function resetTestResults(hwId, qId) {
    for (let t = 1; t <= testCasesCount; t++) {
        const statusEl = document.getElementById(`diff-status-${hwId}-${qId}-${t}`);
        const contentEl = document.getElementById(`diff-content-${hwId}-${qId}-${t}`);
        if (statusEl) statusEl.innerHTML = 'Not Run';
        if (contentEl) contentEl.innerHTML = `
            <div class="text-center py-5 text-muted">
                <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm mb-3" style="width: 80px; height: 80px;">
                    <i class="bi bi-code-slash display-4 pb-1 text-secondary opacity-50"></i>
                </div>
                <h5 class="fw-semibold text-dark">No Diff Available</h5>
                <p class="mb-0">Run tests to generate the diff comparison table.</p>
            </div>`;
    }
    // Re-enable the execute button
    const btn = document.getElementById(`run-button-${hwId}-${qId}`);
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
    }
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
        state[hwId].questions[qId].codeMode = 'upload';
        resetTestResults(hwId, qId);
        e.target.innerHTML = `
    <div class="d-flex flex-column align-items-center text-success position-relative w-100 h-100 justify-content-center">
                <button onclick="removeFile(event, 'code', ${hwId}, ${qId})" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-2" title="Remove File" style="width: 28px; height: 28px; padding: 0;">
                    <i class="bi bi-x"></i>
                </button>
                <i class="bi bi-check-circle-fill display-5 mb-2"></i><span class="fw-bold fs-5">${name}</span>
            </div>`;
        e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        e.target.onclick = null;
        saveState();
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
        saveState();
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
        resetTestResults(hwId, qId);

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
    saveState();
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
        alert(`For test case (s) ${missingPairs.join(', ')}, both input and expected output files must be provided.`);
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
