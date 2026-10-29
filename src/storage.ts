const DB = "crownfall-local";
export interface SavedMatch {
  raw: string;
  savedAt: number;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("matches");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Browser storage is blocked by another tab."));
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("matches", mode);
    const request = operation(transaction.objectStore("matches"));
    transaction.oncomplete = () => {
      db.close();
      resolve(request.result as T);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(
        transaction.error ?? new Error("Storage transaction was interrupted."),
      );
    };
  });
}
export const loadMatch = () =>
  transact<SavedMatch | undefined>("readonly", (store) => store.get("active"));
export const saveMatch = (raw: string) =>
  transact<void>("readwrite", (store) =>
    store.put({ raw, savedAt: Date.now() }, "active"),
  );
export const deleteMatch = () =>
  transact<void>("readwrite", (store) => store.delete("active"));
