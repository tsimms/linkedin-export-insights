
// Setup comms with bridge to server, for enrichment client proxy

const proxyUrl = (url) => {
  const newUrl = url
    .replace('www.linkedin.com', 'timjimsimms.com')
  return newUrl;
}

const checkCache = (url) => {
  const result = localStorage.getItem(`cache.${url}`);
  return result;
}

const setCache = (url, data) => {
  localStorage.setItem(`cache.${url}`, data);
}

const ClientProxy = {
  fetch: async (url) => {
    const cached = checkCache(url);
    if (cached) {
      return cached;
    }
    const fetchUrl = proxyUrl(url);
    const response = await fetch(fetchUrl);
    const html = await response.text();
    setCache(url, html);
    return html;
  },
  setCookie: async file => {
    const text = await file.text();
    debugger;
    console.log(`needing to process these har file contents: ${JSON.stringify(file)}`)
  }
}

export { ClientProxy };
