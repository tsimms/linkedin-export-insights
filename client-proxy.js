// Setup comms with bridge to server, for enrichment client proxy

// Open IndexedDB database
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("cachedData", 1);

    request.onerror = function(event) {
      console.error("IndexedDB error:", event.target.errorCode);
      reject(event.target.errorCode);
    };

    request.onsuccess = function(event) {
      const db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      db.createObjectStore("cache", { keyPath: "url" });
    };
  });
};

// Check cache in IndexedDB
const checkCache = async (url) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["cache"], "readonly");
    const objectStore = transaction.objectStore("cache");
    const request = objectStore.get(url);

    request.onsuccess = function(event) {
      const result = event.target.result;
      resolve(result ? result.data : null);
    };

    request.onerror = function(event) {
      console.error("Error checking cache:", event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
};

// Store data in IndexedDB cache
const setCache = async (url, data) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["cache"], "readwrite");
    const objectStore = transaction.objectStore("cache");
    const updated = (new Date()).toISOString;
    const request = objectStore.put({ url, data, updated });

    request.onsuccess = function() {
      resolve();
    };

    request.onerror = function(event) {
      console.error("Error setting cache:", event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
};

// Setup proxy URL function
const proxyUrl = (url) => {
  const newUrl = url.replace('www.linkedin.com', 'timjimsimms.com');
  return newUrl;
};

// ClientProxy object for fetching data and setting cookies
const ClientProxy = {
  fetch: async (url) => {
    const cached = await checkCache(url);
    if (cached) {
      return { body: cached, cacheHit: true, url };
    }
    const fetchUrl = proxyUrl(url);
    const response = await fetch(fetchUrl);
    const html = await response.text();
    await setCache(url, html);
    return { body: html, cacheHit: false };
  },
  setCookie: async file => {
    const text = await file.text();
    const data = JSON.parse(text);
    const { cookies } = data.log.entries.filter(r => r.request.url.match(/linkedin/))[0].request;
    cookies.forEach(c => document.cookie = `${c.name}=${c.value}`);
    console.log('Set cookies.');
    console.log(`cookies: ${JSON.stringify(cookies)}`);
  }
};

export { ClientProxy };
