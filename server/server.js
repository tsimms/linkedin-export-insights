import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema, addResolversToSchema } from '@graphql-tools/schema';
import { expressMiddleware } from '@apollo/server/express4';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import JSZip from 'jszip';
import { ingest } from './data.js';
import getModelDefinitions from './graphql-model.js';

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

  const server = new ApolloServer({
    schema: schemaWithResolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    apollo: {
      csrfPrevention: false
    }
  });

  await server.start();

  app.use(
    '/',
    cors(),
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
