import gqlContainer from './gql-container.js';
import { ApolloSandbox } from '@apollo/sandbox';
import { ClientProxy } from './client-proxy.js';
import './developer.css';

let webcontainerInstance, _serverUrl, _enrichmentUrl, _schema;
const _queries = { schema: {}, saved: {} };


///////////
// Developer Frame UX
///////////

const showLoading = () => {
  const sandbox = document.getElementById('spinner');
  sandbox.classList.remove('hide');
};

const hideLoading = () => {
  const sandbox = document.getElementById('spinner');
  sandbox.classList.add('hide');
}

const showExplore = () => new Promise(( resolve ) => {
  const serverHostname = _enrichmentUrl.split(':')[1].replaceAll('/','');
  const explore = document.getElementById('explore-dashboard');
  explore.classList.remove('hide');
  // set up the client/server comms, which also instantiates ws connection
  var iframe = document.createElement('iframe');
  iframe.id = 'bridge-frame';
  iframe.onload = resolve;
  iframe.src = `${_serverUrl}/bridge?hostname=${serverHostname}`;
  document.getElementById('bridge').appendChild(iframe);
});

const developerFrameUx = () => {
  const panel = document.getElementById("developer-frame");
  let m_pos;

  const resizeDeveloperFrame = (e) => {
    const dy = m_pos - e.y;
    m_pos = e.y;
    panel.style.height = (parseInt(getComputedStyle(panel, '').height) + dy) + "px";

    // TODO: resize filler div
  };
  
  panel.addEventListener("mousedown", function(e){
    if (e.offsetY < 4) {
      m_pos = e.y;
      document.addEventListener("mousemove", resizeDeveloperFrame, false);
    }
  }, false);
  
  document.addEventListener("mouseup", function(){
      document.removeEventListener("mousemove", resizeDeveloperFrame, false);
  }, false);

  document.getElementById('run-query').addEventListener('click', getQuery)

  document.getElementById('btn-copy').addEventListener('click', async () => {
    const textarea = document.getElementById('explore-results');
    textarea.focus();
    await navigator.clipboard.writeText(textarea.value);
    const button = document.getElementById('btn-copy')
    button.innerHTML = 'Copied!';
    button.disabled = true;
    setTimeout(() => { button.innerHTML = 'Copy'; button.disabled = false; }, 2000);
  });
  
  document.getElementById('explore-query').addEventListener('input', (e) => {
    const textarea = e.target;
    setTimeout(() => { textarea.value = textarea.value.replace(/\\n/g, '\n') }, 2000);
  });

  document.getElementById('schema-query-list').addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const selectedValue = selectedOption.value;
    const queryText = _queries.schema[selectedValue];
    if (queryText) {
      document.getElementById('explore-query').value = queryText;
    };
  });
}


////////////
// Server
////////////
const launchServer = async (uploadedFile) => {
  showLoading();
  const server = await gqlContainer({ 
    dataFileInput:uploadedFile,
    staticFiles: [
      `https://timjimsimms.com/linkedinsight/server/server.js`,
      `https://timjimsimms.com/linkedinsight/server/graphql-model.js`,
      `https://timjimsimms.com/linkedinsight/server/enrichment.js`,
      `https://timjimsimms.com/linkedinsight/server/bridge.html`,
      `https://timjimsimms.com/linkedinsight/server/data.js`,
      `https://timjimsimms.com/linkedinsight/server/package.json`
    ],
    debug:true
  });
  ({ webcontainerInstance } = server);
  _serverUrl = server.serverUrl;
  _enrichmentUrl = server.enrichmentUrl;

  console.log(`Server URL: ${_serverUrl}!`);
  console.log(`Enrichment URL: ${_enrichmentUrl}!`);
  hideLoading();
  await showExplore();
  runIntrospection();

/*
  // the reason this doesn't work is because the /sandbox/explorer endpoint doesn't include a
  // CORP header ("Cross-Origin-Resource-Policy: cross-origin"), which is needed in this
  // context, because we have a COEP policy on the document for the webcontainer execution
  new ApolloSandbox({
    target: '#embedded-sandbox',
    initialEndpoint: `${_serverUrl}/graphql?serverUrl=${_serverUrl}`,
    initialState: {
    }
  });
  */

/*
 document.getElementById('embedded-sandbox').innerHTML = `
  <iframe style="width:100%; height:100%"
    src="${_serverUrl}?serverUrl=${_serverUrl}"
    ></iframe>
  `;
  */

  /*
  document.getElementById('embedded-sandbox').innerHTML = `
  <iframe style="width:100%; height:100%"
    src="${_serverUrl}/inigo"
    ></iframe>
  `;
  document.getElementById('embedded-sandbox').classList.remove('hide');
*/

  /*
  {
    "welcomeModal": [],
    "explorer": {
        "url": serverUrl,
        "activeTabId": "01d3",
        "tabs": [
            {
                "id": "01d3",
                "query": "",
                "variables": "{}",
                "docLastQuery": ""
            }
        ],
        "collections": [],
        "preflightScript": "",
        "history": [],
        "headers": "",
        "preflightEnabled": true,
        "envVariables": "",
        "proxyEnabled": false,
        "historyEnabled": true
    },
    "theme": "dark"
}

*/

//  window.open(_serverUrl, '_blank');
}

const initClientProxy = file => {
  ClientProxy.setCookie(file); // async call
}


