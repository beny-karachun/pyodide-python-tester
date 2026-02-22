importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodideReadyPromise = loadPyodide();
pyodideReadyPromise.then(() => {
    self.postMessage({ pyodideLoaded: true });
});

self.onmessage = async (event) => {
    const { id, codeStr, inputStr, expectedStr } = event.data;
    try {
        let pyodide = await pyodideReadyPromise;
        const wrapper = `
import sys
import io
import difflib
import time
import traceback

def process_test(code_str, input_str, expected_str):
    old_stdout = sys.stdout
    old_stdin = sys.stdin
    
    sys.stdout = io.StringIO()
    sys.stdin = io.StringIO(input_str)
    
    start_time = time.time()
    error_msg = None
    try:
        exec_globals = {"__name__": "__main__"}
        exec(code_str, exec_globals)
    except Exception as e:
        error_msg = traceback.format_exc()
    
    elapsed = time.time() - start_time
    actual_output_str = sys.stdout.getvalue()
    
    sys.stdout = old_stdout
    sys.stdin = old_stdin
    
    if error_msg:
        # Extract last line of traceback
        err_lines = error_msg.strip().split('\\n')
        short_err = err_lines[-1] if err_lines else "Unknown Error"
        
        # We can just render the traceback as the actual output
        diff_html = f"<h5>Error Traceback</h5><div class='bg-dark text-danger p-3 rounded font-monospace' style='white-space: pre-wrap;'>{error_msg}</div>"
        
        return {"status": f"Error: {short_err}", "time": elapsed, "diff_html": diff_html, "error_details": error_msg}
    
    actual_lines = actual_output_str.splitlines()
    expected_lines = expected_str.splitlines()
    
    diff_html = difflib.HtmlDiff().make_table(
        expected_lines, actual_lines,
        fromdesc='Expected Output', todesc='Actual Output',
        context=False, numlines=1
    )
    
    status = "Identical!" if actual_lines == expected_lines else "Different"
    return {"status": status, "time": elapsed, "diff_html": diff_html}
`;
        await pyodide.runPythonAsync(wrapper);
        let process_test = pyodide.globals.get("process_test");
        let resultDict = process_test(codeStr, inputStr, expectedStr);
        let result = resultDict.toJs({ dict_converter: Object.fromEntries });
        resultDict.destroy();

        self.postMessage({ id, success: true, result });
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};
