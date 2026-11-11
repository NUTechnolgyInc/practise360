#!/usr/bin/env node
/**
 * Parses docs/tracker/TRACKER.md (status table + Change Log) into JSON.
 * The Kanban UI (scripts/tracker/serve.mjs) reads only the JSON output --
 * it never parses markdown itself.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TRACKER_MD_PATH = join(__dirname, '../../docs/tracker/TRACKER.md');
export const TRACKER_JSON_PATH = join(__dirname, '../../docs/tracker/tracker.json');

const EPIC_HEADING_RE = /^##\s+(.+?)\s*$/;
const CHANGELOG_ENTRY_RE = /^###\s+(\d{4}-\d{2}-\d{2})\s*(?:—|-)\s*(.+?)\s*$/;
const TABLE_ROW_RE = /^\|(.+)\|\s*$/;
const TABLE_SEPARATOR_RE = /^\|[\s:|-]+\|\s*$/;

function splitRow(line) {
  const match = line.match(TABLE_ROW_RE);
  if (!match) return null;
  const cells = match[1].split('|').map((cell) => cell.trim());
  if (cells.length > 6) {
    // A note containing a literal "|" would otherwise split into extra
    // cells -- fold anything past Note back together rather than drop it.
    return [...cells.slice(0, 5), cells.slice(5).join(' | ')];
  }
  return cells;
}

function parseEpicHeading(text) {
  const sep = text.includes('—') ? '—' : null;
  if (!sep) return { id: text, title: text };
  const [id, ...rest] = text.split('—');
  return { id: id.trim(), title: rest.join('—').trim() };
}

export function parseTracker(markdown) {
  const lines = markdown.split('\n');
  const epics = [];
  const changeLog = [];

  let mode = null; // 'epic' | 'changelog' | null
  let currentEpic = null;
  let currentEntry = null;
  let inTable = false;
  let noteBuffer = [];

  const flushEpicNotes = () => {
    if (currentEpic && noteBuffer.length) {
      const text = noteBuffer.join('\n').trim();
      if (text) currentEpic.notes.push(text);
    }
    noteBuffer = [];
  };

  const flushEntry = () => {
    if (currentEntry) {
      currentEntry.body = currentEntry.bodyLines.join('\n').trim();
      delete currentEntry.bodyLines;
      changeLog.push(currentEntry);
    }
    currentEntry = null;
  };

  for (const rawLine of lines) {
    const line = rawLine;

    if (line.trim() === '## Change Log') {
      flushEpicNotes();
      mode = 'changelog';
      currentEpic = null;
      inTable = false;
      continue;
    }

    const changelogMatch = mode === 'changelog' ? line.match(CHANGELOG_ENTRY_RE) : null;
    if (changelogMatch) {
      flushEntry();
      currentEntry = { date: changelogMatch[1], title: changelogMatch[2], bodyLines: [] };
      continue;
    }

    const epicMatch = line.match(EPIC_HEADING_RE);
    if (epicMatch && !line.startsWith('###')) {
      flushEpicNotes();
      flushEntry();
      mode = 'epic';
      const { id, title } = parseEpicHeading(epicMatch[1]);
      currentEpic = { id, title, notes: [], tickets: [] };
      epics.push(currentEpic);
      inTable = false;
      continue;
    }

    if (mode === 'changelog') {
      if (currentEntry) currentEntry.bodyLines.push(line);
      continue;
    }

    if (mode === 'epic') {
      const cells = splitRow(line);
      if (cells) {
        if (!inTable) {
          inTable = true;
          continue;
        }
        if (TABLE_SEPARATOR_RE.test(line)) continue;
        const [id, title, status, health, lastUpdated, note] = cells;
        if (!id) continue;
        currentEpic.tickets.push({
          id,
          title: title ?? '',
          status: status ?? '',
          health: health ?? '',
          lastUpdated: lastUpdated ?? '',
          note: note ?? '',
        });
        continue;
      }
      if (inTable) inTable = false;
      if (line.trim() === '---') {
        flushEpicNotes();
        continue;
      }
      noteBuffer.push(line);
    }
  }

  flushEpicNotes();
  flushEntry();

  for (const epic of epics) {
    epic.notes = epic.notes.map((n) => n.trim()).filter(Boolean);
  }

  return { epics, changeLog };
}

export function buildTrackerJson(markdown, sourceFile) {
  const { epics, changeLog } = parseTracker(markdown);
  // A "## " heading with no ticket table isn't an epic -- it's front matter
  // (the "How to use this file" legend). Surface its text separately so the
  // Kanban board only ever renders real epics.
  const about = epics.filter((e) => e.tickets.length === 0).flatMap((e) => e.notes);
  const realEpics = epics.filter((e) => e.tickets.length > 0);
  return {
    generatedAt: new Date().toISOString(),
    sourceFile,
    about,
    epics: realEpics,
    changeLog,
  };
}

function main() {
  const markdown = readFileSync(TRACKER_MD_PATH, 'utf8');
  const json = buildTrackerJson(markdown, 'docs/tracker/TRACKER.md');
  writeFileSync(TRACKER_JSON_PATH, JSON.stringify(json, null, 2) + '\n');
  const ticketCount = json.epics.reduce((n, e) => n + e.tickets.length, 0);
  console.log(
    `Parsed ${json.epics.length} epics, ${ticketCount} tickets, ${json.changeLog.length} change log entries -> ${TRACKER_JSON_PATH}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
