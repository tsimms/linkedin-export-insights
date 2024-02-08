import { DateTimeResolver, DateTimeTypeDefinition } from 'graphql-scalars';

const getModelDefinitions = (data) => {
  const typeDefs = `#graphql

    ${DateTimeTypeDefinition}

    type Query {
      allActivities: [Activity]
      activitiesByType(type: String!, startDate: String, endDate: String): [Activity]
      reactionsByType(reactionType: String!, startDate: String, endDate: String): [Reaction]
      messagesByConversation(from: String, to: String, startDate: String, endDate: String): [Message]
      activitiesByDate(startDate: String, endDate: String): [Activity]
      connectionsByFilter(filter: String!, startDate: String, endDate: String): [Connection]
      connectionMessages(firstName: String!, lastName: String!): [Message!]!
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
      messages: [Message!]!
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

  const dateFilter = (data, start, end) => {
    if (!start || !end) return data;
    const s = new Date(start);
    const e = new Date(end);
    return data.filter(d => (new Date(d.date) >= s && new Date(d.date) <= e));
  };

  const responseObject = (results) => {
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
        const data_userFilter = data_dateFilter.filter(item => item.type === 'message' && (item.from.includes(from) || item.to.includes(to)));
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
      },
      connectionMessages: (parent, { firstName, lastName }, context, info) => {
        const data_toFilter = data.filter(item =>
          item.type === 'message' &&
          item.direction === 'to' &&
          (item.to.includes(firstName) || item.to.includes(lastName))
        );
        const data_fromFilter = data.filter(item =>
          item.type === 'message' &&
          item.direction === 'from' &&
          (item.from.includes(firstName) || item.from.includes(lastName))
        );
        return responseObject([...data_toFilter, ...data_fromFilter]);
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
        return null;
      }
    },
    Connection: {
      messages: (connection, _, context) => {
        const firstName = connection.first_name;
        const lastName = connection.last_name;
        const data_toFilter = data.filter(item =>
          item.type === 'message' &&
          item.direction === 'from' &&
          (item.to.split(',').includes(`${firstName} ${lastName}`))
        );
        const data_fromFilter = data.filter(item =>
          item.type === 'message' &&
          item.direction === 'to' &&
          (item.from.includes(`${firstName} ${lastName}`))
        );
        return responseObject([...data_toFilter, ...data_fromFilter]);
      }
    }
  };

  return { typeDefs, resolvers };
};

export default getModelDefinitions;
