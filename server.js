import { promises as fs } from 'fs';
import JSZip from 'jszip';
import { ApolloServer, gql } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addResolversToSchema } from '@graphql-tools/schema';
import { DateTimeResolver, DateTimeTypeDefinition } from 'graphql-scalars';
import { ingest } from './data.js';

const loadData = async (filename) => {
  const dataStream = await fs.readFile(filename);
  const dataModel = (await ingest(dataStream, "all", JSZip))
      .map((d,index) => ({ id: index, ...d }));
  //console.log({ dataModel });
  return dataModel;
};

(async () => {
  const dataModel = await loadData("dataFile.zip");
/*
  ["message", "connection", "comment", "share", "reaction", "vote"]
    .forEach(type => { console.log(dataModel.filter(d => d.type === type)[0]); })
*/
    const { typeDefs, resolvers } = getModelDefinitions(dataModel)
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const schemaWithResolvers = addResolversToSchema({ schema, resolvers });
    const server = new ApolloServer({ schema: schemaWithResolvers });

    server.listen().then(({ url }) => {
      console.log(`Server running at ${url}`);
    });
})();

const getModelDefinitions = (data) => {
  const typeDefs = gql`

  ${DateTimeTypeDefinition}

  type Query {
    allActivities: [Activity]
    activitiesByType(type: String!, startDate: String, endDate: String): [Activity]
    reactionsByType(reactionType: String!, startDate: String, endDate: String): [Reaction]
    messagesByConversation(from: String, to: String, startDate: String, endDate: String): [Message]
    activitiesByDate(startDate: String, endDate: String): [Activity]
    connectionsByFilter(filter: String!, startDate: String, endDate: String): [Connection]
  }

  type Message {
    id: ID!
    conversation_id: String!
    conversation_title: String!
    from: String!
    sender_profile_url: String!
    to: String!
    recipient_profile_urls: String!
    date: DateTime!
    subject: String!
    content: String!
    folder: String!
    type: String!
    year: Int!
    month: String!
    week: String!
    direction: String!
  }
  
  type Connection {
    id: ID!
    first_name: String!
    last_name: String!
    url: String!
    email_address: String!
    company: String!
    position: String!
    connected_on: String!
    type: String!
    year: String!
    month: String!
    week: String!
    date: DateTime!
  }
  
  type Comment {
    id: ID!
    date: DateTime!
    link: String!
    message: String!
    type: String!
    year: Int!
    month: String!
    week: String!
  }
  
  type Share {
    id: ID!
    date: DateTime!
    sharelink: String!
    sharecommentary: String!
    sharedurl: String!
    mediaurl: String!
    visibility: String!
    type: String!
    year: Int!
    month: String!
    week: String!
  }
  
  type Reaction {
    id: ID!
    date: DateTime!
    link: String!
    reactionType: String!
    type: String!
    year: Int!
    month: String!
    week: String!
  }
  
  type Vote {
    id: ID!
    date: DateTime!
    link: String!
    optiontext: String!
    type: String!
    year: Int!
    month: String!
    week: String!
  }
  
  union Activity = Message | Connection | Comment | Share | Reaction | Vote
  
  `;

  // Filter routines
  const dateFilter = (data, start, end) => {
    if (!start || !end) return data;
    const s = new Date(start);
    const e = new Date(end);
    return data.filter(d => (new Date(d.date) >= s && new Date(d.date) <= e));
  }

  const responseObject = (results) => {
    // This doesn't seem to work for our sandbox
/*
    const response = {
      count: results ? results.length : 0,
      results: results || []
    };
*/
    console.log(`Returned response of ${results.length} results`);
    return results;
  };
  
  const resolvers = {
    Query: {
      allActivities: (parent, args, context, info) => {
        return data;
      },
      activitiesByType: (parent, { type, startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        const data_typeFilter = data_dateFilter.filter(item => item.type === type);
        return responseObject(data_typeFilter);
      },
      reactionsByType: (parent, { reactionType, startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        const data_reactionFilter = data_dateFilter.filter(item => item.type === 'reaction' && item.reactionType === reactionType);
        return responseObject(data_reactionFilter);
      },
      messagesByConversation: (parent, { from, to, startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        const data_userFilter =  data_dateFilter.filter(item => item.type === 'message' && (item.from.includes(from) || item.to.includes(to)));
        return responseObject(data_userFilter);
      },
      activitiesByDate: (parent, { startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        return responseObject(data_dateFilter);
      },      
      connectionsByFilter: (parent, { filter, startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        const data_keywordFilter = data_dateFilter.filter(item => item.type === 'connection' && 
          (item.first_name.includes(filter) || item.last_name.includes(filter) ||
           item.email_address.includes(filter) || item.company.includes(filter) ||
           item.position.includes(filter)));

        return responseObject(data_keywordFilter);
      }
    },
    DateTime: DateTimeResolver,
    Activity: {
      __resolveType: (obj, context, info) => {
        if (obj.type === 'message') {
          return 'Message';
        } else if (obj.type === 'connection') {
          return 'Connection';
        } else if (obj.type === 'comment') {
          return 'Comment';
        } else if (obj.type === 'share') {
          return 'Share';
        } else if (obj.type === 'reaction') {
          return 'Reaction';
        } else if (obj.type === 'vote') {
          return 'Vote';
        }
        return null; // Default fallback
      }
    }
  };
  return { typeDefs, resolvers };
}
