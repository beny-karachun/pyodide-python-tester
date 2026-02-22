const testCasesCount = 5;

// Dynamic state mapping homework index to its data
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

function addNewTab() {
    const hwId = tabCount++;
    const tabName = `HW${hwId}`;

    state[hwId] = { code: null, codeName: null, tests: {} };
    for (let t = 1; t <= testCasesCount; t++) {
        state[hwId].tests[t] = { input: null, inputName: null, expected: null, expectedName: null };
    }

    renderTabLink(hwId, tabName);
    renderTabContent(hwId);
    setupDragAndDropForTab(hwId);

    // Switch to the newly created tab
    switchTab(hwId);
}

function renderTabLink(hwId, tabName) {
    const tabsContainer = document.getElementById("hw-tabs");
    const addBtnContainer = document.getElementById("add-tab-container");

    const li = document.createElement('li');
    li.className = 'nav-item';
    li.role = 'presentation';

    li.innerHTML = `
        <button class="nav-link" id="tab-${hwId}-link" data-bs-toggle="tab" data-bs-target="#tab-${hwId}-pane" type="button" role="tab" aria-controls="tab-${hwId}-pane" aria-selected="false">
            <i class="bi bi-folder2-open me-2"></i>${tabName}
        </button>
    `;

    // Insert before the Add Button container
    tabsContainer.insertBefore(li, addBtnContainer);
}

function renderTabContent(hwId) {
    const contentContainer = document.getElementById("tab-content-container");
    const modalsContainer = document.getElementById("modals-container");

    const pane = document.createElement('div');
    pane.className = 'tab-pane fade';
    pane.id = `tab-${hwId}-pane`;
    pane.role = 'tabpanel';
    pane.setAttribute('aria-labelledby', `tab-${hwId}-link`);

    let html = `
        <div class="row pt-2">
            <!-- Code Upload -->
            <div class="col-12 mb-4">
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-primary text-white d-flex align-items-center py-3">
                        <div class="bg-white text-primary rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 40px; height: 40px;">
                            <i class="bi bi-filetype-py fs-4"></i>
                        </div>
                        <div>
                            <h5 class="card-title mb-0 fw-bold">Python Code</h5>
                            <small class="text-white text-opacity-75">Upload your main .py file for HW${hwId}</small>
                        </div>
                    </div>
                    <div class="card-body bg-white p-4">
                        <input type="file" id="file-code-${hwId}" accept=".py" style="display:none;" onchange="handleFileInput(this, 'code', ${hwId})">
                        <div id="code-drop-area-${hwId}" class="drop-area mb-2 fs-5 p-5 text-secondary" onclick="document.getElementById('file-code-${hwId}').click()">
                            <div>
                                <i class="bi bi-cloud-arrow-up display-4 d-block mb-3 text-primary opacity-50 transition-all"></i>
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
                            <input type="file" id="file-input-${hwId}-${t}" accept=".txt" style="display:none;" onchange="handleFileInput(this, 'input', ${hwId}, ${t})">
                            <div id="input-drop-area-${hwId}-${t}" class="drop-area p-3 text-secondary h-100 small" onclick="document.getElementById('file-input-${hwId}-${t}').click()">
                                <div><i class="bi bi-file-earmark-text fs-4 mb-1 d-block"></i> Input File</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <input type="file" id="file-expected-${hwId}-${t}" accept=".txt" style="display:none;" onchange="handleFileInput(this, 'expected', ${hwId}, ${t})">
                            <div id="expected-drop-area-${hwId}-${t}" class="drop-area p-3 text-secondary h-100 small" onclick="document.getElementById('file-expected-${hwId}-${t}').click()">
                                <div><i class="bi bi-file-earmark-check fs-4 mb-1 d-block"></i> Expected File</div>
                            </div>
                        </div>
                    </div>
                    <div id="diff-result-${hwId}-${t}" class="result mt-2 py-3 px-4 bg-light rounded d-flex justify-content-between align-items-center border-0 shadow-sm">
                        <div class="d-flex align-items-center">
                            <div class="bg-white border rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 32px; height: 32px;">
                                <i class="bi bi-activity text-secondary"></i>
                            </div>
                            <div>
                                <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem; font-weight: 700; letter-spacing: 0.5px;">Result</small>
                                <span id="diff-status-${hwId}-${t}" class="fw-bold text-dark" style="font-size: 1.05rem;">Not Run</span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-3 fw-semibold shadow-sm" data-bs-toggle="modal" data-bs-target="#diffModal-${hwId}-${t}">
                            <i class="bi bi-eye me-1"></i> View Diff
                        </button>
                    </div>
                </div>
            </div>
        `;

        modalsHtml += `
        <div class="modal fade" id="diffModal-${hwId}-${t}" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
              <div class="modal-header bg-white border-bottom position-sticky top-0 z-1 py-3 px-4">
                <h5 class="modal-title text-primary fw-bold d-flex align-items-center">
                    <i class="bi bi-distribute-vertical fs-4 me-2 bg-primary bg-opacity-10 rounded p-2"></i>
                    Diff for HW${hwId} - Test Case ${t}
                </h5>
                <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body bg-light p-4">
                <div class="diff-table-wrapper shadow-sm border" id="diff-content-${hwId}-${t}">
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
                <button onclick="clearHomeworkTab(${hwId})" class="btn btn-outline-danger btn-lg shadow-sm px-4 py-3 fw-bold me-3 pointer-events-auto" style="border-radius: 50px;">
                    <i class="bi bi-trash3-fill me-2"></i> Clear All Files
                </button>
                <button id="run-button-${hwId}" class="btn btn-primary btn-lg shadow-lg px-5 py-3 fw-bold text-uppercase pointer-events-auto" style="letter-spacing: 1px; border-radius: 50px;">
                    <i class="bi bi-play-fill me-2 fs-5"></i> Execute HW${hwId} Tests
                </button>
            </div>
        </div>
    `;

    pane.innerHTML = html;
    contentContainer.appendChild(pane);
    modalsContainer.insertAdjacentHTML('beforeend', modalsHtml);
}

