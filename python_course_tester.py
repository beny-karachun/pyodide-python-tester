from flask import Flask, request, jsonify, render_template_string, make_response, session
import os
import difflib
import threading
import webbrowser
import subprocess
import sys
import uuid
import shutil
import time
import atexit
import resource
from datetime import datetime, timedelta
from threading import Thread, Lock
from concurrent.futures import ThreadPoolExecutor
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Set a secret key for session management
app.secret_key = 'your_secret_key'  # Replace with a secure random key in production

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Dictionary to keep track of session expiration times
session_expiry = {}
expiry_lock = Lock()

# Max concurrent executions
MAX_CONCURRENT_EXECUTIONS = 2  # Adjust as needed
execution_semaphore = threading.Semaphore(MAX_CONCURRENT_EXECUTIONS)

# ThreadPoolExecutor for managing code execution tasks
executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_EXECUTIONS)

# Cleanup interval in seconds
CLEANUP_INTERVAL = 60  # Run cleanup every 60 seconds

# Session lifetime in minutes (set to 60 minutes)
SESSION_LIFETIME = 240

# Max upload size in bytes (e.g., 5MB)
MAX_UPLOAD_SIZE = 5 * 1024 * 1024

# Max total disk usage for uploads in bytes (e.g., 100MB)
MAX_TOTAL_UPLOAD_SIZE = 100 * 1024 * 1024

def cleanup_sessions():
    while True:
        time.sleep(CLEANUP_INTERVAL)
        with expiry_lock:
            now = datetime.now()
            expired_sessions = [session_id for session_id, expiry in session_expiry.items() if expiry < now]
            for session_id in expired_sessions:
                user_upload_folder = os.path.join(UPLOAD_FOLDER, session_id)
                try:
                    shutil.rmtree(user_upload_folder)
                    print(f"Deleted expired session files for session_id: {session_id}")
                except Exception as e:
                    print(f"Error deleting files for session_id {session_id}: {e}")
                del session_expiry[session_id]
        # Check total disk usage and clean up if necessary
        total_size = get_total_uploads_size()
        if total_size > MAX_TOTAL_UPLOAD_SIZE:
            print("Total upload size exceeds limit. Cleaning up oldest sessions.")
            cleanup_oldest_sessions()

def get_total_uploads_size():
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(UPLOAD_FOLDER):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            total_size += os.path.getsize(fp)
    return total_size

def cleanup_oldest_sessions():
    with expiry_lock:
        sessions = list(session_expiry.items())
        sessions.sort(key=lambda x: x[1])  # Sort by expiry time
        for session_id, expiry in sessions:
            user_upload_folder = os.path.join(UPLOAD_FOLDER, session_id)
            try:
                shutil.rmtree(user_upload_folder)
                print(f"Deleted session files for session_id: {session_id} during cleanup")
            except Exception as e:
                print(f"Error deleting files for session_id {session_id}: {e}")
            del session_expiry[session_id]
            total_size = get_total_uploads_size()
            if total_size <= MAX_TOTAL_UPLOAD_SIZE:
                break

# Start the cleanup thread
cleanup_thread = Thread(target=cleanup_sessions, daemon=True)
cleanup_thread.start()

@app.before_request
def make_session_permanent():
    session.permanent = True
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    # Update session expiry time
    with expiry_lock:
        session_expiry[session['session_id']] = datetime.now() + timedelta(minutes=SESSION_LIFETIME)

