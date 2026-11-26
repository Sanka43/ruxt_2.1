import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '../..');

const isPackaged = __dirname.includes('app.asar');
const writableDataDir = process.env.RUXT_DATA_DIR || (process.env.APPDATA ? path.join(process.env.APPDATA, 'RuXt', 'data') : path.resolve(appRootDir, 'data'));
const userAgentsDir = path.join(writableDataDir, 'agents');
const bundledAgentsDir = path.resolve(appRootDir, 'agents');

const memoryCache = new Map();

/**
 * Resolves the agent's folder on disk, checking userAgentsDir then bundledAgentsDir.
 */
export function resolveAgentDir(slug) {
  const safeSlug = String(slug || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  if (!safeSlug) return null;

  const candidates = [
    path.join(userAgentsDir, safeSlug),
    path.join(bundledAgentsDir, safeSlug)
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
      return cand;
    }
  }

  // Default fallback if not created yet
  return path.join(userAgentsDir, safeSlug);
}

/**
 * Resolves the path to memory.json for a given agent.
 */
export function resolveMemoryFilePath(slug) {
  const agentDir = resolveAgentDir(slug);
  if (!agentDir) return null;
  return path.join(agentDir, 'memory.json');
}

/**
 * Creates a default empty memory structure for an agent.
 */
function createDefaultMemory(slug) {
  return {
    version: '2.1.0',
    agent: {
      slug: String(slug || '').toLowerCase(),
      updated_at: Date.now()
    },
    memories: [],
    experiences: [],
    preferences: []
  };
}

/**
 * Loads an agent's memory from memory.json with in-memory caching.
 */
export function loadMemory(slug) {
  const safeSlug = String(slug || '').toLowerCase();
  const filePath = resolveMemoryFilePath(safeSlug);
  if (!filePath) return createDefaultMemory(safeSlug);

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const cached = memoryCache.get(safeSlug);
      if (cached && cached._mtime >= stats.mtimeMs) {
        return cached.data;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data.memories)) data.memories = [];
      if (!Array.isArray(data.experiences)) data.experiences = [];
      if (!Array.isArray(data.preferences)) data.preferences = [];
      memoryCache.set(safeSlug, { data, _mtime: stats.mtimeMs });
      return data;
    }
  } catch (err) {
    console.warn(`[agentMemory] Failed to read memory.json for ${slug}:`, err.message);
  }

  const defaultMem = createDefaultMemory(safeSlug);
  memoryCache.set(safeSlug, { data: defaultMem, _mtime: Date.now() });
  return defaultMem;
}

/**
 * Saves memory data back to memory.json atomically.
 */
export function saveMemory(slug, memoryData) {
  const safeSlug = String(slug || '').toLowerCase();
  const agentDir = resolveAgentDir(safeSlug);
  if (!agentDir) return false;

  try {
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    const filePath = path.join(agentDir, 'memory.json');
    memoryData.agent = memoryData.agent || {};
    memoryData.agent.slug = safeSlug;
    memoryData.agent.updated_at = Date.now();

    const jsonStr = JSON.stringify(memoryData, null, 2);
    const tempFile = `${filePath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, jsonStr, 'utf8');
    fs.renameSync(tempFile, filePath);

    memoryCache.set(safeSlug, { data: memoryData, _mtime: Date.now() });
    return true;
  } catch (err) {
    console.error(`[agentMemory] Failed to write memory.json for ${slug}:`, err);
    return false;
  }
}

/**
 * Tokenizes text for keyword matching.
 */
function tokenize(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
      .split(/\s+/)
  )].filter(w => w.length > 2 && !/^(the|and|for|with|from|this|that|have|your|what|when|where|how|can|please|just|make|build)$/i.test(w));
}

/**
 * Retrieves the top relevant memories based on query similarity and importance.
 */
export function retrieveMemories(slug, query = '', { limit = 5, memoryType = null } = {}) {
  const memoryData = loadMemory(slug);
  const memories = memoryData.memories || [];
  if (!memories.length) return [];

  const q = String(query || '').trim();
  const queryTokens = tokenize(q);

  // If query is empty or trivial greeting, return top highest importance memories/preferences
  if (!queryTokens.length) {
    return memories
      .filter(m => !memoryType || m.type === memoryType)
      .sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5))
      .slice(0, limit);
  }

  const scored = [];
  for (const item of memories) {
    if (memoryType && item.type !== memoryType) continue;

    const contentTokens = tokenize(item.content);
    const tagTokens = Array.isArray(item.tags) ? item.tags.flatMap(t => tokenize(t)) : [];

    let score = 0;
    for (const t of queryTokens) {
      if (tagTokens.includes(t)) score += 3.0;
      if (contentTokens.includes(t)) score += 1.5;
    }

    const importance = typeof item.importance === 'number' ? item.importance : 0.7;
    const finalScore = score * (1 + importance);

    if (finalScore > 0 || (score === 0 && importance >= 0.95)) {
      scored.push({ item, score: finalScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.item);
}

/**
 * Adds an episodic memory (lesson, preference, guideline, fact) and persists it.
 */
export function addMemory(slug, {
  type = 'lesson',
  content,
  importance = 0.8,
  tags = [],
  metadata = {}
} = {}) {
  if (!content || !content.trim()) return null;

  const memoryData = loadMemory(slug);
  const memId = `mem_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  
  // Deduplicate near-identical memory content
  const cleanContent = content.trim();
  const existingIdx = memoryData.memories.findIndex(m => m.content && m.content.toLowerCase() === cleanContent.toLowerCase());
  
  if (existingIdx !== -1) {
    // Update existing memory importance and refresh timestamp
    memoryData.memories[existingIdx].importance = Math.max(memoryData.memories[existingIdx].importance || 0.7, importance);
    memoryData.memories[existingIdx].updated_at = Date.now();
    saveMemory(slug, memoryData);
    return memoryData.memories[existingIdx];
  }

  const newEntry = {
    id: memId,
    type: String(type).toLowerCase(),
    content: cleanContent,
    importance: Math.max(0.1, Math.min(1.0, Number(importance) || 0.8)),
    tags: Array.isArray(tags) ? tags : [],
    metadata: typeof metadata === 'object' ? metadata : {},
    created_at: Date.now(),
    updated_at: Date.now()
  };

  memoryData.memories.unshift(newEntry);

  // Keep memories bounded at 250 items max to preserve performance
  if (memoryData.memories.length > 250) {
    memoryData.memories.sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5));
    memoryData.memories = memoryData.memories.slice(0, 250);
  }

  saveMemory(slug, memoryData);
  return newEntry;
}

