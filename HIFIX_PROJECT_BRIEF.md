# HIFIX — Complete Project Brief & AI Agent Handoff Document

> **Last Updated:** 2026-08-07  
> **Project Status:** Phase 4 — 100% COMPLETE (Production-Ready)  
> **Location:** `C:\Users\LENOVO\Documents\pro`  
> **Workspace Corpus:** `kavithashridhar9898-arch/HIFIX`  
> **Backend Port:** 5000 (`0.0.0.0`) | **DB:** MySQL `hifix_db` | **Frontend:** React Native Expo SDK 54  

---

## 1. What is HiFix?

**HiFix** is a full-stack **on-demand home services marketplace** engineered specifically for the Indian market. It bridges **homeowners** with verified **local skilled service workers** (plumbers, electricians, painters, carpenters, HVAC technicians, handymen) and delivers a complete, secure end-to-end lifecycle:

1. Service discovery & worker selection (with real-time map & ratings)
2. Booking creation & acceptance
3. Real-time in-app chat & notifications
4. Live work session timer (persisted in DB)
5. Itemised invoice creation with labour calculation & minimum charge enforcement
6. Customer invoice approval workflow
7. Online payment via Razorpay Checkout & idempotent webhook processing
8. Automated generation of digital completion certificates & payment receipts
9. **On-chain cryptographic registration on Polygon Blockchain** with SHA-256 hash verification and tamper detection
10. Server-side branded A4 PDF certificate generation with embedded verification QR code

---

## 2. Tech Stack Architecture

### Frontend (Mobile App)
- **Framework:** React Native via **Expo SDK 54** (React Navigation v7)
- **Navigation:** `@react-navigation/native-stack` + `@react-navigation/bottom-tabs` (with dynamic scroll-to-hide animated tab bar)
- **State Management:** React Context API (`AuthContext`, `AlertContext`, `NotificationContext`, `SocketContext`, `TabAnimationContext`, `ThemeContext`)
- **Real-Time Engine:** `socket.io-client` v4
- **Maps:** `react-native-maps` with custom marker rendering
- **Payments:** Razorpay WebView Checkout via `react-native-webview`
- **Security & Auth:** `expo-local-authentication` (Biometrics / Face ID / Fingerprint)
- **Notifications:** `@react-native-firebase/messaging` + `@notifee/react-native`
- **Styling:** Vanilla CSS / React Native StyleSheet API with HSL-tailored dark/light mode design system

### Backend (REST API & WebSockets)
- **Runtime & Framework:** Node.js (v24) + Express.js (v4)
- **Database:** MySQL 8 (`mysql2` v3 driver) — database `hifix_db`
- **Real-time Gateway:** Socket.IO Server v4 (integrated with Express HTTP server)
- **Authentication:** JWT (`jsonwebtoken`) + `bcryptjs` password hashing + Nodemailer OTP email verification
- **Financial Gateway:** Razorpay Node SDK v2 with HMAC-SHA256 signature verification
- **Blockchain Interface:** `ethers.js` v6 + custom Solidity Smart Contract
- **PDF & Document Engine:** `pdfkit` (A4 vector rendering) + `qrcode` (PNG/SVG QR generation)

### Blockchain Infrastructure
- **Network:** Polygon Amoy Testnet (Chain ID `80002`) / Polygon Mainnet (`137`) switchable via `.env`
- **Smart Contract:** `HiFixVerification.sol` (Solidity `^0.8.20`)
- **Contract Address:** `0x43FA8B854483759C9989E78F5605dFA0454378A5`
- **Data Privacy:** Stores ONLY 32-byte SHA-256 hashes (`bytes32`), entity types, and booking IDs on-chain. **Zero PII (Personally Identifiable Information) stored on-chain.**

---

## 3. Project Directory Structure

