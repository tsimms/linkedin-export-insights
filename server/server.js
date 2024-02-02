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

  /*
  app.use('/sandbox', (req, res) => {
    console.log(`Handling request for ${req.url}`);
    console.log(`Headers: ${JSON.stringify(req.headers)}`);
    let responseSent = false;
    const proxyReq = proxy.web(req, res, {
//      target: 'https://sandbox.embed.apollographql.com/sandbox/',
      target: 'https://timjimsimms.com/sandbox/',
        // can't pull directly from sandbox.embed.apollographql.com because there's no ACAO header
        // on the preflight check, which is needed when loading into webcontainer. so we've gotta fake it.
      changeOrigin: true,
      selfHandleResponse: true
    });

    proxy.on('proxyRes', (proxyRes) => {
      console.log(JSON.stringify(Object.keys(proxyRes)))
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
          res.send(body);
        }
      });
    });
  });
*/

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
      res.setHeader('Content-Type', 'text/html');
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

  app.use('/sandbox', (req, res) => {
    setProxyRoute(req, res, {
      route: '/sandbox',
//      targetHost: 'sandbox.embed.apollographql.com',
      targetHost: 'timjimsimms.com',
// can't pull directly from sandbox.embed.apollographql.com because there's no ACAO header
// on the preflight check, which is needed when loading into webcontainer. so we've gotta fake it.
      replacements: []

    })
  });

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

  app.use('/build/static', (req, res) => {
    setProxyRoute(req, res, {
      route: '/build/static',
      targetHost: 'studio-ui-deployments.apollographql.com',
      replacements: [
        "https://sandbox.embed.apollographql.com",
        "https://embeddable-sandbox.cdn.apollographql.com",
        "https://studio-staging.apollographql.com",
        "https://graphql-staging.api.apollographql.com"
      ]
    });
  });

/*
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
*/

////////////////
/*
  let isProxying = false;
  
  const handleProxyRes = (req, res) => {
    return new Promise((resolve) => {
      console.log(`Handling request for ${req.url}`);
      let responseSent = false;
      let bodyChunks = [];
      let body = "";
  
      proxy.on('proxyRes', (proxyRes) => {
        proxyRes.on('data', (chunk) => {
          bodyChunks.push(chunk);
        });
  
        proxyRes.on('end', () => {
          body = Buffer.concat(bodyChunks).toString();
          body = body
            .replaceAll("https://sandbox.embed.apollographql.com", _serverUrl)
            .replaceAll("https://embeddable-sandbox.cdn.apollographql.com", _serverUrl)
            .replaceAll("https://studio-staging.apollographql.com", _serverUrl)
            .replaceAll("https://graphql-staging.api.apollographql.com", _serverUrl);
  
          console.log(`
          ${JSON.stringify({ url: req.url, path: req.path, route: req.route })}
          headers: ${JSON.stringify(proxyRes.headers)}
          `);
  
          if (!responseSent) {
            res.setHeader('Content-Type', proxyRes.headers['content-type']);
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            responseSent = true;
            res.send(body);
          }
          console.log(`proxyRes complete for ${req.url}`);
          resolve();
        });
      });
    });
  };
  
  const proxyRequest = (req, res) => {
    proxy.web(req, res, {
      target: `https://studio-ui-deployments.apollographql.com/build/static`,
      changeOrigin: true,
      selfHandleResponse: true
    });
    return Promise.resolve();
  };
  
  app.use('/build/static', async (req, res) => {
    proxyQueue.push({ req, res });
    await new Promise(resolve => setTimeout(resolve, Math.ceil(Math.random()*1000)));
  
    if (!isProxying) {
      isProxying = true;
      while (proxyQueue.length > 0) {
        const { req, res } = proxyQueue.shift();
        console.log(`Starting with ${req.url}`);
        await Promise.all([handleProxyRes(req, res), proxyRequest(req, res)]);
        console.log(`Done with ${req.url}`);
        console.log(`${proxyQueue.length} in q: ${JSON.stringify(proxyQueue.map(p => p.req.url))}`)
      }
      isProxying = false;
    }
  });
*/

/////////////
/*
  app.use('/api', (req, res) => {
    console.log(`>>>> Handling request for ${req.url}`);
    let responseSent = false;

    proxy.on('proxyRes', (proxyRes) => {
      let bodyChunks = [];
      let contentEncoding = proxyRes.headers['content-encoding'];

      proxyRes.on('data', (chunk) => {
        bodyChunks.push(chunk);
      });

      proxyRes.on('end', () => {
        if (!responseSent) {
          const data = Buffer.concat(bodyChunks);
          let body =
            contentEncoding === 'br'
              ? zlib.brotliDecompressSync(data)
              : contentEncoding === 'gzip'
              ? zlib.gunzipSync(data)
              : data;

          body = body.toString();
          responseSent = true;
          console.log(`API Response body: ${body}`);
          res.send(body);
        }
      });
    });
    proxy.web(req, res, {
      // target: 'https://graphql-staging.api.apollographql.com/api',
      target: 'https://timjimsimms.com/api/',
        // can't pull directly from https://graphql-staging.api.apollographql.com because there's no ACAO header
        // on the preflight check, which is needed when loading into webcontainer. so we've gotta fake it.
      changeOrigin: true,
      selfHandleResponse: true,
    });

  });
*/



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
        }
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
