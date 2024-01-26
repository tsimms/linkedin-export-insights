//globals
let FULLNAME = "";


const csvToJson = (rawCsv, labelRow, firstField) => {

  const lines = rawCsv.split(/\r?\n/);
  const re = new RegExp(`\\\\r(${firstField}),`, "g");
  const csv = lines[labelRow].toLowerCase().replace(/[ ]+/g, "_") + '\n' + lines
    .slice(labelRow + 1)
    .join('\\r')
    .replace(re, "\n$1,");

  const objPattern = new RegExp(
    (
      // Delimiters.
      "(\\,|\\r?\\n|\\r|^)" +

      // Quoted fields.
      "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

      // Standard fields.
      "([^\"\\,\\r\\n]*))"
    ), "gi"
  );

  const arrData = [[]];
  let arrMatches = null;
  while (arrMatches = objPattern.exec( csv )){
    // Get the delimiter that was found.
    const strMatchedDelimiter = arrMatches[ 1 ];

    // Check to see if the given delimiter has a length
    // (is not the start of string) and if it matches
    // field delimiter. If id does not, then we know
    // that this delimiter is a row delimiter.
    if ( strMatchedDelimiter.length && strMatchedDelimiter !== ',' ){
      // Since we have reached a new row of data,
      // add an empty row to our data array.
      arrData.push( [] );
    }
    let strMatchedValue;
    // Now that we have our delimiter out of the way,
    // let's check to see which kind of value we
    // captured (quoted or unquoted).
    if (arrMatches[ 2 ]){
      // We found a quoted value. When we capture
      // this value, unescape any double quotes.
      strMatchedValue = arrMatches[ 2 ].replace(
        new RegExp( "\"\"", "g" ),
          "\""
      );
    } else {
      // We found a non-quoted value.
      strMatchedValue = arrMatches[ 3 ];
    }
    // Now that we have our value string, let's add
    // it to the data array.
    arrData[ arrData.length-1 ].push( strMatchedValue );
  }

  const objData = [];
  for (let i = 1; i < arrData.length; i++) {
    objData[i-1] = {};
    for (let k = 0; k < arrData[0].length && k < arrData[i].length; k++) {
      const key = arrData[0][k];
      objData[i-1][key] = arrData[i][k]
    }
  }
  const jsonData = JSON.stringify(objData).replace(/},/g, "},\r\n");
  return JSON.parse(jsonData);

};

const getWeekNumber = (date) => {
  const d = new Date(date)
  const week = Math.ceil((d - new Date(d.getFullYear(), 0, 1)) / 86400000 / 7);
  return week;
}

const formatMonthKey = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

const formatWeekKey = (date) => {
  return `${date.getFullYear()}W${String(getWeekNumber(date)).padStart(2,'0')}`;
}

const indexData = (data, key) => {
  const indexes = {};
  data.forEach(row => {
    const index = row[key];
    if (!indexes[index])
      indexes[index] = [];
    indexes[index].push(row);
  })
  Object.keys(indexes).forEach(d => indexes[d].sort((a,b) => (new Date(b.date).getTime() - new Date(a.date).getTime())));
  return indexes;
};


