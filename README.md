# Ljubica Bielikova — English Teacher, Language Auditor, Translator, Interpreter

A responsive one-page website for Ljubica Bielikova, an English teacher, language auditor, translator and interpreter based in Bratislava, Slovakia. It includes a contact enquiry form with email notifications, an AI FAQ chatbot, and an informal auto-scored English grammar quiz.

## About the services
- Company English lessons tailored to employees' needs
- Complex language audits for employees
- Professional translation between English and Slovak
- Individual and small-group tutoring, plus interpreting
- C2 diploma in English translation (State Language School in Bratislava)

## Requirements
- Node.js 22.9 or newer
- A [Resend](https://resend.com) account and a verified sender domain for enquiry emails
- An OpenAI API key to enable the chatbot

The site runs without npm dependencies and does not store enquiries or chat messages.

## Run locally
1. Copy `.env.example` to `.env`.
2. Set `INTERPRETER_EMAIL`, `EMAIL_FROM`, and `RESEND_API_KEY` to enable contact emails.
3. Set `OPENAI_API_KEY` to enable the chatbot. `OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`.
4. Start the server:

   ```sh
   npm start
   ```

5. Open <http://localhost:3000>.

The server loads `.env` automatically when present. Keep `.env` private and never put provider keys in frontend files.

## Security
- All responses carry security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- Path traversal is blocked in the static file server.
- Per-IP rate limiting on `/api/contact` and `/api/chat` (configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`).
- Request bodies are size-limited and validated; all user input is HTML-escaped before rendering in email.
- Provider timeouts are enforced; errors never leak secrets or internal details.
- A health endpoint is available at `/health` and `/api/health`.

## Features and customization
- **Enquiry form:** sends the request to `INTERPRETER_EMAIL` and attempts to send an acknowledgement to the visitor through Resend. The acknowledgement states that the request is not a confirmed booking.
- **Chat assistant:** calls OpenAI from the server; provider keys are not exposed to the browser. The assistant is instructed not to invent prices, availability, qualifications, or professional advice.
- **English self-check:** five client-side grammar questions with immediate scoring. This is an informal sample, not a certified language-level assessment.
- **Branding and copy:** update `public/index.html` and `public/styles.css`. Colours, fonts and spacing live as custom properties at the top of `styles.css`.
- **Quiz:** edit the `questions` array in `public/app.js`.

## Assets
- **Fonts:** Playfair Display and DM Sans are self-hosted in `public/fonts/` (latin and latin-ext subsets) and declared in `public/fonts.css`. Nothing is fetched from Google Fonts at runtime, so the Content Security Policy can stay restricted to `'self'`.
- **Photographs:** `public/images/bratislava-castle.jpg` and `public/images/desk-notebook.jpg` are placeholder photographs from Pexels. Replace them with authorised photographs and update the `alt` text, which currently carries the photographer credit.
- **Portrait:** the About section shows an empty, art-directed frame. Add the authorised portrait as an `<img>` inside `.portrait__frame` in `public/index.html`.
- **Motion:** `public/vendor/` holds GSAP 3.15 with ScrollTrigger, used for the entrance reveal, image parallax and button interaction. It is vendored rather than loaded from a CDN because the CSP only permits same-origin scripts. Everything is skipped under `prefers-reduced-motion: reduce`.

Configure HTTPS and suitable production hosting before publishing. Add a privacy notice and any applicable cookie/data disclosures before collecting real enquiries.