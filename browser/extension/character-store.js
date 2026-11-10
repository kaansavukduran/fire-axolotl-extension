/* SPDX-License-Identifier: MPL-2.0 */
globalThis.CharacterStore = (() => {
  'use strict';
  let database;
  function open() {
    return database ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('fire-axolotl-characters', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('characters', {keyPath: 'id'});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('characterStorageFailed'));
    });
  }
  async function all() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('characters').objectStore('characters').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('characterStorageFailed'));
    });
  }
  async function save(record) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite'), store = tx.objectStore('characters');
      const request = store.count();
      request.onsuccess = () => {if (request.result >= 8) tx.abort(); else store.add(record);};
      tx.oncomplete = () => resolve(record);
      tx.onabort = () => reject(new Error('characterLibraryFull'));
      tx.onerror = () => reject(new Error('characterStorageFailed'));
    });
  }
  async function remove(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      tx.objectStore('characters').delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(new Error('characterStorageFailed'));
    });
  }
  return {all, save, remove};
})();
