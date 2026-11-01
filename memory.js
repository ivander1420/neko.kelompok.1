
/* ==========================================
   NETQUEST MIKO - LOCAL MEMORY SYSTEM
   Tidak membutuhkan database online
========================================== */

(() => {
  'use strict';

  const DB_NAME = 'NetQuestMikoMemory';
  const DB_VERSION = 1;

  let dbPromise;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB tidak tersedia.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true
          });

          store.createIndex('createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('facts')) {
          db.createObjectStore('facts', {
            keyPath: 'key'
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function saveMessage(role, text) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');

      tx.objectStore('messages').add({
        role,
        text: String(text),
        createdAt: Date.now()
      });

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getRecentMessages(limit = 15) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const request = db.transaction('messages')
        .objectStore('messages')
        .getAll();

      request.onsuccess = () => {
        resolve(
          request.result
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(-limit)
        );
      };

      request.onerror = () => reject(request.error);
    });
  }

  async function saveFact(key, value) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('facts', 'readwrite');

      tx.objectStore('facts').put({
        key,
        value: String(value),
        updatedAt: Date.now()
      });

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getFacts() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const request = db.transaction('facts')
        .objectStore('facts')
        .getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function clearMemory() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['messages', 'facts'],
        'readwrite'
      );

      tx.objectStore('messages').clear();
      tx.objectStore('facts').clear();

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getStats() {
    const messages = await getRecentMessages(100000);
    const facts = await getFacts();

    return {
      messages: messages.length,
      facts: facts.length
    };
  }

  window.NQ_MIKO_MEMORY = {
    saveMessage,
    getRecentMessages,
    saveFact,
    getFacts,
    clearMemory,
    getStats
  };

  window.NQ_MIKO_CLEAR_MEMORY = clearMemory;
  window.NQ_MIKO_MEMORY_STATS = getStats;

})();