@app.route('/')
def index():
    html = '''
    <!doctype html>
    <html lang="en">
    <head>
        <title>Python Code Tester ¬beny_karachun¬            For tutoring, private and group lessons: 0546123730</title>
        <!-- Bootstrap CSS -->
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body {
                background-color: #f8f9fa;
            }
            .drop-area {
                border: 2px dashed #ccc;
                border-radius: 15px;
                text-align: center;
                padding: 20px;
                font-size: 16px;
                color: #6c757d;
                transition: border-color 0.3s, color 0.3s;
                margin-bottom: 10px;
                cursor: pointer;
                background: #ffffff;
            }
            .drop-area.over {
                border-color: #007bff;
                color: #007bff;
            }
            .result {
                margin-top: 10px;
            }
            /* Diff table styling overrides */
            table.diff {width: 100%; border-collapse: collapse; margin-top: 10px;}
            table.diff th, table.diff td {
                border: 1px solid #ccc;
                padding: 10px;
                font-family: monospace;
                font-size: 14px;
                vertical-align: top;
            }
            .diff_header {
                background-color: #e0e0e0;
                font-weight: bold;
            }
            .diff_add {
                background-color: #d4edda;
            }
            .diff_chg {
                background-color: #fff3cd;
            }
            .diff_sub {
                background-color: #f8d7da;
            }
            #session-warning {
                color: #dc3545;
                font-weight: bold;
                margin-left: 10px;
            }
            .modal-xl {
                max-width: 90% !important;
            }
        </style>
    </head>
    <body>
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
          <div class="container-fluid">
            <a class="navbar-brand" href="#">Python Code Tester ¬beny.karachun, לשיעורים פרטיים 0546123730</a>
          </div>
        </nav>
        <div class="container">
            <div class="row mb-3">
                <div class="col d-flex align-items-center">
                    <span id="session-warning"></span>
                </div>
            </div>
            <div class="alert alert-info" id="instructions">
                <strong>Important:</strong> Please ensure all files are properly extracted before uploading.
                Do not drag files directly out of a zip archive. Make sure they are plain <code>.py</code>
                or <code>.txt</code> files.
            </div>

            <div class="row">
              <!-- Column 1 -->
              <div class="col-6">
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="card-title">Upload Your Python Code (Column 1)</h5>
                    </div>
                    <div class="card-body">
                        <div id="code-drop-area-1" class="drop-area mb-3">
                            Drag & Drop Python Code Here (.py)
                        </div>
                        <p class="text-muted">Once uploaded, your code filename will appear above.</p>
                    </div>
                </div>
                <h3 class="mb-3">Test Cases (Column 1)</h3>
                {% for i in range(1,6) %}
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="card-title">Test Case {{ i }}</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <div id="input-drop-area-1-{{ i }}" class="drop-area mb-2">Drag & Drop Input File Here (.txt)</div>
                            <div id="expected-drop-area-1-{{ i }}" class="drop-area">Drag & Drop Expected Output File Here (.txt)</div>
                        </div>
                        <div id="diff-result-1-{{ i }}" class="result">
                            <strong>Result:</strong> <span id="diff-status-1-{{ i }}"></span>
                            <!-- Button to trigger modal -->
                            <button type="button" class="btn btn-link p-0"
                                    data-bs-toggle="modal"
                                    data-bs-target="#diffModal-1-{{ i }}">
                                View Diff
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Modal for Diff (Column 1, Test i) -->
                <div class="modal fade" id="diffModal-1-{{ i }}" tabindex="-1" aria-labelledby="diffModalLabel-1-{{ i }}" aria-hidden="true">
                  <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                      <div class="modal-header">
                        <h5 class="modal-title" id="diffModalLabel-1-{{ i }}">Diff for Test Case {{ i }} (Column 1)</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                      </div>
                      <div class="modal-body">
                        <div class="table-responsive" id="diff-content-1-{{ i }}"></div>
                      </div>
                    </div>
                  </div>
                </div>
                {% endfor %}
                <div class="d-flex justify-content-end">
                    <button id="run-button-1" class="btn btn-primary btn-lg">Run Tests (Column 1)</button>
                </div>
              </div>

              <!-- Column 2 -->
              <div class="col-6">
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="card-title">Upload Your Python Code (Column 2)</h5>
                    </div>
                    <div class="card-body">
                        <div id="code-drop-area-2" class="drop-area mb-3">
                            Drag & Drop Python Code Here (.py)
                        </div>
                        <p class="text-muted">Once uploaded, your code filename will appear above.</p>
                    </div>
                </div>
                <h3 class="mb-3">Test Cases (Column 2)</h3>
                {% for i in range(1,6) %}
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="card-title">Test Case {{ i }}</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <div id="input-drop-area-2-{{ i }}" class="drop-area mb-2">Drag & Drop Input File Here (.txt)</div>
                            <div id="expected-drop-area-2-{{ i }}" class="drop-area">Drag & Drop Expected Output File Here (.txt)</div>
                        </div>
                        <div id="diff-result-2-{{ i }}" class="result">
                            <strong>Result:</strong> <span id="diff-status-2-{{ i }}"></span>
                            <!-- Button to trigger modal -->
                            <button type="button" class="btn btn-link p-0"
                                    data-bs-toggle="modal"
                                    data-bs-target="#diffModal-2-{{ i }}">
                                View Diff
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Modal for Diff (Column 2, Test i) -->
                <div class="modal fade" id="diffModal-2-{{ i }}" tabindex="-1" aria-labelledby="diffModalLabel-2-{{ i }}" aria-hidden="true">
                  <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                      <div class="modal-header">
                        <h5 class="modal-title" id="diffModalLabel-2-{{ i }}">Diff for Test Case {{ i }} (Column 2)</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                      </div>
                      <div class="modal-body">
                        <div class="table-responsive" id="diff-content-2-{{ i }}"></div>
                      </div>
                    </div>
                  </div>
                </div>
                {% endfor %}
                <div class="d-flex justify-content-end">
                    <button id="run-button-2" class="btn btn-primary btn-lg">Run Tests (Column 2)</button>
                </div>
              </div>
            </div>
        </div>

        <!-- Bootstrap JS -->
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            const MAX_UPLOAD_SIZE = {{ MAX_UPLOAD_SIZE }};

            function preventDefaults (e) {
              e.preventDefault()
              e.stopPropagation()
            }

            function highlight(e) {
              e.target.classList.add('over');
            }

            function unhighlight(e) {
              e.target.classList.remove('over');
            }

            function handleCodeDrop(e, col) {
              let dt = e.dataTransfer;
              let files = dt.files;
              let file = files[0];
              if (!file.name.endsWith('.py')) {
                  alert('Please upload a .py file.');
                  return;
              }
              if (file.size > MAX_UPLOAD_SIZE) {
                  alert('File size exceeds the maximum allowed size of 5MB.');
                  return;
              }
              uploadFile(file, 'code_' + col);
              e.target.textContent = 'Uploaded: ' + file.name;
            }

            for (let col = 1; col <= 2; col++) {
                let codeDropArea = document.getElementById('code-drop-area-' + col);
                codeDropArea.addEventListener('dragenter', preventDefaults, false)
                codeDropArea.addEventListener('dragover', preventDefaults, false)
                codeDropArea.addEventListener('dragleave', preventDefaults, false)
                codeDropArea.addEventListener('drop', preventDefaults, false)

                codeDropArea.addEventListener('dragenter', highlight, false)
                codeDropArea.addEventListener('dragover', highlight, false)
                codeDropArea.addEventListener('dragleave', unhighlight, false)
                codeDropArea.addEventListener('drop', unhighlight, false)
                codeDropArea.addEventListener('drop', function(e){handleCodeDrop(e, col)}, false)

                for (let i = 1; i <= 5; i++) {
                    let inputArea = document.getElementById('input-drop-area-' + col + '-' + i);
                    let expectedArea = document.getElementById('expected-drop-area-' + col + '-' + i);

                    inputArea.addEventListener('dragenter', preventDefaults, false)
                    inputArea.addEventListener('dragover', preventDefaults, false)
                    inputArea.addEventListener('dragleave', preventDefaults, false)
                    inputArea.addEventListener('drop', preventDefaults, false)

                    inputArea.addEventListener('dragenter', highlight, false)
                    inputArea.addEventListener('dragover', highlight, false)
                    inputArea.addEventListener('dragleave', unhighlight, false)
                    inputArea.addEventListener('drop', unhighlight, false)
                    inputArea.addEventListener('drop', function(e){handleFileDrop(e, 'input', col, i)}, false)

                    expectedArea.addEventListener('dragenter', preventDefaults, false)
                    expectedArea.addEventListener('dragover', preventDefaults, false)
                    expectedArea.addEventListener('dragleave', preventDefaults, false)
                    expectedArea.addEventListener('drop', preventDefaults, false)

                    expectedArea.addEventListener('dragenter', highlight, false)
                    expectedArea.addEventListener('dragover', highlight, false)
                    expectedArea.addEventListener('dragleave', unhighlight, false)
                    expectedArea.addEventListener('drop', unhighlight, false)
                    expectedArea.addEventListener('drop', function(e){handleFileDrop(e, 'expected', col, i)}, false)
                }

                document.getElementById('run-button-' + col).addEventListener('click', function(){
                    const runButton = document.getElementById('run-button-' + col);
                    fetch('/run?col=' + col, {method: 'POST', credentials: 'same-origin'})
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            alert(data.error);
                            return;
                        }
                        for (let i = 1; i <= 5; i++) {
                            let testResult = data['test' + i];
                            let statusSpan = document.getElementById('diff-status-' + col + '-' + i);
                            let contentDiv = document.getElementById('diff-content-' + col + '-' + i);
                            if (testResult == null) {
                                statusSpan.textContent = '';
                                contentDiv.innerHTML = '';
                            } else {
                                let timeTaken = testResult['time_taken'] ? testResult['time_taken'].toFixed(3) + 's' : '';
                                let memoryUsed = testResult['memory_used'] ? (testResult['memory_used'] + 'KB') : '';
                                let statusText = testResult['status'];
                                let complexityInfo = '';
                                if (timeTaken || memoryUsed) {
                                    complexityInfo = ' (Runtime: ' + timeTaken + ', Space: ' + memoryUsed + ')';
                                }
                                statusSpan.textContent = statusText + complexityInfo;
                                contentDiv.innerHTML = testResult['diff_html'] || '';
                                if (testResult['status'] === 'Identical!') {
                                    statusSpan.classList.remove('text-danger');
                                    statusSpan.classList.add('text-success');
                                } else if (testResult['status'] === 'Different') {
                                    statusSpan.classList.remove('text-success');
                                    statusSpan.classList.add('text-danger');
                                } else if (statusText.startsWith('Error:')) {
                                    statusSpan.classList.remove('text-success');
                                    statusSpan.classList.add('text-warning');
                                } else {
                                    statusSpan.classList.remove('text-success', 'text-danger', 'text-warning');
                                }
                            }
                        }

                        // Change run button to a checkmark for 5 seconds
                        const originalText = runButton.textContent;
                        runButton.textContent = '✔';
                        setTimeout(() => {
                            runButton.textContent = originalText;
                        }, 5000);
                    });
                });
            }

            function handleFileDrop(e, type, col, i) {
              let dt = e.dataTransfer;
              let files = dt.files;
              let file = files[0];
              if (!file.name.endsWith('.txt')) {
                  alert('Please upload a .txt file.');
                  return;
              }
              if (file.size > MAX_UPLOAD_SIZE) {
                  alert('File size exceeds the maximum allowed size of 5MB.');
                  return;
              }
              uploadFile(file, type + '_' + col + '_' + i);
              e.target.textContent = 'Uploaded: ' + file.name;
            }

            function uploadFile(file, type) {
                let url = '/upload'
                let formData = new FormData()
                formData.append('file', file)
                formData.append('type', type)

                fetch(url, {
                  method: 'POST',
                  body: formData,
                  credentials: 'same-origin'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                    } else {
                        console.log('File uploaded:', type);
                    }
                })
                .catch(() => {
                    console.log('Upload failed:', type);
                });
            }

            // Session timeout warning
            let sessionLifetime = {{ SESSION_LIFETIME }} * 60; // in seconds
            function updateSessionWarning() {
                if (sessionLifetime <= 0) {
                    document.getElementById('session-warning').textContent = 'Session expired. Please refresh the page.';
                    clearInterval(sessionInterval);
                } else {
                    let minutes = Math.floor(sessionLifetime / 60);
                    let seconds = sessionLifetime % 60;
                    document.getElementById('session-warning').textContent = 'Session expires in ' + minutes + 'm ' + seconds + 's';
                    sessionLifetime--;
                }
            }
            let sessionInterval = setInterval(updateSessionWarning, 1000);
            updateSessionWarning();
        </script>
    </body>
    </html>
    '''
    return render_template_string(html, MAX_UPLOAD_SIZE=MAX_UPLOAD_SIZE, SESSION_LIFETIME=SESSION_LIFETIME)

