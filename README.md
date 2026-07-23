# i.らぶ.moe

[English](README.md) | [日本語](README.ja.md)

**Share your Minecraft screenshots with one click.**

i.らぶ.moe is a client-side Fabric mod that turns screenshots into short, shareable URLs.
After taking a screenshot with **F2**, a clickable upload button appears in chat. Once
uploaded, the short URL is automatically copied to your clipboard.

## Features

- Upload screenshots directly from Minecraft
- Automatically copy the resulting short URL
- Capture the current server name and address as image metadata
- Open, copy, or delete an uploaded image from the in-game chat
- Manage image titles, albums, tags, favorites, and visibility from the website
- Share images as unlisted, private, or passphrase-protected
- English and Japanese support based on your Minecraft language
- Optional automatic F2 uploads for Plus users

The mod is entirely client-side and does not need to be installed on the server.

## How to use

1. Install the mod together with Fabric Loader and Fabric API.
2. Take a screenshot with **F2**.
3. Click **[Upload]** in the chat message.
4. The screenshot is uploaded and its URL is copied to your clipboard.

Free users can upload screenshots manually. Plus users can enable automatic uploads:

```text
/ilovemoe auto-upload on
```

## Commands

```text
/ilovemoe login
/ilovemoe auto-upload
/ilovemoe auto-upload on
/ilovemoe auto-upload off
```

The login command opens a Turnstile-protected email form. The magic link sent from that form
lets you manage your screenshots from the web dashboard.

## Plans

The free plan includes manual uploads, up to 50 uploads per 30 days, and 30-day storage.

Plus includes:

- Up to 500 uploads per 30 days
- 365-day storage
- Automatic screenshot uploads
- More albums and images per album
- Private and passphrase-protected sharing
- Tags, favorites, and bulk organization

## Privacy notice

Screenshots may contain player names, chat messages, server addresses, or other personal
information. Please review your screenshot before uploading and choose an appropriate
visibility setting.

[Website](https://i.らぶ.moe) | [Privacy Policy](https://i.らぶ.moe/privacy) | [Terms](https://i.らぶ.moe/terms)
