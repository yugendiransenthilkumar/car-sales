# AutoSphere — Full-Stack Certified Used Car Sales Portal

A production-grade, zero-framework second-hand car dealership website built with **HTML5, CSS3, Vanilla JavaScript (ES6+ Modules)**, **Supabase** (PostgreSQL Database, Authentication, and Row Level Security), **Appwrite Storage** (Vehicle Photography), and **WhatsApp Click-to-Chat** for customer purchase enquiries.

---

## 1. System Architecture

```
                                  +---------------------------------------+
                                  |         AutoSphere Frontend           |
                                  |  HTML5 / Modern CSS3 / Vanilla ES6+   |
                                  +-------------------+-------------------+
                                                      |
                   +----------------------------------+----------------------------------+
                   |                                  |                                  |
                   v                                  v                                  v
+------------------------------------+  +----------------------------+  +---------------------------------+
|          Supabase Cloud            |  |      Appwrite Cloud        |  |        WhatsApp Engine          |
|------------------------------------|  |----------------------------|  |---------------------------------|
| - PostgreSQL Database (`cars`)     |  | - Storage Bucket           |  | - Official click-to-chat API    |
| - Relational Schema & Indexes      |  |   (`car-photos`)           |  | - Pre-filled structured enquiry |
| - Auth (JWT & Password Sessions)   |  | - Image Upload & View URLs |  |   (Year, Make, Model, Trim,     |
| - Row Level Security (RLS)         |  | - Auto-generated Previews  |  |   Mileage, Price, URL link)     |
| - Role Validation (`profiles`)     |  | - 5MB & MIME validations   |  | - Direct sales concierge chat   |
+------------------------------------+  +----------------------------+  +---------------------------------+
```

### Architectural Highlights
- **Zero Heavy Frontend Frameworks**: Completely free from React, Vue, Angular, Svelte, Tailwind, or jQuery runtime overhead. Blazing fast first-contentful paint.
- **Strict Separation of Storage and Database**: Binary vehicle photos reside in Appwrite Storage. Only lightweight metadata (`appwrite_file_id`, `image_url`, `display_order`) is persisted in Supabase.
- **Server-Authoritative Authorization**: Customers can never escalate their privileges by editing local storage or client JavaScript. Profiles default to `'customer'` via a `SECURITY DEFINER` PostgreSQL database trigger. Admin actions are verified through Supabase RLS policies in the database.
- **No Build-Step Lock-in**: Can run natively on standard static hosting (GitHub Pages, Cloudflare Pages, Netlify) or locally via Vite dev server.

---

## 2. File and Directory Structure

```
/
├── index.html                   # Public Homepage (Hero search, featured & recent cars, guarantees)
├── cars.html                    # Inventory Catalog (Facet filters, search, sort, pagination)
├── car-details.html             # Detailed Vehicle Dossier (Image gallery, full specs, WhatsApp CTA)
├── login.html                   # User & Dealership Admin Sign-In (Role-based redirect)
├── register.html                # Customer Registration (Enforces customer role)
├── contact.html                 # Showroom Location & Test Drive Booking
│
├── admin/
│   ├── index.html               # Admin Router Guard
│   ├── dashboard.html           # Real-Time Inventory Metrics & Recent Activity
│   ├── cars.html                # Admin Inventory Table with inline status & delete
│   ├── add-car.html             # Add Vehicle Form with multi-image dropzone
│   └── edit-car.html            # Edit Vehicle Form with gallery management
│
├── assets/
│   ├── css/
│   │   ├── style.css            # Public styles, CSS variables, grid, modals, toasts
│   │   ├── admin.css            # Back-office dashboard, tables, metric cards, dropzone
│   │   └── auth.css             # Login & Registration authentication forms
│   │
│   ├── js/
│   │   ├── config.js            # Central project credentials & runtime overrides
│   │   ├── supabase-client.js   # Supabase SDK initialization & data access queries
│   │   ├── appwrite-client.js   # Appwrite Storage SDK, image upload, delete & previews
│   │   ├── auth.js              # Supabase Auth, session listeners, role verification
│   │   ├── common.js            # Toast notifications, modals, WhatsApp enquiry builder
│   │   ├── home.js              # Homepage hero search & live inventory loader
│   │   ├── cars.js              # Multi-criteria inventory filtering & pagination
│   │   ├── car-details.js       # Gallery switcher, technical specs, related cars
│   │   ├── login.js             # Sign-in handler with role routing
│   │   ├── register.js          # Customer signup with client validations
│   │   ├── admin-auth.js        # Admin portal guard & sidebar user renderer
│   │   ├── admin-dashboard.js   # Live metric aggregations & recent table
│   │   ├── admin-cars.js        # Inventory manager, inline status, safe delete
│   │   └── car-form.js          # Reusable car form controller (Add & Edit)
│   │
│   └── images/
│       ├── logo-placeholder.svg # AutoSphere vector brand emblem
│       └── car-placeholder.svg  # High-definition vehicle fallback placeholder
│
├── database/
│   ├── schema.sql               # PostgreSQL tables, sequences, triggers, constraints
│   └── rls-policies.sql         # Row Level Security policies for strict role isolation
│
└── README.md                    # System documentation, testing & deployment guide
```

