# ALL WHITE POOL PARTY — ZIMJA FEST

A TypeScript / Next.js starter for the ALL WHITE POOL PARTY event website and direct-bank-transfer ticketing workflow.

## Event details

- **Event:** ALL WHITE POOL PARTY
- **Organiser:** ZIMJA FEST
- **Presented by:** TINOTENDA MEDIA LIMITED
- **Date:** Friday, 11 December 2026
- **Start time:** 8:00 PM (Africa/Lagos, UTC+01:00)
- **Venue:** 2, Lanre Laogoshe Close, off Etal Avenue, Oregun, Ikeja
- **Landmark:** In front of NNPC, First Bank Bus Stop
- **Early Bird:** ₦3,000, limited to the first 30 individual admissions
- **Regular:** ₦5,000, one admission
- **Friends of 5:** ₦20,000, five individual admissions
- **Payment:** Direct bank transfer to the organiser. No Paystack or other checkout gateway.

**Contact information**

- Sponsorship: +234 812 156 7008
- Enquiries: +234 916 524 5102

> This project is a development starter, not a certified production payment service. Read the Before Launch section before accepting real orders or payments.

## Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS v4 and a small global CSS design system
- Supabase PostgreSQL, Auth and private Storage
- `@supabase/ssr` cookie-based authentication and Next.js `proxy.ts`
- Zod request validation
- HMAC-SHA256 signed QR credentials
- `qrcode` for ticket QR image generation
- `@zxing/browser` for camera-based QR scanning
- Resend-based ticket email delivery
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

1. Download or clone the project.
2. Extract it into your Documents folder if you downloaded a ZIP.
3. Open PowerShell in the project directory.

For example:

```powershell
cd "$HOME\Documents\all-white-pool-party"
code .
```

The project folder should contain `package.json`, `src`, `public`, `supabase` and this README.

## 3. Install dependencies

```powershell
npm install
```

## 4. Create a Supabase project

1. Create a new project in Supabase.
2. Open **Project Settings → API** or the API Keys section in the current dashboard.
3. Copy the project URL and publishable key.
4. Copy the private service-role/secret key for server-side use only.
5. Open **Authentication → Providers** and keep Email authentication enabled.
6. Disable public sign-ups if customers are not meant to create administrator accounts.

Never put the service-role key in browser code or in a variable beginning with `NEXT_PUBLIC_`.

## 5. Configure environment variables

Copy the template:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and fill in the values:

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

Also configure the email-provider variables specified by the project's `.env.example` before testing ticket email delivery.

Generate a strong QR signing secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character output into `TICKET_QR_SECRET`.

Do not reuse an example value, expose it in client code, or commit `.env.local` to Git.

The bank account is intentionally left blank in the template. Add the correct receiving-account information before testing payment instructions. The project does not contain or assume your bank details.

## 6. Create the database

For a **fresh Supabase project**:

1. Open Supabase and go to **SQL Editor**.
2. Open the local file:

   `supabase/migrations/20261121210000_complete_schema.sql`

3. Copy the entire SQL file into a new SQL Editor query.
4. Run it once against the fresh project.
5. Confirm that the tables, functions and private `payment-receipts` Storage bucket were created.

**Important:** This is the consolidated initial migration. Do not rerun it against an existing database containing event orders or payment records.

The migration creates:

- Events and ticket categories
- Orders and attendees
- Admin users and audit logs
- Bank-transfer payment submissions
- Tickets and check-ins
- Atomic order reservation
- Payment submission and payment approval functions
- Ticket issuance and QR nonce storage
- Ticket availability and dashboard statistics
- Expiration handling for pending reservations and payment submissions

Ticket prices are stored in integer kobo:

| Ticket | Price | Database value |
|---|---:|---:|
| Early Bird | ₦3,000 | 300,000 |
| Regular | ₦5,000 | 500,000 |
| Friends of 5 | ₦20,000 | 2,000,000 |

## 7. Update event details in an existing database

If you already ran the original schema migration, do not run it again.

Instead, open Supabase **SQL Editor**, create a new query and run:

```sql
begin;

update public.events
set
  event_start_at = '2026-12-11 20:00:00+01',
  venue = '2, Lanre Laogoshe Close, off Etal Avenue, Oregun, Ikeja (in front of NNPC, First Bank Bus Stop)'
where slug = 'all-white-pool-party';

update public.ticket_types
set price_amount_kobo = case id
  when 'early-bird' then 300000
  when 'regular' then 500000
  when 'friends-of-five' then 2000000
  else price_amount_kobo
end
where id in (
  'early-bird',
  'regular',
  'friends-of-five'
);

commit;

select
  e.name,
  e.event_start_at,
  e.venue,
  t.id,
  t.name as ticket_name,
  t.price_amount_kobo,
  t.admissions_per_unit,
  t.early_bird_limit
from public.events e
join public.ticket_types t on t.event_id = e.id
where e.slug = 'all-white-pool-party'
order by t.sort_order;
```

Check the returned event date, venue and prices before accepting new reservations.

This update changes ticket prices for new reservations. Existing orders retain their original recorded totals.

## 8. Create the first administrator

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

## 9. Start the website

```powershell
npm run dev
```

Open:

