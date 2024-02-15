import { JSDOM } from 'jsdom';

const _interval = 2000;
const _headers = {
  cookie: `bcookie="v=2&34a8d04f-d347-493d-821a-e4259365bf12"; bscookie="v=1&202401091826037a8172c2-abe5-4edf-867f-178c3e13bfbdAQGc5Pk1ia2_LQKFzk0b623zLdu1bP6Q"; _gcl_au=1.1.633320568.1704824766; aam_uuid=86963082424392267153885736013401379176; g_state={"i_l":0}; li_rm=AQG3BKIg19KvzAAAAYzve9bGSKIOIqyEekj1mmi16Rb6G6PH3M2TV5LSPx3J-oVYNbQDuc5ivIYsq63DWG6zYuh8ySLxUOkrwQ4E5aabV3QB0HbzDCZefrwO; timezone=America/New_York; li_theme=light; li_theme_set=app; li_sugr=625df826-a160-4b38-8273-be4fa62fdcc4; _guid=d19463ee-2544-423c-be69-2a9580caaebb; JSESSIONID="ajax:6752329053734170832"; liap=true; lang=v=2&lang=en-us; li_alerts=e30=; AMCVS_14215E3D5995C57C0A495C55%40AdobeOrg=1; dfpfpt=4e9472be1eb5443c93db0fbb5fe8be1e; AnalyticsSyncHistory=AQKYGutAHCbsZQAAAY2eniUOjaLgt85HLwsjtEH8ZjSfnYDdhr0x8TJ9oI5cTF9WchqidWGUmfZcEBsPwngeCQ; lms_ads=AQEHvHvFfD7EnwAAAY2eniWYEJ_hjKZRLTAzI7EdoqpBRQwKVrUCN0bnyamJUiGMwNKyKarrQZquXQmyxEhRrmVdyTnixsRX; lms_analytics=AQEHvHvFfD7EnwAAAY2eniWYEJ_hjKZRLTAzI7EdoqpBRQwKVrUCN0bnyamJUiGMwNKyKarrQZquXQmyxEhRrmVdyTnixsRX; AMCV_14215E3D5995C57C0A495C55%40AdobeOrg=-637568504%7CMCIDTS%7C19767%7CMCMID%7C86740224657215136163829123382067700387%7CMCAAMLH-1708461646%7C7%7CMCAAMB-1708461646%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1707864046s%7CNONE%7CvVersion%7C5.1.1%7CMCCIDH%7C-2116355723; fptctx2=taBcrIH61PuCVH7eNCyH0K%252fD9DJ44Cptuv0RyrXgXCvm3%252blUFWu3y%252fc369R5shuBSHDuzdQdBTnvAC90kk1gatD92tkPnXO%252b3tdncNu%252fsFad0ju0bm8u%252bDLKoDDKxR%252flG%252bEU0RX%252bW8xdGO021dP67sxB5wU908YiuuRlcPcI%252fhI5p0isEUjW7vzF2iB4firBmmvRX0YRGwOJuh%252fXoGu%252fLO87ZQJCICREASrAlgZLH2r5LGikqZbiophRSLPexxNNrUzS3ALP7eTcyitPslttK1SYyRrIqDb4rL%252fBPq7my3Fx6EmkQb0%252f4vTq%252bDvfbXi91W07f6G1PkXGxwphDDU1CyB4ZLBxzxaC98J941Bu3X4%253d; li_at=AQEDAQz5GKYFy9mkAAABjThxJfIAAAGNyJwgsE4AM1rcgrsj5o1VUH4HGPRdQlJ5OcXUfzZFJcd17qEJQneX4BQRJFwMGOr8M5V29tgLblaWKUphDCqhgFcwT0zQHvhwzRvTHm4lvBpL-XZ953YVsrE4; sdsc=1%3A1SZM1shxDNbLt36wZwCgPgvN58iw%3D; __cf_bm=BqauUe7EKkoHQ2ghRrDFjCc9_7scD6HZaGMuJ61KyKY-1707940429-1.0-AecLCHZHMrQ4v3ksednUb9BA1R+CaNNdcZdbiWt4DrqaSVhjXPM1XsY/3rxoyKIRi4sqCSKsvKofKQBZdDfEkOo=; UserMatchHistory=AQKReAEUL1PVzwAAAY2pSLb-sELtcX4ls50C0h916NkkNfW5eGbbpAgm4_4WoBDEqqLzUo8qbtpT3vFGyUcW3nKoTCqJPfvfwAJDOrDsWxQeUgN34pRXiLcv8cq5Xq-sUalyJK2M0q4zKuVY4Hu79MHOCVTo_Z9djuCfWxTw0jLdJB0MmG5eYCbvDMzp4x-WvdYzQ6a_FNzNm6G4FF7CZ0oN6kZCKOX6sMe_tBOfVOZIWZHhZt959ZCCd2_sRqew3-wWgMrcYLBoHzvM5OWXfa6Fa4ynbV6RxiWGroAUTd51HsPu3mS1teZ8kou9n65r77fbp1c; lidc="b=TB66:s=T:r=T:a=T:p=T:g=4624:u=2109:x=1:i=1707942132:t=1708013119:v=2:sig=AQHNaigKGai-Iq77OVQt_AUtQpVvK31a"`
}
let _stop = false;
let _fetchBlock = false;
let _enrichmentData = {};
let _enrichmentQueue = [];


const getEnrichmentDataFromStorage = () => {
  let data = localStorage.getItem('posts');
  if (! data) {
    data = {};
    localStorage.setItem('posts', data);
  }
  return data;
}

const setEnrichmentDataToStorage = (data) => {
  localStorage.setItem('posts', data)
}

const getRemainingEnrichment = (list, data) => {
  const remaining = list.filter(e => Object.keys(data).includes(e));
  return remaining;
}

/*
const enrichmentQueue = [
  //'https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7078962157496741888'
  //'https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7044982472572362753?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A7044982472572362753%2C7046928620199567361%29'
  'https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7044982472572362753',
  'https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A7143046692571889665'
];
*/
  
const transformUrl = (url) => {
  const newUrl = url
    .replace('www.linkedin.com', 'timjimsimms.com')
    .split('?')[0]
  return newUrl;
}

const runQuery = async (url) => {
  if (_fetchBlock) {
    _enrichmentQueue.push(url);
    return;
  }
  _fetchBlock = true;
  const fetchUrl = transformUrl(url);
  const res = await fetch(fetchUrl, { headers: { ..._headers } });
  const html = await res.text();
  const { document } = (new JSDOM(html)).window;
  let returnData = {};
  const code = document.querySelectorAll('code')

  debugger;
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

const launchEnrichment = async () => {
/*
  const existingData = getEnrichmentDataFromStorage();
  const enrichmentQueue = getRemainingEnrichment(list, existingData);
*/
  _stop = false;
  while (_enrichmentQueue.length && !_stop && !_fetchBlock) {
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
    return post;
  }
  if (! _enrichmentQueue.includes(url))
    _enrichmentQueue.push(url);
  return { status: 'queued' };
}

(() => {
  launchEnrichment();
})()

export { getPost };