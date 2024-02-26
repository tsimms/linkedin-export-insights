import { JSDOM } from 'jsdom';
import WebSocket from 'ws';

const _interval = 2000;
let _stop = false;
let _fetchBlock = false;
let _enrichmentData = {};
let _enrichmentQueue = [];
let _proxyWss;
let _clientConnection = null;


const getRemainingEnrichment = (list, data) => {
  const remaining = list.filter(e => Object.keys(data).includes(e));
  return remaining;
}


const enrichmentQueue = [
  //'https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7078962157496741888'
  //'https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7044982472572362753?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A7044982472572362753%2C7046928620199567361%29'
  //'https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7044982472572362753',
  //'https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A7143046692571889665'
  'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A7144303114068586496'
];
  
const transformUrl = (url) => {
  const newUrl = url.split('?')[0]
  return newUrl;
}

const runQuery = async (url) => {
  if (!url) {
    console.error(`Caught an empty url arg in runQuery()`);
    return;
  }
  if (_fetchBlock) {
    _enrichmentQueue.push(url);
    return;
  }
  _fetchBlock = true;
  const fetchUrl = transformUrl(url);
/*
  const res = await fetch(fetchUrl, { headers: { ..._headers } });
  const html = await res.text();
*/
  let html = null;
  try {
    html = await clientProxyFetch(fetchUrl);
  } catch(e) {
    console.error(e.message);
    _enrichmentQueue.push(url);
  }
  const { document } = (new JSDOM(html)).window;
  let returnData = {};
  const code = document.querySelectorAll('code')
  const data = Array.from(code)
    .map(e => e.innerHTML.replaceAll('\n',''))
    .map(text => { try { return JSON.parse(text) } catch {return {text}} })
    //.filter(e => !e.request)
    .find(e => e.included?.length && e.included?.some(d => d.entityUrn.match(/FEED_DETAIL/)))?.included;

  if (data) {
    const author = data.find(e => e.$type === "com.linkedin.voyager.feed.render.UpdateV2").actor.name.text;
    const commentary = data.find(e => e.$type === "com.linkedin.voyager.feed.render.UpdateV2").commentary.text.text;
  
    let { numImpressions, numLikes, numComments, numShares, reactionTypeCounts } =
      data.find(e => e.$type === "com.linkedin.voyager.feed.shared.SocialActivityCounts" && !e.entityUrn.includes('comment'))
    reactionTypeCounts = reactionTypeCounts?.map(r => ({ reactionType: r.reactionType, count: r.count }));
    
    console.log({ [url]: { 
      author,
      commentary:JSON.stringify(commentary),
      numImpressions,
      numLikes,
      numComments,
      numShares,
      reactionTypeCounts:JSON.stringify(reactionTypeCounts)
    } });
    returnData = {
      status: (new Date()).toISOString(),
      url,
      post: { author, commentary, numImpressions, numLikes, numComments, numShares, reactionTypeCounts }
    };
  
  } else {
    console.log(`hmmmm, this URL didn't have the right format: ${url}`);
  }
  _fetchBlock = false;
  return returnData;
}


const clientProxyFetch = (url) => new Promise((resolve, reject) => {
  if (!_clientConnection) {
    reject('No client connection available.');
    return;
  }
  const message = { action: 'fetch', url };
  _clientConnection.send(JSON.stringify(message));
  _clientConnection.on('message', (message) => {
    const body = message.toString();
    console.log(`clientProxyFetch():: response for ${url} of length ${body.length}`);
    resolve(body);
  });
  _clientConnection.once('error', (error) => { reject(error); });
});

const launchEnrichment = async () => {
  _proxyWss = new WebSocket.Server({ port: 8080 });
  _proxyWss.on('connection', (ws) => {
    console.log('Client connected.');
    _clientConnection = ws;
    ws.on('close', () => {
        console.log('Client disconnected.');
        _clientConnection = null;
    });
  });
  console.log(`running wss server.`);


  _stop = false;
  while (!_stop) {
    await new Promise(resolve => setTimeout(resolve, _interval));  
    if (_enrichmentQueue.length && !_fetchBlock) {
      const nextUrl = _enrichmentQueue.pop();
      if (!Object.keys(_enrichmentData).includes(nextUrl)) {
        const post = await runQuery(nextUrl);
        _enrichmentData[post.url] = post;
        // setEnrichmentDataToStorage(existingData);
      }  
    }
  };
}

const stopEnrichment = () => {
  _stop = true;
}

const getPost = async (url) => {
  if (_enrichmentData[url])
    return _enrichmentData[url];
  if (!_enrichmentQueue.length) {
    // get instant request data
    const post = await runQuery(url);
    if (post) {
      _enrichmentData[url] = post;
      return post;  
    }
    // otherwise, might have gotten in there realizing we need to queue instead.
  }
  if (! _enrichmentQueue.includes(url))
    _enrichmentQueue.push(url);
  return { status: 'queued' };
}


export { getPost, launchEnrichment, stopEnrichment };
