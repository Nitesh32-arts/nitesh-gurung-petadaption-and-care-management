# eSewa payment integration

## If you see "This site can't be reached" (DNS_PROBE_FINISHED_NXDOMAIN)

The browser cannot resolve `uat.esewa.com.np`. This is a **network/DNS issue**, not an application bug.

### What to try

1. **Different network**  
   Use another connection (e.g. mobile hotspot, different Wi‑Fi). Some networks or regions block or don’t resolve `.np` or eSewa’s UAT domain.

2. **DNS**  
   Try switching DNS (e.g. Google 8.8.8.8, Cloudflare 1.1.1.1) in your OS or router.

3. **VPN**  
   If you’re outside Nepal, a VPN with a Nepal endpoint may be required for eSewa UAT.

4. **eSewa docs**  
   Check [eSewa developer docs](https://developer.esewa.com.np/) for current UAT URLs and test access.

### Overriding URLs (optional)

- **Frontend** (gateway redirect): in project root create `.env` with  
  `VITE_ESEWA_GATEWAY_URL=https://...` and optionally `VITE_ESEWA_SCD=...`  
  Then restart the Vite dev server.

- **Backend** (verification): set env vars before running Django:  
  `ESEWA_VERIFY_URL`, `ESEWA_SCD`  
  (e.g. for production or an alternate test URL provided by eSewa).

Default values (UAT) are:

- Gateway: `https://uat.esewa.com.np/epay/main`
- Verify: `https://uat.esewa.com.np/epay/transrec`
- SCD: `EPAYTEST`

---

## Signed payment (HMAC + initiate API)

The app supports **eSewa ePay with HMAC signing**:

1. **Initiate** – `POST /api/payments/esewa/initiate/` with `order_id`, `success_url`, `failure_url`. Backend generates `transaction_uuid`, builds payment fields, signs with **HMAC SHA256** using `ESEWA_SECRET_KEY`, and returns `payment_data` + `gateway_url`. Frontend POSTs that payload to eSewa.

2. **Fallback** – If `ESEWA_SECRET_KEY` is not set, the backend returns 503 from initiate; the frontend then uses the **unsigned** payload (amount, order id, success/failure URLs) and POSTs to the gateway as before.

**To enable signed payment:** set in your environment (e.g. backend `.env` or shell):

- `ESEWA_SECRET_KEY=<your eSewa merchant secret>`

Get the secret from eSewa (developer portal / credentials). **Never commit it to git.**  
After setting it, restart Django; checkout with eSewa will call initiate and redirect with the signed form.