def get_user_upload_folder():
    session_id = session.get('session_id')
    user_upload_folder = os.path.join(UPLOAD_FOLDER, session_id)
    return user_upload_folder

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    file_type = request.form['type']  # e.g. 'code_1', 'input_1_3', 'expected_2_5'
    filename = secure_filename(file.filename)

    if file.content_length > MAX_UPLOAD_SIZE:
        return jsonify({'error': 'File size exceeds the maximum allowed size of 5MB.'}), 400

    # Parse file_type
    # Format: code_{col}, input_{col}_{test}, expected_{col}_{test}
    parts = file_type.split('_')
    if parts[0] == 'code':
        col = parts[1]
        # Check file extension for Python code
        if not filename.endswith('.py'):
            return jsonify({'error': 'Invalid file type. Please upload a .py file.'}), 400
        filename = f'code_{col}.py'
    elif parts[0] in ['input', 'expected']:
        if not filename.endswith('.txt'):
            return jsonify({'error': 'Invalid file type. Please upload a .txt file.'}), 400
        col = parts[1]
        test_num = parts[2]
        filename = f'{parts[0]}_{col}_{test_num}.txt'
    else:
        return jsonify({'error': 'Invalid file type.'}), 400

    user_upload_folder = get_user_upload_folder()
    os.makedirs(user_upload_folder, exist_ok=True)
    filepath = os.path.join(user_upload_folder, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    file.save(filepath)
    return jsonify({'success': 'File uploaded successfully'}), 200

def execute_code(code_path, input_path, output_path):
    # Run the code with the input file
    with open(input_path, 'rb') as infile, open(output_path, 'wb') as outfile:
        try:
            # Measure resource usage before
            before = resource.getrusage(resource.RUSAGE_CHILDREN)
            result = subprocess.run(
                ['python', code_path],
                stdin=infile,
                stdout=outfile,
                stderr=subprocess.PIPE,
                timeout=5,
                check=True,
                preexec_fn=lambda: os.setsid()
            )
            # Measure resource usage after
            after = resource.getrusage(resource.RUSAGE_CHILDREN)
            # Calculate memory usage in kilobytes
            memory_used = after.ru_maxrss - before.ru_maxrss
            return None, memory_used
        except subprocess.TimeoutExpired:
            return 'Error: Timeout', 0
        except subprocess.CalledProcessError as e:
            return f'Error: {e.stderr.decode()}', 0
        except Exception as e:
            return f'Error: {e}', 0

@app.route('/run', methods=['POST'])
def run_tests():
    col = request.args.get('col', 1, type=int)
    user_upload_folder = get_user_upload_folder()
    code_path = os.path.join(user_upload_folder, f'code_{col}.py')
    if not os.path.exists(code_path):
        return jsonify({'error': f'Code file for column {col} not uploaded'}), 400

    # Check for input/output file mismatches
    missing_pairs = []
    for i in range(1, 6):
        input_exists = os.path.exists(os.path.join(user_upload_folder, f'input_{col}_{i}.txt'))
        expected_exists = os.path.exists(os.path.join(user_upload_folder, f'expected_{col}_{i}.txt'))
        if input_exists != expected_exists:
            missing_pairs.append(i)
    if missing_pairs:
        missing_tests = ', '.join(str(i) for i in missing_pairs)
        return jsonify({'error': f'For test case(s) {missing_tests} in column {col}, both input and expected output files must be provided.'}), 400

    future = executor.submit(process_tests, user_upload_folder, code_path, col)
    try:
        results = future.result(timeout=30)  # Wait for up to 30 seconds
    except Exception:
        return jsonify({'error': 'Server is busy. Please try again later.'}), 503
    return jsonify(results)

def process_tests(user_upload_folder, code_path, col):
    results = {}
    # Acquire semaphore to limit concurrent executions
    with execution_semaphore:
        for i in range(1, 6):
            input_path = os.path.join(user_upload_folder, f'input_{col}_{i}.txt')
            expected_path = os.path.join(user_upload_folder, f'expected_{col}_{i}.txt')
            output_path = os.path.join(user_upload_folder, f'output_{col}_{i}.txt')
            if os.path.exists(input_path) and os.path.exists(expected_path):
                start_time = time.time()
                error, memory_used = execute_code(code_path, input_path, output_path)
                end_time = time.time()
                elapsed_time = end_time - start_time

                if error:
                    # Produce a diff_html showing expected vs empty output
                    actual_output = []
                    with open(expected_path, 'r') as f:
                        expected_output = f.read().splitlines()

                    diff_html = difflib.HtmlDiff().make_table(
                        expected_output, actual_output,
                        fromdesc='Expected Output', todesc='Actual Output',
                        context=False, numlines=1
                    )
                    results[f'test{i}'] = {
                        'status': error,
                        'diff_html': diff_html,
                        'time_taken': elapsed_time,
                        'memory_used': memory_used
                    }
                    continue

                with open(output_path, 'r') as f:
                    actual_output = f.read().splitlines()
                with open(expected_path, 'r') as f:
                    expected_output = f.read().splitlines()

                diff_html = difflib.HtmlDiff().make_table(
                    expected_output, actual_output,
                    fromdesc='Expected Output', todesc='Actual Output',
                    context=False, numlines=1
                )

                if actual_output == expected_output:
                    results[f'test{i}'] = {
                        'status': 'Identical!',
                        'diff_html': diff_html,
                        'time_taken': elapsed_time,
                        'memory_used': memory_used
                    }
                else:
                    results[f'test{i}'] = {
                        'status': 'Different',
                        'diff_html': diff_html,
                        'time_taken': elapsed_time,
                        'memory_used': memory_used
                    }
                try:
                    os.remove(output_path)
                except Exception as e:
                    print(f"Error deleting file {output_path}: {e}")
            else:
                # If both input and expected files are not provided, skip
                results[f'test{i}'] = None
    return results

def cleanup_on_exit():
    if os.path.exists(UPLOAD_FOLDER):
        shutil.rmtree(UPLOAD_FOLDER)

atexit.register(cleanup_on_exit)

if __name__ == '__main__':
    threading.Timer(1, lambda: webbrowser.open_new('http://127.0.0.1:5000/')).start()
    app.run()