/**
 * Records a task experience (deliverable summary, supervisor score, review outcome).
 */
export function recordExperience(slug, {
  taskTitle,
  summary,
  score = null,
  verdict = 'COMPLETED',
  artifact = null,
  metadata = {}
} = {}) {
  const memoryData = loadMemory(slug);
  const expId = `exp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  const experience = {
    id: expId,
    task_title: taskTitle || 'Autonomous Task',
    summary: summary || '',
    score: typeof score === 'number' ? score : null,
    verdict,
    artifact,
    metadata,
    created_at: Date.now()
  };

  memoryData.experiences = memoryData.experiences || [];
  memoryData.experiences.unshift(experience);

  // Keep max 50 recent experiences
  if (memoryData.experiences.length > 50) {
    memoryData.experiences = memoryData.experiences.slice(0, 50);
  }

  saveMemory(slug, memoryData);
  return experience;
}

/**
 * Formats memories into prompt text for LLM injection.
 */
export function formatMemoryContext(memories = []) {
  if (!Array.isArray(memories) || !memories.length) return '';

  const lines = memories.map(m => {
    const label = (m.type || 'lesson').toUpperCase();
    return `- [${label}] ${m.content}`;
  });

  return `\n\n--- AGENT EPISODIC MEMORY (LEARNED LESSONS & USER GUIDELINES) ---\n` +
         `You remember the following verified rules, guidelines, and user preferences from previous sessions:\n` +
         lines.join('\n') +
         `\nStrictly adhere to these internalized lessons in your current execution.\n`;
}

const MEMORY_SCOPES = ['memories', 'experiences', 'preferences'];

/** Counts and last-update time, without returning the memory contents. */
export function memoryOverview(slug) {
  const data = loadMemory(slug);
  return {
    slug: String(slug || '').toLowerCase(),
    memories: data.memories.length,
    experiences: data.experiences.length,
    preferences: data.preferences.length,
    updatedAt: data.agent?.updated_at || null
  };
}

/** Removes one learned memory by id. Returns true if something was removed. */
export function deleteMemory(slug, id) {
  const data = loadMemory(slug);
  const before = data.memories.length;
  data.memories = data.memories.filter((m) => m.id !== id);
  if (data.memories.length === before) return false;
  return saveMemory(slug, data);
}

/** Clears one section ('memories' | 'experiences' | 'preferences') or everything ('all'). */
export function clearMemory(slug, scope = 'all') {
  if (scope !== 'all' && !MEMORY_SCOPES.includes(scope)) {
    throw new Error(`scope must be one of: all, ${MEMORY_SCOPES.join(', ')}`);
  }
  const data = loadMemory(slug);
  for (const key of scope === 'all' ? MEMORY_SCOPES : [scope]) data[key] = [];
  return saveMemory(slug, data);
}

export default {
  memoryOverview,
  deleteMemory,
  clearMemory,
  resolveAgentDir,
  resolveMemoryFilePath,
  loadMemory,
  saveMemory,
  retrieveMemories,
  addMemory,
  recordExperience,
  formatMemoryContext
};
