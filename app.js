import { ingest } from './server/data.js';
import gqlContainer from './gql-container.js';
import { ApolloSandbox } from '@apollo/sandbox';
import JSZip from 'jszip';
import './app.css';

let _data, _chart, _chartData, _settings, _uploadedFile;
let webcontainerInstance, _serverUrl;


////////
// Data preparation routines
////////
const getMonthCutoff = () => {
  const monthCutoff = new Date();
  monthCutoff.setMonth(monthCutoff.getMonth() - 13);
  const cutoffKey = `${monthCutoff.getFullYear()}-${String(monthCutoff.getMonth() + 1).padStart(2, '0')}`;
  return cutoffKey;
}
const getWeekCutoff = () => {
  const weekCutoff = new Date();
  weekCutoff.setDate(weekCutoff.getDate() - 7*16);
  const cutoffKey = `${weekCutoff.getFullYear()}W${String(Math.ceil((weekCutoff - new Date(weekCutoff.getFullYear(), 0, 1)) / 86400000 / 7)).padStart(2,'0')}`;
  return cutoffKey;
}
const filterKeys = (granularity, data) => {
  let dataset = data;
  switch (granularity) {
    case "yearly":
      break;
    case "monthly":
      dataset = data.filter(d => (d.length === 7 && d >= getMonthCutoff()))
      break;
    case "weekly":
      dataset = data.filter(d => (d.length === 7 && d >= getWeekCutoff()))
      break;
  }
  return dataset;
}

const setChart = (data) => {
  let labels = [];
  const { granularity } = _settings.options;
  const ignoreGroupPosts = _settings.options.ignoreGroupPosts === "yes";

  Object.keys(data).forEach(key => Object.keys(data[key])
    // TODO: probably just want to iterate to set labels whether there's data or not
    .forEach(labelKey => {
      if (!labels.includes(labelKey)) labels.push(labelKey);
    })
  );
  labels = filterKeys(granularity, labels).sort((a,b) => (b.localeCompare(a)));
  if (granularity === "yearly")
    labels = labels.filter(year => year >= 2000).sort((a,b) => (b-a))
  const chartOptions = {
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };
  _chartData = { 
    labels,
    datasets: [
      {
        label: "Sent Messages",
        data: filterKeys(granularity, labels)
          .sort((a, b) => b.localeCompare(a))
          .map(x => (data.SentMessages[x] ? { 
            x,
            y:data.SentMessages[x].length,
            span:(new Date(data.SentMessages[x][0].date) - new Date(data.SentMessages[x][data.SentMessages[x].length-1].date)),
            first:new Date(data.SentMessages[x][0].date),
            last:new Date(data.SentMessages[x][data.SentMessages[x].length-1].date)
          } : { x, y:0, span:0 }))
      },
      {
        label: "Connections",
        data: filterKeys(granularity, labels)
          .sort((a, b) => b.localeCompare(a))
          .map(x => (data.Connections[x] ? {
            x,
            y:data.Connections[x].length,
            span:(new Date(data.Connections[x][0].date) - new Date(data.Connections[x][data.Connections[x].length-1].date)),
            first:new Date(data.Connections[x][0].date),
            last:new Date(data.Connections[x][data.Connections[x].length-1].date)
          } : { x, y:0, span:0 }))
      },
      {
        label: "Comments",
        data: filterKeys(granularity, labels)
          .sort((a, b) => b.localeCompare(a))
          .map(x => (data.Comments[x] ? {
            x,
            y:data.Comments[x].length,
            span:(new Date(data.Comments[x][0].date) - new Date(data.Comments[x][data.Comments[x].length-1].date)),
            first:new Date(data.Comments[x][0].date),
            last:new Date(data.Comments[x][data.Comments[x].length-1].date)
          } : { x, y:0, span:0 }))
      },
      {
        label: "Posts",
        data: filterKeys(granularity, labels)
          .sort((a, b) => b.localeCompare(a))
          .map(x => (data.Shares[x] ? {
            x,
            y:data.Shares[x].filter(p => (!ignoreGroupPosts || !p.sharelink.match(/group/))).length,
            span: data.Shares[x].filter(p => (!ignoreGroupPosts || !p.sharelink.match(/group/))).length ? (
              new Date(data.Shares[x].filter(p => (!ignoreGroupPosts || !p.sharelink.match(/group/)))[0].date)
                - new Date(data.Shares[x].filter(p => (!ignoreGroupPosts || !p.sharelink.match(/group/)))
                  [data.Shares[x].filter(p => (!ignoreGroupPosts || !p.sharelink.match(/group/))).length-1].date)
            ) : 0,
            first:new Date(data.Shares[x][0].date),
            last:new Date(data.Shares[x][data.Shares[x].length-1].date)
          } : { x, y:0, span:0 }))
      },
      {
        label: "Reactions",
        data: filterKeys(granularity, labels)
          .sort((a, b) => b.localeCompare(a))
          .map(x => (data.Reactions[x] ? {
            x,
            y:data.Reactions[x].length-1,
            span:(new Date(data.Reactions[x][0].date) - new Date(data.Reactions[x][data.Reactions[x].length-1].date)),
            first:new Date(data.Reactions[x][0].date),
            last:new Date(data.Reactions[x][data.Reactions[x].length-1].date),
            meta:{
              types: Object.keys(data.Reactions[x].types).map(
                type => ({ [type]: data.Reactions[x].types[type].length })
              )
            }
          } : { x, y:0, span:0 }))
      },
      {
        label: "Votes",
        data: filterKeys(granularity, labels)
          .sort((a, b) => b.localeCompare(a))
          .map(x => (data.Votes[x] ? {
            x,
            y:data.Votes[x].length,
            span:(new Date(data.Votes[x][0].date) - new Date(data.Votes[x][data.Votes[x].length-1].date)),
            first:new Date(data.Votes[x][0].date),
            last:new Date(data.Votes[x][data.Votes[x].length-1].date)
          } : { x, y:0, span:0 }))
      }
    ]
  };
  _data = data;
  const ctx = document.getElementById('chart');
  _chart = new Chart(ctx, {
    type: 'line',
    data: _chartData,
    options: chartOptions
  });
  ctx.style.display = 'block';
  showAnalytics();
};

