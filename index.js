const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const platform = os.platform();
const arch = os.arch();


const platformArch = {
  'x64': 'amd64'
}

const repo = 'jurekbarth/rpgo';
const version = 'v0.1.4';
const projectname = 'rpgo';
let retry = 0;

const destinationPath = path.resolve(__dirname, 'node_modules/.bin');

const downloadUrl = `https://github.com/${repo}/releases/download/${version}/${projectname}_${version.substr(1)}_${platform}_${platformArch[arch]}.tar.gz`


let writeTo = `${destinationPath}/${projectname}`;

if (platform === 'win32') {
  writeTo = `${destinationPath}/${projectname}.exe`;
}


// create a bin directory if one doesn't exist
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

const download = (uri, dest) => {
  if (retry === 3) {
    console.log("Retried 3 times.  Sorry.");
    return;
  }
  console.log("Downloading " + platform + " " + arch + " executable...")
  https.get(uri, function (res) {
    // github will redirect
    if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
      uri = res.headers.location;
      console.log("Redirecting and retrying ...")
      download(uri, dest);
    } else if (res.statusCode === 200) {
      saveAndUnzip(res, uri, dest);
    } else {
      // something bad happened, return the status code and exit.
      console.log(`could not download zip archive: ${res.statusCode}, ... retrying`);
      retry++;
      download(uri, dest);
    }
  });
};

const saveAndUnzip = (response, uri, dest) => {
  console.log("Extracting ...")
  console.log(dest)
  const file = fs.createWriteStream(dest);
  response.pipe(zlib.createGunzip()).pipe(file);
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
    download(uri, dest);
  });
}


download(downloadUrl, writeTo);
