/**
 * RuXt Dedicated Task Completion Controller & Lifecycle Manager
 * Enforces the core invariant: Action Executed != Action Succeeded != Task Completed.
 */

export const TaskLifecycleState = {
  CREATED: 'CREATED',
  UNDERSTANDING: 'UNDERSTANDING',
  PLANNING: 'PLANNING',
  EXECUTING: 'EXECUTING',
  OBSERVING: 'OBSERVING',
  VERIFYING: 'VERIFYING',
  RECOVERING: 'RECOVERING',
  REPLANNING: 'REPLANNING',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

export class TaskCompletionController {
  constructor(jobState) {
    this.jobState = jobState;
    this.currentState = TaskLifecycleState.CREATED;
    this.verifiedEvidence = new Map();
    this.stateHistory = [];
  }

  /**
   * Transition task to new lifecycle state
   */
  transitionTo(newState, reason = '') {
    const prev = this.currentState;
    this.currentState = newState;
    this.jobState.lifecycleState = newState;
    this.stateHistory.push({
      from: prev,
      to: newState,
      timestamp: Date.now(),
      reason
    });
  }

  /**
   * Register verified evidence for a specific criterion
   */
  recordEvidence(criterionId, evidence) {
    this.verifiedEvidence.set(criterionId, {
      timestamp: Date.now(),
      evidence
    });
    this.jobState.verifiedOutcomes[criterionId] = evidence;
  }

  /**
   * Evaluate whether the entire task outcome is genuinely completed
   */
  evaluateCompletion(taskContract) {
    if (!taskContract || !taskContract.successCriteria) {
      return { completed: false, reason: 'No task contract success criteria defined' };
    }

    const unverified = [];
    const verified = [];

    for (const sc of taskContract.successCriteria) {
      const ev = this.verifiedEvidence.get(sc.id);
      if (ev && ev.evidence && (ev.evidence.verified === true || ev.evidence.success === true || ev.evidence === true)) {
        verified.push({ id: sc.id, evidence: ev.evidence });
      } else {
        unverified.push(sc);
      }
    }

    const allSatisfied = unverified.length === 0;

    return {
      completed: allSatisfied,
      totalCriteria: taskContract.successCriteria.length,
      verifiedCount: verified.length,
      verified,
      unverified,
      reason: allSatisfied 
        ? 'All success criteria verified with observable evidence.' 
        : `Pending unverified criteria: ${unverified.map(u => u.id).join(', ')}`
    };
  }

  /**
   * Generate structured final completion report
   */
  generateReport(taskContract) {
    const evalRes = this.evaluateCompletion(taskContract);
    return {
      jobId: this.jobState.id,
      goal: this.jobState.goal,
      objective: taskContract.objective,
      status: evalRes.completed ? 'COMPLETED' : (this.currentState === TaskLifecycleState.CANCELLED ? 'CANCELLED' : 'PARTIAL_OR_FAILED'),
      lifecycleState: this.currentState,
      executionDurationMs: Date.now() - this.jobState.startTime,
      totalSteps: taskContract.planSteps.length,
      completedStepsCount: this.jobState.currentStepIndex + 1,
      evaluation: evalRes,
      verifiedDeliverables: Object.fromEntries(this.verifiedEvidence),
      stateHistory: this.stateHistory
    };
  }
}
