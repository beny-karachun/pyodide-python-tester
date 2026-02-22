const columnsCount = 2;
const testCasesCount = 5;
const state = {
    1: { code: null, codeName: null, tests: {} },
    2: { code: null, codeName: null, tests: {} }
};

for (let c = 1; c <= columnsCount; c++) {
    for (let t = 1; t <= testCasesCount; t++) {
        state[c].tests[t] = { input: null, inputName: null, expected: null, expectedName: null };
    }
}

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
    initializeUI();
});

function initializeUI() {
    const container = document.getElementById("columns-container");
    const modalsContainer = document.getElementById("modals-container");

    let html = "";
    let modalsHtml = "";

    for (let c = 1; c <= columnsCount; c++) {
        html += `
            <div class="col-xl-6 mb-4">
                <div class="card mb-4 shadow-sm border-0">
                    <div class="card-header bg-primary text-white d-flex align-items-center">
                        <i class="bi bi-filetype-py fs-4 me-2"></i>
                        <h5 class="card-title mb-0">Upload Your Python Code (Column ${c})</h5>
                    </div>
                    <div class="card-body bg-white">
                        <input type="file" id="file-code-${c}" accept=".py" style="display:none;" onchange="handleFileInput(this, 'code', ${c})">
                        <div id="code-drop-area-${c}" class="drop-area mb-3 fs-5 p-4 text-secondary" onclick="document.getElementById('file-code-${c}').click()">
                            <div>
                                <i class="bi bi-cloud-arrow-up display-6 d-block mb-2 text-primary opacity-50"></i>
                                Drag & Drop Python Code (.py) or Click to Browse
                            </div>
                        </div>
                        <p class="text-muted small m-0"><i class="bi bi-info-circle me-1"></i> Once uploaded, your code filename will appear above.</p>
                    </div>
                </div>
                <h4 class="mb-3 text-secondary border-bottom pb-2"><i class="bi bi-list-check me-2"></i>Test Cases (Column ${c})</h4>
        `;

        for (let t = 1; t <= testCasesCount; t++) {
            html += `
                <div class="card mb-3 shadow-sm border-0 bg-transparent">
                    <div class="card-header bg-white border-bottom-0 pt-3 pb-0">
                        <h6 class="card-title mb-0 text-primary fw-bold">Test Case ${t}</h6>
                    </div>
                    <div class="card-body bg-white rounded-bottom">
                        <div class="row g-2 mb-3">
                            <div class="col-md-6">
                                <input type="file" id="file-input-${c}-${t}" accept=".txt" style="display:none;" onchange="handleFileInput(this, 'input', ${c}, ${t})">
                                <div id="input-drop-area-${c}-${t}" class="drop-area p-3 text-secondary h-100 small" onclick="document.getElementById('file-input-${c}-${t}').click()">
                                    <i class="bi bi-file-earmark-text me-2"></i> Input File
                                </div>
                            </div>
                            <div class="col-md-6">
                                <input type="file" id="file-expected-${c}-${t}" accept=".txt" style="display:none;" onchange="handleFileInput(this, 'expected', ${c}, ${t})">
                                <div id="expected-drop-area-${c}-${t}" class="drop-area p-3 text-secondary h-100 small" onclick="document.getElementById('file-expected-${c}-${t}').click()">
                                    <i class="bi bi-file-earmark-check me-2"></i> Expected File
                                </div>
                            </div>
                        </div>
                        <div id="diff-result-${c}-${t}" class="result mt-2 py-2 px-3 bg-light rounded d-flex justify-content-between align-items-center border-0 shadow-sm">
                            <div class="d-flex align-items-center">
                                <span class="badge bg-secondary me-2">Result</span>
                                <span id="diff-status-${c}-${t}" class="fw-bold text-muted" style="font-size: 0.95rem;">-</span>
                            </div>
                            <button type="button" class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#diffModal-${c}-${t}">
                                <i class="bi bi-eye"></i> View Diff
                            </button>
                        </div>
                    </div>
                </div>
            `;

            modalsHtml += `
            <div class="modal fade" id="diffModal-${c}-${t}" tabindex="-1" aria-hidden="true">
              <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg">
                  <div class="modal-header bg-light">
                    <h5 class="modal-title text-primary"><i class="bi bi-distribute-vertical me-2"></i>Diff for Test Case ${t} (Column ${c})</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body bg-light pt-0">
                    <div class="diff-table-wrapper shadow-sm" id="diff-content-${c}-${t}">
                        <div class="text-center p-5 text-muted">
                            <i class="bi bi-code-slash display-4 d-block mb-3 opacity-25"></i>
                            Run tests to see the diff comparison.
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            `;
        }

        html += `
                <div class="d-flex justify-content-end mb-5 mt-4">
                    <button id="run-button-${c}" class="btn btn-primary btn-lg shadow px-5 py-2 fw-bold text-uppercase" style="letter-spacing: 1px;">
                        <i class="bi bi-play-fill me-1 fs-5"></i> Run Tests
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    modalsContainer.innerHTML = modalsHtml;

    setupDragAndDrop();
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function setupDragAndDrop() {
    for (let c = 1; c <= columnsCount; c++) {
        let codeDropArea = document.getElementById('code-drop-area-' + c);

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            codeDropArea.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            codeDropArea.addEventListener(eventName, () => codeDropArea.classList.add('over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            codeDropArea.addEventListener(eventName, () => codeDropArea.classList.remove('over'), false);
        });

        codeDropArea.addEventListener('drop', (e) => handleCodeDrop(e, c), false);

        for (let t = 1; t <= testCasesCount; t++) {
            let inputArea = document.getElementById(`input-drop-area-${c}-${t}`);
            let expectedArea = document.getElementById(`expected-drop-area-${c}-${t}`);

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

            inputArea.addEventListener('drop', (e) => handleFileDrop(e, 'input', c, t), false);
            expectedArea.addEventListener('drop', (e) => handleFileDrop(e, 'expected', c, t), false);
        }

        document.getElementById(`run-button-${c}`).addEventListener('click', () => runTestsForColumn(c));
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = (e) => resolve({ name: file.name, content: e.target.result });
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

async function handleCodeDrop(e, c) {
    let dt = e.dataTransfer;
    let file = dt.files[0];
    if (!file) return;
    if (!file.name.endsWith('.py')) {
        alert('Please upload a .py file.');
        return;
    }

    try {
        let { name, content } = await readFile(file);
        state[c].code = content;
        state[c].codeName = name;
        e.target.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-file-earmark-check-fill fs-4 d-block mb-1"></i> ${name}</span>`;
        e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
    } catch (err) {
        alert("Failed to read file.");
    }
}