//////////
// Storage
//////////
const getConfig = () => {
  const config = localStorage.getItem("config");
  let settingsJson;
  if (config) {
    try {
      settingsJson = JSON.parse(config);
    } catch (e) {
      // invalid JSON
      settingsJson = {};
      _settings = settingsJson;
      setConfig();
    }
  } else {
    settingsJson = {};
    _settings = settingsJson;
    setConfig();
  }
  return settingsJson;  
}

const setConfig = () => {
  localStorage.setItem("config", JSON.stringify(_settings));
}

//////////
// General UI/UX
//////////
const getRange = (dataset) => {
  const range = { start: null, end: null };
  dataset.forEach(k => {
    const start = k.data[k.data.length-1].last;
    const end = k.data[0].first;
    if (! range.start || new Date(start).getTime() < range.start)
        range.start = new Date(start).getTime();
    if (! range.end || new Date(end).getTime() > range.end)
      range.end = new Date(end).getTime();
  })
  return range;
}

const getFormattedDateTime = (timestamp) => {
  const date = new Date(timestamp);
  const formattedDate = date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formattedDate;
}

const showRange = range => {
  const { start, end } = range;
  const rangeString = `${getFormattedDateTime(start)} - ${getFormattedDateTime(end)}`;
  document.getElementById('range').innerHTML = rangeString;
}

const showLoading = () => {
  const sandbox = document.getElementById('spinner');
  sandbox.classList.remove('hide');
};

const hideLoading = () => {
  const sandbox = document.getElementById('spinner');
  sandbox.classList.add('hide');
}

const showExplore = () => {
  const explore = document.getElementById('explore-dashboard');
  explore.classList.remove('hide');
  document.getElementById('bridge').innerHTML = `
  <iframe id="bridge-frame" style="width:100%; height:100%" src="${_serverUrl}/bridge"></iframe>
  `;
}

////////////
// Server
////////////
const launchServer = async () => {
  showLoading();
  const server = await gqlContainer({ 
    dataFileInput:_uploadedFile,
    staticFiles: [
      `https://timjimsimms.com/linkedinsight/server/server.js`,
      `https://timjimsimms.com/linkedinsight/server/graphql-model.js`,
      `https://timjimsimms.com/linkedinsight/server/data.js`,
      `https://timjimsimms.com/linkedinsight/server/package.json`
    ],
    debug:true
  });
  ({ webcontainerInstance } = server);
  _serverUrl = server.serverUrl;

  console.log(`Server URL: ${_serverUrl}!`);
  hideLoading();
  showExplore();

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

const runQuery = async () => {
  const query = document.getElementById('explore-query').value;
  const res = await fetch(_serverUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: query
  });
  console.log(await res.json());
}


////////////
// UX Exports
////////////
const onFileSelected = async () => {
  const files = filesInput.files;
  if (files.length) {
    _uploadedFile = files[0];
    await processFile();
    launchServer();
  }
};

const uxOptions = () => {
  const granularity = document.getElementById('granularity').value;
  const ignoreGroupPosts = document.getElementById('ignoreGroupPosts').value;
  if (!_settings.options) _settings.options = {};
  _settings.options.granularity = granularity;
  _settings.options.ignoreGroupPosts = ignoreGroupPosts;
  setConfig();
  processFile();
}

const toggleSettings = () => {
  const form = document.getElementById('form');
  const element = document.getElementById('form-toggle');
  if (element.innerHTML === "Hide Settings") {
    form.style.display = "none";
    element.innerHTML = "Show Settings";
  } else {
    form.style.display = "block";
    element.innerHTML = "Hide Settings"
  }
}

const toggleDeveloperMode = () => {
  const developerMode = document.getElementById('developerMode').value;
  const developerFrame = document.getElementById('developer-frame');
  developerFrame.style.display = (developerMode === "yes" ? "block" : "none");
  _settings.options.developerMode = developerMode;
  setConfig();
}

