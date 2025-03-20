const { google } = require("googleapis");
const readline = require("readline");

const oauth2Client = new google.auth.OAuth2(
  "266471163240-4v3c9gel7sd0ovjnaf4ho1pkh5cs5mcq.apps.googleusercontent.com",
  "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",
  "urn:ietf:wg:oauth:2.0:oob"
);

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log("\n1. Visit this URL in your browser:", url);
console.log("\n2. After allowing access, you'll get a code on the screen.");
console.log("3. Copy that code and paste it below.\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code shown on the screen: ", async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (tokens.refresh_token) {
      console.log("\n✅ Success! Here's your refresh token:\n");
      console.log(tokens.refresh_token);
      console.log(
        "\nAdd this to your .env.local file as GMAIL_REFRESH_TOKEN\n"
      );
    } else {
      console.log(
        "\n❌ No refresh token received. Please try again with a different Google account or revoke access first."
      );
    }
    rl.close();
  } catch (error) {
    console.error("\n❌ Error getting tokens:", error.message);
    rl.close();
  }
});