```
pro/
├── backend/
│   ├── server.js                      # Main entry point (Express, Socket.IO, DB Init, Blockchain Recovery)
│   ├── .env                           # Environment secrets & connection strings
│   ├── config/
│   │   ├── blockchain.js              # Polygon RPC config, Contract ABI, SIMULATION_MODE flag
│   │   ├── database.js                # MySQL connection pool (ALWAYS use this pool)
│   │   ├── dbInit.js                  # Auto-executes DDL for all tables across Phase 1-4 on boot
│   │   ├── email.js                   # Nodemailer transporter configuration
│   │   └── payment.js                 # Razorpay SDK instance
│   ├── contracts/
│   │   └── HiFixVerification.sol      # Solidity verification contract
│   ├── controllers/
│   │   ├── blockchainController.js    # /api/blockchain/* endpoints (PDF download, retry, stats)
│   │   ├── notificationController.js  # Notification APIs
│   │   ├── paymentController.js       # Core payment routes
│   │   └── razorpayController.js      # Razorpay order, verify, webhook handlers
│   ├── middleware/
│   │   ├── auth.js                    # JWT authentication & user context injection
│   │   └── errorHandler.js            # Centralised error handling middleware
│   ├── routes/
│   │   ├── auth.js                    # Auth endpoints (login, register, OTP, biometrics)
│   │   ├── blockchain.js              # Verification & queue routes
│   │   ├── bookings.js                # Booking workflow routes
│   │   ├── chat.js                    # Chat messaging routes
│   │   ├── invoiceRequests.js         # Invoice lifecycle routes
│   │   ├── notifications.js           # User notification routes
│   │   ├── payment.js                 # Financial & Razorpay routes
│   │   ├── workTimer.js               # Work session timer routes
│   │   ├── workerProfile.js           # Worker rates & settings routes
│   │   └── workers.js                 # Worker directory & review routes
│   ├── scripts/
│   │   └── updateSchemaBlockchainJobs.js # Migration script for durable queue table
│   ├── services/
│   │   ├── BlockchainQueue.js         # Crash-safe MySQL queue, exponential backoff, restart recovery
│   │   ├── BlockchainService.js       # SHA-256 canonical hashing, Polygon RPC client, audit logger
│   │   ├── InvoiceService.js          # Invoice calculation & breakdown engine
│   │   ├── NotificationService.js     # FCM push + MySQL in-app notifications
│   │   ├── PaymentService.js          # Payment transaction persistence
│   │   ├── PdfService.js              # Vector PDF certificate renderer with QR embedding
│   │   ├── RazorpayService.js         # Razorpay signature verification & idempotency
│   │   ├── ReceiptService.js          # Payment receipt issuer
│   │   └── WorkTimerService.js        # Persistent work timer calculator
│   ├── test-phase41-hardening.js      # 5-test hardening verification suite
│   └── test-regression-final.js       # 12-test full system regression suite
│
├── frontend/
│   ├── App.js                         # Root React Native component, navigation container, screens
│   ├── context/
│   │   ├── AuthContext.js             # User authentication state & token storage
│   │   ├── AlertContext.js            # Global toast / modal alert manager
│   │   ├── NotificationContext.js     # Real-time notification receiver
│   │   ├── SocketContext.js           # WebSocket connection manager
│   │   ├── TabAnimationContext.js     # Bottom tab bar scroll animation state
│   │   └── ThemeContext.js            # Dark/Light mode theme state
│   ├── components/
│   │   ├── WorkerCard.js              # Worker list item component
│   │   ├── WorkerBottomSheet.js       # Worker quick-view modal
│   │   ├── CustomMapMarker.js         # Map location pin
│   │   ├── PremiumBackground.js       # UI gradient background wrapper
│   │   └── AnimatedLogo.js            # Vector splash animation
│   └── screens/                       # All 40 mobile screens
```

---

## 4. Implementation History (Phases 1 to 4)

### Phase 1: Core Marketplace & Real-Time Engine (COMPLETE)
- JWT authentication + Password hashing + OTP Email reset + Google Sign-In + Biometric Auth
- Worker profile registration, categories, experience, service rates, portfolio gallery
- Homeowner discovery screen, search filters, interactive location map
- Booking management (Pending -> Accepted -> In Progress -> Completed -> Cancelled)
- Socket.IO 1-on-1 real-time chat with typing indicators and media attachments
- Push notifications via Firebase FCM & in-app notification inbox
- Global Dark / Light mode system

### Phase 2: Work Timer & Financial Invoice Engine (COMPLETE)
- MySQL-backed persistent work timer (`work_sessions`) with start, pause, resume, and lock controls
- Worker rate configuration (hourly rate, travel fee, emergency fee, service radius)
- Itemised invoice builder:
  - Labour charges (computed automatically: `worked_seconds × hourly_rate`)
  - Material line items (custom item list with costs)
  - Travel fee, Emergency fee, Other charges
  - Platform fee, Tax, Discounts
  - Minimum charge enforcement logic
