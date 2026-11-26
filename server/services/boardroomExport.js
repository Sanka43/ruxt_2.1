// Turns a boardroom session into a Markdown document users can save or share.

const PHASE_TITLES = {
  debate: 'Debate',
  proposal: 'Proposals',
  decision: 'Decision',
  vote: 'Vote',
  summary: 'Summary'
};

function heading(phase) {
  return PHASE_TITLES[phase] || (phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : 'Discussion');
}

export function boardroomToMarkdown({ session, messages = [], tasks = [] }) {
  const lines = [];
  lines.push(`# ${session.topic}`);
  lines.push('');
  lines.push(`- **Board:** ${session.squad_name || 'RuXt Specialist Executive Board'}`);
  lines.push(`- **Status:** ${session.status || 'unknown'}`);
  if (session.created_at) lines.push(`- **Started:** ${session.created_at}`);
  lines.push('');

  if (session.decision) {
    lines.push('## Decision', '', String(session.decision).trim(), '');
  }

  let currentPhase = null;
  for (const m of messages) {
    if (m.phase !== currentPhase) {
      currentPhase = m.phase;
      lines.push(`## ${heading(currentPhase)}`, '');
    }
    lines.push(`**${m.agent_name}** (${m.agent_role})`, '', String(m.message).trim(), '');
  }

  if (tasks.length) {
    lines.push('## Tasks', '');
    for (const t of tasks) {
      const done = t.status === 'done' || t.status === 'completed';
      lines.push(`- [${done ? 'x' : ' '}] ${t.title}${t.agent_id ? ` (${t.agent_id})` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** A safe download filename for a session topic. */
export function exportFileName(topic) {
  const base = String(topic || 'boardroom')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${base || 'boardroom'}.md`;
}
