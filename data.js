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

    const indexData = (data, key) => {
      const indexes = {};
      data.forEach(row => {
        index = row[key];
        if (!indexes[index])
          indexes[index] = [];
        indexes[index].push(row);
      })
      return indexes;
    };

    const readZip = async (file) => {
      const zipFile = new JSZip();
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
            const dataByYear = indexData(data, "year");
            return dataByYear;
          }
        },
        {
          name: "Shares",
          file: "Shares.csv",
          labelRow: 0,
          firstField: "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}",
          transformFn: (data) => {
            const dataByYear = indexData(data, "year");
            return dataByYear;
          }
        },
        {
          name: "Reactions",
          file: "Reactions.csv",
          labelRow: 0,
          firstField: "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}",
          transformFn: (data) => {
            const dataByYear = indexData(data, "year");
            const dataByType = {};
            Object.keys(dataByYear).forEach(k => { dataByType[k] = indexData(dataByYear[k], "type")});
	    //return dataByType;
            return dataByYear;
          }
        },
        {
          name: "SentMessages",
          file: "messages.csv",
          labelRow: 0,
          firstField: ".*?==",
          transformFn: (data) => {
            data.filter(d => d.from === FULLNAME);
            const dataByYear = indexData(data, "year");
            return dataByYear;
          }
        },
        {
          name: "Connections",
          file: "Connections.csv",
          labelRow: 3,
          firstField: "[^,]+",
          transformFn: (data) => {
            const dataWithYear = data.map(row => ({ ...row, year: row.connected_on.split(' ')[2].replace(/[^\d]/g,"") }));
            const dataByYear = indexData(dataWithYear, "year");
            return dataByYear;
          }
        },
        {
          name: "Votes",
          file: "Votes.csv",
          labelRow: 0,
          firstField: "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}",
          transformFn: (data) => {
            const dataByYear = indexData(data, "year");
            return dataByYear;
          }
        }
      ];

      const processedDataJobs = dataFiles.map(async (dataFile) => ({
        name: dataFile.name,
        data: await zipFile.loadAsync(file)
          .then((zipObj) => (zipObj.file(dataFile.file).async("text")))
          .then(data => csvToJson(data, dataFile.labelRow, dataFile.firstField))  
          .then(rows => rows.map(row => ({...row, year: (new Date(row.date)).getFullYear()})))
          .then(dataFile.transformFn)
      }));

      const processedData = await Promise.all(processedDataJobs);
      //console.log(processedData);
      return processedData;
    };

    const transformFinal = (data) => {
      const datasets = {};
      data.forEach(obj => {datasets[obj.name] = obj.data });
      return datasets;
    }

    const onFileSelected = () => {
      const files = filesInput.files;
      if (files.length) {
        readZip(files[0])
          .then(transformFinal)
          .then(setChart);
      }
    };

