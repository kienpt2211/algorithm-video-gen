import argparse
import json
import lldb
import os
import shlex


def scalar(value):
    raw = value.GetValue()
    summary = value.GetSummary()
    type_name = value.GetTypeName() or ""
    if summary is not None and ("string" in type_name or type_name in ("char *", "const char *")):
        return summary.strip('"')
    if raw is None:
        return None
    if raw in ("true", "false"):
        return raw == "true"
    try:
        return int(raw, 0)
    except (ValueError, TypeError):
        try:
            return float(raw)
        except (ValueError, TypeError):
            return summary.strip('"') if summary else raw


def serialize(value, depth=0):
    if depth > 5:
        return "<max-depth>"
    synthetic = value.GetSyntheticValue() if value.IsValid() else value
    if synthetic and synthetic.IsValid():
        value = synthetic
    count = value.GetNumChildren()
    type_name = value.GetTypeName() or ""
    if count == 0:
        return scalar(value)
    children = [value.GetChildAtIndex(i) for i in range(min(count, 256))]
    is_sequence = (
        "vector<" in type_name
        or "array<" in type_name
        or "deque<" in type_name
        or type_name.endswith("]")
        or all((child.GetName() or "").lstrip("[").rstrip("]").isdigit() for child in children)
    )
    if is_sequence:
        return [serialize(child, depth + 1) for child in children]
    result = {}
    for index, child in enumerate(children):
        name = child.GetName() or str(index)
        if name.startswith("__"):
            continue
        result[name] = serialize(child, depth + 1)
    return result if result else scalar(value)


def snapshot(frame):
    variables = frame.GetVariables(True, True, True, False)
    result = {}
    for index in range(min(variables.GetSize(), 256)):
        value = variables.GetValueAtIndex(index)
        name = value.GetName()
        if name and not name.startswith("__"):
            result[name] = serialize(value)
    return result


def source_frame(process, source_path):
    wanted = os.path.realpath(source_path)
    for thread in process:
        if thread.GetStopReason() not in (lldb.eStopReasonBreakpoint, lldb.eStopReasonPlanComplete):
            continue
        for frame in thread:
            entry = frame.GetLineEntry()
            file_spec = entry.GetFileSpec()
            full = os.path.realpath(os.path.join(file_spec.GetDirectory() or "", file_spec.GetFilename() or ""))
            if full == wanted:
                return frame
    return None


def trace_run(debugger, command, result, _internal_dict):
    parser = argparse.ArgumentParser(prog="trace-run")
    parser.add_argument("--binary", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--stdin", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--stdout", required=True)
    parser.add_argument("--stderr", required=True)
    parser.add_argument("--show-start", type=int, required=True)
    parser.add_argument("--show-end", type=int, required=True)
    parser.add_argument("--max-steps", type=int, default=5000)
    args = parser.parse_args(shlex.split(command))

    target = debugger.CreateTarget(args.binary)
    if not target.IsValid():
        raise RuntimeError("LLDB could not create target")

    line_count = sum(1 for _ in open(args.source, "r", encoding="utf-8"))
    resolved = 0
    for line in range(1, line_count + 1):
        breakpoint = target.BreakpointCreateByLocation(args.source, line)
        if breakpoint.GetNumLocations() == 0:
            target.BreakpointDelete(breakpoint.GetID())
        else:
            resolved += breakpoint.GetNumLocations()
    if resolved == 0:
        raise RuntimeError("No executable C++ source lines resolved")

    launch_info = lldb.SBLaunchInfo([])
    launch_info.SetWorkingDirectory(os.path.dirname(args.binary))
    launch_info.AddOpenFileAction(0, args.stdin, True, False)
    launch_info.AddOpenFileAction(1, args.stdout, False, True)
    launch_info.AddOpenFileAction(2, args.stderr, False, True)
    error = lldb.SBError()
    process = target.Launch(launch_info, error)
    if not error.Success():
        raise RuntimeError(error.GetCString())

    steps = []
    previous = None
    truncated = False
    iterations = 0
    while process.GetState() in (lldb.eStateStopped, lldb.eStateRunning):
        iterations += 1
        if iterations % 50 == 0:
            print("trace progress", iterations, "steps", len(steps), "state", process.GetState())
        if process.GetState() == lldb.eStateRunning:
            process.Stop()
        frame = source_frame(process, args.source)
        if frame is not None:
            line = frame.GetLineEntry().GetLine()
            current = {
                "line": line,
                "displayLine": max(args.show_start, min(args.show_end, line)),
                "function": frame.GetFunctionName() or "<global>",
                "depth": frame.GetThread().GetNumFrames() - 1,
                "variables": snapshot(frame),
            }
            if previous is not None:
                steps.append({
                    "index": len(steps),
                    "line": previous["line"],
                    "displayLine": previous["displayLine"],
                    "function": previous["function"],
                    "depth": previous["depth"],
                    "before": previous["variables"],
                    "after": current["variables"],
                })
            previous = current
            if len(steps) >= args.max_steps:
                truncated = True
                process.Kill()
                break
        process.Continue()

    if previous is not None and not truncated:
        steps.append({
            "index": len(steps), "line": previous["line"], "displayLine": previous["displayLine"],
            "function": previous["function"], "depth": previous["depth"],
            "before": previous["variables"], "after": previous["variables"],
        })
    exit_code = process.GetExitStatus() if process.GetState() == lldb.eStateExited else -1
    stdout = open(args.stdout, "r", encoding="utf-8", errors="replace").read() if os.path.exists(args.stdout) else ""
    payload = {"version": 1, "sourceFile": os.path.basename(args.source), "stdout": stdout, "exitCode": exit_code, "truncated": truncated, "steps": steps}
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    result.AppendMessage("trace written: " + args.output)


def __lldb_init_module(debugger, _internal_dict):
    debugger.HandleCommand("command script add -f lldb_tracer.trace_run trace-run")
