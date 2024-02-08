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
    setProxyRoute(req, res, {
      route: '/inigo',
      targetHost: 'explorer.inigo.io',
      replacements: []
    })
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

    window.addEventListener('message', async (event) => {
      const { data, origin } = event;
      try {
        debugger;
        const { url, method, headers, body } = JSON.parse(data);
        console.log({ body });
        // body is JSON
        const res = await fetch(url, { method, headers, body });
        if (res.ok) {
          const results = await res.json();
          let type = 'bridge_response';
          if (JSON.parse(body).query.includes('query IntrospectionQuery')) {
            type = 'bridge_introspection';
          }
          console.log('BRIDGE: sending "' + type + '" response from successful query');
          window.parent.postMessage(JSON.stringify({ type, results }), origin);
        } else {
          console.log(Object.keys(res));
          const message = 'Error response from endpoint: ' + res.statusText;
          window.parent.postMessage(JSON.stringify({ type: 'bridge_error', message }), origin);
        }
      } catch (e) {
        const message = 'Error sending request to endpoint';
        console.error(message);
        window.parent.postMessage(JSON.stringify({ type: 'bridge_error', message }), origin);
      }
    });
  
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
