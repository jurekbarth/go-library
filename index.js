const os = require('os');
const fs = require('fs');
const https = require('https');

const platform = os.platform();
const arch = os.arch();


const platformArch = {
  'x64': 'amd64'
}

let retry = 0;

const isWindows = platform === 'win32';

// create a bin directory if one doesn't exist

const createPath = (destinationPath) => {
  fs.access(destinationPath, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        console.log('creating bin directory');
        fs.mkdirSync(destinationPath);
      } else {
        throw err;
      }
    } else {
      console.log(`${destinationPath} directory already exists`);
    };
  });
}


const download = (uri, dest, projectname) => {
  if (retry === 3) {
    console.log("Retried 3 times.  Sorry.");
    return;
  }
  console.log(`Downloading ${platform}:${arch}, ${uri}`)
  https.get(uri, function (res) {
    // github will redirect
    if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
      uri = res.headers.location;
      console.log("Redirecting and retrying ...")
      download(uri, dest, projectname);
    } else if (res.statusCode === 200) {
      saveAndUnzip(res, uri, dest, projectname);
    } else {
      // something bad happened, return the status code and exit.
      console.log(`could not download zip archive: ${res.statusCode}, ... retrying`);
      retry++;
      download(uri, dest, projectname);
    }
  });
};

const saveAndUnzip = (response, uri, dest, projectname) => {
  console.log("Extracting ...")
  console.log(dest)
  const file = fs.createWriteStream(dest, { mode: 0o755 });
  if (isWindows) {
    const unzip = require('unzip-stream');
    const str = response.pipe(unzip.Parse());
    str.on('entry', (f) => {
      console.log(f.path);
      if (f.path === 'rpgo.exe') {
        f.pipe(file);
      }
    });
    str.on('error', (err) => {
      console.log(err);
    });
  } else {
    const zlib = require('zlib');
    const tar = require('tar-stream');
    const extract = tar.extract();
    response.pipe(zlib.createGunzip()).pipe(extract);
    extract.on('entry', (header, stream, next) => {
      if (header.name === projectname) {
        stream.pipe(file);
      }
      stream.on('end', function () {
        next()
      })
      stream.resume()
    })
  }

  file.on('finish', () => {
    // close the file
    file.close(() => {
      console.log("Done!");
    });
  });

  // something went wrong.  unlink the file.
  file.on('error', () => {
    fs.unlink(file);
    console.log("Something went wrong while downloading or unzipping ...Retrying");
    retry++;
    download(uri, dest, projectname);
  });
}

const setup = (options) => {
  const { repo, version, projectname, destinationPath } = options;
  let writeTo = `${destinationPath}/${projectname}`;
  if (isWindows) {
    writeTo = `${destinationPath}/${projectname}.exe`;
  }
  createPath(destinationPath);
  let downloadUrl = `https://github.com/${repo}/releases/download/${version}/${projectname}_${version.substr(1)}_${platform}_${platformArch[arch]}.tar.gz`
  if (isWindows) {
    downloadUrl = `https://github.com/${repo}/releases/download/${version}/${projectname}_${version.substr(1)}_${platform}_${platformArch[arch]}.zip`
  }
  download(downloadUrl, writeTo, projectname);
}

module.exports = setup
