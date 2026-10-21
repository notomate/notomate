import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Editor,
  allBlocks,
  broadcastChannelSync,
  broadcastChannelTransport,
  collaboration,
  isDoc,
  presence,
  sampleDoc,
  type Doc,
} from './lib';

// Dev playground: persist to localStorage the way an app using the library would.
const KEY = 'notion-editor:doc:v1';

function load(): Doc {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (isDoc(parsed) && parsed.rootIds.length) return parsed;
  } catch {
    /* fall through to sample */
  }
  // Persist right away so other tabs load the same block ids (presence refers to ids).
  const doc = sampleDoc();
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    /* storage unavailable */
  }
  return doc;
}

let timer: ReturnType<typeof setTimeout> | undefined;

function save(doc: Doc) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(doc));
    } catch {
      /* quota exceeded (large images) — keep working in memory */
    }
  }, 500);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Editor
      blocks={allBlocks}
      plugins={[
        collaboration({ transport: broadcastChannelSync() }),
        presence({ transport: broadcastChannelTransport() }),
      ]}
      defaultDoc={load()}
      onChange={save}
      theme="system"
    />
  </StrictMode>,
);