---

## 3. Step-by-Step Setup Guide

### Phase 1: Supabase Database & Auth Setup
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase Dashboard.
3. Open `database/schema.sql`, paste the full script, and click **Run**. This provisions:
   - `profiles` table (linked to `auth.users`)
   - `cars` inventory table with safe sequential listing numbers (e.g. `AS-10001`)
   - `car_images` table with foreign keys and cascade delete
   - Automatic `handle_new_user()` trigger for new signups
   - Automatic `updated_at` triggers
4. In the SQL Editor, open `database/rls-policies.sql`, paste the full script, and click **Run**. This enables Row Level Security and enforces that only verified administrators can insert, update, or delete cars.
5. In your Supabase Dashboard, go to **Project Settings** -> **API** and copy:
   - **Project URL**
   - **anon / public key**

### Phase 2: Designating an Administrator Account
1. Open the website and go to `/register.html`. Register an account with your desired admin email (e.g. `admin@autosphere.com`).
2. Because all public registrations default to `customer` for security, open your Supabase **SQL Editor** and execute:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@autosphere.com');
   ```
3. You can now sign in at `/login.html` and you will be routed directly to the protected `/admin/dashboard.html`!

### Phase 3: Appwrite Storage Setup
1. Create a free account at [appwrite.io](https://cloud.appwrite.io).
2. Create a new Project (e.g. `autosphere-used-cars`).
3. Navigate to **Storage** -> **Create Bucket**:
   - Bucket Name: `car-photos`
   - Bucket ID: `car-photos` (or note down the generated ID)
   - Max file size: `5MB`
   - Allowed file extensions: `jpg, jpeg, png, webp`
4. In Bucket **Settings** -> **Permissions**:
   - Add Role `Any` (or `Guests`) with **Read** permission so website visitors can view vehicle photographs.
   - For file uploads: In direct client testing, grant **Create** and **Delete** to `Any` or `Users`, or use an Appwrite Function that validates the Supabase JWT.
5. Copy your:
   - **Appwrite Endpoint** (e.g. `https://cloud.appwrite.io/v1`)
   - **Project ID**
   - **Bucket ID**

### Phase 4: Configure the Frontend
Open `assets/js/config.js` and set your credentials:
```javascript
export const CONFIG = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
  
  appwriteEndpoint: 'https://cloud.appwrite.io/v1',
  appwriteProjectId: 'your-project-id',
  appwriteBucketId: 'car-photos',

  // Dealership WhatsApp number in international format without '+' sign
  whatsappNumber: '919876543210',

  siteUrl: window.location.origin
};
```
*Note: You can also click the **⚙️ System Setup** button on the website banner at any time to enter and test runtime credentials directly in the browser!*

---

## 4. WhatsApp Buy Now Integration

