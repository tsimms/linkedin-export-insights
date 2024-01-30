self.addEventListener('fetch', event => {
    console.log('Service Worker caught fetch event!');
    const url = new URL(event.request.url);
    if ([
      'sandbox.embed.apollographql.com',
      'embeddable-sandbox.cdn.apollographql.com'
    ].includes(url.hostname)) {
      url.host = '${_serverUrl}';
      const newRequest = new Request(url, event.request);
      event.respondWith(fetch(newRequest));
    }
  });