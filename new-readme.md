Can we use telegram account storage connecting with our system to use as my storage system even if i know touch the telegram i can still upload it from my machine or wherever i deploy is it possible or not??

Yes, it’s possible. Lots of people do this. Your server or script uploads files to a private Telegram channel through Telegram’s API, so you never have to open the Telegram app. You save the returned file_id or message ID in your own database so you can fetch the file again later.

Two ways to do it:

Bot API (easiest): create a bot with @BotFather and add it as an admin of a private channel. Your code calls sendDocument. The catch is size: on the standard API, bots can download up to 20 MB per file via getFile and upload up to 50 MB. You can run your own copy of the Bot API server instead, which allows working with files up to 2000 MB (2 GB). That only works when the server is started with the --local flag. 
A flat-vector paper plane beside a file icon and a size gauge representing Telegram file size limits
 +2
User account through MTProto (Telethon or Pyrogram in Python, GramJS in Node): you log in once with your phone number and an OTP, and after that the session file runs on its own. Standard free accounts can upload files up to 2 GB, while Telegram Premium subscribers can upload files up to 4 GB. 
fast

Things to keep in mind:

Files bigger than the limit have to be split into chunks, and your code puts them back together on download.
Encrypt files before uploading. Channel content isn’t end-to-end encrypted.
Telegram’s terms don’t really cover using it as general-purpose storage. Very heavy automated use, especially on a user account, can get rate-limited (FloodWait errors) or banned. Use a dedicated account, not your main one, and keep important data backed up somewhere else.
Expect rate limits, roughly 20 messages a minute per channel for bots, so add retry and backoff logic.

Existing open-source projects like TGDrive and teldrive already work this way if you don’t want to build it yourself. I can write a starter Python script (upload, download and chunking) for whichever method you choose.

So how much storage is can store on it overall

There’s no official overall limit. Telegram doesn’t put a cap on total cloud storage per account or channel. The limits apply per file: 2 GB on a free account, 4 GB with Premium, and 50 MB through the standard Bot API.

The practical limits are elsewhere:

Fair use: “Unlimited” isn’t guaranteed. If you upload many terabytes through automation, Telegram may throttle or ban the account, and there’s no SLA or support if files disappear.
Speed: Uploads and downloads are rate-limited, so moving large amounts of data takes time. Free accounts may also get slower download speeds than Premium.
Inactive accounts: By default, an account is deleted after 6 months without activity, and its data goes with it. You can raise this to 12 months or more in Privacy settings, and regular API activity keeps the account active anyway.

In short, you can store a lot, from hundreds of GB to multiple TB in practice. Treat it as a free, best-effort backup tier, not your only copy of anything important.

But how to create a project which i can use toh store upload on it and then fatch and all store project files and other data in structured format and deploy project on vercel and can upload drag drop from system and all

I’ll build this as a ready-to-deploy Next.js project for Vercel. It will have drag-and-drop file and folder uploads, file chunking, a Postgres database for the folder/file structure, password login and optional encryption.

I built the project and sent it as tg-drive.zip. I checked that every file parses, but I couldn’t install the packages here, so it hasn’t been built or tested yet. Your first npm install and Vercel deploy will be the real test.

How it works:

Your files go to a Telegram chat through your bot, split into 4 MB pieces. Vercel only accepts about 4.5 MB per request, so the pieces have to be smaller than that. Each piece is one Telegram message, so file size has no practical limit.
The folder and file structure is kept in a free Postgres database (Neon). It records each folder, each file’s name, size and type, and which Telegram messages hold which pieces.
The web app lets you drag and drop files or whole project folders, and keeps their folder structure. It also has folders, search, rename, delete, download, a password login, and optional encryption so Telegram only ever stores scrambled data.

To get it running (about 10 minutes, full steps in README.md):

Create a bot with @BotFather, press Start in it, and get your chat ID from the getUpdates link.
In Vercel, go to Storage and create a Neon database, then run schema.sql in its SQL editor.
Push the folder to GitHub, import it into Vercel, and add the environment variables (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, APP_PASSWORD, SESSION_SECRET, and ENCRYPTION_KEY if you want encryption).

Limits to know:

Speed: uploads are limited by Telegram’s rate limits, so expect a few MB per second at best. The app waits and retries automatically.
Big downloads: files are put back together in your browser’s memory, so download multi-GB files on a computer, not a phone.
Back up the database: without it, the pieces stored in Telegram are very hard to reassemble.
Tg drive
ZIP

