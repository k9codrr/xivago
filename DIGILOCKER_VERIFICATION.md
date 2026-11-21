# Xivago: DigiLocker (Aadhaar) Verification Use Case

## Part 1: How Xivago will use the DigiLocker API

*Use-case statement for Setu / DigiLocker onboarding*

### About Xivago
Xivago is an online marketplace and community platform. Service providers and
people looking for services connect, post requirements, chat and do deals. To
build trust between strangers, we want users to be able to prove they are
real, adult individuals.

### Purpose
We will use the DigiLocker API **only for one-time identity verification** of a
user. Verification is **optional**. Users who complete it get a **"Verified"
badge** on their profile. We do **not** use Aadhaar data for any other purpose,
such as credit checks, marketing, profiling or sharing with third parties.

### How the user flow works
1. A logged-in user taps **"Verify with DigiLocker"** on their profile.
   Before this, they see a clear consent notice explaining what will be
   shared and why.
2. Xivago creates a DigiLocker request through Setu, and the user is sent to
   the **official DigiLocker login page**.
3. The user signs in to **their own DigiLocker account** and explicitly agrees
   to share their Aadhaar with Xivago.
4. DigiLocker sends the user back to Xivago. Our server reads the Aadhaar
   details **once**, server to server, and checks that:
   - the Aadhaar document's digital signature is valid
   - the user is 18 years or older
   - this identity has not already been used to verify another Xivago account
5. We **revoke our access** to the user's DigiLocker straight away using the
   revoke API.
6. The user's profile shows a **"Verified"** badge.

This is a **lifetime, one-time verification**. Each user is verified only once,
and we never ask again or fetch their DigiLocker data a second time.

### APIs we will use
| API | Why |
|---|---|
| Create DigiLocker request | To send the user to DigiLocker login and consent |
| Get request status | To confirm the user has authenticated |
| Fetch Aadhaar | To verify identity and age once |
| Revoke request | To end our access right after verification |

We do **not** need the document list or document-fetch APIs for PAN, driving
licence and other documents.

### What data we store, and what we do not
| Data | Stored? |
|---|---|
| Full Aadhaar number | **Never.** It is not received or stored |
| Masked Aadhaar number | **No** |
| Name, date of birth, gender | **No.** Used only during the request, then discarded |
| Photo, address, email, phone, Aadhaar XML | **No.** Never saved or logged |
| "Verified" status and date of verification | **Yes** |
| An irreversible, encrypted (HMAC) token made from the identity | **Yes.** Used only to stop one person from verifying several accounts. It cannot be turned back into Aadhaar details |

- Aadhaar details are **never shown** anywhere on the platform, including to
  our admins. Other users see only the "Verified" badge.
- Aadhaar data is **never written to application logs**.
- If a user deletes their account, their verification status and token are
  deleted too.

### Security and compliance
- All API calls are made server to server over HTTPS. API keys are kept only
  in server-side secret storage and are never exposed in the app or browser.
- Each verification request is tied to the logged-in user who started it,
  so it cannot be reused by anyone else.
- Attempts are rate-limited per user, and unfinished requests expire.
- We follow the **Aadhaar Act, 2016 (Section 29)** and the **Digital Personal
  Data Protection Act, 2023**: explicit consent, a stated purpose, the minimum
  data needed, and deletion on request.
- Our Privacy Policy and Terms of Service explain this verification process
  and the fact that no Aadhaar data is retained.

---

## Part 2: How to get the API from the Setu dashboard

> Screen names on Setu's dashboard may differ slightly. If you can't find an
> option, contact Setu support or sales. Their docs say credentials are
> provided by Setu.

### Step 1: Create a Setu account
1. Go to **https://bridge.setu.co**. This is Setu's developer dashboard, called "Bridge".
2. Sign up with your **business email**.
3. Verify your email and log in.

### Step 2: Set up your organisation
1. Enter your organisation name (**Xivago**) and business details.
2. Invite teammates if needed.

### Step 3: Add the DigiLocker product (Sandbox)
1. In Bridge, open **Products** (or **Data** → **DigiLocker**).
2. Choose **DigiLocker** and create a new **product instance** in **Sandbox** mode.
3. Fill in the product details:
   - **Product name:** Xivago Identity Verification
   - **Redirect URL:** `https://<your-domain>/api/verification/digilocker/callback`.
     For local testing, use your tunnel URL.
   - **Use case:** paste the summary from Part 1.
4. Submit. If the DigiLocker product isn't listed for your account, email or
   contact Setu and ask them to enable **DigiLocker (Data)** for sandbox.

### Step 4: Copy your sandbox API credentials
From the product instance page, copy these three values:
- **Client ID** (`x-client-id`)
- **Client Secret** (`x-client-secret`). Store it safely; it may be shown only once.
- **Product Instance ID** (`x-product-instance-id`)

The sandbox base URL is **`https://dg-sandbox.setu.co`**.

### Step 5: Test in sandbox
1. Give the credentials to the developer and add them to the server's
   environment variables. Never commit them to git.
2. Test the full flow: successful verification, user declines consent, the
   same Aadhaar used on a second account, and an already verified user.
3. Confirm no Aadhaar data appears in the database or logs.

### Step 6: Apply for production (go live)
In Bridge, click **"Go Live"** or **"Request Production Access"**, or contact
Setu sales. Keep these ready:
- **Registered business entity** (Pvt Ltd, LLP or partnership)
- Company **PAN**, **GSTIN**, and **Certificate of Incorporation / CIN**
- **KYC of the director or authorised signatory** (PAN and Aadhaar)
- **Live website or app URL** with a **Privacy Policy** and **Terms of Service**
  that mention DigiLocker verification
- **Use-case document**: Part 1 of this file
- **Production redirect URL**
- Expected **monthly verification volume**

### Step 7: Agreement and pricing
1. Setu will share the **commercial terms**. Pricing is per successful
   verification and is agreed directly with Setu.
2. Sign the agreement. Setu may also run a short review of your app's flow
   and consent screen.

### Step 8: Get production credentials
1. Once approved, a **Production** product instance appears in Bridge.
2. Copy the production **Client ID**, **Client Secret** and **Product Instance ID**.
3. The production base URL is **`https://dg.setu.co`**.
4. Update the server's environment variables, do one real verification to
   confirm everything works, and then launch.

### Useful links
- Setu dashboard: https://bridge.setu.co
- DigiLocker API docs: https://docs.setu.co/data/digilocker
