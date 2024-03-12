import { DateTimeResolver, DateTimeTypeDefinition } from 'graphql-scalars';
import  { getEnrichData, launchEnrichment, stopEnrichment } from './enrichment.js';

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
      messages (startDate: String, endDate: String): [Message]
      connections (startDate: String, endDate: String): [Connection]
      comments (startDate: String, endDate: String): [Comment]
      posts (startDate: String, endDate: String): [Post]
      reactions (startDate: String, endDate: String): [Reaction]
      votes (startDate: String, endDate: String): [Vote]
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
      connections: [Connection!]!
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
      message_count: Int!
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
      post: Post
    }

    type Post {
      id: ID!
      date: DateTime
      link: String!
      commentary: String!
      sharedurl: String!
      mediaurl: String
      visibility: String
      type: String!
      year: Int
      month: String
      week: String
      my_comments: [Comment!]!
      my_comment_count: Int!
      author: String
      numImpressions: Int
      numLikes: Int
      numComments: Int
      numShares: Int
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
      content_type: String!
      my_post: Post
      my_comment: Comment
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

    union Activity = Message | Connection | Comment | Post | Reaction | Vote
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


  const setCache = (context, type, data, reset) => {
    if (!context.cache)
      context.cache = {};
    const isArray = Array.isArray(data);
    if (!context.cache[type] || reset)
      context.cache[type] = isArray ? [] : {}; 
    if (isArray)
      context.cache[type].push(...data)
    else
      context.cache[type] = { ...context.cache[type], ...data };
    return context;
  }

  const getCache = (context, type, key) => {
    const empty = !(context?.cache?.[type]);
    switch (type) {
      case "connections":
        if (empty) {
          const { cache } = setCache(context, type, data.filter(d => d.type === 'connection'), true);
          context.cache = cache;
        }
        break;
      case "comments":
        if (empty) {
          const { cache } = setCache(context, type, data.filter(d => d.type === 'comment'), true);
          context.cache = cache;
        }
        break;
      case "posts":
        if (empty) {
          const { cache } = setCache(context, type, data.filter(d => d.type === 'share'), true);
          context.cache = cache;
        }
        break;
      default:
        if (empty && !context.cache) {
          context.cache = {};
        }
    }
    if (!context.cache[type])
      return null;
    if (!Array.isArray(context.cache[type]))
      return context.cache[type][key]
    else
      return context.cache[type]
  };

  const getEnrichedPost = async (url, isOthersPost) => {
    debugger;
    const post = await getEnrichData(url, isOthersPost ? "othersPost" : "postMetrics" );
    if (post.status === 'queued') {
      post.post = {
        author: null,
        numImpressions: null,
        numLikes: null,
        numComments: null,
        numShares: null
      }
      if (isOthersPost) {
        post.post = { ...post.post, sharelink: url }
      }
    }
    return post.post;
  }

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
      messages: (parent, { startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        const data_typeFilter = data_dateFilter.filter(d => d.type === 'message');
        return responseObject(data_typeFilter);
      },
      connections: (parent, { startDate, endDate }, context, info) => {
        const d = getCache(context, 'connections');
        const data_dateFilter = dateFilter(d, startDate, endDate);
        return responseObject(data_dateFilter);
      },
      comments: (parent, { startDate, endDate }, context, info) => {
        const d = getCache(context, 'comments');
        const data_dateFilter = dateFilter(d, startDate, endDate);
        return responseObject(data_dateFilter);
      },
      posts: (parent, { startDate, endDate }, context, info) => {
        const d = getCache(context, 'posts')
        const data_dateFilter = dateFilter(d, startDate, endDate);
        return responseObject(data_dateFilter);
      },
      reactions: (parent, { startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        const data_typeFilter = data_dateFilter.filter(d => d.type === 'reaction');
        return responseObject(data_typeFilter);
      },
      votes: (parent, { startDate, endDate }, context, info) => {
        const data_dateFilter = dateFilter(data, startDate, endDate);
        const data_typeFilter = data_dateFilter.filter(d => d.type === 'vote');
        return responseObject(data_typeFilter);
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
          return 'Post';
        } else if (obj.type === 'reaction') {
          return 'Reaction';
        } else if (obj.type === 'vote') {
          return 'Vote';
        }
        return null;
      }
    },
    Connection: {
      messages: (connection, _, context)  => {
        const firstName = connection.first_name;
        const lastName = connection.last_name;
        const data_toFilter = data.filter(item =>
          item.type === 'message' &&
          item.direction === 'from' &&
            (item.to.split(/,(?![ ])/).includes(`${firstName} ${lastName}`))
        );
        const data_fromFilter = data.filter(item =>
          item.type === 'message' &&
          item.direction === 'to' &&
          (item.from.includes(`${firstName} ${lastName}`))
        );
         
        const results = responseObject([...data_toFilter, ...data_fromFilter]).sort((a,b) => (new Date(a.date) - new Date(b.date)));
        connection.messages = results
        return results;
      },
      message_count: (connection, _, context) => {
        return connection.messages.length;
      }
    },
    Post: {
      link: (post, _, context) => (post.sharelink),
      commentary: (post, _, context) => (post.sharecommentary),
      my_comments: (post, _, context) => {
        const link = post.sharelink;
        const commentsSet = getCache(context, "comments");
        const results = commentsSet.filter(c => c.link === link);
        post.my_comments = results;
        return results;
      },
      my_comment_count: (post, _, context) => {
        return post.my_comments.length;
      },
      author: async (post, _, context) => {
        const epost = await getEnrichedPost(post.sharelink);
        return epost.author;
      },
      numImpressions: async (post, _, context) => {
        const epost = await getEnrichedPost(post.sharelink);
        return epost.numImpressions;
      },
      numLikes: async (post, _, context) => {
        const epost = await getEnrichedPost(post.sharelink);
        return epost.numLikes;
      },
      numComments: async (post, _, context) => {
        const epost = await getEnrichedPost(post.sharelink);
        return epost.numComments;
      },
      numShares: async (post, _, context) => {
        const epost = await getEnrichedPost(post.sharelink);
        return epost.numShares;
      }
    },
    Comment: {
      post: async (comment, _, context) => {
        const { link } = comment;
        const postsSet = getCache(context, "posts");
        let result = postsSet.find(c => c.sharelink === link);
        if (! result) {
          // if there's no match on the post, it means the post was authored by someone else
          // fetch that post (if it hasn't already been fetched)
          // TO-DO: we should probably add these posts to the data model, but I'm not yet sure
          //   how we'll need to use the data
          result = await getEnrichedPost(link, true);
        }
        return result;
      }
    },
    Reaction: {
      content_type: (reaction, _, context) => {
        const { link } = reaction;
        let result = '';
        if (link.includes('commentUrn')) {
          result = 'COMMENT'
        } else {
          result = 'POST'
        }
        reaction.content_type = result;
        return result;
      },
      my_post: (reaction, _, context) => {
        let { link } = reaction;
        link = link.split('?')[0];
        const postsSet = getCache(context, "posts");
        const result = postsSet.find(c => c.sharelink === link);
        return result;
      },
      my_comment: (reaction, _, context) => {
        let { link } = reaction;
        link = link.split('?')[0];
        if (reaction.content_type !== 'COMMENT')
          return null;
        const commentsSet = getCache(context, "comments");
        const result = commentsSet.find(c => c.link === link);
        return result;
      }
    },
    Message: {
      connections: (parent, _, context) => {
        const names = (parent.direction === 'from')
          ? parent.to.split(/,(?![ ])/)
          : [ parent.from ]
        const connectionStore = {};
        const connectionsSet = getCache(context, "connections");
        const connectionsCached = names.map(name => {
          const fromCache = getCache(context, "connection", name);
          if (fromCache) return ({ name, value: fromCache });
          return ({ name, value: null });
        })
        // if it's uncached, find them in the dataset and set cache
        const namesUncached = connectionsCached.filter(n => !n.value).map(n => n.name);
        const connections = connectionsSet
          .filter(c => namesUncached.includes(`${c.first_name} ${c.last_name}`));
        connections
          .forEach(c => {
            connectionStore[`${c.first_name} ${c.last_name}`] = c;
          });    
        const { cache } = setCache(context, "connection", connectionStore, false);
        context.cache = cache;

        const resultSet = [
          ...connectionsCached.filter(n => n.value !== null).map(n => n.value),
          ...Object.values(connectionStore)
        ].sort((a, b) => (new Date(a)).getTime() - (new Date(b)).getTime());

        return resultSet;
      }
    }
  };

  return { typeDefs, resolvers };
};

export { getModelDefinitions, launchEnrichment, stopEnrichment };
