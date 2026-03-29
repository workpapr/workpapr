/**
 * Interface for pipeline tracing — decouples the analysis pipeline
 * from the training module's TraceRecorder implementation.
 */
export interface TraceHook {
  recordPipelineStep(
    action: string,
    target: string,
    resultSummary: string,
    decision: string,
    durationMs?: number
  ): void;
  completeAllTraces(): void;
}

/** No-op implementation for when tracing is not needed. */
export const nullTraceHook: TraceHook = {
  recordPipelineStep() {},
  completeAllTraces() {},
};
