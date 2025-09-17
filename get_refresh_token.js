const fs = require("fs");
const { google } = require("googleapis");

const credentials = JSON.parse(fs.readFileSync("credentials.json"));

const { client_id, client_secret, redirect_uris } = credentials.installed;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Scopes for uploading videos
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline", // important! gives refresh token
  scope: SCOPES,
});

console.log("Authorize this app by visiting this URL:");
console.log(authUrl);

// After you get the code from the URL, paste it below
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question("Enter the code from that page here: ", async (code) => {
  const { tokens } = await oAuth2Client.getToken(code);
  console.log("Here is your refresh token (save this safely!):");
  console.log(tokens.refresh_token);
  readline.close();
});
