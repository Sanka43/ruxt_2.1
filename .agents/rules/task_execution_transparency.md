---
description: Invariant requiring transparent explanation to the user upon completion, failure, or interruption of any task, and dynamic window targeting.
always_on: true
---

# Rule: Task Execution Transparency & Dynamic Geometry

1. **Mandatory Outcome Explanation**:
   - Every autonomous task or desktop execution must report its final outcome back into the user's active chat session.
   - If a task completes successfully: present confirmed deliverables and verified checkpoints.
   - If a task stops halfway, is incomplete, fails, or is cancelled:
     - Clearly list completed checkpoints vs unverified/failed checkpoints.
     - State the precise reason why execution halted (e.g., focus lost, unverified editor state, exception, user abort).
     - Provide actionable recovery recommendations.
     - Respond in the language used by the user (Sinhala, Singlish, or English).

2. **Dynamic Window Geometry & Multi-Monitor Resolution**:
   - Never use hardcoded screen coordinate percentages (e.g., `width * 0.38`, `height * 0.40`) to click or type into application windows.
   - Always query the actual active target window bounding rect and center dynamically (`getWindowCenter`).
   - Support arbitrary display scaling and multi-monitor coordinates.
