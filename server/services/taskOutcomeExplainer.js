import { randomUUID } from 'crypto';
import db from '../db.js';

/**
 * RuXt Task Outcome Explainer & Reporter
 * Formulates human-understandable, transparent explanations when tasks finish, stop halfway, fail, or abort.
 * Directly updates the active chat session so the user is always informed.
 */

export function notifyTaskOutcome({
  sessionId,
  jobState,
  taskContract,
  finalReport,
  error = null,
  isAborted = false
}) {
  if (!sessionId) {
    console.warn('[TaskOutcomeExplainer] No sessionId provided, skipping chat notification.');
    return null;
  }

  const goal = jobState?.goal || taskContract?.objective || 'Desktop Task';
  const hasSinhala = Boolean(
    taskContract?.isSinhala || 
    /[\u0D80-\u0DFF]/.test(goal) || 
    /sindu|katha|liyanna|danna|ahanna|balanna|ekak|ganan|karanna|open|mata/i.test(goal)
  );

  const totalSteps = taskContract?.planSteps?.length || jobState?.steps?.length || 0;
  const currentStep = (jobState?.currentStepIndex ?? -1) + 1;
  const isCompleted = finalReport?.status === 'COMPLETED' || (!isAborted && !error && finalReport?.evaluation?.completed);

  let message = '';

  if (isAborted) {
    // 1. User Aborted / Cancelled
    if (hasSinhala) {
      message = 
`🛑 **කාර්යය ඔබ විසින් නතර කරන ලදී (Task Stopped by User)**

**ඉලක්කය:** "${goal}"

• **තත්ත්වය:** පරිශීලකයා විසින් Escape යතුර එබීමෙන් හෝ Stop බොත්තම එබීමෙන් ක්‍රියාවලිය නවත්වන ලදී.
• **සිදු කර තිබූ ප්‍රගතිය:** පියවර ${currentStep} / ${totalSteps} සම්පූර්ණ කර තිබුණි.

💡 *නැවත මෙම කාර්යය ආරම්භ කිරීමට අවශ්‍ය නම් මට පවසන්න.*`;
    } else {
      message = 
`🛑 **Task Stopped by User**

**Goal:** "${goal}"

• **Status:** Execution was stopped via Stop button or Escape key.
• **Progress when stopped:** Completed ${currentStep} of ${totalSteps} checkpoints.

💡 *Let me know if you would like me to restart or adjust the task.*`;
    }
  } else if (error) {
    // 2. Unexpected Execution Error
    const errMsg = typeof error === 'string' ? error : (error?.message || 'Unknown system error');
    const failedStepName = taskContract?.planSteps?.[jobState?.currentStepIndex]?.name || 'Current Action';

    if (hasSinhala) {
      message = 
`❌ **කාර්යය අතරමගදී දෝෂයක් නිසා නැවතුණා (Task Execution Halted)**

**ඉලක්කය:** "${goal}"

**මොකක්ද වුණේ (Why it stopped):**
- **නැවතුණු පියවර:** [පියවර ${currentStep}/${totalSteps}] ${failedStepName}
- **හේතුව (Reason):** ${errMsg}
- **සම්පූර්ණ වූ පියවර ගණන:** ${Math.max(0, currentStep - 1)}/${totalSteps}

🔧 **යෝජිත විසඳුම (Next Steps):**
- අදාළ Application එක (උදා: Notepad/Chrome) වෙනත් window එකකින් block වී නැති බව තහවුරු කර නැවත උත්සාහ කරන්න.`;
    } else {
      message = 
`❌ **Task Execution Halted with an Error**

**Goal:** "${goal}"

**Why it stopped:**
- **Failed checkpoint:** [Step ${currentStep}/${totalSteps}] ${failedStepName}
- **Reason:** ${errMsg}
- **Successfully completed steps:** ${Math.max(0, currentStep - 1)} of ${totalSteps}

🔧 **Suggested Action:**
- Please ensure the target window is not minimized or obstructed and try again.`;
    }
  } else if (!isCompleted) {
    // 3. Partial or Incomplete (e.g. Unverified Criteria)
    const unverifiedReasons = finalReport?.evaluation?.unverified?.map(u => u.description || u.id).join(', ') || 'Certain verification criteria remained unfulfilled';
    const evalReason = finalReport?.evaluation?.reason || unverifiedReasons;

    // Check which steps succeeded
    const stepsOverview = (taskContract?.planSteps || []).map((s, idx) => {
      const isDone = idx < currentStep;
      return `${isDone ? '✅' : '⚠️'} පියවර ${idx + 1}: ${s.name}`;
    }).join('\n');

    const stepsOverviewEn = (taskContract?.planSteps || []).map((s, idx) => {
      const isDone = idx < currentStep;
      return `${isDone ? '✅' : '⚠️'} Step ${idx + 1}: ${s.name}`;
    }).join('\n');

    if (hasSinhala) {
      message = 
`⚠️ **කාර්යය අතරමග නැවතුණා / අසම්පූර්ණයි (Task Incomplete)**

ඔබ ලබා දුන් කාර්යය (*"${goal}"*) සම්පූර්ණයෙන්ම තහවුරු කර ගැනීමට නොහැකිව අතරමග නැවතුණා.

**මොකක්ද වුණේ (Execution Breakdown):**
${stepsOverview}

**අතරමග නැවතීමට හේතුව (Reason for Interruption):**
• ${evalReason}
• Application window එක නිවැරදිව focus කරගත නොහැකි වීම හෝ Editor එක තුළට content ඇතුළත් වීම සත්‍යාපනය (Verify) නොවීය.

💡 **මීළඟ පියවර (Recommendations):**
- Application window එක screen එක මත click කර focus කර තබන්න.
- මා විසින් නැවත උත්සාහ කිරීමට "try again" හෝ "නැවත කරන්න" යැයි පවසන්න.`;
    } else {
      message = 
`⚠️ **Task Incomplete / Halted Halfway**

The task (*"${goal}"*) could not be fully completed and verified.

**Execution Breakdown:**
${stepsOverviewEn}

**Reason for Interruption:**
• ${evalReason}
• Target application focus was interrupted or the text/content could not be verified in the editor canvas.

💡 **Recommendations:**
- Ensure the application window is brought to the foreground and click inside the editor.
- Reply "try again" to retry.`;
    }
  } else {
    // 4. Fully Completed Successfully
    const deliverableCount = Object.keys(finalReport?.verifiedDeliverables || {}).length;
    const deliverablesText = (taskContract?.planSteps || []).map((s, idx) => `✅ ${s.name}`).join('\n');

    if (hasSinhala) {
      message = 
`🎯 **කාර්යය සාර්ථකව අවසන් කළා! (Task Completed)**

ඔබ ලබා දුන් කාර්යය (*"${goal}"*) සාර්ථකව ක්‍රියාත්මක කර සත්‍යාපනය කරන ලදී. 🚀

**සම්පූර්ණ වූ පියවර (Completed Checkpoints):**
${deliverablesText}

• **තත්ත්වය:** සියලු සාර්ථකත්ව නිර්ණායක (${deliverableCount > 0 ? deliverableCount : totalSteps} criteria) තහවුරු විය.
• **Deliverable:** අවශ්‍ය සියලු text/actions පරිගණකය මත සජීවීව ක්‍රියාත්මක විය!`;
    } else {
      message = 
`🎯 **Task Completed Successfully!**

The task (*"${goal}"*) has been executed and verified on your PC. 🚀

**Completed Checkpoints:**
${deliverablesText}

• **Status:** All ${deliverableCount > 0 ? deliverableCount : totalSteps} success criteria verified with observable evidence.`;
    }
  }

  // Persist into chat_messages SQLite
  try {
    const msgId = randomUUID();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(msgId, sessionId, message);

    db.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);

    return { msgId, content: message };
  } catch (dbErr) {
    console.error('[TaskOutcomeExplainer Error]: Failed to write to database:', dbErr.message);
    return null;
  }
}
