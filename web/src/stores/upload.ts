// upload.ts
import { create } from "zustand";
import { Upload } from "tus-js-client";

export type UploadStatus = "uploading" | "paused" | "error" | "done" | "canceled";

export interface UploadResult {
  id: string;
  filename: string;
  original_name: string;
  size: number;
  ext: string;
}

export interface UploadTask {
  id: string;
  workspaceId: string;
  name: string;
  size: number;
  bytesUploaded: number;
  status: UploadStatus;
  error?: string;
  result?: UploadResult;
}

interface UploadStore {
  tasks: UploadTask[];
  startUpload: (
    workspaceId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ) => { taskId: string; promise: Promise<UploadResult> };
  pause: (id: string) => void;
  resume: (id: string) => void;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
}

const ENDPOINT = "/api/v1/uploads/";
const CHUNK_SIZE = 8 * 1024 * 1024;
const PROGRESS_INTERVAL_MS = 250;

// Live tus uploads and their promise settlers, kept out of zustand state so
// they survive component unmounts (e.g. closing a picker modal).
const live = new Map<
  string,
  { upload: Upload; resolve: (r: UploadResult) => void; reject: (e: Error) => void }
>();

type CompleteListener = (task: UploadTask) => void;
const completeListeners = new Set<CompleteListener>();

/** Notifies when any upload finishes successfully. Returns an unsubscribe fn. */
export const subscribeUploadComplete = (listener: CompleteListener) => {
  completeListeners.add(listener);
  return () => {
    completeListeners.delete(listener);
  };
};

let nextId = 0;

const fileExt = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
};

export const useUploadStore = create<UploadStore>((set, get) => {
  const patch = (id: string, changes: Partial<UploadTask>) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    }));

  const begin = (upload: Upload) => {
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => upload.start());
  };

  return {
    tasks: [],

    startUpload: (workspaceId, file, onProgress) => {
      const id = `upload-${Date.now()}-${nextId++}`;
      set((state) => ({
        tasks: [
          ...state.tasks,
          { id, workspaceId, name: file.name, size: file.size, bytesUploaded: 0, status: "uploading" },
        ],
      }));

      let lastProgressAt = 0;
      const promise = new Promise<UploadResult>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: ENDPOINT,
          chunkSize: CHUNK_SIZE,
          retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
          metadata: {
            workspaceId,
            filename: file.name,
            filetype: file.type,
          },
          storeFingerprintForResuming: true,
          removeFingerprintOnSuccess: true,
          onProgress: (bytesUploaded, bytesTotal) => {
            const now = Date.now();
            if (now - lastProgressAt < PROGRESS_INTERVAL_MS && bytesUploaded < bytesTotal) return;
            lastProgressAt = now;
            patch(id, { bytesUploaded });
            if (onProgress && bytesTotal > 0) {
              onProgress(Math.round((bytesUploaded * 100) / bytesTotal));
            }
          },
          onSuccess: ({ lastResponse }) => {
            const entry = live.get(id);
            live.delete(id);
            const fileId = lastResponse.getHeader("Notomate-File-Id");
            const filename = lastResponse.getHeader("Notomate-File-Name");
            if (!fileId || !filename) {
              const error = new Error("Upload finished without a stored file");
              patch(id, { status: "error", error: error.message });
              entry?.reject(error);
              return;
            }
            const result: UploadResult = {
              id: fileId,
              filename,
              original_name: file.name,
              size: file.size,
              ext: fileExt(file.name),
            };
            patch(id, { status: "done", bytesUploaded: file.size, result });
            const task = get().tasks.find((t) => t.id === id);
            if (task) completeListeners.forEach((l) => l(task));
            entry?.resolve(result);
          },
          onError: (error) => {
            // Keep the live entry so the task can be retried; the promise
            // rejects now so callers can surface the failure.
            patch(id, { status: "error", error: error.message });
            live.get(id)?.reject(error);
          },
        });
        live.set(id, { upload, resolve, reject });
        begin(upload);
      });
      // Callers that don't await (e.g. fire-and-forget pickers) shouldn't
      // trigger unhandled rejection warnings; the panel shows the error.
      promise.catch(() => {});

      return { taskId: id, promise };
    },

    pause: (id) => {
      const entry = live.get(id);
      if (!entry) return;
      entry.upload.abort();
      patch(id, { status: "paused" });
    },

    resume: (id) => {
      const entry = live.get(id);
      if (!entry) return;
      patch(id, { status: "uploading", error: undefined });
      entry.upload.start();
    },

    retry: (id) => {
      get().resume(id);
    },

    cancel: (id) => {
      const entry = live.get(id);
      live.delete(id);
      patch(id, { status: "canceled" });
      if (entry) {
        entry.upload.abort(true).catch(() => {});
        entry.reject(new Error("Upload canceled"));
      }
    },

    clearFinished: () =>
      set((state) => ({
        tasks: state.tasks.filter((t) => t.status === "uploading" || t.status === "paused" || t.status === "error"),
      })),
  };
});

if (typeof window !== "undefined") {
  // Pick up uploads that gave up while the network was down.
  window.addEventListener("online", () => {
    const { tasks, resume } = useUploadStore.getState();
    tasks.filter((t) => t.status === "error").forEach((t) => resume(t.id));
  });

  window.addEventListener("beforeunload", (e) => {
    if (useUploadStore.getState().tasks.some((t) => t.status === "uploading")) {
      e.preventDefault();
    }
  });
}