- Customer invoice review screen (Accept / Reject workflow)

### Phase 3: Razorpay Payment System & Earnings (COMPLETE)
- Razorpay order creation in INR paise
- In-app WebView checkout integration
- Webhook receiver with HMAC-SHA256 signature verification & deduplication (`webhook_events`)
- Digital payment receipt generation (`payment_receipts`)
- Denormalised worker earnings tracking (`worker_earnings`)
- Payment history for both workers and homeowners

### Phase 4: Polygon Blockchain & Durable Infrastructure (COMPLETE — 100%)
- Smart contract (`HiFixVerification.sol`) deployed to Polygon Amoy Testnet
- Canonical deterministic SHA-256 hash generation for Invoices, Certificates, and Receipts
- Auto-enqueueing of blockchain jobs on invoice acceptance and receipt creation
- **Durable MySQL Queue (`blockchain_jobs`):** Crash-safe, pessimistic locking (`FOR UPDATE`), exponential backoff retries (30s, 60s, 120s, 300s, 600s), dead-letter queueing (`DEAD_LETTER`)
- **Server Restart Recovery:** `initServerRecovery()` reconciles any interrupted `PROCESSING` jobs upon backend boot
- **Tamper Detection:** Live re-hashing of database records against stored on-chain hashes
- **Server-Side PDF Service (`PdfService.js`):** Generates branded A4 completion certificates with embedded verification QR code
- **Frontend Verification Screen & PDF Download Button**
- **Admin Blockchain Control Center:** Real-time queue metrics, retry triggers, and audit trail

---

## 5. All Frontend Screens (40 Total)

| Screen Name | Route | Role | Description |
|-------------|-------|------|-------------|
| `VideoSplashScreen` | — | All | Animated brand opening video |
| `WelcomeScreen` | `Welcome` | Guest | Landing screen with Auth CTAs |
| `LoginScreen` | `Login` | Guest | Email/password, Google & Biometric login |
| `RegisterScreen` | `Register` | Guest | Role-based registration (Homeowner / Worker) |
| `ForgotPasswordScreen` | `ForgotPassword` | Guest | OTP-based password recovery |
| `HomeScreen` | `Home` | Homeowner | Service categories, nearby top workers, search |
| `WorkersScreen` | `Workers` | Homeowner | Filterable directory of service workers |
| `WorkerDetailScreen` | `WorkerDetail` | Homeowner | Full worker bio, rates, gallery, reviews |
| `BookingsScreen` | `Bookings` / `Jobs` | Both | Booking dashboard for homeowners & workers |
| `BookingDetailScreen` | `BookingDetail` | Both | Booking status, actions, timeline |
| `ServiceRequestScreen` | `ServiceRequest` | Homeowner | Form to request service from a worker |
| `ChatsScreen` | `Chats` | Both | Conversation list |
| `ChatScreen` | `Chat` | Both | Real-time chat view with typing status |
| `ProfileScreen` | `Profile` | Both | User profile overview & account settings |
| `EditProfileScreen` | `EditProfile` | Both | Profile photo & info editor |
| `NotificationsScreen` | `Notifications` | Both | Notification history inbox |
| `SecurityScreen` | `Security` | Both | Password change & biometric toggles |
| `HelpScreen` | `Help` | Both | FAQ & support channels |
| `WorkerMapScreen` | `Map` | Worker | Live location map of nearby jobs |
| `WorkerDashboardScreen` | `WorkerDashboard` | Worker | Worker analytics & quick metrics |
| `WorkerEarningsScreen` | `WorkerEarnings` | Worker | Detailed earnings breakdown |
| `ProfessionalDetailsScreen` | `ProfessionalDetails` | Worker | Configure hourly rates & service charges |
| `WorkTimerScreen` | `WorkTimer` | Worker | Interactive work session timer |
| `InvoiceBuilderScreen` | `InvoiceBuilder` | Worker | Itemised invoice creator |
| `InvoicePreviewScreen` | `InvoicePreview` | Worker | Pre-flight invoice review |
| `InvoiceViewScreen` | `InvoiceView` | Worker | Sent invoice detail view |
| `InvoiceEditScreen` | `InvoiceEdit` | Worker | Edit draft invoice |
| `PaymentRequestsScreen` | `PaymentRequests` | Homeowner | Pending invoices needing customer approval |
| `HomeownerInvoicesScreen` | `HomeownerInvoices` | Homeowner | Invoice history & receipts |
| `PaymentScreen` | `Payment` | Homeowner | Razorpay payment WebView screen |
| `PaymentSuccessScreen` | `PaymentSuccess` | Homeowner | Payment confirmation & receipt screen |
| `PaymentHistoryScreen` | `PaymentHistory` | Both | Financial transaction history |
| `ReceiptScreen` | `Receipt` | Both | Digital payment receipt viewer |
| `AdminDashboardScreen` | `AdminDashboard` | Admin | Platform administrative dashboard |
| `PublicVerificationScreen` | `PublicVerification` | Public | Unauthenticated live verification screen |
| `CertificateVerificationScreen` | `CertificateVerification` | Both | Certificate view + blockchain proof + PDF download |
| `BlockchainAdminScreen` | `BlockchainAdmin` | Admin | Blockchain job queue manager & retry console |

