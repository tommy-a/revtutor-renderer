# revtutor-renderer

> Offline frame renderer for tutoring session videos; Node.js command line app.

## Build

* Install node.js version 6.9.5; `nvm` is useful if you have a different version already installed (https://github.com/creationix/nvm) - this version is needed because the `fabric` library's peer dependency `canvas` does not build properly for versions 7.x
* For OSX:
 ``` bash
nvm install 6.9.5; nvm use 6.9.5
sudo yarn
```
* For Windows:

Download http://ftp.gnome.org/pub/GNOME/binaries/win64/gtk+/2.22/gtk+-bundle_2.22.1-20101229_win64.zip , and unzip it to `C:\GTK`

Download and install https://sourceforge.net/projects/libjpeg-turbo/files/1.5.1/libjpeg-turbo-1.5.1-vc64.exe/download
 ``` bash
# launch shell in admin mode

nvm install 6.9.5; nvm use 6.9.5
npm install --global --production windows-build-tools
npm config set msvs_version 2015 --global

# relaunch shell in admin mode

npm install --global node-gyp
npm install

# the following is a patch for the canvas library to support jpegs - see https://github.com/Automattic/node-canvas/pull/841
# this is needed for now because the fabric library requires an older version of canvas
cp binding.gyp node_modules/canvas
curl -outFile .\node_modules\canvas\src\register_font.h https://raw.githubusercontent.com/timknip/node-canvas/42e9a7412dbc96544f28027a2ba9827dfcde97e8/src/register_font.h
curl -outFile .\node_modules\canvas\src\register_font.cc https://raw.githubusercontent.com/timknip/node-canvas/42e9a7412dbc96544f28027a2ba9827dfcde97e8/src/register_font.cc
curl -outFile .\node_modules\canvas\util\win_jpeg_lookup.js https://raw.githubusercontent.com/Automattic/node-canvas/48eb938b70ce593a225a54e49c6e307694cb19f9/util/win_jpeg_lookup.js
cd .\node_modules\canvas; node-gyp rebuild; cd ..\..
```

## Test

``` bash
# run tests once  
npm test

# run tests in watch mode
npm run test:auto
```

## Run

Execute the following to run the application:
``` bash
# replace ${} with the appropriate value
npm run start -- --archiveFile ${./binaryFile} --outputDir ${./snapshots}
```

To obtain the binary file for a session on `test.rev.com`, install the aws CLI (`brew install awscli` on OSX), and then configure it by running `aws configure`, and then run the following command:
 ``` bash
# replace the .elf filename with the session of interest
aws s3 cp s3://test-rev/tutoring/sessions/test/s6C3D.elf ./binary
```

Use the following details when configuring:
``` json
"region": "us-west-2", 
"credentials": {
    "accessKeyId": "AKIAIZ5OH5LJCDQ7EMRA",
    "secretAccessKey": "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"
}
```

To turn these frames into a video with audio, install `ffmpeg` via `brew install ffmpeg`, and then run the following:
 ``` bash
# replace ./snapshots with the value you chose for --outputDir, and sound.m4a with the audio file source
ffmpeg -r 30 -i ./snapshots/%d.png -i sound.m4a -acodec copy -pix_fmt yuv420p ./snapshots/output.mp4
```