const ingest = async (file, granularity, JSZipLib) => {
  const zipFile = new (JSZipLib || JSZip)();
  const dataFiles = [
    {
      name: "Profile",
      file: "Profile.csv",
      labelRow: 0,
      firstField: "[^,]+",
      transformFn: (data) => {
        FULLNAME = `${data[0].first_name} ${data[0].last_name}`;
        return data;
      }
    },
    {
      name: "Comments",
      file: "Comments.csv",
      labelRow: 0,
      firstField: "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}",
      transformFn: (data) => {
        const dataset = {
          all: data,
          yearly: indexData(data, "year"),
          monthly: indexData(data, "month"),
          weekly: indexData(data, "week")
        };
        return dataset[granularity];
      }
    },
    {
      name: "Shares",
      file: "Shares.csv",
      labelRow: 0,
      firstField: "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}",
      transformFn: (data) => {
        const dataset = {
          all: data,
          yearly: indexData(data, "year"),
          monthly: indexData(data, "month"),
          weekly: indexData(data, "week")
        };
        return dataset[granularity];
      }
    },
    {
      name: "Reactions",
      file: "Reactions.csv",
      labelRow: 0,
      firstField: "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}",
      transformFn: (data) => {
        const dataset = {
          all: data,
          yearly: indexData(data, "year"),
          monthly: indexData(data, "month"),
          weekly: indexData(data, "week")
        };
        Object.keys(dataset.yearly).forEach(k => { dataset.yearly[k].types = indexData(dataset.yearly[k], "type")});
        Object.keys(dataset.monthly).forEach(k => { dataset.monthly[k].types = indexData(dataset.monthly[k], "type")});
        Object.keys(dataset.weekly).forEach(k => { dataset.weekly[k].types = indexData(dataset.weekly[k], "type")});
        return dataset[granularity];
      }
    },
    {
      name: "SentMessages",
      file: "messages.csv",
      labelRow: 0,
      firstField: ".*?==",
      transformFn: (data) => {
        let messages = data.map(d => ({ 
          ...d,
          direction: (d.from === FULLNAME) ? 'from' : 'to',
          type: 'message'
        }));
        if (granularity !== "all") {
          messages = messages
            .filter(m => m.direction === 'from')
            .map(m => ({ ...m, type:'sentmessage'}));
        }
        const dataset = {
          all: messages,
          yearly: indexData(messages, "year"),
          monthly: indexData(messages, "month"),
          weekly: indexData(messages, "week")
        };
        return dataset[granularity];
      }
    },
    {
      name: "Connections",
      file: "Connections.csv",
      labelRow: 3,
      firstField: "[^,]+",
      transformFn: (data) => {
        const dataWithYearMonthAndWeek = data.map(row => ({ 
          ...row,
          date: new Date(row.connected_on.replace(/\\r/,"")).toISOString(),
          year: row.connected_on.split(' ')[2].replace(/[^\d]/g,""),
          month: formatMonthKey(new Date(row.connected_on.replace(/\\r/,""))),
          week: formatWeekKey(new Date(row.connected_on.replace(/\\r/,"")))
        }));
        const dataset = {
          all: dataWithYearMonthAndWeek,
          yearly: indexData(dataWithYearMonthAndWeek, "year"),
          monthly: indexData(dataWithYearMonthAndWeek, "month"),
          weekly: indexData(dataWithYearMonthAndWeek, "week")
        };
        return dataset[granularity];
      }
    },
    {
      name: "Votes",
      file: "Votes.csv",
      labelRow: 0,
      firstField: "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}",
      transformFn: (data) => {
        const dataset = {
          all: data,
          yearly: indexData(data, "year"),
          monthly: indexData(data, "month"),
          weekly: indexData(data, "week")
        };
        return dataset[granularity];
      }
    }
  ];

  const processedDataJobs = dataFiles.map(async (dataFile) => ({
    name: dataFile.name,
    data: await zipFile.loadAsync(file)
      .then((zipObj) => (zipObj.file(dataFile.file).async("text")))
      .then(data => csvToJson(data, dataFile.labelRow, dataFile.firstField))  
      .then(rows => rows.map(row => ({
        ...row,
        ...(dataFile.name === 'Reactions' ? { reactionType : row.type } : {}),
        type: dataFile.name.replace(/ |(s$)/g, "").toLowerCase(),
        ...(row.date ? { date: (new Date(row.date)).toISOString()} : {}),
        year: (new Date(row.date)).getFullYear(),
        month: formatMonthKey(new Date(row.date)),
        week: formatWeekKey(new Date(row.date))
      })))
      .then(dataFile.transformFn)
  }));

  const processedData = await Promise.all(processedDataJobs);
  //console.log(processedData);
  const datasets = {};
  processedData.forEach(obj => {datasets[obj.name] = obj.data });
  return (granularity === "all" 
    ? [].concat(...Object.values(datasets)).sort((a, b) => new Date(b.date) - new Date(a.date))
    : datasets
  );
  //return datasets;
};


export { ingest };
