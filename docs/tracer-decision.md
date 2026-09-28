# Tracer decision

The tracer is behind the TypeScript `Tracer` interface in `scripts/tracer.ts`.

## Experiment result

Apple LLDB 14 exposes its Python API on this machine, but both an API launch and a direct `process launch` hang while starting `debugserver` in the current local execution environment. The prototype remains isolated in `scripts/lldb_tracer.py` and `LldbTracer`, but it is not selected by the pipeline.

## Chosen backend: guarded source instrumentation

`InstrumentedTracer` copies the original source into the job and never edits it. It creates `instrumented.cpp` beside it, inserts calls only in the configured visible range, and compiles the copy with `clang++ -g -O0`. A generic header serializes scalars, strings, arrays, nested vectors, pairs, sets, maps, stacks, and queues as JSON. The backend captures only variables referenced by the view spec and already declared at that source position.

To avoid changing C++ control-flow meaning, a control statement in the visible range must use braces. The tracer rejects an unbraced statement with its source line instead of guessing. `if` conditions are sampled before evaluation; loop headers are sampled at the beginning of each entered iteration; simple statements are sampled after execution. The normal and traced executions are compared by exit code and exact stdout before rendering.

The runner enforces wall-clock timeout, step count, serialized collection limits, and final trace size. A strict child-process memory cap is not portable in the current macOS runner and is not claimed.
