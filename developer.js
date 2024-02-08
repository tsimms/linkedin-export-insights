import gqlContainer from './gql-container.js';
import { ApolloSandbox } from '@apollo/sandbox';
import './developer.css';

let webcontainerInstance, _serverUrl, _schema;


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
  const explore = document.getElementById('explore-dashboard');
  explore.classList.remove('hide');
  var iframe = document.createElement('iframe');
  iframe.id = 'bridge-frame';
  iframe.onload = resolve;
  iframe.src = `${_serverUrl}/bridge`;
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
      `https://timjimsimms.com/linkedinsight/server/data.js`,
      `https://timjimsimms.com/linkedinsight/server/package.json`
    ],
    debug:false
  });
  ({ webcontainerInstance } = server);
  _serverUrl = server.serverUrl;

  console.log(`Server URL: ${_serverUrl}!`);
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

// Query response message handler
window.addEventListener('message', (event) => {
  const { data, origin } = event;
  if (origin === _serverUrl) {
    try {
      const { type, results, message } = JSON.parse(data);
      if (type === 'bridge_response') {
        const resultsElement = document.getElementById('explore-results');
        resultsElement.value = JSON.stringify(results, undefined, 2);
        if (results.data[Object.keys(results.data)[0]].length) {
          document.getElementById('results-status').classList.remove('hide');
          document.getElementById('results-count').innerHTML = `Results count: ${results.data[Object.keys(results.data)[0]].length}`;
        } else {
          document.getElementById('results-status').classList.add('hide');
        }
        return;
      } else if (type === 'bridge_introspection') {
        processIntrospectionData(results);
        return;
      } else if (type === 'bridge_error') {
        console.error(message);
      }
    } catch (e) {
      console.error(`Caught error on response: ${e.message}`);
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
  `.replaceAll('\n',"").replaceAll(/[ ]+/g," ");
  runQuery(query);
}

const processIntrospectionData = (data) => {
  _schema = data?.data?.__schema;
  const queries = _schema?.types?.filter(t => t.name === 'Query')[0]?.fields;
  // populate select
  const schemaQuerySelect = document.getElementById('schema-query');
  queries.forEach(q => {
    const { name } = q;
    const option = document.createElement('option');
    option.textContent = name;
    option.value = name;
    schemaQuerySelect.appendChild(option);
  });
  console.log({ queries });
}

const runQuery = (query) => {
  document.getElementById('bridge-frame').contentWindow.postMessage(JSON.stringify({
    url: _serverUrl, 
    method: 'POST',
    headers: {
      "Content-type": "application/json"
    },
    body: query
  }), _serverUrl);
}

const getQuery = () => {
  const query = document.getElementById('explore-query')
    .value
    .replaceAll('\n',"")
    .replaceAll(/[ ]+/g," ");
  runQuery(query);
}


////////
// Main
////////


// Init
(() => {
    developerFrameUx();
})()

export { launchServer };