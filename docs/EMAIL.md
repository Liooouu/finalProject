# TrackED email configuration and delivery

TrackED uses SMTP to send account codes and copies of in-app notifications. The technical maintainer configures the sending account on the API server. Changing an email's wording is a separate task from changing SMTP credentials.

The application can improve message clarity and correct sending configuration, but it cannot guarantee a recipient's Inbox, Primary tab, or Important label. The receiving provider and the recipient control those decisions. Gmail documents its [sender requirements](https://support.google.com/mail/answer/81126) and [importance markers](https://support.google.com/mail/answer/186543).

## Where to edit

Paths below are relative to the TrackED project folder.

| File or setting | Purpose |
| --- | --- |
| `backend/.env` | Local development credentials and the local website address. This file is private and must not be committed. |
| Coolify → `tracked-api` → Environment Variables | Production SMTP credentials and the public website address. Set them on the API application, not the frontend. Restart or redeploy the API after changing them. |
| `backend/.env.example` | The local configuration template, with placeholders instead of real passwords. |
| `backend/services/mailer.js` | Creates the Nodemailer SMTP transport and sends messages. Credentials belong in the environment, not in this source file. |
| `backend/services/appSettings.js` | Resolves the effective environment configuration and compatibility settings. |
| `backend/services/emailTemplate.js` | Default subjects, headings, introductory wording, HTML layout, plain-text versions, event details, and account-code messages. |
| `backend/services/notify.js` | Stores in-app notices and sends email copies to the same recipients. |
| `backend/routes/eventRoutes.js`, `backend/routes/organizerRoutes.js`, `backend/routes/adminRoutes.js`, and `backend/services/manualAttendance.js` | The specific notification titles and messages for events, excuse decisions, account changes, and attendance reviews. Search for `notifyUsers(` to find the originating message. |

The normal message path is: a system action creates a notification → `notify.js` stores the in-app notice → `emailTemplate.js` renders the message → `mailer.js` sends it through the configured SMTP provider.

## Production configuration

For the existing Gmail sending account, configure the following values in the API's production environment. Replace the examples with the account that actually sends TrackED mail; do not copy a placeholder password.

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sending-account@gmail.com
SMTP_PASS=your-google-app-password
MAIL_FROM=TrackED <your-sending-account@gmail.com>
APP_URL=https://track-ed.vispo.me
```

Use the same Gmail address for `SMTP_USER` and the address inside `MAIL_FROM`. `TrackED` is the display name; it does not change the authenticated sender address. A custom sender address needs a provider-authorized alias or a verified sending domain. Do not impersonate a school mailbox that the application is not authorized to use.

Optionally set `MAIL_REPLY_TO` to a monitored support address if replies should go somewhere other than the sending account.

For Gmail password-based SMTP, enable 2-Step Verification and create an App Password. Use that App Password rather than the normal Google account password. Google may revoke App Passwords after an account-password change. OAuth 2.0 is another supported authentication method, but requires a separate implementation. See [Google App Passwords](https://support.google.com/accounts/answer/185833) and [Nodemailer's Gmail guide](https://nodemailer.com/guides/using-gmail).

Port `465` uses TLS from the start with `SMTP_SECURE=true`. For a provider's STARTTLS configuration on port `587`, use `SMTP_SECURE=false`; that value means TLS is negotiated after connecting, not that TLS should be disabled. Use the provider's published configuration and keep certificate validation enabled. See [Nodemailer's SMTP transport](https://nodemailer.com/smtp).

`APP_URL` must be the public HTTPS website in production. A `localhost` or `127.0.0.1` link opens the recipient's own device rather than TrackED. Keep `http://localhost:5173` only in the local development environment.

## Existing installations and saved settings

Older versions stored SMTP configuration and optional message templates in the MongoDB `Setting` document whose key is `email`. Removing the admin configuration screen does not delete that document.

A complete environment configuration takes precedence for SMTP. Configure `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` together, then set the port, TLS mode, sender, and public `APP_URL` explicitly. Legacy database settings remain a read fallback for installations that have not yet supplied a complete environment configuration; this avoids immediately disabling their existing email delivery.

Existing custom subject, title, and body overrides remain compatible. An override can make an older installation display different wording from the defaults in `emailTemplate.js`. A maintainer should inspect or deliberately reset those specific template fields before expecting revised defaults. Never delete the whole settings document just to change wording.

The old database SMTP password is encrypted using the application's secret. Changing that secret can make the legacy saved password unreadable. A complete environment configuration avoids relying on that saved password. Do not expose either password in logs, screenshots, source code, or support messages.

## Edit the messages

Edit `DEFAULT_TEMPLATES` in `backend/services/emailTemplate.js` for the standard account-verification, password-reset, and notification subjects and introductions. Preserve the supported placeholders, such as `{name}`, `{title}`, and `{message}`. The event-specific sentence may originate in a `notifyUsers` call, so changing only the wrapper will not change every event or review message.

Keep subjects accurate and concise. Account codes must remain readable as text, include their actual expiry, and tell the recipient not to share the code. Include event dates, times, venue, and the action required when relevant. Keep HTML and plain-text versions consistent, and use the public TrackED URL for links. Message wording alone does not repair failed domain authentication.

## Investigate Spam placement

1. Open an affected received message in Gmail, choose the message's **More** menu, then **Show original**. Review the SPF, DKIM, and DMARC results and the visible From address. Google's [header instructions](https://support.google.com/mail/answer/29436) explain how to view the original message.
2. For direct mail, investigate authentication failures or misaligned sender domains before changing colors or adding urgency to a subject. A `PASS` result confirms that particular authentication check; it does not guarantee Inbox delivery.
3. When sending as `@gmail.com` through Gmail, Google owns that domain's DNS and signing configuration. Do not add Gmail SPF or DKIM records to the TrackED website domain and expect them to authenticate a `gmail.com` sender.
4. When adopting a custom sending domain, use the exact SPF, DKIM-selector, and DMARC records supplied or required by its email provider. Verify those records with the provider. Do not invent DKIM keys, create conflicting SPF records, or tighten DMARC policy before checking legitimate senders.
5. Confirm that message links use the real HTTPS website and that the sender is stable and recognizable. Check the provider's rejection, quota, and delivery logs when messages are missing.

Recipients can mark a legitimate message **Not spam**, add the sender to contacts, or choose their own importance/filter preferences. Those are recipient choices, not settings TrackED can impose. Setting every message's priority to High cannot force Gmail to assign its Important label.

The `/api/health` response's `mail: "on"` indicates that configuration is present; it does not establish that a message was accepted, delivered to an inbox, or read. Keep in-app notifications available independently of email. Test delivery only to an authorized test recipient before relying on a production configuration change.

Notification copies are submitted through a shared queue with three active jobs and a reusable SMTP connection pool. The queue is in memory, so a server restart can interrupt pending email copies. It is not a durable delivery or retry service. In-app notices are stored before these submissions, and SMTP failures do not remove them.