function switchTab(hwId) {
    const tabTriggerEl = document.querySelector(`#tab-${hwId}-link`);
    if (tabTriggerEl) {
        let tab = new bootstrap.Tab(tabTriggerEl);
        tab.show();
        currentTabId = hwId;
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function setupDragAndDropForTab(hwId) {
    let codeDropArea = document.getElementById(`code-drop-area-${hwId}`);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        codeDropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        codeDropArea.addEventListener(eventName, () => codeDropArea.classList.add('over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        codeDropArea.addEventListener(eventName, () => codeDropArea.classList.remove('over'), false);
    });

    codeDropArea.addEventListener('drop', (e) => handleCodeDrop(e, hwId), false);

    for (let t = 1; t <= testCasesCount; t++) {
        let inputArea = document.getElementById(`input-drop-area-${hwId}-${t}`);
        let expectedArea = document.getElementById(`expected-drop-area-${hwId}-${t}`);

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

        inputArea.addEventListener('drop', (e) => handleFileDrop(e, 'input', hwId, t), false);
        expectedArea.addEventListener('drop', (e) => handleFileDrop(e, 'expected', hwId, t), false);
    }

    document.getElementById(`run-button-${hwId}`).addEventListener('click', () => runTestsForColumn(hwId));
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = (e) => resolve({ name: file.name, content: e.target.result });
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

async function handleCodeDrop(e, hwId) {
    let dt = e.dataTransfer;
    let file = dt.files[0];
    if (!file) return;
    if (!file.name.endsWith('.py')) {
        alert('Please upload a .py file.');
        return;
    }

    try {
        let { name, content } = await readFile(file);
        state[hwId].code = content;
        state[hwId].codeName = name;
        e.target.innerHTML = `
            <div class="d-flex flex-column align-items-center text-success position-relative w-100 h-100 justify-content-center">
                <button onclick="removeFile(event, 'code', ${hwId})" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-2" title="Remove File" style="width: 28px; height: 28px; padding: 0;">
                    <i class="bi bi-x"></i>
                </button>
                <i class="bi bi-check-circle-fill display-5 mb-2"></i><span class="fw-bold fs-5">${name}</span>
            </div>`;
        e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        e.target.onclick = null; // Disable re-click when a file is mapped
    } catch (err) {
        alert("Failed to read file.");
    }
}

async function handleFileDrop(e, type, hwId, t) {
    let dt = e.dataTransfer;
    let file = dt.files[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
        alert('Please upload a .txt file.');
        return;
    }

    try {
        let { name, content } = await readFile(file);
        state[hwId].tests[t][type] = content;
        state[hwId].tests[t][type + 'Name'] = name;
        e.target.innerHTML = `
            <div class="d-flex flex-column align-items-center text-success position-relative w-100 h-100 justify-content-center">
                <button onclick="removeFile(event, '${type}', ${hwId}, ${t})" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-1" title="Remove File" style="width: 24px; height: 24px; padding: 0;">
                    <i class="bi bi-x"></i>
                </button>
                <i class="bi bi-check-circle-fill fs-3 mb-1"></i><span class="fw-semibold text-truncate w-75 pointer-events-none">${name}</span>
            </div>`;
        e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        e.target.onclick = null;
    } catch (err) {
        alert("Failed to read file.");
    }
}

function removeFile(e, type, hwId, t = null) {
    e.stopPropagation(); // prevent clicking the drop area again

    if (type === 'code') {
        state[hwId].code = null;
        state[hwId].codeName = null;

        let dropArea = document.getElementById(`code-drop-area-${hwId}`);
        dropArea.className = "drop-area mb-2 fs-5 p-5 text-secondary";
        dropArea.innerHTML = `
            <div>
                <i class="bi bi-cloud-arrow-up display-4 d-block mb-3 text-primary opacity-50 transition-all"></i>
                <span class="fw-semibold">Drag & Drop Python Code (.py)</span><br>
                <span class="fs-6 fw-normal opacity-75">or Click to Browse</span>
            </div>`;
        dropArea.onclick = () => document.getElementById(`file-code-${hwId}`).click();
        document.getElementById(`file-code-${hwId}`).value = '';
    } else {
        state[hwId].tests[t][type] = null;
        state[hwId].tests[t][type + 'Name'] = null;

        let dropArea = document.getElementById(`${type}-drop-area-${hwId}-${t}`);
        dropArea.className = "drop-area p-3 text-secondary h-100 small";
        let icon = type === 'input' ? 'bi-file-earmark-text' : 'bi-file-earmark-check';
        let txt = type === 'input' ? 'Input File' : 'Expected File';

        dropArea.innerHTML = `<div><i class="bi ${icon} fs-4 mb-1 d-block"></i> ${txt}</div>`;
        dropArea.onclick = () => document.getElementById(`file-${type}-${hwId}-${t}`).click();
        document.getElementById(`file-${type}-${hwId}-${t}`).value = '';

        // Reset status for this test
        document.getElementById(`diff-status-${hwId}-${t}`).innerHTML = 'Not Run';
        document.getElementById(`diff-content-${hwId}-${t}`).innerHTML = `
            <div class="text-center py-5 text-muted">
                <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm mb-3" style="width: 80px; height: 80px;">
                    <i class="bi bi-code-slash display-4 pb-1 text-secondary opacity-50"></i>
                </div>
                <h5 class="fw-semibold text-dark">No Diff Available</h5>
                <p class="mb-0">Run tests to generate the diff comparison table.</p>
            </div>`;
    }
}

function clearHomeworkTab(hwId) {
    if (!confirm("Are you sure you want to clear all uploaded files for this homework?")) return;

    if (state[hwId].code) {
        removeFile({ stopPropagation: () => { } }, 'code', hwId);
    }

    for (let t = 1; t <= testCasesCount; t++) {
        if (state[hwId].tests[t].input) {
            removeFile({ stopPropagation: () => { } }, 'input', hwId, t);
        }
        if (state[hwId].tests[t].expected) {
            removeFile({ stopPropagation: () => { } }, 'expected', hwId, t);
        }
    }
}

async function handleFileInput(inputElement, type, hwId, t = null) {
    if (!inputElement.files || inputElement.files.length === 0) return;
    let file = inputElement.files[0];
    let dropArea = inputElement.nextElementSibling;
    let eventTargetObj = { target: dropArea };

    if (type === 'code') {
        if (!file.name.endsWith('.py')) {
            alert('Please upload a .py file.');
            inputElement.value = '';
            return;
        }
        await handleCodeDrop({ dataTransfer: { files: [file] }, target: dropArea }, hwId);
    } else {
        if (!file.name.endsWith('.txt')) {
            alert('Please upload a .txt file.');
            inputElement.value = '';
            return;
        }
        await handleFileDrop({ dataTransfer: { files: [file] }, target: dropArea }, type, hwId, t);
    }
}

function runPythonTest(codeStr, inputStr, expectedStr, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const id = ++messageId;
        messageCallbacks[id] = resolve;
        worker.postMessage({ id, codeStr, inputStr, expectedStr });

        // Handle timeout by terminating worker and recreating it
        setTimeout(() => {
            if (messageCallbacks[id]) {
                worker.terminate();
                initWorker(); // Recreate worker since it's dead
                resolve({ error: "Timeout: Execution took too long (>" + timeoutMs / 1000 + "s) or an infinite loop occurred." });
                delete messageCallbacks[id];
            }
        }, timeoutMs);
    });
}

async function runTestsForColumn(hwId) {
    const btn = document.getElementById(`run-button-${hwId}`);

    if (!state[hwId].code) {
        alert(`Please upload a Python code file for HW${hwId} first.`);
        return;
    }

    // Check pairs
    const missingPairs = [];
    const validTests = [];
    for (let t = 1; t <= testCasesCount; t++) {
        const hasInput = !!state[hwId].tests[t].input;
        const hasExpected = !!state[hwId].tests[t].expected;
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

    // Reset statuses
    validTests.forEach(t => {
        document.getElementById(`diff-status-${hwId}-${t}`).innerHTML = '<span class="spinner-border spinner-border-sm me-2 text-primary" role="status"></span> <span class="text-primary">Executing...</span>';
    });

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Processing...';
    btn.disabled = true;

    for (let t of validTests) {
        const inputStr = state[hwId].tests[t].input;
        const expectedStr = state[hwId].tests[t].expected;
        const codeStr = state[hwId].code;

        let response = await runPythonTest(codeStr, inputStr, expectedStr, 15000);

        let statusSpan = document.getElementById(`diff-status-${hwId}-${t}`);
        let contentDiv = document.getElementById(`diff-content-${hwId}-${t}`);

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
                // Short error message
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
