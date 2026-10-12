# Hulu Academy — Telegram Freshman Referral & Materials Access

**Purpose:** Build a polished Telegram Mini App + Telegram bot + backend that helps freshman students join the official Hulu Academy Telegram channel through personalized referral links. A student who brings **20 verified unique students** into the channel unlocks the **full Year 1, Semester 1 tutorial-material package**.

**Design direction:** premium, academic, luxury, trustworthy, mobile-first. Use the supplied Hulu Academy logo as the primary brand asset.

---

## 1. Product summary

### Core user journey

1. Student opens the Hulu Academy Telegram bot.
2. Bot opens the **Hulu Academy Referral Mini App**.
3. The Mini App authenticates the Telegram user through Telegram `initData`; the backend validates it server-side.
4. The dashboard shows:
   - current verified referrals,
   - progress toward 20,
   - a personalized referral/invite link,
   - Share/Copy actions,
   - current access status,
   - tutorial-package information.
5. The student shares their personalized Telegram channel invite link with classmates.
6. A referred freshman joins the official Telegram channel through that personalized invite link.
7. The backend receives Telegram membership updates and attributes the join to the inviter using the Telegram invite-link information.
8. The inviter's verified count increases **once per unique Telegram account**.
9. At exactly 20 verified referrals, the system creates/grants a permanent or policy-defined entitlement to the full Year 1 Semester 1 package.
10. The user sees a premium success state and can open the protected materials area.
11. Admins can view users, referral activity, suspicious activity, entitlements, and system health.

### Critical rule

**Never award a referral merely because someone clicked a link.**

A referral is counted only after the referred Telegram account is verifiably a member of the target channel. Duplicate users, self-referrals, fake client-side events, repeated clicks, and manipulated counters must not count.

---

# 2. Recommended architecture

Use a production-grade architecture with these logical components:

```text
Telegram User
    |
    v
Hulu Academy Bot
    |
    +----> Telegram Mini App
    |          |
    |          v
    |      HTTPS Backend API
    |          |
    |          +---- PostgreSQL
    |          +---- Redis / queue (optional but recommended)
    |          +---- Entitlement service
    |          +---- Referral service
    |          +---- Admin service
    |
    +----> Target Telegram Channel
                  |
                  v
          Telegram membership updates
                  |
                  v
             Bot webhook
                  |
                  v
          Referral verification
```

### Recommended implementation stack

The AI agent may substitute equivalent technologies, but should prefer:

- **Frontend:** Next.js + React + TypeScript
- **Styling:** Tailwind CSS + custom CSS variables
- **Telegram Mini App SDK:** official Telegram Web App JavaScript API
- **Bot:** grammY or Telegraf with TypeScript
- **Backend:** Next.js API routes/server actions or a separate Node.js service
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Cache/queue:** Redis where useful
- **Validation:** Zod
- **Authentication:** Telegram Mini App `initData` server-side verification
- **Testing:** Vitest/Jest + Playwright
- **Deployment:** any HTTPS-capable production platform; use webhook mode for Telegram

Do not make the frontend responsible for security decisions. The backend is the source of truth.

---

# 3. Telegram-specific referral design

## Preferred referral mechanism

Use a **unique Telegram channel invite link per referrer**.

When a student becomes a participant in the referral system:

1. Ensure the student has a Telegram user record.
2. Create or retrieve a dedicated invite link for the target channel.
3. Store the invite-link identifier in the database and associate it with the student's internal user ID.
4. Display that invite link in the Mini App.
5. When another student joins the channel, consume the Telegram membership update and inspect the invite-link information.
6. Resolve the invite link back to the referrer.
7. Count the referred student exactly once.

This is stronger than relying only on a normal website query parameter because the final conversion event is a real Telegram channel membership.

Telegram's Bot API supports invite links and membership updates. The bot must have the required administrator permissions in the target channel/chat and must subscribe to the relevant update types.

## Important Telegram constraints

- The bot must be an administrator of the target channel/chat with the permissions required to manage or observe membership.
- Configure webhook updates to include `chat_member` where required.
- Store Telegram user IDs as 64-bit-safe integers (or PostgreSQL `BIGINT`).
- Never trust `initDataUnsafe` on the server.
- Validate `Telegram.WebApp.initData` on the backend before accepting the user identity.
- Do not expose the bot token to the browser.
- Use HTTPS in production.
- Handle Telegram updates idempotently.

