# ALL WHITE POOL PARTY — ZIMJA FEST

A TypeScript / Next.js starter for the ALL WHITE POOL PARTY event website and direct-bank-transfer ticketing workflow.

**Event details currently configured**

- Event: ALL WHITE POOL PARTY
- Organiser: ZIMJA FEST (presented by Tinotenda Media Limited)
- Date: Sunday, 13 December 2026
- Start time: 8:00 PM (Africa/Lagos, UTC+01:00)
- Venue: undisclosed (confirm with the organiser before publishing a final location)
- Early Bird: ₦4,000, first 30 individual admissions
- Regular: ₦8,000, one admission
- Friends of 5: ₦36,000, five individual admissions
- Payment: direct bank transfer to the organiser; no Paystack or other checkout gateway

The latest supplied flyer is included at `public/images/all-white-pool-party-flyer.jpg`.

> This ZIP is a development starter, not a certified production payment service. Read the “Before launch” section before accepting real orders or payments.

## Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS v4 (plus a small global CSS design system)
- Supabase PostgreSQL, Auth and private Storage
- `@supabase/ssr` cookie-based authentication and Next.js `proxy.ts`
- Zod request validation
- HMAC-SHA256 signed QR credentials
- `qrcode` for ticket QR image generation
- `@zxing/browser` for camera-based QR scanning
- Vercel-compatible deployment

## 1. Requirements

- Node.js 20.9 or newer (Node.js 22 or 24 is recommended)
- npm
- A Supabase project
- A code editor such as Visual Studio Code

Check your local versions:

```powershell
node -v
npm -v
```

## 2. Extract and open the project

1. Download `all-white-pool-party.zip`.
2. Extract it into your Documents folder.
3. Open PowerShell in the extracted project directory.

For example:

```powershell
cd "$HOME\Documents\all-white-pool-party"
code .
```

The folder should contain `package.json`, `src`, `public`, `supabase` and this README.

## 3. Install dependencies

```powershell
npm install
```

## 4. Create a Supabase project

1. Create a new project in Supabase.
2. Open **Project Settings → API** (or the API Keys section in the current dashboard).
3. Copy the project URL and publishable key.
4. Copy the private service-role/secret key for server-side use only.
5. Open **Authentication → Providers** and keep Email authentication enabled.
6. Disable public sign-ups if customers are not meant to create admin accounts.

Never put the service-role key in browser code or a variable beginning with `NEXT_PUBLIC_`.

## 5. Configure environment variables

Copy the template:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
TICKET_QR_SECRET=YOUR_64_CHARACTER_HEX_SECRET
PAYMENT_BANK_NAME=YOUR_BANK_NAME
PAYMENT_ACCOUNT_NAME=YOUR_ACCOUNT_NAME
PAYMENT_ACCOUNT_NUMBER=YOUR_10_DIGIT_ACCOUNT_NUMBER
PAYMENT_INSTRUCTIONS=Use your order reference as the transfer narration. Transfer the exact amount shown.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Generate a strong QR signing secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character output into `TICKET_QR_SECRET`. Do not reuse the example value, expose it in client code, or commit `.env.local` to Git.

The bank account is intentionally left blank in the template. Add the correct receiving-account information before testing payment instructions. The project does not contain or assume your bank details.

## 6. Create the database

1. In Supabase, open **SQL Editor**.
2. Open the local file `supabase/migrations/0001_complete_schema.sql`.
3. Copy the entire SQL file into a new SQL Editor query.
4. Run it once against this fresh Supabase project.
5. Confirm that the tables, functions and private `payment-receipts` Storage bucket were created.

This consolidated migration creates:

- Events and ticket categories
- Orders and attendees
- Admin users and audit logs
- Bank-transfer payment submissions
- Tickets and check-ins
- Atomic order reservation
- Payment submission and payment approval functions
- Ticket issuance and QR nonce storage
- Ticket availability and dashboard statistics

Ticket prices are stored in integer kobo in the database: ₦4,000 = 400,000 kobo, ₦8,000 = 800,000 kobo and ₦36,000 = 3,600,000 kobo.

## 7. Create the first administrator

1. In Supabase, open **Authentication → Users**.
2. Create the owner account with an email address and strong password.
3. Copy that user's UUID.
4. In Supabase SQL Editor, run the following, replacing the two placeholders:

```sql
insert into public.admin_users (
  user_id,
  display_name,
  role,
  is_active
)
values (
  'PASTE_AUTH_USER_UUID_HERE',
  'Event Owner',
  'owner',
  true
);
```

Only users present in `admin_users` with `is_active = true` can enter the private dashboard. A Supabase login alone does not grant administrator access.

Suggested roles:

| Role | Main access |
|---|---|
| `owner` | All current admin operations |
| `finance` | Payment queue and payment approval |
| `ticket_manager` | Gate check-in |
| `gate_staff` | Gate check-in |
| `support` | No payment approval or gate admission permission |

Create staff Auth users first, then insert their UUIDs in `admin_users` with the intended role.

## 8. Start the website

```powershell
npm run dev
```

Open:

- Public website: http://localhost:3000
- Admin login: http://localhost:3000/admin/login
- Admin overview: http://localhost:3000/admin
- Payment verification: http://localhost:3000/admin/payments
- Gate scanner: http://localhost:3000/admin/gate

The camera scanner works on `localhost` for development and requires HTTPS after deployment. Grant camera permission when prompted.

## 9. How the ticket rules work

### Early Bird allocation

The first release is capped at 30 individual admissions, not 30 order records. A Friends of 5 package consumes five admissions if it is ever made available in that phase; in the current configuration it is a later release only.

The server and database count confirmed paid Early Bird admissions plus unexpired reservations. An unsubmitted reservation initially holds its admissions for 20 minutes. A customer who submits transfer details receives a 24-hour review hold. An expired reservation is not counted as available inventory.

### Later release

Regular at ₦8,000 and Friends of 5 at ₦36,000 become purchasable only after all 30 Early Bird admissions are **paid and verified**. This is the current implementation of “after Early Bird sells out”. If the organiser wants the later categories to open as soon as 30 slots are merely reserved or receipts submitted, the database rule needs to be changed deliberately.

### Friends of 5

Each group package creates five attendee rows and five individual ticket records. Each person can enter separately using their own ticket ID or QR credential.

## 10. How direct bank transfer works

1. Customer selects a ticket and enters purchaser and attendee details.
2. The server reserves the allocation and creates an order reference.
3. The payment page displays the bank details configured in `.env.local`.
4. Customer transfers the exact order total and submits sender details, bank transaction reference and a receipt.
5. The receipt is stored in a private Supabase Storage bucket.
6. An owner or finance administrator checks the actual credit in the bank account, not only the screenshot.
7. The administrator enters the amount actually received and the actual bank reference, then approves.
8. Payment approval, order update, ticket issuance and audit record are performed by one database transaction.
9. One signed QR credential and one human-readable ticket ID are issued per attendee.

No online payment gateway is integrated.

## 11. Verify the setup

After configuration, run:

```powershell
npm run typecheck
npm run lint
npm run build
```

Then manually exercise the complete flow using test orders and test transfers. Do not use a real customer transfer as the first test. Confirm that:

- An Early Bird order cannot exceed the remaining 30-admission allocation.
- Regular and Friends of 5 remain locked until 30 Early Bird admissions are paid and verified.
- Customer-submitted amount cannot be edited to change the database order total.
- A screenshot alone does not mark an order paid.
- Only an active owner/finance account can approve a payment.
- Approval creates exactly one ticket per attendee.
- Forged QR credentials fail.
- A manual ticket ID is checked against the database and payment.
- The same ticket cannot be admitted twice, including simultaneous scans on two devices.

## 12. Important current limitations — finish these before a public launch

This project contains the foundational event site, order reservation, bank-transfer submission, administrator payment review, ticket issuance and gate verification source. The following operational features still need to be completed and tested before live public sales:

1. **Email delivery and ticket recovery:** There is no email provider wired in yet. Ticket retrieval currently uses a private checkout token held in the original browser's `sessionStorage`. A customer changing devices or clearing browser data needs a secure email-based recovery flow before launch.
2. **Operational expiration job:** A scheduled job should mark expired orders and notify customers/admins. The database currently releases expired, unsubmitted reservations during availability/order operations; it does not have a configured scheduled worker.
3. **Abuse protection:** Add rate limiting, bot protection and upload scanning for receipt files. The current code checks receipt signatures, MIME magic bytes and a 5 MB size limit but does not scan uploaded files for malware.
4. **Admin security:** Enable MFA for owner/finance accounts, set strong password and recovery policies, and review staff access.
5. **Production testing:** Test the SQL migration against a fresh Supabase project, run all npm checks, and perform end-to-end/concurrency tests before accepting payments.
6. **Event policies:** Confirm the venue, event capacity, opening/entry time, age rules, refund/transfer terms, pool safety rules and contact/venue announcement procedure. The older flyer mentioned 200 capacity; the newer flyer did not, so capacity is intentionally not hardcoded.
7. **Legal/privacy pages:** Publish organiser-approved terms, privacy notice, receipt retention rules and refund/cancellation policy.
8. **Notifications and operations:** Add email notifications, customer support workflow, and a process for bank reconciliation and refunds.

The application is a starting implementation; no claim is made that it has been independently security audited or production certified.

## 13. Deployment overview

1. Push the project to a private GitHub repository.
2. Import the repository into Vercel.
3. Add all `.env.local` variables to Vercel Project Settings → Environment Variables.
4. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS domain.
5. Deploy and test the public website, admin login, checkout, private receipt upload and gate scanner on HTTPS.
6. Ensure the Supabase Auth site URL and redirect URLs include the production domain.
7. Keep the Supabase service-role key and QR signing secret server-side only.

Do not switch to live promotion until the limitations above have been addressed.

---

**Design note:** The site uses the latest supplied ALL WHITE flyer as its main event image and follows its warm white, charcoal and gold visual direction. Event photography, venue information and other promotional claims should only be added after the organiser approves them.
"# WhiteParty" 