async function handleFileDrop(e, type, c, t) {
    let dt = e.dataTransfer;
    let file = dt.files[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
        alert('Please upload a .txt file.');
        return;
    }

    try {
        let { name, content } = await readFile(file);
        state[c].tests[t][type] = content;
        state[c].tests[t][type + 'Name'] = name;
        e.target.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i> ${name}</span>`;
        e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
    } catch (err) {
        alert("Failed to read file.");
    }
}

async function handleFileInput(inputElement, type, c, t = null) {
    if (!inputElement.files || inputElement.files.length === 0) return;
    let file = inputElement.files[0];
    let e = { target: inputElement.nextElementSibling }; // Map to drop area div
    try {
        let { name, content } = await readFile(file);
        if (type === 'code') {
            state[c].code = content;
            state[c].codeName = name;
            e.target.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-file-earmark-check-fill fs-4 d-block mb-1"></i> ${name}</span>`;
            e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        } else {
            state[c].tests[t][type] = content;
            state[c].tests[t][type + 'Name'] = name;
            e.target.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i> ${name}</span>`;
            e.target.classList.add('border-success', 'bg-success', 'bg-opacity-10');
        }
    } catch (err) {
        alert("Failed to read file.");
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

async function runTestsForColumn(c) {
    const btn = document.getElementById(`run-button-${c}`);

    if (!state[c].code) {
        alert(`Please upload a Python code file for column ${c} first.`);
        return;
    }

    // Check pairs
    const missingPairs = [];
    const validTests = [];
    for (let t = 1; t <= testCasesCount; t++) {
        const hasInput = !!state[c].tests[t].input;
        const hasExpected = !!state[c].tests[t].expected;
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
        document.getElementById(`diff-status-${c}-${t}`).innerHTML = '<span class="spinner-border spinner-border-sm me-1 text-primary" role="status"></span> Running...';
        document.getElementById(`diff-status-${c}-${t}`).className = "fw-bold text-primary";
    });

    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Running...';
    btn.disabled = true;

    for (let t of validTests) {
        const inputStr = state[c].tests[t].input;
        const expectedStr = state[c].tests[t].expected;
        const codeStr = state[c].code;

        let response = await runPythonTest(codeStr, inputStr, expectedStr, 15000);

        let statusSpan = document.getElementById(`diff-status-${c}-${t}`);
        let contentDiv = document.getElementById(`diff-content-${c}-${t}`);

        if (response.error) {
            statusSpan.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-danger me-1"></i>${response.error}`;
            statusSpan.className = "fw-bold text-danger";
            contentDiv.innerHTML = `<div class="alert alert-danger m-3"><i class="bi bi-x-octagon-fill me-2"></i>${response.error}</div>`;
        } else {
            let res = response.result;
            // res.status, res.time, res.diff_html
            let timeTaken = res.time ? res.time.toFixed(3) + 's' : '';
            let complexityInfo = timeTaken ? ` <span class="badge bg-light text-dark fw-normal border ms-1"><i class="bi bi-stopwatch me-1"></i>${timeTaken}</span>` : '';

            contentDiv.innerHTML = res.diff_html || '';

            if (res.status === 'Identical!') {
                statusSpan.innerHTML = `<i class="bi bi-check-circle-fill text-success me-1"></i>Success${complexityInfo}`;
                statusSpan.className = "fw-bold text-success";
            } else if (res.status === 'Different') {
                statusSpan.innerHTML = `<i class="bi bi-x-circle-fill text-danger me-1"></i>Differences Found${complexityInfo}`;
                statusSpan.className = "fw-bold text-danger";
            } else if (res.status.startsWith('Error:')) {
                // Short error message
                statusSpan.innerHTML = `<i class="bi bi-exclamation-octagon-fill text-warning me-1"></i>${res.status}${complexityInfo}`;
                statusSpan.className = "fw-bold text-warning";
            } else {
                statusSpan.innerHTML = res.status + complexityInfo;
                statusSpan.className = "fw-bold text-secondary";
            }
        }
    }

    btn.innerHTML = '<i class="bi bi-check2-all me-1"></i> Tests Completed';
    btn.classList.replace('btn-primary', 'btn-success');

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.replace('btn-success', 'btn-primary');
        btn.disabled = false;
    }, 3000);
}