---

# 4. Referral rules

Implement these rules as backend business logic, not UI logic.

### Count a referral only if all are true

- The referred account is a valid Telegram user.
- The referred account is not the referrer.
- The referred account successfully joins the target channel.
- The join can be attributed to a referral invite link belonging to the referrer.
- That referred Telegram user has not already been counted for another referrer.
- The referral event has not already been processed.
- The user is not blocked/suspended/banned from the program.
- The referral is not identified as an abuse pattern requiring review.

### Recommended policy

- **One Telegram account = one referral conversion.**
- **One referred account can reward only one referrer.**
- Repeated joins/leaves/rejoins do not create multiple credits.
- Clicking a referral link without joining gives zero credit.
- Joining the channel through a normal/non-referral link gives zero referral credit.
- Self-referral gives zero credit.
- Admin-created/manual adjustments must be auditable.
- Referral count should be a derived value from verified referral records, not an editable integer.

### Leave/rejoin policy

Default recommendation: once a referral has been verified and credited, it remains credited unless an administrator explicitly invalidates it for abuse.

If the business later wants "must remain subscribed," implement a separate **active referral** metric rather than silently changing historical referral records.

---

# 5. User roles

## Student

Can:

- Open Mini App
- See referral progress
- Copy/share their referral link
- See verified referrals
- See reward status
- Access unlocked materials
- View basic profile/account information
- Request support

Cannot:

- Modify referral count
- Modify entitlement status
- View other students' private data
- Access admin APIs

## Admin

Can:

- View dashboard metrics
- Search students
- Inspect referral history
- View invite-link mappings
- Review suspicious referrals
- Grant/revoke entitlements with an audit reason
- Manage tutorial packages
- View webhook/system health
- Export appropriate reports
- Suspend abusive accounts

Use role-based access control on the server.

---

# 6. Main screens

## Screen A — Welcome / onboarding

Luxury academic landing screen.

Elements:

- Hulu Academy logo
- Headline: **"Welcome to Hulu Academy"**
- Supporting text: **"Invite your freshman classmates and unlock the complete Year 1 • Semester 1 tutorial package."**
- Primary CTA: **"Open My Referral Dashboard"**
- Secondary CTA: **"Join the Official Channel"**
- Trust note explaining that referrals are verified through Telegram channel membership.

## Screen B — Referral dashboard

Hero card:

**"Your Referral Progress"**

Large progress indicator:

**0 / 20**

or dynamic value.

Display:

- Verified referrals: `N`
- Remaining: `20 - N`
- Progress percentage
- Status:
  - `Not unlocked`
  - `Almost there`
  - `Unlocked`

Primary action:

**"Share My Referral Link"**

Secondary actions:

- `Copy Link`
- `Open Channel`
- `View Referral Activity`

## Screen C — Referral activity

Show:

- date/time
- referred user status
- verification state
- reward impact

Do not expose sensitive information about other Telegram users. Prefer masked display such as:

`Student #••••82`

or first name only if policy allows.

## Screen D — Reward unlocked

Premium celebratory state:

**"Congratulations — Full Package Unlocked!"**

Copy:

"You reached 20 verified freshman referrals. Your Year 1 • Semester 1 tutorial package is now available."

Buttons:

- `Open Full Package`
- `View My Referral Dashboard`
- `Share Hulu Academy`

## Screen E — Materials

Show the available tutorial package categories.

Examples:

- Course 01
- Course 02
- Course 03
- Course 04

The actual course list must be configurable by admins rather than hard-coded.

## Screen F — Locked materials

If user has fewer than 20 verified referrals:

- Show package preview
- Explain unlock requirement
- Show live progress
- CTA: `Invite More Students`

Never reveal protected files or direct storage URLs to an unauthorized client.

---

# 7. Luxury visual system

## Brand asset

Use the supplied image:

`hulu_academy_logo.jpg`

Use the logo prominently but do not distort it.

Recommended uses:

- App header
- Welcome hero
- Loading state
- Reward-unlocked state
- Favicon/app icon where technically appropriate

## Primary luxury gradient

Use this exact gradient as the signature gold surface:

```dart
LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: const [
    Color(0xFF6D4C00),
    Color(0xFFB8860B),
    Color(0xFFD4AF37),
    Color(0xFFC9A227),
    Color(0xFF6D4C00),
  ],
)
```

For a web implementation, translate those values to CSS:

```css
background: linear-gradient(
  135deg,
  #6D4C00 0%,
  #B8860B 25%,
  #D4AF37 50%,
  #C9A227 75%,
  #6D4C00 100%
);
```

## Supporting colors

Use the supplied logo as the visual source of truth and keep the UI restrained:

- Luxury gold: `#D4AF37`
- Deep gold: `#6D4C00`
- Rich gold: `#B8860B`
- Antique gold: `#C9A227`
- Premium dark background: `#0A0A0A` / near-black
- Deep academic blue: use a very dark blue sampled/approximated from the logo
- White: `#FFFFFF`
- Soft text: warm neutral/gray rather than pure gray

Avoid rainbow colors, neon UI, excessive gradients, cartoon styling, or generic SaaS-blue interfaces.

## Visual language

The product should feel:

- premium
- prestigious
- academic
- modern
- trustworthy
- Ethiopian university/freshman oriented without becoming culturally cliché
- mobile-first
- elegant rather than flashy

Use:

- subtle gold borders
- glass/metallic cards sparingly
- soft shadows
- fine separators
- rounded cards
- large readable numbers
- generous spacing
- tasteful micro-animations
- accessible contrast

Do not overuse gold text on light gold backgrounds.

---

# 8. Referral link UI

The dashboard should prominently show the student's personal link.

Example display:

```text
MY REFERRAL LINK

https://t.me/HuluAcademyBot?start=ref_8F3K2P

[ Copy Link ]  [ Share ]
```

If using a dedicated Telegram channel invite link, display the actual generated invite URL rather than inventing a URL.

### Share message

Use a concise, student-friendly message such as:

> Join Hulu Academy's official freshman channel for academic updates and tutorial resources. Use my link to join: [REFERRAL LINK]

Make the message configurable from the admin system.

---

# 9. Database design

Use PostgreSQL.

## users

```text
id                 UUID / internal ID
telegram_user_id   BIGINT UNIQUE NOT NULL
username           nullable
first_name         nullable
last_name          nullable
language_code      nullable
role               STUDENT | ADMIN
status             ACTIVE | SUSPENDED
created_at         timestamp
updated_at         timestamp
last_seen_at       timestamp
```

## referral_links

```text
id                 UUID
owner_user_id      UUID -> users.id
telegram_invite_id nullable/string
invite_url         text UNIQUE
status             ACTIVE | REVOKED
created_at         timestamp
updated_at         timestamp
```

## referrals

```text
id                    UUID
referrer_user_id      UUID -> users.id
referred_user_id      UUID -> users.id
referral_link_id      UUID -> referral_links.id
telegram_join_event_id nullable
status                PENDING | VERIFIED | REJECTED | REVOKED
verified_at            nullable timestamp
rejection_reason       nullable
created_at             timestamp
updated_at             timestamp

UNIQUE(referred_user_id)
```

The `UNIQUE(referred_user_id)` constraint prevents a Telegram account from rewarding multiple referrers.

## referral_events

Immutable audit/event table:

```text
id                    UUID
telegram_update_id    BIGINT UNIQUE
event_type            JOIN | LEAVE | REJOIN | INVALIDATE | MANUAL_ADJUSTMENT
telegram_user_id      BIGINT
telegram_chat_id      BIGINT
referral_link_id      nullable
referrer_user_id      nullable
raw_event_hash        nullable
metadata_json         JSONB
created_at            timestamp
```

## entitlements

```text
id                    UUID
user_id               UUID -> users.id
product_id            UUID -> products.id
status                ACTIVE | REVOKED | EXPIRED
source                REFERRAL_20 | ADMIN_GRANT | OTHER
granted_at            timestamp
expires_at            nullable
created_at             timestamp
updated_at             timestamp

UNIQUE(user_id, product_id)
```

