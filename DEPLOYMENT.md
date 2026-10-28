# GitHub Pages and Render deployment

The site is published at <https://slqven.github.io/LubicaB_site/>. GitHub Pages serves the static frontend; Render runs the Node.js API used by the enquiry form and chatbot.

## Current services

- **Pages:** <https://slqven.github.io/LubicaB_site/>
- **API health:** <https://lubica-interpreter-api.onrender.com/health>
- **Render service:** `lubica-interpreter-api`, Free plan, Frankfurt (EU Central)
- **GitHub workflow:** `.github/workflows/deploy-pages.yml` (`workflow_dispatch`)
- **CORS:** Render allows the `https://slqven.github.io` origin.

The API is live, but enquiry emails and chatbot replies need provider credentials before they can work.

## Enable email and chat

In the Render service's [Environment settings](https://dashboard.render.com/web/srv-dbglnn3bc2fs73b2pv0g/env), add these variables:

| Variable | Value |
| --- | --- |
| `INTERPRETER_EMAIL` | Address that should receive booking enquiries |
| `RESEND_API_KEY` | Secret API key from Resend |
| `EMAIL_FROM` | Sender address on a domain verified with Resend |
| `OPENAI_API_KEY` | Secret API key for the chatbot |

Keep the API keys in Render, not in chat, the website source, or GitHub. Save the variables and let Render redeploy. `OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`.

## Deploy changes

The Pages workflow is intentionally manual. In GitHub, open **Actions → Deploy GitHub Pages → Run workflow** to publish the `public/` directory after a frontend change. Render automatically deploys the Node API when changes are pushed to `master`.

The Render free instance can spin down after inactivity; its first request after a pause may take around 50 seconds. If the Render service URL changes, update `data-api-base` in `public/index.html` and `ALLOWED_ORIGINS` in Render's environment settings, then redeploy both services as needed.
