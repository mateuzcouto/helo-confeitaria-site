# QZ Security Endpoints

This folder contains backend endpoints required by QZ Tray trusted signing flow.

It also contains a Firestore trigger that sends order notifications through EmailJS on the server side (no EmailJS credentials in frontend).

## Endpoints

- `GET /api/qz/certificate` -> returns JSON with `certificate`
- `POST /api/qz/sign` -> signs incoming payload and returns JSON with `signature`
- `POST /api/admin/claim/sync` -> verifies authenticated user token and applies custom claim `admin` if email is present in backend allowlist (`ADMIN_ALLOWED_EMAILS`).

## Firestore Triggers

- `sendOrderNotificationEmail` -> triggered on `orders` creation and sends EmailJS notifications from backend.

## Environment Variables

Set these in your deployment environment:

- `QZ_CERT_PEM`: public certificate PEM
- `QZ_PRIVATE_KEY_PEM`: private key PEM used for signatures
- `EMAILJS_SERVICE_ID`: EmailJS service ID
- `EMAILJS_TEMPLATE_ID`: EmailJS template ID
- `EMAILJS_PUBLIC_KEY`: EmailJS public key
- `EMAILJS_PRIVATE_KEY`: EmailJS private key/access token
- `EMAILJS_NOTIFY_EMAILS`: comma-separated recipients list
- `ADMIN_ALLOWED_EMAILS`: comma-separated admin emails allowed to receive custom claim `admin`

Both values can be stored with real newlines or escaped `\\n`.

## Local test

1. Install deps in `functions/`:
   - `npm install`
2. Copy `.env.example` to `.env` and fill values.
3. Run Firebase emulators with functions + hosting.

## Deploy

- `firebase deploy --only functions,hosting`

Keep the private key secret. Never expose it in frontend code.