---

## 6. All API Endpoints Reference

### Authentication (`/api/auth`)
- `POST /register` — Register user
- `POST /login` — Authenticate & receive JWT
- `POST /logout` — Invalidate session
- `POST /forgot-password` — Trigger OTP email
- `POST /verify-otp` — Verify 6-digit OTP
- `POST /reset-password` — Set new password
- `GET /profile` | `PUT /profile` — Read/update user profile
- `POST /google-signin` — Auth via Google token
- `POST /biometric-login` — Auth via biometric challenge token

### Worker Directory (`/api/workers`)
- `GET /` — Search/filter workers
- `GET /nearby` — Get workers by lat/lng proximity
- `GET /:id` — Get worker detailed profile
- `POST /` | `PUT /:id` — Create/update worker profile
- `POST /:id/gallery` | `DELETE /:id/gallery/:imageId` — Portfolio media manager
- `GET /:id/reviews` | `POST /:id/reviews` — Reviews & ratings

### Bookings (`/api/bookings`)
- `GET /` — List bookings for current user
- `POST /` — Create booking request
- `GET /:id` — Detailed booking overview
- `PATCH /:id/status` | `PATCH /:id/accept` | `PATCH /:id/complete` | `PATCH /:id/cancel` — Lifecycle transitions

### Work Session Timer (`/api/work-timer`)
- `POST /start` — Begin work session
- `PATCH /pause` | `PATCH /resume` — Pause/resume timer
- `POST /complete` — Finish work session & record total elapsed seconds
- `GET /:bookingId` — Get active timer state

### Invoices (`/api/invoice`)
- `POST /create` — Generate invoice from session data
- `GET /worker` | `GET /customer` — Role-filtered invoice lists
- `GET /:id` — Invoice detail view
- `PATCH /:id/accept` — Customer accepts invoice (triggers blockchain queue)
- `PATCH /:id/reject` — Customer rejects invoice
- `PUT /:id/edit` — Modify draft invoice

### Payments (`/api/payment`)
- `POST /razorpay/create-order` — Initialize Razorpay order (INR)
- `POST /razorpay/verify` — Verify Razorpay signature & issue receipt
- `POST /razorpay/webhook` — Process asynchronous Razorpay webhooks
- `GET /receipt/:invoiceId` — Fetch digital receipt
- `GET /history` — Transaction logs
- `GET /worker-earnings` — Worker payout dashboard metrics

### Blockchain Verification (`/api/blockchain`)
- `GET /verify/certificate/:id` — Verify work certificate
- `GET /verify/invoice/:id` — Verify invoice integrity
- `GET /verify/receipt/:id` — Verify payment receipt integrity
- `GET /verify/hash/:hash` — Search on-chain record by raw SHA-256 hash
- `GET /dashboard` — System queue health, active jobs, audit logs
- `POST /register-invoice` — Explicitly queue an invoice for blockchain registration
- `GET /certificate/:id/pdf` — Download vector A4 PDF certificate with QR code
- `POST /jobs/:id/retry` — Admin manual retry for failed/dead-letter jobs

### Real-time Messaging (`/api/chat`)
- `GET /conversations` | `POST /conversations` — Chat thread list & creation
- `GET /conversations/:id/messages` | `POST /conversations/:id/messages` — Message exchange
- `POST /conversations/:id/media` — Media upload in chat
- `PATCH /conversations/:id/read` — Read receipts

---

## 7. Database Architecture (`hifix_db`)

