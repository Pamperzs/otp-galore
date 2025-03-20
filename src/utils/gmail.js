import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);

// Set credentials (you'll need to implement the OAuth2 flow)
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

export async function getEmails() {
  try {
    // Search for Netflix emails with broader terms
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 50,
      // Search for Netflix emails with various subject patterns
      q: "from:netflix.com OR subject:Netflix",
    });

    console.log("Fetched messages count:", response.data.messages?.length || 0);

    if (!response.data.messages) {
      console.log("No messages found");
      return [];
    }

    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full",
        });

        // Get headers
        const headers = email.data.payload.headers;
        const subject =
          headers.find((h) => h.name === "Subject")?.value || "No Subject";
        const date = new Date(headers.find((h) => h.name === "Date")?.value);
        const from = headers.find((h) => h.name === "From")?.value;

        // Extract body to find original recipient
        let body = "";
        if (email.data.payload.parts) {
          for (const part of email.data.payload.parts) {
            if (
              part.mimeType === "text/html" ||
              part.mimeType === "text/plain"
            ) {
              body += Buffer.from(part.body.data, "base64").toString();
            }
          }
        } else if (email.data.payload.body.data) {
          body = Buffer.from(email.data.payload.body.data, "base64").toString();
        }

        // Try to find the original recipient
        let originalTo = "";

        // Pattern to match email in format: To: email@domain.com
        const toMatch = body.match(
          /To:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
        );
        if (toMatch) {
          originalTo = toMatch[1];
        }

        // If not found, try alternative pattern for Netflix emails
        if (!originalTo) {
          const netflixToMatch = body.match(
            /(?:sent to|dikirim ke|enviado a|отправлено на|送信先|gửi đến)\s*\[?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\]?/i
          );
          if (netflixToMatch) {
            originalTo = netflixToMatch[1];
          }
        }

        // If still not found, use the header To value
        if (!originalTo) {
          originalTo =
            headers.find((h) => h.name === "To")?.value || "No recipient";
        }

        // Extract body and find Netflix verification link
        let netflixLink = null;

        // Pattern 1: Look for verification link in any button or anchor tag
        const buttonPatterns = [
          // Match link in button with href
          /<button[^>]*href=["'](https:\/\/www\.netflix\.com\/account\/travel\/verify\?[^"']+)["'][^>]*>/i,
          // Match link in anchor tag
          /<a[^>]*href=["'](https:\/\/www\.netflix\.com\/account\/travel\/verify\?[^"']+)["'][^>]*>/i,
          // Match any element with verification link
          /href=["'](https:\/\/www\.netflix\.com\/account\/travel\/verify\?[^"']+)["']/i,
        ];

        for (const pattern of buttonPatterns) {
          const match = body.match(pattern);
          if (match) {
            netflixLink = match[1];
            // Decode HTML entities if present
            netflixLink = netflixLink.replace(/&amp;/g, "&");
            break;
          }
        }

        // If still no link found, try finding it in the raw text
        if (!netflixLink) {
          const rawLinkMatch = body.match(
            /https:\/\/www\.netflix\.com\/account\/travel\/verify\?[^\s<>"']+/i
          );
          if (rawLinkMatch) {
            netflixLink = rawLinkMatch[0];
          }
        }

        // Only return emails that have the Netflix verification link
        if (netflixLink) {
          console.log("Found Netflix verification email:", {
            id: message.id,
            subject,
            date: date.toISOString(),
            hasLink: true,
            link: netflixLink,
            to: originalTo,
          });

          return {
            id: email.data.id,
            subject: subject,
            date: date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            from: from,
            to: originalTo,
            link: netflixLink,
          };
        }
        return null;
      })
    );

    // Filter out null values and sort by date
    const sortedEmails = emails
      .filter(Boolean)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log("Total Netflix verification emails:", sortedEmails.length);

    return sortedEmails;
  } catch (error) {
    if (error.message === "invalid_grant") {
      console.error(`
        Refresh token has expired or been revoked.
        This can happen when:
        - Gmail has security updates
        - Google Account settings change
        - The token hasn't been used for a long time
        
        To fix this:
        1. Run 'node get-refresh-token.js'
        2. Follow the prompts to get a new refresh token
        3. Update GMAIL_REFRESH_TOKEN in .env.local
        4. Restart the server
      `);
      return [];
    }
    console.error("Error fetching emails:", error);
    return [];
  }
}
