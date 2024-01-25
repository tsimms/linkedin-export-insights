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
  const dataModel = await loadData("data/Complete_LinkedInDataExport_01-23-2024.zip");
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
    activitiesByType(type: String!): [Activity]
    reactionsByType(reactionType: String!): [Reaction]
    messagesByConversation(from: String!, to: String!): [Message]
    activitiesByDate(date: DateTime): [Activity]
    connectionsByFilter(filter: String!): [Connection]
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
  
  const resolvers = {
    Query: {
      allActivities: (parent, args, context, info) => {
        // Return the entire data set without filtering
        // Replace this with your actual data fetching logic
        return data;
      },
      activitiesByType: (parent, { type }, context, info) => {
        // Logic to fetch activities by type
        // Replace this with your actual data fetching logic
        return data.filter(item => item.type === type);
      },
      reactionsByType: (parent, { reactionType }, context, info) => {
        // Logic to fetch reactions by type
        // Replace this with your actual data fetching logic
        return data.filter(item => item.type === 'reaction' && item.reactionType === reactionType);
      },
      messagesByConversation: (parent, { from, to }, context, info) => {
        // Logic to fetch messages by conversation
        // Replace this with your actual data fetching logic
        return data.filter(item => item.type === 'message' && item.from === from && item.to.includes(to));
      },
      activitiesByDate: (parent, { date }, context, info) => {
        // Parse the input date string to a Date object
        const targetDate = new Date(date);
      
        // Logic to fetch activities by date (using a date range comparison)
        // Replace this with your actual data fetching logic
        return data.filter(item => {
          const itemDate = new Date(item.date);
          // Adjust the condition based on your desired date range comparison
          return itemDate.getTime() === targetDate.getTime();
        });
      },      
      connectionsByFilter: (parent, { filter }, context, info) => {
        // Logic to fetch connections by name, email, company, or position
        // Replace this with your actual data fetching logic
        return data.filter(item => item.type === 'connection' && 
          (item.first_name.includes(filter) || item.last_name.includes(filter) ||
           item.email_address.includes(filter) || item.company.includes(filter) ||
           item.position.includes(filter)));
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



const launchServer = () => {

  // Your JavaScript object representing your data
  const data = {
    users: [
      { id: 1, name: 'John Doe', age: 25 },
      { id: 2, name: 'Jane Doe', age: 30 },
    ],
  };

  // Define your GraphQL schema
  const typeDefs = gql`

    type User {
      id: ID!
      name: String!
      age: Int!
    }

    input UserFilter {
      ageGreaterThan: Int
    }

    type Query {
      users(filter: UserFilter): [User]
    }
  `;


  // Implement your resolvers
      const resolvers = {
          Query: {
          users: (parent, args) => {
              // Check if there is a filter argument
              if (args.filter && args.filter.ageGreaterThan) {
              return data.users.filter(user => user.age > args.filter.ageGreaterThan);
              }
      
              // If no filter, return all users
              return data.users;
          },
          },
      };
    

  // Create an instance of ApolloServer
  const server = new ApolloServer({ typeDefs, resolvers });

  // Start the server
  server.listen().then(({ url }) => {
    console.log(`Server running at ${url}`);
  });

}
