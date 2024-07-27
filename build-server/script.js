const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const Redis = require("ioredis");

const publisher = new Redis("");

const s3Client = new S3Client({
  region: "",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog({ log }) {
  publisher.publish(`log:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
  console.log("Executing script.js");
  publishLog("Build started");
  const outDirPath = `${__dirname}/output`;

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", (data) => {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stdout.on("error", (data) => {
    console.log("Error: ", data.toString());
    publishLog("Error: ", data.toString());
  });

  p.on("close", async () => {
    console.log("Build completed");
    const distFolderPath = `${outDirPath}/dist`;
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    publishLog("Starting to upload files");

    for (const file of distFolderContents) {
      const filePath = `${distFolderPath}/${file}`;

      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log("Uploading: ", filePath);
      publishLog("Uploading: ", file);

      const command = new PutObjectCommand({
        Bucket: "instantdeploy",
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);

      console.log("Uploaded: ", filePath);
      publishLog("Uploaded: ", file);
    }
    console.log("Done uploading files");
    publishLog("Done uploading files");
  });
}

init();
