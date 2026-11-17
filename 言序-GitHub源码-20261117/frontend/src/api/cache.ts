/** 只缓存可重复读取的文稿和时间码，不持久化用户麦克风录音。 */
export async function cache<T>(key: string, value?: T): Promise<T | null> {
  let db: IDBDatabase | undefined;
  try {
    db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lingua-vue-cache", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("items");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise((resolve, reject) => {
      const transaction = db!.transaction(
        "items",
        value === undefined ? "readonly" : "readwrite",
      );
      const request =
        value === undefined
          ? transaction.objectStore("items").get(key)
          : transaction.objectStore("items").put(value, key);
      request.onsuccess = () =>
        resolve((value === undefined ? request.result : value) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
