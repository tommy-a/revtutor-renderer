# revtutor-renderer

> Offline frame renderer for tutoring session videos; Node.js command line app.

## Build

* Install node.js version 6.9.5; `nvm` is useful if you have a different version already installed (https://github.com/creationix/nvm) - this version is needed because the `fabric` library's peer dependency `canvas` does not build properly for versions 7.x
* Install yarn `npm install yarn -g`
* Run `sudo yarn` to build and install dependencies

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

To turn these frames into a video, install `ffmpeg` via `brew install ffmpeg`, and then run the following:
 ``` bash
# replace ./snapshots with the value you chose for --outputDir
ffmpeg -r 30 -i ./snapshots/%d.png -pix_fmt yuv420p ./snapshots/output.mp4
```