## products

```text
id
name
description
type
status
created_at
updated_at
```

## materials

```text
id
product_id
title
description
storage_key / telegram_file_id
sort_order
status
created_at
updated_at
```

## admin_audit_logs

```text
id
admin_user_id
action
target_type
target_id
reason
metadata_json
created_at
```

---

# 10. Referral verification flow

```text
Student A opens Mini App
        |
        v
Backend authenticates Student A
        |
        v
Get/create Student A referral link
        |
        v
Student A shares link
        |
        v
Student B opens/uses Telegram link
        |
        v
Student B joins target channel
        |
        v
Telegram sends membership update
        |
        v
Webhook verifies update
        |
        v
Resolve invite link -> Student A
        |
        +----> Is Student B already credited?
        |          |
        |          +-- YES --> ignore/idempotent
        |          |
        |          +-- NO
        |
        +----> Is Student B == Student A?
        |          |
        |          +-- YES --> reject
        |
        v
Create VERIFIED referral
        |
        v
Recalculate Student A verified referral count
        |
        v
If count >= 20
        |
        v
Create entitlement if not already active
        |
        v
Notify/update dashboard
```

---

# 11. Idempotency and race-condition protection

This is mandatory.

Telegram updates can be delivered more than once or processed concurrently.

Implement:

- unique `telegram_update_id`
- database transactions
- unique constraint on `referred_user_id`
- unique constraint on `(user_id, product_id)` for entitlements
- server-side count derived from `referrals.status = VERIFIED`
- atomic entitlement creation
- safe retry handling
- webhook acknowledgement only after durable processing or reliable queueing

Do not increment a numeric counter blindly:

```text
BAD:
referral_count = referral_count + 1
```

Prefer:

```text
verified_count = COUNT(referrals WHERE status = VERIFIED)
```

or maintain a cached counter that is rebuilt from the authoritative referral table.

---

# 12. Entitlement logic

The business rule is:

```text
IF verified_referral_count >= 20
AND user.status = ACTIVE
AND no active entitlement exists
THEN grant Year 1 Semester 1 Full Package
```

This operation must be idempotent.

If a user already has the entitlement, do nothing.

The exact access duration should be configurable. Default recommendation:

- entitlement is granted after 20 verified referrals;
- access remains active for the academic period configured by admins;
- if the phrase "1st year 1st semester" means a permanent entitlement, set `expires_at = NULL`.

Do not hard-code the expiration date.

---

# 13. Protected materials delivery

The frontend must not expose raw private storage credentials.

Preferred approaches:

### Option A — Protected web materials

Backend checks entitlement before issuing access.

```text
GET /api/materials
Authorization: validated Telegram session

-> verify user
-> verify entitlement
-> return allowed materials
```

For files:

- use short-lived signed URLs
- or stream through an authenticated backend
- never embed permanent private object-storage credentials

### Option B — Private Telegram materials channel

After entitlement is granted:

- send an approved invite/join mechanism to the student
- or approve their join request
- maintain entitlement status separately

If using a private Telegram channel, make sure the bot has the required permissions.

---

# 14. API specification

Example endpoints:

```text
POST /api/telegram/auth
GET  /api/me
GET  /api/referral
GET  /api/referral/activity
POST /api/referral/link
GET  /api/entitlement
GET  /api/materials
GET  /api/materials/:id
POST /api/webhooks/telegram
```

Admin:

```text
GET  /api/admin/users
GET  /api/admin/referrals
GET  /api/admin/referrals/:id
POST /api/admin/referrals/:id/review
POST /api/admin/entitlements/grant
POST /api/admin/entitlements/revoke
GET  /api/admin/metrics
GET  /api/admin/audit-logs
```

The agent may adjust routing conventions to its framework.

---

# 15. Telegram Mini App authentication

Frontend obtains:

```text
window.Telegram.WebApp.initData
```

Send the raw `initData` to the backend over HTTPS.

Backend:

1. Parse query-string fields.
2. Build Telegram's data-check string.
3. Calculate the HMAC-SHA-256 signature using the bot token-derived secret.
4. Compare signatures using a constant-time comparison.
5. Validate `auth_date` freshness.
6. Extract the authenticated Telegram user.
7. Create/update the user record.
8. Issue an application session.

