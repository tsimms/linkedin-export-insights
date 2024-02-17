import gqlContainer from './gql-container.js';
import { ApolloSandbox } from '@apollo/sandbox';
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
  // TODO: set up handler for caching enrichment proxy results
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
    debug:false
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

// Setup comms with bridge to server, for enrichment client proxy

const enrichmentProxy = async (url) => {
  const headers = {
    Cookie: 'bcookie="v=2&34a8d04f-d347-493d-821a-e4259365bf12"; bscookie="v=1&202401091826037a8172c2-abe5-4edf-867f-178c3e13bfbdAQGc5Pk1ia2_LQKFzk0b623zLdu1bP6Q"; _gcl_au=1.1.633320568.1704824766; aam_uuid=86963082424392267153885736013401379176; g_state={"i_l":0}; li_rm=AQG3BKIg19KvzAAAAYzve9bGSKIOIqyEekj1mmi16Rb6G6PH3M2TV5LSPx3J-oVYNbQDuc5ivIYsq63DWG6zYuh8ySLxUOkrwQ4E5aabV3QB0HbzDCZefrwO; timezone=America/New_York; li_theme=light; li_theme_set=app; li_sugr=625df826-a160-4b38-8273-be4fa62fdcc4; _guid=d19463ee-2544-423c-be69-2a9580caaebb; JSESSIONID="ajax:6752329053734170832"; liap=true; lang=v=2&lang=en-us; li_alerts=e30=; AMCVS_14215E3D5995C57C0A495C55%40AdobeOrg=1; dfpfpt=4e9472be1eb5443c93db0fbb5fe8be1e; AnalyticsSyncHistory=AQKYGutAHCbsZQAAAY2eniUOjaLgt85HLwsjtEH8ZjSfnYDdhr0x8TJ9oI5cTF9WchqidWGUmfZcEBsPwngeCQ; lms_ads=AQEHvHvFfD7EnwAAAY2eniWYEJ_hjKZRLTAzI7EdoqpBRQwKVrUCN0bnyamJUiGMwNKyKarrQZquXQmyxEhRrmVdyTnixsRX; lms_analytics=AQEHvHvFfD7EnwAAAY2eniWYEJ_hjKZRLTAzI7EdoqpBRQwKVrUCN0bnyamJUiGMwNKyKarrQZquXQmyxEhRrmVdyTnixsRX; li_at=AQEDAQz5GKYFy9mkAAABjThxJfIAAAGNyJwgsE4AM1rcgrsj5o1VUH4HGPRdQlJ5OcXUfzZFJcd17qEJQneX4BQRJFwMGOr8M5V29tgLblaWKUphDCqhgFcwT0zQHvhwzRvTHm4lvBpL-XZ953YVsrE4; sdsc=1%3A1SZM1shxDNbLt36wZwCgPgvN58iw%3D; fptctx2=taBcrIH61PuCVH7eNCyH0K%252fD9DJ44Cptuv0RyrXgXCvm3%252blUFWu3y%252fc369R5shuBSHDuzdQdBTnvAC90kk1gatD92tkPnXO%252b3tdncNu%252fsFad0ju0bm8u%252bDLKoDDKxR%252flG%252bEU0RX%252bW8xdGO021dP67paDgqcCajhYd2LYvcVFVVRnfLWcdms0IfNdesqV87%252f8c5Vx2bPH%252fCUpqPU9ldEvwenz5boyo4pmzpJE80rnPEMZlOk%252foHao7BqmhikcFXetuM%252f1j1Hqg2GtptHoWbAgNTHMGfnl%252bbDrOqIZNk3%252fAMHpkLYqs0alXQPUgBdOt%252by7fN%252b5%252fw52Kylwt1rIFqAMgdYt2Tx47IY5HGXMZDQkWCU%253d; AMCV_14215E3D5995C57C0A495C55%40AdobeOrg=-637568504%7CMCIDTS%7C19769%7CMCMID%7C86740224657215136163829123382067700387%7CMCAAMLH-1708617775%7C7%7CMCAAMB-1708617775%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1708020175s%7CNONE%7CvVersion%7C5.1.1%7CMCCIDH%7C-2116355723; UserMatchHistory=AQI7_2AD1Y5HLwAAAY2txj3yoX1MxdYbwk1XmK-gTkjBlQRihPJgNJMicYK6PXKH8zC5UHglt1BByZFCBSUGirD_F98UGRY4LdM7T7KF5h4JDv1V4rMBqcW56a1RK-p331BePzxmb5gnjYApXp78H29mV8sqZ0LDf7WsSH1KUMMsXMgywOM-vQKE0M-LCEAWuanW3VaPOPSLgmSO-XkYv6SiYIxIgmDC8hjELmD7B9j54jO6r26POKkVKnF7M8sU7gBVE-AZmxkNyLVV9s5eUHahsp55dyCnsODWTZ5-bhARdqAgUx3Ped1mXucOgX2MMxDIPzQ; lidc="b=TB66:s=T:r=T:a=T:p=T:g=4627:u=2109:x=1:i=1708030616:t=1708117016:v=2:sig=AQHk0B4h3NJyrfHarNimfmgn7RqxNxjP"; __cf_bm=Hy4.J9h_UpLzRXdBlUlGKpXFxuy3ECynQbNp0tbvFRE-1708034456-1.0-AVaw5jkZJxh9hFaWLe63792S7QDGWwP+QImi6QZLuh2ll3Fg/h7n+BFQTNaAKH7lBQzbDDn39xC/kPsZXpeH33Y=',
    'X-LIID': 'abc123'
  };
  const response = await fetch(url, { headers });
  const html = await response.text();
  return html;
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
      const html = await enrichmentProxy(url);
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

export { launchServer };