When a customer clicks **Buy Now** on any vehicle card or details page, `assets/js/common.js` formats a rich, pre-filled purchase enquiry:

```
Hello AutoSphere Cars,

I am interested in purchasing the following vehicle listed on your website:
----------------------------------------
Listing ID: AS-10001
Vehicle: 2023 Hyundai Creta (SX (O) 1.5 Turbo)
Asking Price: ₹14,50,000
Kilometres: 24,000 km
Fuel: Petrol | Transmission: Automatic | 1 Owner(s)
Status: AVAILABLE
----------------------------------------
Listing URL: https://yoursite.com/car-details.html?id=...

Could you please confirm its current availability, inspection schedule, and final on-road pricing details?
```

- Encoded safely via standard `encodeURIComponent`
- Opens via official WhatsApp click-to-chat API: `https://wa.me/{number}?text={encoded}`
- If a vehicle is marked as `sold`, the Buy Now button is automatically disabled and marked "Sold Out" to prevent false enquiries.

---

## 5. Security & Row Level Security (RLS) Verification

| Resource | Public / Anonymous | Authenticated Customer | Administrator |
|---|---|---|---|
| `cars` (Read) | **Allowed** | **Allowed** | **Allowed** |
| `cars` (Insert/Update/Delete) | **Blocked by RLS** | **Blocked by RLS** | **Allowed** |
| `car_images` (Read) | **Allowed** | **Allowed** | **Allowed** |
| `car_images` (Write) | **Blocked by RLS** | **Blocked by RLS** | **Allowed** |
| `profiles` (Role alteration) | **Blocked** | **Blocked by trigger & RLS** | **Controlled via DB** |
| Admin Pages (`/admin/*`) | Redirects to `/login.html` | Redirects to `/cars.html` with alert | **Access Granted** |

---

## 6. Comprehensive Testing Checklist

- [x] **Public Browsing**: Homepage renders hero search, featured cars, and recent cars loaded dynamically from Supabase.
- [x] **Multi-Criteria Search**: Filtering by brand, model keyword, year, fuel type, transmission, max budget, and max kilometres updates inventory in real time.
- [x] **Sorting & Pagination**: Sorting by price (low/high), year (newest), and newest listings functions correctly with pagination.
- [x] **Car Details Page**: Loads single vehicle by UUID, displays gallery thumbnails with image switcher, formats currency in Indian Rupees (`₹`), and hides absent optional fields.
- [x] **WhatsApp Click-to-Chat**: Generates formatted enquiry message with listing number, make, model, price, mileage, and canonical URL.
- [x] **Authentication Flow**: Customer registration creates `profiles` entry with `role = 'customer'`. Login redirects admins to `/admin/dashboard.html` and customers to `/cars.html`.
- [x] **Admin Authorization Guard**: Direct URL access to `/admin/*` rejects unauthenticated users and authenticated non-administrators.
- [x] **Inventory Management**: Admins can add vehicles with multi-image drag-and-drop, inline change status (Available, Reserved, Sold), edit existing specs, and safely delete listings with Appwrite storage cleanup.
- [x] **Reliability & Error Handling**: Missing images fall back cleanly to `car-placeholder.svg`. Database connectivity errors display helpful retry callouts instead of crashing.

---

## 7. Static Hosting & Zero-Cost Deployment

The application is fully compatible with any modern static web host:

### Option A: Cloudflare Pages
1. Push repository to GitHub.
2. Log into Cloudflare Dashboard -> **Workers & Pages** -> **Create application** -> **Pages**.
3. Select your repository. Build output directory: `.` (or `dist` if building with Vite).
4. Deploy!

### Option B: GitHub Pages
1. In your GitHub repository, go to **Settings** -> **Pages**.
2. Source: **Deploy from a branch** -> branch `main` -> folder `/ (root)`.
3. Save. Your website will be live in seconds.

### Option C: Netlify / Vercel
1. Import repository.
2. Set Build Command: `npm run build`
3. Set Publish Directory: `dist`
4. Deploy.