Also give another feature to it that user can connect his multiple gmail accounts using login and then there is a overall connected storage for him from each drive account left up storage and keep the telegram thing as it it

I’ll add Google Drive as a second storage option next to Telegram. You’ll be able to connect several Gmail accounts with Google login and see their combined free space in one place. Uploads can go to Telegram, to whichever Drive account has the most free space, or to an account you pick.

I’ve updated tg-drive.zip so you can connect several Gmail accounts and see all their free space as one pool. Telegram storage works exactly as before. As with the first version, every file parses, but I couldn’t install packages or run the app here, so the first deploy is the real test.

What’s new:

Storage panel: a “Storage” button opens a panel with a + Connect Google account button that uses normal Google sign-in, and you can repeat it for each Gmail account. Each account gets a used/free bar, and at the top you see the combined free space across all accounts, plus Telegram (no fixed cap) and how much the app has stored.
“Save to” menu: next to the upload buttons you choose where new uploads go:
Telegram
Google Drive (most free): the app picks the account with the most free space that the file fits in
A specific account, for example “you@gmail.com (12.4 GB free)”
One file list for everything: each file has a label showing where it’s stored, TG or Drive · accountname. Folders, search, download and delete work the same for both.
Drive uploads are normal files: they land in a “TG Drive” folder in that account, so you can also open them directly in Google Drive.
Limited access: the app uses Google’s most limited Drive permission (drive.file), so it can only see files it uploaded, never the rest of your Drive.

What you need to do (full steps in README.md, step 4):

In Google Cloud Console: create a project, enable the Drive API and create an OAuth web client. Use https://your-app.vercel.app/api/google/callback as the redirect URL.
On the OAuth consent screen, set the app to “In production”. If you leave it in “Testing”, Google disconnects your accounts every 7 days.
Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_URL to Vercel.
Run schema.sql again. It’s safe to re-run and only adds the new tables and columns.

Limits to know:

Free space is shared: the free space Google reports is shared with Gmail and Photos.
Largest file: one file can’t be split across accounts, so the biggest file you can upload to Drive is the free space of your emptiest account.
Don’t change SESSION_SECRET later: it’s also used to encrypt the saved Google logins, so changing it means reconnecting every account.
Tg drive
ZIP

So what are the all env vars? And the flow will be login with email and pass then uploading files which will be uploaded on telegram channel automatically and for google need to connect with a button and can add multiple accounts and their all storage gets combined which i can upload to

Yes, that’s how it works, with two differences: the login is a password only, not email + password, and a single file can’t be bigger than the free space of one Google account.

All environment variables:

Required:

TELEGRAM_BOT_TOKEN: your bot’s token from @BotFather
TELEGRAM_CHAT_ID: the channel ID (like -100…, with the bot added as admin), or your own user ID
DATABASE_URL: Neon Postgres connection string (Vercel sets it automatically if you add Neon there)
APP_PASSWORD: the password you log in with
SESSION_SECRET: a long random string, for example from openssl rand -hex 32. Never change it after connecting Google accounts.

Optional:

ENCRYPTION_KEY: encrypts files before they’re sent to Telegram. If you lose it, those files can’t be recovered.
GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: from Google Cloud Console. These turn on the Connect Google button.
APP_URL: your site URL, like https://your-app.vercel.app. Google login sends you back to this address.

The flow:

Log in: you enter the password from APP_PASSWORD. It’s a single-user login, with no email field and no sign-up.
Upload: you drag and drop or pick files. With “Save to: Telegram” selected (the default), they go to your channel automatically.
Connect Google: Storage → + Connect Google account, then sign in with Google. Repeat for as many Gmail accounts as you like.
Combined storage: the Storage panel shows every account’s free space and the total. With “Save to: Google Drive (most free)” selected, each file goes to whichever account has the most room.

About the combined storage: it works as one pool across files, not within a single file. If you have three accounts with 10 GB free each, you can store about 30 GB in total, but each file must be under 10 GB. Anything bigger can go to Telegram instead.

If you want a real email + password login, for example several users who each have their own files and Google accounts, I can add sign-up, hashed passwords and per-user data. That means a users table and tagging every file and account with its owner.

Can we also make it and use these as my server where i can host my site using openpanel dokploy and all ??

No. Telegram and Google Drive can only store files. They can’t run anything, and Dokploy and OpenPanel need a real Linux machine that runs programs (Docker, databases, Node and so on). Storage alone can’t host a site. Google Drive also dropped its old web-hosting feature years ago.

