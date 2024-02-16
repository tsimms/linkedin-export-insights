import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema, addResolversToSchema } from '@graphql-tools/schema';
import { expressMiddleware } from '@apollo/server/express4';
import http from 'http';
import httpProxy from 'http-proxy';
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import zlib from 'zlib';
import JSZip from 'jszip';
import { ingest } from './data.js';
import getModelDefinitions from './graphql-model.js';

let _serverUrl = '';

const loadData = async (filename) => {
  const dataStream = await fs.readFile(filename);
  const dataModel = (await ingest(dataStream, "all", JSZip))
    .map((d, index) => ({ id: index, ...d }));
  return dataModel;
};

const proxyQueue = [];

const startApolloServer = async () => {
  const dataModel = await loadData("dataFile.zip");
  const { typeDefs, resolvers } = getModelDefinitions(dataModel);
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const schemaWithResolvers = addResolversToSchema({ schema, resolvers });

  const app = express();
  const httpServer = http.createServer(app);
  const proxy = httpProxy.createProxyServer();

  app.use(cors());

  app.options('/', cors());
  app.options('/sandbox', cors());
  app.options('/api/graphql', cors());


  proxy.on('proxyReq', (proxyReq, req, res) => {
    console.log(`proxyReq props: ${JSON.stringify(Object.keys(proxyReq))}`);
  })
  proxy.on('proxyRes', (proxyRes, req, res) => {
    let bodyChunks = [];
    proxyRes.on('data',(chunk) => { bodyChunks.push(chunk) });
    proxyRes.on('end', () => {
      const rawData = Buffer.concat(bodyChunks);
      const data = proxyRes.headers['content-encoding'] === 'br'
        ? zlib.brotliDecompressSync(rawData)
        : proxyRes.headers['content-encoding'] === 'gzip'
          ? zlib.gunzipSync(rawData)
          : rawData;
      let body = data.toString();
      if (req.graphql && req.graphql.replacements) {
        req.graphql.replacements.forEach((replace) => {
          body = body.replaceAll(replace, _serverUrl);
        })
      };
        // override content-type when encrypted
      res.setHeader('Content-Type', proxyRes.headers['content-type']);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
      res.send(body);
    });
  })
  const setProxyRoute = (req, res, options) => {
    const { route, targetHost, replacements } = options;
    console.log(`Handling request for ${req.url}`);
    req.graphql = {
      replacements
    };
    proxy.web(req, res, {
      target: `https://${targetHost}${route}/`,
      changeOrigin: true,
      selfHandleResponse: true
    })
  };

  app.use('/v2', (req, res) => {
    setProxyRoute(req, res, {
      route: '/v2',
      targetHost: 'embeddable-sandbox.cdn.apollographql.com',
      replacements: [
        "https://sandbox.embed.apollographql.com",
        "https://embeddable-sandbox.cdn.apollographql.com"
      ]
    });
  });

  app.use('/sandbox', (req, res) => {
    setProxyRoute(req, res, {
      route: '/sandbox',
//      targetHost: 'sandbox.embed.apollographql.com',
      targetHost: 'timjimsimms.com',
// can't pull directly from sandbox.embed.apollographql.com because there's no ACAO header
// on the preflight check, which is needed when loading into webcontainer. so we've gotta fake it.
      replacements: [
        "https://studio-ui-deployments.apollographql.com"
      ]

    })
  });

  app.use('/build/static', (req, res) => {
    setProxyRoute(req, res, {
      route: '/build/static',
      targetHost: 'studio-ui-deployments.apollographql.com',
      replacements: [
        "https://sandbox.embed.apollographql.com",
        "https://embeddable-sandbox.cdn.apollographql.com",
        "https://studio-staging.apollographql.com",
//        "https://graphql-staging.api.apollographql.com"
      ]
    });
  });

  app.use('/inigo', (req, res) => {
    /*
    setProxyRoute(req, res, {
      route: '/inigo',
      targetHost: 'explorer.inigo.io',
      replacements: []
    });
    */
    res.send(`
<html>
  <head>
    <base href="https://explorer.inigo.io">
    <script>
    self["MonacoEnvironment"] = (function (paths) {
      return {
        globalAPI: false,
        getWorkerUrl : function (moduleId, label) {
          var result =  paths[label];
          if (/^((http:)|(https:)|(file:)|(\\\/\\\/))/.test(result)) {
            var currentUrl = String(window.location);
            var currentOrigin = currentUrl.substr(0, currentUrl.length - window.location.hash.length - window.location.search.length - window.location.pathname.length);
            if (result.substring(0, currentOrigin.length) !== currentOrigin) {
              var js = '/*' + label + '*/importScripts("' + result + '");';
              var blob = new Blob([js], { type: 'application/javascript' });
              return URL.createObjectURL(blob);
            }
          }
          return result;
        }
      };
    })({
      "json": "/monacoeditorwork/json.worker.bundle.js",
      "typescript": "/monacoeditorwork/ts.worker.bundle.js",
      "editorWorkerService": "/monacoeditorwork/editor.worker.bundle.js",
      "graphql": "/monacoeditorwork/graphql.worker.bundle.js",
      "javascript": "/monacoeditorwork/ts.worker.bundle.js"
    });
    </script>
    <script type="module" crossorigin src="/assets/index-6211fc1a.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-c80688b3.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
    `)
  });


  app.get('/test', (req, res) => {
    //res.append('Cross-Origin-Resource-Policy', 'cross-origin');
    //res.set('Access-Control-Allow-Origin', '*');
    res.send('This is a test response!');
  });

  app.get('/bridge', (req, res) => {
    res.setHeader('Content-type', 'text/html');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(`
  <script>
    // receive client request and send to server
    window.addEventListener('message', async (event) => {
      const { data, origin } = event;
      try {
        const { action } = JSON.parse(data);
        if (action === 'fetch') {
          await doFetch(data);
        } else if (action === 'ws') {
        }
      } catch (e) {
        console.log('Expecting action property in ' + data);
      }
    });

    const doFetch = async (data) => {
      try {
        const { action, url, method, headers, body, timestamp } = JSON.parse(data);
        console.log({ body });
        // body is JSON
        const res = await fetch(url, { method, headers, body });
        if (res.ok) {
          // process results from server
          const results = await res.json();
          let type = 'bridge_response';
          if (JSON.parse(body).query.includes('query IntrospectionQuery')) {
            type = 'bridge_introspection';
          }
          console.log('BRIDGE: sending "' + type + '" response from successful query');
          window.parent.postMessage(JSON.stringify({ type, timestamp, results }), origin);
        } else {
          const { errors } = await res.json();
          const message = 'Error response from endpoint: ' + res.statusText;
          window.parent.postMessage(JSON.stringify({ type: 'bridge_error', message, results: errors }), origin);
        }
      } catch (e) {
        const message = 'Error sending request to endpoint';
        console.error(message);
        window.parent.postMessage(JSON.stringify({ type: 'bridge_error', message }), origin);
      }
    }
    
    const ws = new WebSocket('ws://localhost:8080');
    const headers = {
      cookie: 'bcookie="v=2&34a8d04f-d347-493d-821a-e4259365bf12"; bscookie="v=1&202401091826037a8172c2-abe5-4edf-867f-178c3e13bfbdAQGc5Pk1ia2_LQKFzk0b623zLdu1bP6Q"; _gcl_au=1.1.633320568.1704824766; aam_uuid=86963082424392267153885736013401379176; g_state={"i_l":0}; li_rm=AQG3BKIg19KvzAAAAYzve9bGSKIOIqyEekj1mmi16Rb6G6PH3M2TV5LSPx3J-oVYNbQDuc5ivIYsq63DWG6zYuh8ySLxUOkrwQ4E5aabV3QB0HbzDCZefrwO; timezone=America/New_York; li_theme=light; li_theme_set=app; li_sugr=625df826-a160-4b38-8273-be4fa62fdcc4; _guid=d19463ee-2544-423c-be69-2a9580caaebb; JSESSIONID="ajax:6752329053734170832"; liap=true; lang=v=2&lang=en-us; li_alerts=e30=; AMCVS_14215E3D5995C57C0A495C55%40AdobeOrg=1; dfpfpt=4e9472be1eb5443c93db0fbb5fe8be1e; AnalyticsSyncHistory=AQKYGutAHCbsZQAAAY2eniUOjaLgt85HLwsjtEH8ZjSfnYDdhr0x8TJ9oI5cTF9WchqidWGUmfZcEBsPwngeCQ; lms_ads=AQEHvHvFfD7EnwAAAY2eniWYEJ_hjKZRLTAzI7EdoqpBRQwKVrUCN0bnyamJUiGMwNKyKarrQZquXQmyxEhRrmVdyTnixsRX; lms_analytics=AQEHvHvFfD7EnwAAAY2eniWYEJ_hjKZRLTAzI7EdoqpBRQwKVrUCN0bnyamJUiGMwNKyKarrQZquXQmyxEhRrmVdyTnixsRX; li_at=AQEDAQz5GKYFy9mkAAABjThxJfIAAAGNyJwgsE4AM1rcgrsj5o1VUH4HGPRdQlJ5OcXUfzZFJcd17qEJQneX4BQRJFwMGOr8M5V29tgLblaWKUphDCqhgFcwT0zQHvhwzRvTHm4lvBpL-XZ953YVsrE4; sdsc=1%3A1SZM1shxDNbLt36wZwCgPgvN58iw%3D; fptctx2=taBcrIH61PuCVH7eNCyH0K%252fD9DJ44Cptuv0RyrXgXCvm3%252blUFWu3y%252fc369R5shuBSHDuzdQdBTnvAC90kk1gatD92tkPnXO%252b3tdncNu%252fsFad0ju0bm8u%252bDLKoDDKxR%252flG%252bEU0RX%252bW8xdGO021dP67paDgqcCajhYd2LYvcVFVVRnfLWcdms0IfNdesqV87%252f8c5Vx2bPH%252fCUpqPU9ldEvwenz5boyo4pmzpJE80rnPEMZlOk%252foHao7BqmhikcFXetuM%252f1j1Hqg2GtptHoWbAgNTHMGfnl%252bbDrOqIZNk3%252fAMHpkLYqs0alXQPUgBdOt%252by7fN%252b5%252fw52Kylwt1rIFqAMgdYt2Tx47IY5HGXMZDQkWCU%253d; AMCV_14215E3D5995C57C0A495C55%40AdobeOrg=-637568504%7CMCIDTS%7C19769%7CMCMID%7C86740224657215136163829123382067700387%7CMCAAMLH-1708617775%7C7%7CMCAAMB-1708617775%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1708020175s%7CNONE%7CvVersion%7C5.1.1%7CMCCIDH%7C-2116355723; UserMatchHistory=AQI7_2AD1Y5HLwAAAY2txj3yoX1MxdYbwk1XmK-gTkjBlQRihPJgNJMicYK6PXKH8zC5UHglt1BByZFCBSUGirD_F98UGRY4LdM7T7KF5h4JDv1V4rMBqcW56a1RK-p331BePzxmb5gnjYApXp78H29mV8sqZ0LDf7WsSH1KUMMsXMgywOM-vQKE0M-LCEAWuanW3VaPOPSLgmSO-XkYv6SiYIxIgmDC8hjELmD7B9j54jO6r26POKkVKnF7M8sU7gBVE-AZmxkNyLVV9s5eUHahsp55dyCnsODWTZ5-bhARdqAgUx3Ped1mXucOgX2MMxDIPzQ; lidc="b=TB66:s=T:r=T:a=T:p=T:g=4627:u=2109:x=1:i=1708030616:t=1708117016:v=2:sig=AQHk0B4h3NJyrfHarNimfmgn7RqxNxjP"; __cf_bm=Hy4.J9h_UpLzRXdBlUlGKpXFxuy3ECynQbNp0tbvFRE-1708034456-1.0-AVaw5jkZJxh9hFaWLe63792S7QDGWwP+QImi6QZLuh2ll3Fg/h7n+BFQTNaAKH7lBQzbDDn39xC/kPsZXpeH33Y='
    }
    ws.onopen = () => { console.log('WebSocket connection established.'); };
    ws.onclose = () => { console.log('WebSocket connection closed.'); };
    ws.onerror = (error) => { console.error('WebSocket error:', error); };
    ws.onmessage = async (event) => {
      console.log('Received a proxy fetch message for ' + data.url);
      const data = JSON.parse(event.data);
      if (data.action === 'fetch') {
        const { url } = data;
        const response = await fetch(url, { headers });
        const html = await response.text();
        ws.send(html);
      }
    };
  
  </script>
    `);
  })

  app.get('/favicon.ico', (req, res) => {
    res.sendStatus('204');
  })

  app.use((req, res, next) => {
    // Accept incoming locally addressed requests that are ultimately destined for other origin
    const originalSend = res.send;
    res.send = function (body) {
      let newBody = body;
      if (req.method === 'GET' && req.url.split('?')[0] === '/') {
        if (req.query.serverUrl) {
          _serverUrl = req.query.serverUrl;
          console.log(`Replacing to ${_serverUrl}`);
          newBody = newBody
            .replaceAll("https://sandbox.embed.apollographql.com", _serverUrl)
            .replaceAll("https://embeddable-sandbox.cdn.apollographql.com", _serverUrl)
            .replaceAll("https://studio-ui-deployments.apollographql.com", _serverUrl);
          console.log(`Replacement on: ${req.url}`);
        }
      }
      originalSend.call(this, newBody);
    };
    next();
  });

  const server = new ApolloServer({
    schema: schemaWithResolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ footer: false, headers: { 'X-LI-TJS': '12345' } })
    ],
    apollo: {
      csrfPrevention: false
    }
  });

  await server.start();

  app.use(
    '/',
    cors({ origin: ['https://timjimsimms.com', 'https://studio.apollographql.com'] }),
    express.json(),
    expressMiddleware(server),
  );

  app.use((req, res, next) => {
    res.append('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });

  await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
  console.log(`🚀 Apollo Server ready at http://localhost:4000`);
};

// Start Apollo Server
startApolloServer();