### Core Tables
- `users` (id, name, email, phone, password, user_type, profile_image, timestamps)
- `workers` (id, user_id, service_type, experience_years, hourly_rate, min_charge, travel_charge_per_km, emergency_charge, working_hours, service_radius, location, average_rating)
- `bookings` (id, homeowner_id, worker_id, booking_date, address, status)
- `reviews` (id, booking_id, reviewer_id, worker_id, rating, comment)
- `worker_gallery` (id, worker_id, image_url, description)
- `conversations`, `messages`, `message_media`, `typing_status` (Real-time chat schema)
- `notifications`, `notification_settings`, `device_tokens` (Push & in-app alerts)

### Financial & Work Session Tables
- `work_sessions` (id, booking_id, worker_id, started_at, paused_at, total_paused_ms, total_duration_ms, status, locked)
- `invoice_requests` (id, booking_id, worker_id, customer_id, hourly_rate_snapshot, worked_seconds, labour_cost, material_items, material_cost, travel_cost, emergency_cost, other_cost, discount, tax, platform_fee, grand_total, service_description, status, blockchain_status, blockchain_tx_hash, blockchain_hash)
- `payments` (id, booking_id, worker_id, customer_id, requested_amount, status, payment_method, razorpay_order_id, razorpay_payment_id)
- `razorpay_orders` (id, invoice_id, razorpay_order_id, amount_paise, status)
- `payment_receipts` (id, invoice_id, booking_id, razorpay_payment_id, receipt_number, amount, paid_at, blockchain_status)
- `webhook_events` (id, event_id, event_type, payload, processed_at)
- `worker_earnings` (worker_id, total_earned, total_pending, total_jobs_paid)

### Blockchain Verification Tables
- `work_certificates` (id, certificate_number, booking_id, invoice_id, worker_id, customer_id, issued_at, blockchain_status, blockchain_tx_hash, blockchain_hash, blockchain_verified_at, blockchain_block_number, blockchain_network)
- `blockchain_audit_logs` (id, entity_type, entity_id, action, hash, tx_hash, details, created_at)
- `blockchain_jobs` (id, job_type, entity_type, entity_id, booking_id, entity_hash, status, attempt_count, max_attempts, next_retry_at, transaction_hash, block_number, network, last_error, created_at, updated_at, completed_at)

---

## 8. Verification & Test Suite Summary

The repository includes two automated test suites in `backend/`:

1. **`test-phase41-hardening.js` (5/5 PASSED)**
   - Test 1: Durable MySQL job queue persistence before processing
   - Test 2: Server restart recovery & job reconciliation
   - Test 3: Idempotency & duplicate submission protection
   - Test 4: Server-side vector PDF generation & QR embedding
   - Test 5: Explicit invoice blockchain registration API

2. **`test-regression-final.js` (12/12 PASSED)**
   - Hash determinism & canonical payload ordering
   - Tamper detection (amount mutation)
   - Certificate & Receipt SHA-256 hash functions
   - Schema validation for `blockchain_jobs`, `work_certificates`, `invoice_requests`, `payment_receipts`, and `blockchain_audit_logs`
   - `getDashboardSummary` API integrity
   - Active database verification state

**All 17 automated verification checks run clean with 0 failures.**

---

## 9. Critical Development Guidelines for AI Agents

When modifying or extending this repository:

1. **DO NOT BREAK WORKING FUNCTIONALITY:** All Phase 1–4 features (Auth, Booking, Chat, Timer, Invoices, Razorpay, Blockchain, PDFs) are fully functional and tested.
2. **CURRENCY FORMATTING:** Always format currency in Indian Rupees (`Rs. X,XX,XXX.00`).
3. **DATABASE ACCESS:** Always import and use the shared MySQL connection pool from `backend/config/database.js`. Do not instantiate duplicate pools.
4. **BLOCKCHAIN REGISTRATION:** Never call `BlockchainService.registerOnChain()` directly from business controllers. Always route through `BlockchainQueue.enqueueJob()` to ensure crash-safe persistence.
5. **SIMULATION MODE:** Keep `SIMULATION_MODE` supported in `backend/config/blockchain.js` so local development operates gracefully even when no funded wallet private key is supplied.
6. **MIGRATION SAFETY:** When altering database schemas, write idempotent checks (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) as demonstrated in `backend/config/dbInit.js`.
7. **VERIFICATION:** Always run `node test-regression-final.js` and `node test-phase41-hardening.js` inside `backend/` to verify system health after making any backend edits.