What you need: one small server (a VPS) to install Dokploy or OpenPanel on. Typical choices are a cheap VPS from Hetzner, Contabo or DigitalOcean, or Oracle Cloud’s free tier if your region has capacity. After that you can host as many sites as fit on that one machine.

How your storage pool fits in:

Run TG Drive itself on Dokploy instead of Vercel. That removes Vercel’s 4 MB-per-request limit and its time limits, so uploads can be faster and use bigger chunks. It would need a small change to the chunk size.
Store your sites’ backups and large media in the pool. Database dumps, uploads and videos go to Telegram or Drive, and the VPS disk stays small.
Connect Dokploy’s backups directly. Dokploy saves backups to S3-compatible storage. I could add an S3-compatible API to TG Drive so Dokploy, rclone or any S3 tool can write straight into your Telegram/Drive pool. It’s a bigger piece of work, but doable.

What I wouldn’t do: serve a live website’s pages or images straight from Telegram or Drive. It would be slow, rate-limited, and a ban could take your site offline.

The setup that works: one VPS running Dokploy, which runs your sites and TG Drive, with Telegram and Google Drive as cheap, large storage behind it. I can adapt TG Drive for Dokploy (Dockerfile plus bigger chunks) or add the S3-compatible API if you want either.

And how much i get storage from free plan of cloudflare r2?

10 GB. The Cloudflare R2 free tier includes 10 GB-month of Standard storage, 1 million Class A operations (writes and lists) and 10 million Class B operations (reads) every month, plus free egress. 
upstash

What to know about it:

Usage above 10 GB is charged, with no hard stop. All usage above the free tier is charged and the bucket remains accessible. There is no hard limit on the total cost. Past the free tier, R2 Standard storage pricing is $0.015 per GB-month, so 100 GB costs about $1.35/month. 
upstash
Only one storage class is free. The free tier only applies to Standard storage. 
cloudflare
You need a card on file. Cloudflare asks for a payment method before you can turn R2 on, even for the free tier.
Downloads are free. You pay nothing for egress at any volume, which is R2’s big advantage over AWS S3.

Compared with your pool, 10 GB is small: Telegram has no fixed cap and each Gmail account adds 15 GB. Where R2 is much better is reliability. It’s a real storage service with no ban risk, it’s fast, and it’s S3-compatible, so Dokploy backups and rclone work with it directly.

A good split would be R2 for important backups and live site assets, and Telegram and Google Drive for bulk storage. I can add R2 to TG Drive as a third “Save to” option.

Sources:

Cloudflare R2 pricing docs
Upstash: Cloudflare R2 pricing in 2026

Yes add option to the project and also multiple people can use the platform for that give user login sign up option

I’ll add both: Cloudflare R2 as a third storage option, and email + password sign-up and login with separate files for each user.

I’ve updated tg-drive.zip: anyone can now sign up with email and password and gets their own private drive, and Cloudflare R2 is a third “Save to” option. The server code passed a type-check against stand-in types for Next.js, Neon and aws4fetch. The UI screens couldn’t be type-checked or run here, so your first npm install and deploy will show whether anything still needs fixing.

How it works now:

Accounts: there’s a sign-up / sign-in page, and passwords are stored securely hashed. Each user only ever sees their own folders, files and Google accounts.
Telegram: works as before. It’s your one bot and channel, shared by all users, and their files are kept apart in the database.
Cloudflare R2: your one bucket, shared by all users. It’s capped at 10 GB total by default so you stay on the free tier, and you can also set a per-user limit.
Google Drive: each user connects their own Gmail accounts, and the Storage panel adds up that user’s free space.
Your existing files: the first account that signs up takes over files uploaded with the older versions. Sign up yourself first.

New environment variables:

ALLOW_SIGNUP=false closes sign-ups.
SIGNUP_CODE makes sign-up require an invite code.
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET connect R2.
R2_TOTAL_LIMIT_GB (default 10) caps total R2 use, and R2_USER_LIMIT_GB caps each user.
APP_PASSWORD is no longer used, so remove it.

Before you open it to other people:

Set ENCRYPTION_KEY. Everyone’s Telegram files land in your channel, and without it you, or anyone in that channel, could open them.
Use SIGNUP_CODE or ALLOW_SIGNUP=false so strangers can’t fill your Telegram or R2 storage.
Re-run schema.sql. It upgrades your existing database in place.

Telegram’s rate limits are shared by all users, so uploads there get slower when several people upload at once. R2 stays fast.

Tg drive
ZIP