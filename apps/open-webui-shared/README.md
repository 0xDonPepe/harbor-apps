# Open WebUI for Ollama

Private ChatGPT-style assistant for the separate Ollama app: chat with the models every AI app on this machine
shares, or connect your own API keys.

This is Open WebUI without a model server of its own. Install the **Ollama** app first: its models, its graphics
card and its settings (context length, keep-alive and so on) serve this app and every other AI app that links to
it, so each model is downloaded once. The **Open WebUI** app (with its own bundled Ollama) stays available and
unchanged.

## What Harbor does

- Runs Open WebUI on its own private network; only the web UI is published on 127.0.0.1.
- Links it to Ollama (*Talks privately to*, picked for you when one Ollama is installed): a private network joined
  only by this app and Ollama's server, with Ollama's address in `OLLAMA_BASE_URL` (`http://ollama-link:11434`).
- Generates the session signing key once and keeps it as a retained secret.
- Hands the current address to Open WebUI (WEBUI_URL) and re-renders it when you publish the app.

## First run

1. Install Ollama, then this app. Open it and create the first account; it becomes the administrator. Further
   sign-ups wait for admin approval.
2. Download a model under Admin Panel, Settings, Models (for example `llama3.2:1b`). It lands in the Ollama app,
   where your other AI apps see it too. Per-model options (temperature, context, system prompt) are set here as
   well, under Workspace, Models.
3. Or add an API key under Admin Panel, Settings, Connections.

## Linking Ollama later

The link is optional, so the app also installs without Ollama (API keys only). Open WebUI saves the Ollama address
in its own database at its first start and keeps it after that. If you installed it without Ollama and link one
later (app page, Links), Harbor hands it the address, but Open WebUI still uses the one it saved: enter
`http://ollama-link:11434` once under Admin Panel, Settings, Connections, Ollama API. Picking another Ollama later
needs nothing: the address stays the same.

## Storage

- `data`: Chats, users and settings. The models live in the Ollama app.
- Managed volumes and your folders are retained on remove; Harbor never deletes them.

## Notes

- How fast answers come depends on Ollama: on a graphics card Harbor found (see the Ollama app), or on the CPU.
- Nothing leaves this machine unless you add an external API key.

Upstream: https://openwebui.com