const setGoal = (granularity, label, currentGoal) => {
  let prompt = `To what value should we set ${granularity} target for ${label}?`;
  if (currentGoal)
    prompt += `
Current goal set to ${currentGoal}`;
  const goal = window.prompt(prompt);
  if (!_settings.goals) _settings.goals = {};
  if (!_settings.goals[granularity]) _settings.goals[granularity] = {};
  if (goal !== null) {
    if (parseInt(goal))
      _settings.goals[granularity][label] = parseInt(goal);
    else 
      delete _settings.goals[granularity][label];
  }
  setConfig();
  showAnalytics();
}

const setUx = () => {
  if (_settings.options?.granularity)
    document.getElementById('granularity').value = _settings.options.granularity;
  if (_settings.options?.ignoreGroupPosts)
    document.getElementById('ignoreGroupPosts').value = _settings.options.ignoreGroupPosts;
    if (_settings.options?.developerMode)
    document.getElementById('developerMode').value = _settings.options.developerMode;

  // set UX event listeners
  document.getElementById('granularity').addEventListener('change', uxOptions);
  document.getElementById('ignoreGroupPosts').addEventListener('change', uxOptions);
  document.getElementById('filesInput').addEventListener('change', onFileSelected);
  document.getElementById('form-toggle').addEventListener('click', toggleSettings);
  document.getElementById('developerMode').addEventListener('change', toggleDeveloperMode);
  document.getElementById('run-query').addEventListener('click', runQuery)
  toggleDeveloperMode();
}

///////////
// Analytics routines
///////////

const analyticsCalc = (label, dataset) => {
  const mean = (dataset.reduce((a,b)=>(a+b.y),0)/dataset.length).toFixed(1);
  const current = dataset[0].y;
  const dataset_past = dataset.slice(1);
  const dataset_now = dataset[0];
  const past_span_avg = (dataset_past.reduce((a,b)=>(a+b.span),0)/dataset_past.length / 86400000).toFixed(1);
  const current_span = (dataset_now.span / 86400000).toFixed(1);
  const elapsed = (current_span / past_span_avg).toFixed(3);
  const projected = elapsed !== '0.000' ? (current / elapsed).toFixed(1) : "0";
  const projectionAboveAvg = (parseFloat(projected) >= parseFloat(mean)); // yellow
  const currentAboveAvg = (parseFloat(current) >= parseFloat(mean)); // light green
  let goal = 0;
  try {
    if (_settings.goals[_settings.options.granularity][label]) {
      goal = _settings.goals[_settings.options.granularity][label];
    }
  } catch (e) {};
  const projectionAboveGoal = goal && (parseFloat(projected) >= parseFloat(goal)); // light green
  const currentAboveGoal = goal && (parseFloat(current) >= parseFloat(goal)); // dark green
  let progressColor = false;
  if (projectionAboveAvg) progressColor = 'projection-above-avg';
  if (currentAboveAvg) progressColor = 'current-above-avg'
  if (projectionAboveGoal) progressColor = 'projection-above-goal';
  if (currentAboveGoal) progressColor = 'current-above-goal';
  return { mean, current, elapsed, projected, progressColor, goal };
};

const showAnalytics = () => {
  const { granularity } = _settings.options;
  const eventListeners = [];
  const cards = _chartData.datasets.map(ds => ({
    ...analyticsCalc(ds.label, ds.data),
    label:ds.label,
    key:ds.label.replace(/ /,"")
  }));
  document.getElementById('analytics').innerHTML =
    cards.map(d => (`
    <div class="hcard${d.progressColor ? ` ${d.progressColor}`:''}">
    <div class="label">${d.label}</div>
    <div class="mean"><label>Avg:</label><span class="value">${d.mean}</span></div>
    <div class="mean"><label>Current:</label><span class="value">${d.current}</span></div>
    <div class="projected"><label>Proj:</label><span class="value">${d.projected}</span></div>
    <div class="goal" id="goal-${d.key}">${d.goal 
      ? `<label>Goal:</label><span class="value">${d.goal}</span>` 
      : `<a href="#">Set Goal</a>`
    }</div>
    </div>
    `))
    .join(" ");
  cards.forEach(d => {
    const element = d.goal 
      ? document.querySelector(`.goal#goal-${d.key} .value`)
      : document.querySelector(`.goal#goal-${d.key} a`);
    const handler = setGoal.bind(null, granularity, d.label, d.goal || null);
    element.addEventListener('click', handler)
  });
  const range = getRange(_chartData.datasets);
  showRange(range);
}

const clearAnalytics = () => {
  document.getElementById('analytics').innerHTML = '';
}


////////
// Main
////////

// Kicks off data processing
const processFile = () => {
  clearAnalytics();
  if (_chart) {
    _chart.destroy();
  }
  if (_uploadedFile) {
    return ingest(_uploadedFile, _settings.options.granularity, JSZip)
      .then(setChart);
  }
};

// Init
(() => {
  _settings = getConfig();
  uxOptions();
  setUx();
})()

