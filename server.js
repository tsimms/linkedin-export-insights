import { promises as fs } from 'fs';
import { ApolloServer, gql } from 'apollo-server';
import JSZip from 'jszip';
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
    const server = new ApolloServer(getModelDefinitions(dataModel));
    server.listen().then(({ url }) => {
      console.log(`Server running at ${url}`);
    });
})();

const getModelDefinitions = (data) => {
  const typeDefs = gql`

  type Query {
    activitiesByType(type: String!): [Activity]
    reactionsByType(reactionType: String!): [Reaction]
    messagesByConversation(from: String!, to: String!): [Message]
    activitiesByDate(date: String!): [Activity]
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
    date: String!
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
    date: String!
  }
  
  type Comment {
    id: ID!
    date: String!
    link: String!
    message: String!
    type: String!
    year: Int!
    month: String!
    week: String!
  }
  
  type Share {
    id: ID!
    date: String!
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
    date: String!
    link: String!
    reactionType: String!
    type: String!
    year: Int!
    month: String!
    week: String!
  }
  
  type Vote {
    id: ID!
    date: String!
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
        // Logic to fetch activities by date
        // Replace this with your actual data fetching logic
        return data.filter(item => item.date === date);
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