Never use `initDataUnsafe` as proof of identity.

---

# 16. Security requirements

Mandatory:

- bot token only in server-side environment variables
- HTTPS
- server-side Telegram `initData` validation
- CSRF protection where applicable
- rate limiting
- request validation
- authorization on every protected endpoint
- admin RBAC
- audit logs
- secure cookies/session tokens
- no sensitive secrets in frontend bundles
- no direct database access from frontend
- strict CORS policy if applicable
- input sanitization
- webhook secret/path protection where supported
- idempotent Telegram update handling
- database constraints against duplicate rewards

### Abuse prevention

Detect and flag:

- self-referrals
- unusually fast referral bursts
- large numbers of referrals from suspicious patterns
- repeated account churn
- suspicious shared invite links
- admin/manual adjustments without a reason

Do not attempt to fingerprint devices invasively. Keep the system privacy-conscious.

---

# 17. Admin dashboard

Dashboard cards:

- Total registered students
- Total verified referrals
- Students at 20+
- Active entitlements
- Referrals today
- Suspicious referrals
- Failed webhook events

Referral table:

```text
Referrer | Verified | Progress | Entitlement | Status | Last Activity
```

User detail:

- Telegram user ID
- name/username where available
- registration time
- personal referral link
- referral history
- entitlement history
- audit events
- suspension controls

---

# 18. Analytics

Track product-level events:

```text
mini_app_opened
referral_link_viewed
referral_link_copied
referral_share_clicked
channel_join_verified
referral_verified
reward_unlocked
materials_opened
```

Do not count analytics events as referrals.

Referral truth comes from verified Telegram membership.

---

# 19. Notifications

When a referral is verified:

> 🎉 A new student joined through your link!
>
> Your progress is now **7 / 20**.

At 20:

> 🏆 Congratulations!
>
> You have reached **20 verified referrals** and unlocked the **Year 1 • Semester 1 Full Tutorial Package**.
>
> Tap below to access your materials.

Notifications should be configurable and rate-limited to prevent spam.

---

# 20. Error states

Design polished states for:

- Telegram data unavailable
- invalid session
- expired session
- channel unavailable
- referral link creation failed
- webhook processing delay
- user already credited
- user joined without a referral
- user is not currently a channel member
- entitlement not yet available
- materials temporarily unavailable
- suspended account
- network failure
- unknown Telegram error

Never show raw stack traces or secrets.

---

# 21. Accessibility and responsive behavior

Mobile-first.

Must work well at:

- small Android phones
- large Android phones
- iPhone
- Telegram Desktop
- narrow WebView widths

Requirements:

- minimum comfortable touch targets
- readable typography
- keyboard/focus support where relevant
- sufficient contrast
- reduced-motion support
- no essential information conveyed by color alone
- loading skeletons instead of layout jumps

---

# 22. Performance

Target:

- fast first render
- optimized logo/image
- lazy-load material lists
- avoid heavy animation libraries
- cache stable API data
- debounce copy/share actions
- paginate admin tables
- use database indexes on Telegram IDs, referral link IDs, status fields, and timestamps

---

# 23. Testing plan

## Unit tests

Test:

- Telegram `initData` validation
- referral attribution
- self-referral rejection
- duplicate referral rejection
- 20-referral threshold
- entitlement idempotency
- suspended-user behavior
- invite-link mapping

## Integration tests

Simulate:

1. Student A registration
2. Student A gets invite link
3. Student B joins using A's invite link
4. Telegram membership event arrives
5. Referral becomes VERIFIED
6. A reaches 20
7. entitlement is created
8. duplicate Telegram update arrives
9. no duplicate referral or entitlement is created

## End-to-end tests

Use Playwright for:

- onboarding
- dashboard
- copy/share UI
- progress states
- unlocked package
- admin workflows

---

# 24. Acceptance criteria

The build is complete only when all are true:

