import { WebContainer } from '@webcontainer/api';

const _dataFilename = "dataFile.zip";


const startServer = async (options) => {
  const { dataFileInput, staticFiles, debug } = options;

  const readAsUint8Array = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target.result;
        const uint8Array = new Uint8Array(result);
        resolve(uint8Array);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const log = (message) => {
    const d = new Date();
    const timestamp = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
    if (debug) {
      console.log(`${timestamp}: ${message}`);
    }
  };

  const webcontainerInstance = await WebContainer.boot();
  const dataFile = await readAsUint8Array(dataFileInput);
  const files = {
    [_dataFilename]: {
      file: {
        contents: dataFile,
      },
    }
  };
  await webcontainerInstance.mount(files);
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const nocache = Array.from({ length:8 }, ()=>characters[Math.floor(Math.random() * characters.length)]).join('');

  //const bootstrapServer = async () => {

  try {
    await Promise.all(staticFiles
      .map(f => `${f}?${nocache}`)
      .map(file => {
        const filename = file.replace(/^.*\//g,"");
        const outputFilename = filename.replace(/\?.*$/,"");
        return Promise.resolve()
        .then(() => fetch(file))
        .then(response => response.text())
        .then(fileContent => {
            webcontainerInstance.fs.writeFile(outputFilename, fileContent)
        })
        .then(() => log(`Loaded ${outputFilename} successfully!`))
        .catch(e => { console.error(`Error writing ${filename}: ${e}`)})
      }))
  } catch (err) {
    console.error('Error loading files:', err.message);
  }

  const fileListing = await webcontainerInstance.fs.readdir('/', { withFileTypes: true });
  log('File Listing:');
  fileListing.forEach((entry) => {
    log(`- ${entry.name} (${entry.isDirectory() ? 'Directory' : 'File'})`);
  });
  const installProcess = await webcontainerInstance.spawn('npm', ['install']);
  installProcess.output.pipeTo(new WritableStream({
    write(data) {
      log(data);
    }
  }));
  await installProcess.exit;
  const runtimeProcess = await webcontainerInstance.spawn('npm', ['run', 'server']);
  runtimeProcess.output.pipeTo(new WritableStream({
    write(data) {
      log(data);
    }
  }))



  webcontainerInstance.on('error', (err) => {
    console.error(err);
  });
  const waitForStartups = [
    new Promise(resolve => {
      webcontainerInstance.on('port', (port, type, url) => {
        log(JSON.stringify({ port, type, url }));
        if (port === 8080) resolve({ enrichmentUrl: url });
      })
    }),
    new Promise(resolve => {
      webcontainerInstance.on('server-ready', (port, url) => {
        log(`Server is ready! URL: ${url}`);
        resolve({ serverUrl: url });
      });
    })
  ];

  const urls = (await Promise.all(waitForStartups))
    .reduce((acc, obj) => Object.assign(acc, obj), {})
  log(`got all the Urls: ${urls}`);
  const { enrichmentUrl, serverUrl } = urls; 
  return { webcontainerInstance, serverUrl, enrichmentUrl };
};


export default startServer;  