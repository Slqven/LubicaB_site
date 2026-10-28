# GitHub Pages and Render deployment

GitHub Pages serves the static frontend; Render runs the Node.js API used by the enquiry form and chatbot. Deploy the backend before publishing Pages so both features have a live API.

## 1. Deploy the backend on Render

1. In Render, choose **New → Blueprint**, select this GitHub repository and the `master` branch, then deploy the `render.yaml` Blueprint.
2. In the new Render service's **Environment** settings, enter `INTERPRETER_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM`, and `OPENAI_API_KEY`. Use a sender address verified with Resend. Keep these values in Render, not in frontend files or GitHub.
3. Wait for the service to become live and check <https://lubica-interpreter-api.onrender.com/health> returns `{"status":"ok"}`. The Pages frontend is configured to use this Render URL.

## 2. Publish the frontend on GitHub Pages

1. In GitHub, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
2. In **Actions → Deploy GitHub Pages → Run workflow**, manually run the deployment after the Render health check succeeds.
3. The site URL is <https://slqven.github.io/LubicaB_site/>.

The Pages workflow is manual so it will not publish a frontend that cannot yet reach its backend.

## Configuration notes

- The Render Blueprint starts on the free plan, which may spin down after inactivity and make the first request slower.
- If Render assigns a different public URL, update `data-api-base` in `public/index.html` and `ALLOWED_ORIGINS` in `render.yaml` to match the actual backend and frontend URLs, then redeploy.
- If using a custom Pages domain, add that exact origin to `ALLOWED_ORIGINS` as well.
- Keep provider keys in Render's environment settings. Do not commit them or place them in frontend code.