- [ ] Hulu Academy logo is integrated cleanly.
- [ ] Premium gold gradient is used as a signature visual element.
- [ ] Mini App opens inside Telegram.
- [ ] Telegram identity is authenticated server-side.
- [ ] Each student receives one referral identity/link.
- [ ] Referral clicks alone do not count.
- [ ] Real channel membership is required for verification.
- [ ] A referred Telegram account can only count once.
- [ ] Self-referrals are rejected.
- [ ] Duplicate Telegram updates are harmless.
- [ ] Referral count is derived from authoritative records.
- [ ] Exactly 20 verified referrals unlock the full package.
- [ ] Unlock is idempotent.
- [ ] Locked materials cannot be accessed directly.
- [ ] Admin can inspect referrals.
- [ ] Admin actions are audited.
- [ ] Abuse cases can be reviewed.
- [ ] The interface is responsive and polished.
- [ ] No secrets are exposed in client-side code.
- [ ] Production webhook and environment configuration are documented.
- [ ] Automated tests cover the referral and entitlement logic.

---

# 25. Suggested project structure

```text
hulu-academy-referral/
├── apps/
│   ├── mini-app/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── styles/
│   ├── bot/
│   │   ├── src/
│   │   │   ├── handlers/
│   │   │   ├── services/
│   │   │   └── telegram/
│   └── admin/
├── packages/
│   ├── db/
│   ├── shared/
│   ├── validation/
│   └── ui/
├── prisma/
│   └── schema.prisma
├── tests/
├── .env.example
├── docker-compose.yml
└── README.md
```

A simpler single-app structure is acceptable if it preserves clean separation between UI, Telegram integration, business logic, and database access.

---

# 26. Environment variables

Create `.env.example` without real secrets:

```env
DATABASE_URL=
REDIS_URL=

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_TARGET_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=

APP_URL=
MINI_APP_URL=

SESSION_SECRET=

ADMIN_TELEGRAM_IDS=
```

Never commit real `.env` files.

---

# 27. Deployment checklist

1. Create Telegram bot using BotFather.
2. Configure Mini App URL.
3. Configure bot menu button / Mini App launch method.
4. Add bot as administrator to the target channel.
5. Give only the minimum required permissions.
6. Deploy backend over HTTPS.
7. Configure Telegram webhook.
8. Register required update types.
9. Create database.
10. Run migrations.
11. Configure environment variables.
12. Test referral link creation.
13. Test a real join in a controlled channel/test environment.
14. Verify the membership update contains the expected invite-link attribution.
15. Test duplicate updates.
16. Test 20-referral unlock.
17. Test material protection.
18. Test admin audit logs.
19. Enable monitoring and error reporting.

---

# 28. Important implementation decision: do not fake the referral system

Do not build a front-end-only counter such as:

```text
Click Share -> referrals++
```

That is not acceptable.

The authoritative chain must be:

```text
Telegram identity
        +
Telegram invite link
        +
real Telegram channel membership
        =
verified referral
```

The dashboard is only a presentation layer over this backend truth.

---

# 29. Master prompt for the AI coding agent

Copy everything inside the block below and give it to the coding agent.