- Public website: [http://localhost:3000](http://localhost:3000)
- Admin login: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- Admin overview: [http://localhost:3000/admin](http://localhost:3000/admin)
- Payment verification: [http://localhost:3000/admin/payments](http://localhost:3000/admin/payments)
- Gate scanner: [http://localhost:3000/admin/gate](http://localhost:3000/admin/gate)

The camera scanner works on `localhost` for development and requires HTTPS after deployment. Grant camera permission when prompted.

## 10. How the ticket rules work

### Early Bird allocation

The first release is capped at **30 individual admissions**, not 30 order records.

An unsubmitted reservation initially holds its admissions for 20 minutes. A Friends of 5 package consumes five admissions if it is ever made available during this phase.

The server and database account for confirmed paid Early Bird admissions and unexpired reservations when calculating availability.

A customer who submits transfer details receives a 24-hour review hold. Expired reservations are not counted as available inventory.

### Later release

Regular at ₦5,000 and Friends of 5 at ₦20,000 become purchasable only after all 30 Early Bird admissions are **paid and verified**.

This is the current implementation of “after Early Bird sells out”.

If the organiser wants the later categories to open as soon as 30 slots are merely reserved or payment receipts submitted, the database rule must be changed deliberately.

### Friends of 5

Each group package creates five attendee records and five individual ticket records.

Each person can enter separately using their own ticket ID or QR credential. A group purchase does not create one shared admission ticket.

## 11. How direct bank transfer works

1. Customer selects a ticket and enters purchaser and attendee details.
2. The server reserves the allocation and creates an order reference.
3. The payment page displays the bank details configured in `.env.local`.
4. Customer transfers the exact order total and submits sender details, bank transaction reference and a receipt.
5. The receipt is stored in a private Supabase Storage bucket.
6. An owner or finance administrator checks the actual credit in the bank account, not only the screenshot.
7. The administrator enters the amount actually received and the actual bank reference, then approves.
8. Payment approval, order update, ticket issuance and audit record are performed by one database transaction.
9. The system generates and saves one unique textual ticket code for each individual admission.
10. All issued ticket codes are emailed to the buyer in one booking email.

No online payment gateway is integrated.

### Ticket validation and entry

- Every admission has its own unique textual ticket code.
- QR credentials provide an additional scanning method.
- A ticket can be checked in only once.
- The same ticket cannot be admitted again after a successful check-in.
- The textual ticket code remains the official ticket identifier and can be used for manual lookup.

Customers should keep their ticket email and avoid sharing their ticket codes or QR credentials publicly.

## 12. Verify the setup

After configuration, run:

```powershell
npm run typecheck
npm run lint
npm run build
```

Then manually exercise the complete flow using test orders and test transfers.

Do not use a real customer transfer as the first test.

Confirm that:

- An Early Bird order cannot exceed the remaining 30-admission allocation.
- Regular and Friends of 5 remain locked until 30 Early Bird admissions are paid and verified.
- Customer-submitted amounts cannot change the database order total.
- A screenshot alone does not mark an order paid.
- Only an active owner/finance account can approve a payment.
- Approval creates exactly one ticket per attendee.
- Each issued ticket has a unique textual code.
- Ticket codes are emailed to the buyer.
- Forged QR credentials fail.
- A manual ticket ID is checked against the database and payment.
- The same ticket cannot be admitted twice, including simultaneous scans on two devices.
- Expired reservations release their inventory correctly.

## 13. Important limitations — finish these before a public launch

The project contains the foundational event website, order reservation, bank-transfer submission, administrator payment review, ticket issuance, ticket email and gate verification source.

The following operational tasks still need to be addressed:

1. **Email deliverability and recovery:** Configure the email provider, verify the sender domain and test that ticket emails reliably reach buyers. The ticket wallet currently uses a private checkout token held in the original browser's `sessionStorage`. Customers changing devices or clearing browser data may not be able to reopen that wallet, so retain the emailed ticket codes as their entry reference.
2. **Expiration scheduling:** Database operations handle expired reservations when relevant functions run. A separate scheduled worker has not been configured to proactively process every expiration or send expiration notifications.
3. **Abuse protection:** Add rate limiting, bot protection and upload scanning for receipt files. The current code checks receipt signatures, MIME magic bytes and a 5 MB size limit, but does not scan uploaded files for malware.
4. **Admin security:** Enable MFA for owner/finance accounts, set strong password and recovery policies, and review staff access.
5. **Production testing:** Test the SQL migration against a fresh Supabase project, run all npm checks, and perform end-to-end and concurrency tests before accepting payments.
6. **Event policies:** Confirm event capacity, opening and entry procedures, age rules, refund and transfer terms, pool safety rules and contact/venue announcement procedures. The newer flyer does not specify total capacity, so no total capacity is hardcoded.
7. **Legal and privacy pages:** Publish organiser-approved terms, privacy notice, receipt retention rules and refund/cancellation policy.
8. **Notifications and operations:** Establish a customer support workflow, bank reconciliation process and refund procedure.

The application is a starting implementation. It has not been independently security-audited or production-certified.

## 14. Deployment overview

1. Push the project to a private GitHub repository.
2. Import the repository into Vercel.
3. Add all required environment variables to Vercel Project Settings → Environment Variables.
4. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS domain.
5. Deploy and test the public website, admin login, checkout, private receipt upload, ticket email and gate scanner on HTTPS.
6. Ensure the Supabase Auth site URL and redirect URLs include the production domain.
7. Keep the Supabase service-role key and QR signing secret server-side only.

Do not begin live promotion until the required operational and security checks have been addressed.

---

**Design note:** The website uses the event's warm white, charcoal and gold visual direction. Keep `public/images/all-white-pool-party-flyer.jpg` updated with the current approved flyer. Venue information and other promotional claims should match details approved by the organiser.