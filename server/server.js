import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
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
  app.use('/sandbox', (req, res) => {
    console.log(`Handling request for ${req.url}`);
    let responseSent = false;
    const proxyReq = proxy.web(req, res, {
//      target: 'https://sandbox.embed.apollographql.com/sandbox/explorer',
      target: 'https://timjimsimms.com/sandbox/explorer',
      changeOrigin: true,
      selfHandleResponse: true
    });

    proxy.on('proxyRes', (proxyRes) => {
      let bodyChunks = [];
      let contentEncoding = proxyRes.headers['content-encoding'];

      proxyRes.on('data', (chunk) => { bodyChunks.push(chunk); });
      proxyRes.on('end', () => {
        if (!responseSent) {
          const data = Buffer.concat(bodyChunks);
          let body = contentEncoding === 'br' ?
            zlib.brotliDecompressSync(data) :
            contentEncoding === 'gzip' ?
              zlib.gunzipSync(data) :
              data;

          body = body
            .toString()
            .replaceAll("https://studio-ui-deployments.apollographql.com", _serverUrl)

          res.setHeader('Content-Type', 'text/html');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
          responseSent = true;
          console.log(`Response body: ${body}`);
          res.send(body);
        }
      });
    });
  });

  app.use('/v2', (req, res) => {
    console.log(`Handling request for ${req.url}`);
    let responseSent = false;
    proxy.on('proxyRes', (proxyRes) => {
      let bodyChunks = [];
      proxyRes.on('data', (chunk) => {
        bodyChunks.push(chunk);
      });
      proxyRes.on('end', () => {
        if (responseSent)
          return;
        let body = Buffer.concat(bodyChunks).toString();
        body = body
          .replaceAll("https://sandbox.embed.apollographql.com", _serverUrl)
          .replaceAll("https://embeddable-sandbox.cdn.apollographql.com", _serverUrl);
        // console.log('Modified Response body:', body);
        responseSent = true;
        res.send(body);
      });
    });
    proxy.web(req, res, {
      target: `https://embeddable-sandbox.cdn.apollographql.com/v2/`,
      changeOrigin: true,
      selfHandleResponse: true
    });
  });

  app.use('/build/static', (req, res) => {
    console.log(`Handling request for ${req.url}`);
    let responseSent = false;
    let bodyChunks = [];
    let body = "";

    const handleProxyRes = (proxyRes) => {

        proxyRes.on('data', (chunk) => {
          console.log(`url: ${req.url}, chunk: ${chunk}`)
          bodyChunks.push(chunk);
        });
        proxyRes.on('end', () => {
          if (responseSent)
            return;
          body = Buffer.concat(bodyChunks).toString();
          body = body
            .replaceAll("https://sandbox.embed.apollographql.com", _serverUrl)
            .replaceAll("https://embeddable-sandbox.cdn.apollographql.com", _serverUrl)
            .replaceAll("https://studio-staging.apollographql.com", _serverUrl)
            .replaceAll("https://graphql-staging.api.apollographql.com", _serverUrl)
          console.log(`
          ${JSON.stringify({ url: req.url, path: req.path, route: req.route })}
          bodyChunks: ${bodyChunks.length} elements
          headers: ${JSON.stringify(proxyRes.headers)}
  ${body}
          `);
          responseSent = true;
          res.setHeader('Content-Type', proxyRes.headers['content-type']);
          res.send(body);
          proxy.removeListener('proxyRes', handleProxyRes);
        });

    }

      proxy.on('proxyRes', handleProxyRes);

      proxy.web(req, res, {
        target: `https://studio-ui-deployments.apollographql.com/build/static`,
        changeOrigin: true,
        selfHandleResponse: true
      });

  });

  app.get('/test', (req, res) => {
    //res.append('Cross-Origin-Resource-Policy', 'cross-origin');
    //res.set('Access-Control-Allow-Origin', '*');
    res.send('This is a test response!');
  });

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
          console.log(`Response body: ${newBody}`);
        }
/*
        const { url, method, params, headers } = req;
        console.log('Request: ', JSON.stringify({ method, url, headers, params }));
*/
      }
      originalSend.call(this, newBody);
    };
    next();
  });

  const server = new ApolloServer({
    schema: schemaWithResolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer })
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
  console.log(`🚀 Server ready at http://localhost:4000`);
};

// Start Apollo Server
startApolloServer();