```text
You are a senior full-stack engineer, Telegram Mini App engineer, product designer, security engineer, and QA engineer.

Build a production-ready Telegram Mini App + Telegram bot + backend for Hulu Academy.

PROJECT:
Hulu Academy Freshman Referral & Year 1 Semester 1 Tutorial Access.

BUSINESS GOAL:
Freshman students should join the official Hulu Academy Telegram channel through personalized referral links. When a student successfully refers 20 UNIQUE and VERIFIED students who actually join the target Telegram channel, the referring student receives access to the complete Year 1 First Semester tutorial-material package.

NON-NEGOTIABLE BUSINESS RULE:
A referral does NOT count when a user clicks a link.
A referral counts only when the referred Telegram account is verifiably a member of the target Telegram channel and the join can be attributed to the referrer's Telegram invite link.

SECURITY RULE:
Never trust client-side referral counts.
Never trust initDataUnsafe.
Never put the Telegram bot token in browser code.
All referral verification, entitlement decisions, and authorization must happen on the server.

BRAND:
Use the supplied Hulu Academy logo.
Create a premium academic/luxury visual identity.
Use this signature gold gradient:

LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: const [
    Color(0xFF6D4C00),
    Color(0xFFB8860B),
    Color(0xFFD4AF37),
    Color(0xFFC9A227),
    Color(0xFF6D4C00),
  ],
)

For web/CSS use the equivalent 135deg gradient.

VISUAL STYLE:
- premium
- academic
- elegant
- modern
- prestigious
- dark luxury
- restrained gold
- mobile-first
- high readability
- subtle shadows
- tasteful borders
- tasteful micro-animations
- no cartoon style
- no generic SaaS blue
- no excessive gradients
- no visual clutter

PREFERRED STACK:
- Next.js + React + TypeScript
- Tailwind CSS
- Telegram Mini App JavaScript API
- grammY or Telegraf for bot
- PostgreSQL
- Prisma
- Redis where useful
- Zod
- Playwright
- Vitest/Jest

You may use equivalent technologies if there is a strong reason, but explain the choice.

TELEGRAM ARCHITECTURE:
1. Student opens the Hulu Academy bot.
2. Bot opens the Mini App.
3. Mini App sends Telegram.WebApp.initData to backend.
4. Backend validates initData cryptographically.
5. Backend creates/updates the student.
6. Backend creates or retrieves a unique Telegram channel invite link belonging to that student.
7. Mini App displays that link.
8. Student shares it.
9. Referred student joins the target Telegram channel.
10. Telegram sends membership update to the bot.
11. Backend verifies and attributes the join using the invite link.
12. Referral becomes VERIFIED exactly once.
13. When VERIFIED count reaches 20, create the Year 1 Semester 1 entitlement.
14. Show unlocked package in Mini App.

TELEGRAM REQUIREMENTS:
- Bot must be an administrator in the target channel/chat with required permissions.
- Configure the webhook correctly.
- Subscribe to required membership updates.
- Store Telegram IDs safely as BIGINT/64-bit-safe values.
- Use HTTPS.
- Handle updates idempotently.
- Do not depend on client-side events for referral truth.

REFERRAL RULES:
- one Telegram account can reward at most one referrer
- self-referral is rejected
- duplicate Telegram updates are ignored safely
- clicking a link is not a referral
- joining without the referral invite link is not a referral
- repeated leave/rejoin does not create another reward
- historical verified referrals remain credited unless an admin explicitly revokes them
- all manual changes require an audit reason

DATABASE:
Create clean Prisma models for:
users
referral_links
referrals
referral_events
products
materials
entitlements
admin_audit_logs

Important constraints:
- unique telegram_user_id
- unique referred_user_id in referrals
- unique user/product entitlement
- unique telegram update ID
- useful indexes for Telegram IDs, referral link IDs, status, and timestamps

REFERRAL EVENT PROCESSING:
Make webhook processing idempotent and transactional.

Never do:
referralCount = referralCount + 1

Instead derive the authoritative count from VERIFIED referral records or maintain a rebuildable cached counter.

ENTITLEMENT:
When verified referrals >= 20:
- create the Year 1 Semester 1 Full Package entitlement
- make operation idempotent
- do not create duplicate entitlements
- notify the user
- show success state

Do not hard-code expiration. Make expiration configurable. Support permanent access by allowing expires_at to be null.

MINI APP SCREENS:
1. Welcome/onboarding
2. Referral dashboard
3. Referral activity
4. Reward unlocked
5. Materials
6. Locked materials
7. Profile/settings if useful
8. Help/support

DASHBOARD MUST SHOW:
- logo
- verified referrals
- 0/20-style progress
- remaining referrals
- progress percentage
- referral link
- copy link
- share CTA
- channel CTA
- reward status

UNLOCKED SCREEN:
Headline:
"Congratulations — Full Package Unlocked!"

Explain that 20 verified freshman referrals were reached.

Button:
"Open Full Package"

MATERIAL SECURITY:
Do not expose private files directly.
Check entitlement server-side before returning protected materials.
Use short-lived signed URLs or authenticated streaming.
If materials are delivered through a private Telegram channel, use a controlled Telegram access flow and keep entitlement status in the application database.

ADMIN:
Create an admin dashboard with:
- total students
- verified referrals
- users at 20+
- active entitlements
- today's referrals
- suspicious referrals
- webhook errors
- searchable users
- referral history
- entitlement management
- audit logs
- suspension controls

ADMIN SECURITY:
Use Telegram-based admin allowlisting or a secure admin role.
Never rely only on a hidden URL.
Every admin action must be logged.

ABUSE PREVENTION:
Detect/flag:
- self-referrals
- duplicate referrals
- suspicious bursts
- repeated account churn
- suspicious invite-link behavior
- manual adjustments without reasons

Do not implement invasive device fingerprinting.

AUTHENTICATION:
Validate Telegram.WebApp.initData on backend.
Use HMAC-SHA-256 according to Telegram's official Mini App validation method.
Check auth_date freshness.
Create an application session after validation.
Use secure cookies or another secure session mechanism.

API:
Implement clean endpoints equivalent to:
POST /api/telegram/auth
GET /api/me
GET /api/referral
GET /api/referral/activity
POST /api/referral/link
GET /api/entitlement
GET /api/materials
GET /api/materials/:id
POST /api/webhooks/telegram

Admin endpoints:
GET /api/admin/users
GET /api/admin/referrals
GET /api/admin/referrals/:id
POST /api/admin/referrals/:id/review
POST /api/admin/entitlements/grant
POST /api/admin/entitlements/revoke
GET /api/admin/metrics
GET /api/admin/audit-logs

UX:
Make the interface feel like a premium university academic platform.
Use the Hulu Academy logo.
Use the luxury gold gradient.
Make the 20-referral progress visually dominant.
Use responsive cards.
Use skeleton loading.
Use polished empty/error states.
Use accessible contrast.
Support reduced motion.

SHARING:
Provide Copy Link.
Provide Telegram-friendly share behavior where supported.
Use configurable share text.

DEFAULT SHARE MESSAGE:
"Join Hulu Academy's official freshman channel for academic updates and tutorial resources. Use my link to join: [REFERRAL LINK]"

TESTING:
Write unit tests for:
- Telegram initData validation
- self-referral
- duplicate referral
- referral attribution
- 20 threshold
- entitlement idempotency
- suspended users
- duplicate Telegram updates

Write integration tests for:
Student A -> invite link -> Student B joins -> webhook -> verified referral.

Test the exact 20th referral.
Test referral 21 does not create a second entitlement.
Test replaying the same Telegram update does not change counts.
Test two concurrent processing attempts cannot double-credit.

E2E:
Use Playwright for the dashboard, locked state, unlocked state, admin flows.

DELIVERABLES:
1. Full source code.
2. Database schema/migrations.
3. Telegram bot implementation.
4. Mini App UI.
5. Admin dashboard.
6. Tests.
7. .env.example.
8. README.
9. Deployment instructions.
10. Telegram BotFather configuration instructions.
11. Webhook configuration instructions.
12. Seed/demo data where safe.
13. Security checklist.
14. API documentation.
15. Explanation of important architecture decisions.

DEVELOPMENT PROCESS:
Before coding, inspect the repository and identify existing code.
Do not destroy existing working functionality.
Then:
1. plan architecture
2. implement database
3. implement Telegram integration
4. implement authentication
5. implement referral verification
6. implement entitlement logic
7. implement Mini App UI
8. implement admin dashboard
9. add tests
10. run tests
11. fix errors
12. document setup and deployment

If credentials or Telegram configuration are missing, create environment-variable placeholders and a clear setup guide. Do not invent real bot tokens, channel IDs, domains, or invite links.

IMPORTANT:
Do not fake Telegram membership verification.
Do not use a client-side referral counter.
Do not expose secrets.
Do not mark a referral VERIFIED based solely on a button click.
Do not give access to protected materials based solely on frontend state.

The final application should be production-oriented, maintainable, secure, responsive, and visually premium.
```

---

# 30. Official Telegram references for the coding agent

Use Telegram's official documentation as the implementation authority:

- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Bot API changelog: https://core.telegram.org/bots/api-changelog

When Telegram behavior conflicts with assumptions in this specification, follow the current official Telegram documentation and adapt the implementation while preserving the business rule: **only a verified channel join can create a referral.**

---

# 31. Final product principle

The most important product loop is:

**Share → Real student joins → Telegram verifies membership → Referral credited → 20 reached → Full package unlocked**

Everything in the UI should make this loop extremely clear.
