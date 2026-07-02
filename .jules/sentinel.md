## 2024-07-02 - Hardcoded Webhook Secret
**Vulnerability:** A hardcoded HMAC secret (`super-secret-webhook-key`) was found in the call to `generateHmacSha256` in `src/components/SystemConfig.tsx`.
**Learning:** Hardcoding secrets in frontend code exposes them to anyone who can view the client-side source code, allowing them to forge webhook requests.
**Prevention:** Use environment variables (e.g., `import.meta.env.VITE_WEBHOOK_SECRET`) and ensure secrets are securely injected or handled server-side rather than exposed in client-side bundles.
