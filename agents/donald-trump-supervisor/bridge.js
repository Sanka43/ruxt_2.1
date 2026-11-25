function hasCriticalSignals({ prompt, result, outputFile }) {
  const text = String(result || '').trim();
  const ask = String(prompt || '').trim();
  const reasons = [];

  if (!text) reasons.push('No result text — nothing to show. Sad!');
  if (/couldn'?t|cannot|can\'t|failed|failure|error|exception|traceback|timed out|too long|missing instructions/i.test(text)) {
    reasons.push('The result itself admits failure or errors.');
  }
  if (text.length > 0 && text.length < 24) {
    reasons.push('The answer is tiny — not a real finished job.');
  }
  if (!outputFile && /\b(sheet|spreadsheet|numbers|calendar|budget|file|download|workbook|invoice|timetable|blend|model)\b/i.test(ask)) {
    reasons.push('No work file came back. People want the download, believe me.');
  }
  if (ask && text && !roughlyMatchesRequest(ask, text) && text.length < 80) {
    reasons.push('This barely answers what the user asked for.');
  }
  return reasons;
}

function roughlyMatchesRequest(ask, result) {
  const words = String(ask).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4).slice(0, 8);
  if (!words.length) return true;
  const hay = String(result).toLowerCase();
  return words.some((w) => hay.includes(w));
}

function trumpPass(workerName, rating) {
  const lines = [
    `I reviewed ${workerName || 'the agent'}’s work. Rating: ${rating}/5. Tremendous job. Really tremendous. I approve it — believe me.`,
    `Look, I checked it myself. ${rating} out of 5. ${workerName || 'This agent'} did a fantastic job. The best. Approved.`,
    `Folks, I went through the whole thing. ${rating}/5. No disasters. ${workerName || 'The agent'} crushed it. Green light. Huge win.`
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function trumpRecreate(workerName, reasons, rating) {
  const list = reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
  return [
    `Whoa, whoa, whoa. I rated ${workerName || 'the agent'}’s work ${rating}/5 — and I’m sorry, this needs a full recreate. So sad.`,
    list,
    `Here’s the deal: ${workerName || 'the agent'} is going to recreate it right now. No excuses. Make it beautiful. The best version. Go.`
  ].join('\n\n');
}

function reviewPayload(body = {}) {
  const workerName = body.workerName || body.agentName || 'the agent';
  const prompt = body.prompt || body.request || '';
  const result = body.result || '';
  const outputFile = body.outputFile || null;
  const reasons = hasCriticalSignals({ prompt, result, outputFile });
  const recreate = reasons.length > 0;
  const rating = recreate ? Math.max(1, 3 - reasons.length) : 5;
  const comment = recreate ? trumpRecreate(workerName, reasons, rating) : trumpPass(workerName, rating);
  const recreatePrompt = recreate
    ? `Supervisor Donald Trump rated this ${rating}/5 and asked you to recreate it.\nIssues:\n- ${reasons.join('\n- ')}\n\nOriginal request:\n${prompt}\n\nPrevious result:\n${result}`
    : null;

  return {
    ok: true,
    supervisor: {
      id: 'donald-trump-supervisor',
      name: 'Donald Trump',
      role: 'Supervisor'
    },
    rating,
    verdict: recreate ? 'RECREATE' : 'OK',
    critical: recreate,
    recreate,
    reasons,
    comment,
    speech: comment,
    message: comment,
    recreatePrompt,
    fixPrompt: recreatePrompt
  };
}

module.exports = {
  handle: async ({ method, path: routePath, body }) => {
    if (method === 'GET' && (routePath === '/' || routePath === '/status')) {
      return {
        id: 'donald-trump-supervisor',
        name: 'Donald Trump',
        role: 'Supervisor',
        available: true,
        supervisor: true
      };
    }
    if (method === 'POST' && routePath === '/review') {
      return reviewPayload(body || {});
    }
    return { error: `Unknown route ${method} ${routePath}` };
  }
};