// Query response message handler
window.addEventListener('message', async (event) => {
  const { data, origin } = event;
  let incomingData;
  try {
    incomingData = JSON.parse(data);
  } catch (e) {
    return;
  }
  const { type, results, timestamp, message, url } = incomingData;

  if (type.startsWith('bridge_')) {
    const resultsElement = document.getElementById('explore-results');
    const duration = (new Date()).getTime() - timestamp;
    if (type === 'bridge_proxy_request') {
      const html = await ClientProxy.fetch(url);
      const message = JSON.stringify({
        action: 'bridge_proxy_response',
        body: html,
        timestamp: (new Date()).getTime(),
      });
      document.getElementById('bridge-frame').contentWindow.postMessage(message, _serverUrl);
      return;
    } else if (type === 'bridge_response') {
      const size = new TextEncoder().encode(JSON.stringify(results)).length;
      const sizeText = (size < 1024) ? `${size} B` : `${(Math.round(size / 1024 * 10) / 10).toFixed(1)} KB`;
      resultsElement.value = JSON.stringify(results, undefined, 2);
      if (results.data[Object.keys(results.data)[0]].length) {
        document.getElementById('results-duration').innerHTML = `Elapsed query time: ${duration}ms`;
        document.getElementById('results-size').innerHTML = sizeText;
        document.getElementById('results-count').innerHTML = `Results count: ${results.data[Object.keys(results.data)[0]].length}`;
        document.getElementById('results-header').classList.remove('invisible');
        document.getElementById('results-status').classList.remove('invisible');
      } else {
        document.getElementById('results-header').classList.add('invisible');
        document.getElementById('results-status').classList.add('invisible');
      }
      return;
    } else if (type === 'bridge_introspection') {
      processIntrospectionData(results);
      return;
    } else if (type === 'bridge_error') {
      resultsElement.value = JSON.stringify(results, undefined, 2);
      document.getElementById('results-status').classList.add('invisible');
      document.getElementById('results-header').classList.add('invisible');
      console.error(message);
      return;
    }
    console.error('something went wrong on response');
  }
});

const runIntrospection = async () => {
  const query = `
    {"query":"
      query IntrospectionQuery {
        __schema {
          
          queryType { name }
          mutationType { name }
          subscriptionType { name }
          types {
            ...FullType
          }
          directives {
            name
            description
            
            locations
            args {
              ...InputValue
            }
          }
        }
      }

      fragment FullType on __Type {
        kind
        name
        description
        
        fields(includeDeprecated: true) {
          name
          description
          args {
            ...InputValue
          }
          type {
            ...TypeRef
          }
          isDeprecated
          deprecationReason
        }
        inputFields {
          ...InputValue
        }
        interfaces {
          ...TypeRef
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
        possibleTypes {
          ...TypeRef
        }
      }

      fragment InputValue on __InputValue {
        name
        description
        type { ...TypeRef }
        defaultValue
      }

      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    "}
  `.replaceAll('\n'," ").replaceAll(/[ \t]+/g," ");
  runQuery(query);
}

const processIntrospectionData = (data) => {
  _schema = data?.data?.__schema;
  const queries = _schema?.types?.find(t => t.name === 'Query')?.fields;
  console.log({ _schema, _queries });
  // populate select
  const schemaQuerySelect = document.getElementById('schema-query-list');
  queries.forEach(q => {
    const objectFields = (name) => {
      const fields = _schema.types
        .find(type => type.name === name)?.fields
        .map(field => (`${field.type?.ofType?.kind !== 'LIST' ? `\t\t${field.name}\n` : ""}`))
        .join("")
      return fields;
    };
    const { name } = q;
    const option = document.createElement('option');
    option.textContent = name;
    option.value = name;
    schemaQuerySelect.appendChild(option);
    // query processing
    const objectType = q.type.ofType.name;
    const fields = _schema.types.find(t => t.name === objectType).fields
    let fieldText = '';
    if (fields) {
      fieldText = fields.map(f => (`\t${f.name}${
        f.type.ofType?.kind === 'LIST' 
          ? ` {\n${ objectFields(f.type.ofType.ofType.ofType.name) }\t}\n`
         : f.type.kind === 'OBJECT' 
            ? ` {\n${ objectFields(f.type.name) }\t}\n`
            :"\n"
      } `)).join("");
    } else {
      // probably a union with possibleTypes
    }
    
    _queries.schema[name] = `
    {
      "query":"query ExampleQuery${
        // vars
        q.args.length ? 
          '(' +
          q.args.map(a => (`$${a.name}: ${a.type.kind === "NON_NULL" ? `${a.type.ofType.name}!`: a.type.name}`)).join(', ') +
          ')'
          : ""
      } {
        ${name} (${
          // args
          q.args.length ? q.args.map(a => (`${a.name}: $${a.name}`)).join(', ')
            : ""
        }) {
${fieldText}
        }
      }",
      "variables":{
        ${
          q.args.length ? q.args.map(a => (`"${a.name}": null`)).join(', ')
            : ""
        }
      }
    }    
    `;
  });
  /*
{
  "query":"query ExampleQuery($filter: String!) {
    connectionsByFilter(filter: $filter) {
      first_name
      last_name
      email_address
      position
      company
    }
  }",
  "variables":{"filter":"ounder"}
}
  */
}

const runQuery = (query) => {
  document.getElementById('explore-results').value = "";
  document.getElementById('bridge-frame').contentWindow.postMessage(JSON.stringify({
    action: 'fetch',
    url: _serverUrl, 
    method: 'POST',
    headers: {
      "Content-type": "application/json"
    },
    timestamp: (new Date()).getTime(),
    body: query
  }), _serverUrl);
}

const getQuery = () => {
  const query = document.getElementById('explore-query')
    .value
    .replaceAll('\n'," ")
    .replaceAll(/[ \t]+/g," ");
  runQuery(query);
}


////////
// Main
////////


// Init
(() => {
    developerFrameUx();
})()

export { launchServer, initClientProxy };