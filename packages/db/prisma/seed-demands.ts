/**
 * Demo demand seeder — fills the home feed with realistic demands across
 * every category in apps/web/src/lib/categories.ts.
 *
 * Run: pnpm --filter @slotbook/db seed:demands
 *
 * Idempotent: every run deletes the demands owned by the demo authors below
 * and recreates them, so re-running also refreshes `timelineEnd` (the feed
 * hides demands whose timeline has passed, and timelines cap at 7 days).
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES_DATA, getSubCategoryById } from "../../../apps/web/src/lib/categories.js";

const prisma = new PrismaClient();

// ── Deterministic RNG so the same demand gets the same images/city each run ──
let rngState = 20261031;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 2 ** 32;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function pickMany<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  return out;
}

const CITIES = [
  { name: "Mumbai, Maharashtra", lat: 19.076, lng: 72.8777 },
  { name: "Delhi, Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bengaluru, Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad, Telangana", lat: 17.385, lng: 78.4867 },
  { name: "Chennai, Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata, West Bengal", lat: 22.5726, lng: 88.3639 },
  { name: "Pune, Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad, Gujarat", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur, Rajasthan", lat: 26.9124, lng: 75.7873 },
  { name: "Gurugram, Haryana", lat: 28.4595, lng: 77.0266 },
  { name: "Noida, Uttar Pradesh", lat: 28.5355, lng: 77.391 },
  { name: "Chandigarh, Punjab", lat: 30.7333, lng: 76.7794 },
  { name: "Kochi, Kerala", lat: 9.9312, lng: 76.2673 },
  { name: "Indore, Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { name: "Lucknow, Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { name: "Surat, Gujarat", lat: 21.1702, lng: 72.8311 },
  { name: "Coimbatore, Tamil Nadu", lat: 11.0168, lng: 76.9558 },
  { name: "Goa, Goa", lat: 15.4909, lng: 73.8278 },
  { name: "Bhubaneswar, Odisha", lat: 20.2961, lng: 85.8245 },
  { name: "Nagpur, Maharashtra", lat: 21.1458, lng: 79.0882 },
] as const;

const AUTHORS = [
  { name: "Arjun Mehta", companyName: "Mehta Ventures", city: 0 },
  { name: "Sneha Iyer", companyName: "Kaveri Foods Pvt Ltd", city: 4 },
  { name: "Rohit Malhotra", companyName: "UrbanNest Realty", city: 9 },
  { name: "Kavya Reddy", companyName: "Lumen Health Tech", city: 3 },
  { name: "Vikram Singh", companyName: "Rajputana Crafts", city: 8 },
  { name: "Neha Kapoor", companyName: "Bloom Skincare", city: 1 },
  { name: "Aditya Rao", companyName: "Stackwise Labs", city: 2 },
  { name: "Ishita Banerjee", companyName: "Kolkata Tea Traders", city: 5 },
  { name: "Farhan Qureshi", companyName: "Qureshi Exports", city: 15 },
  { name: "Meera Nair", companyName: "Coastal Stays", city: 12 },
  { name: "Karan Joshi", companyName: "FitFuel Nutrition", city: 6 },
  { name: "Pooja Agarwal", companyName: "Agarwal Textiles", city: 7 },
].map((a, i) => ({ ...a, email: `demo.buyer${i + 1}@xivago.in` }));

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&q=70&auto=format&fit=crop`;

// Image pools per parent category id (all URLs verified to return 200).
const IMAGES: Record<string, string[]> = {
  "1": ["1589829545856-d10d557cf95f", "1450101499163-c8848c66ca85", "1554224155-6726b3ff858f", "1507679799987-c73779587ccf", "1521791055366-0d553872125f", "1600880292203-757bb62b4baf", "1436450412740-6b988f486c6b", "1586282391129-76a6df230234"].map(u),
  "2": ["1486312338219-ce68d2c6f44d", "1519389950473-47ba0277781c", "1558494949-ef010cbdcc31", "1677442136019-21780ecad995", "1555066931-4365d14bab8c", "1517694712202-14dd9538aa97", "1550751827-4bd374c3f58b", "1504639725590-34d0984388bd", "1531297484001-80022131f5a1"].map(u),
  "3": ["1561070791-2526d30994b5", "1572044162444-ad60f128bdea", "1492691527719-9d1e07e534b4", "1586717791821-3f44a563fa4c", "1558655146-9f40138edfeb", "1609921212029-bb5a28e60960", "1574717024653-61fd2cf4d44d", "1626785774573-4b799315345d"].map(u),
  "4": ["1611162617474-5b21e879e113", "1533750349088-cd871a92f312", "1504868584819-f8e8b4b6d7e3", "1432888498266-38ffec3eaf0a", "1557838923-2985c318be48", "1460925895917-afdab827c52f", "1556761175-5973dc0f32e7"].map(u),
  "5": ["1540575467063-178a50c2df87", "1511578314322-379afb476865", "1522071820081-009f0129c71c", "1600880292089-90a7e086ee0c", "1552664730-d307ca884978", "1497366216548-37526070297c", "1542744173-8e7e53415bb0"].map(u),
  "6": ["1598550476439-6847785fcea6", "1611162616305-c69b3fa7fbe0", "1590602847861-f357a9332bbc", "1516321318423-f06f85e504b3", "1478737270239-2f02b77fc618", "1533035353720-f1c6a75cd8ab"].map(u),
  "7": ["1526304640581-d334cdbbf45e", "1451187580459-43490279c0fa", "1556742049-0cfed4f6a45d", "1559526324-4b87b5e36e44", "1488646953014-85cb44e25828"].map(u),
  "8": ["1556745757-8d76bdb6984b", "1521737604893-d14cc237f11d", "1523240795612-9a054b0db644", "1517245386807-bb43f82c33c4", "1543269865-cbf427effbad"].map(u),
  "9": ["1563013544-824ae1b704d3", "1556740738-b6a63e27c4df", "1472851294608-062f824d29cc", "1607082348824-0a96f2a4b9da", "1523474253046-8cd2748b5fd2", "1556742502-ec7c0e9f34b1"].map(u),
  "10": ["1551288049-bebda4e38f71", "1543286386-713bdd548da4", "1460925895917-afdab827c52f", "1518186285589-2f7649de83e0", "1535320903710-d993d3d77d29", "1454165804606-c3d57bc86b40"].map(u),
  "11": ["1486406146926-c627a92ad1ab", "1560518883-ce09059eeffa", "1600585154340-be6161a56a0c", "1497366811353-6870744d04b2", "1512917774080-9991f1c4c750", "1564013799919-ab600027ffc6"].map(u),
  "12": ["1532012197267-da84d127e765", "1515942661900-94b3d1972591", "1600431521340-491eca880813", "1518562180175-34a163b1a9a6", "1502134249126-9f3755a50d78", "1519681393784-d120267933ba"].map(u),
};

// Images shipped in apps/web/public — app screenshots, so only used as
// "reference" images on UI/UX and product-design demands.
const SYSTEM_IMAGES = ["/calendar-spend.jpg", "/xivago-checkout.jpg", "/xivago-credit.jpg"];

type D = [summary: string, budgetMin: number, budgetMax: number];

// Four demands for each of the original 31 sub-categories (124 demands). Sub-categories
// added later have no seed demands yet; they are skipped below via `?? []`.
// Seed demands only carry a sub-category id (no provider/problem), like legacy records.
const DEMANDS: Record<string, D[]> = {
  "1.1": [
    ["Incorporating a Pvt Ltd for our D2C snack brand with two co-founders. Need MoA/AoA, founder agreements with 4-year vesting and a clean cap table.", 25000, 60000],
    ["Flipping our Indian Pvt Ltd to a Delaware C-Corp ahead of a US seed round. Looking for someone who has done 5+ flips and handles FEMA filings.", 150000, 300000],
    ["Need a lawyer to review a SAFE note from an angel investor and redline the term sheet before Friday. Quick turnaround essential.", 15000, 35000],
    ["Setting up an ESOP pool of 10% for our 18-member team. Need policy drafting, board resolutions and grant letters.", 40000, 90000],
  ],
  "1.2": [
    ["Looking for a fractional CFO, 8 hours a week, for a ₹12 Cr revenue manufacturing SME. Monthly MIS, cash-flow forecasting and banker meetings.", 60000, 120000],
    ["Need a CA to clean up two years of books in Tally and get us audit-ready. Around 3,000 transactions, GST reconciliations included.", 35000, 75000],
    ["Freelancer earning in USD needs help with foreign income tax filing, DTAA benefit claims and advance tax planning for this year.", 8000, 20000],
    ["Migrating accounts from Tally to Zoho Books / Xero for a 3-entity group. Need chart of accounts mapping and opening balances verified.", 40000, 80000],
  ],
  "1.3": [
    ["File trademarks for our brand name and logo in classes 3 and 35 in India, plus a WIPO Madrid filing for UAE and UK.", 30000, 70000],
    ["SaaS startup preparing for SOC 2 Type I. Need gap assessment, policy templates and readiness support over the next 3 months.", 200000, 450000],
    ["Need a DPDP Act / GDPR compliance review for our health app: privacy policy, consent flows and data processing agreements.", 50000, 120000],
    ["Draft a standard NDA, MSA and SLA template pack for our agency to use with enterprise clients.", 20000, 45000],
  ],
  "2.1": [
    ["Build a React Native app for our home-services marketplace: customer booking, provider app, Razorpay payments and live job tracking.", 400000, 900000],
    ["Need a Next.js developer to rebuild our marketing site from WordPress. 12 pages, CMS-driven blog, Lighthouse score above 90.", 80000, 180000],
    ["Looking for a Node.js backend engineer to design REST APIs for a B2B ordering portal with GST invoicing and inventory sync.", 150000, 350000],
    ["Flutter developer needed to fix crashes and ship our grocery app update to Play Store and App Store within 2 weeks.", 50000, 120000],
  ],
  "2.2": [
    ["Build a WhatsApp AI assistant that answers customer FAQs from our product catalogue and PDFs using RAG. Hindi and English support.", 120000, 300000],
    ["Need an LLM engineer to fine-tune a Llama 3 model on 20k support tickets for auto-classification and suggested replies.", 200000, 500000],
    ["Looking for a LangGraph expert to build an agent that reads invoices from email, extracts data and pushes it to our ERP.", 150000, 350000],
    ["Set up a semantic search over 50,000 legal judgments using Qdrant or Pinecone with a simple search UI.", 180000, 400000],
  ],
  "2.3": [
    ["Migrate our app from a single EC2 box to a containerised AWS setup with Terraform, auto-scaling and zero-downtime deploys.", 150000, 350000],
    ["Need a VAPT for our fintech web app and APIs before RBI audit. Detailed report with CVSS scores and retest included.", 100000, 250000],
    ["Set up GitHub Actions CI/CD for a monorepo: lint, tests, preview deployments and production release with approvals.", 40000, 100000],
    ["Our AWS bill crossed ₹4 lakh a month. Looking for a cloud cost optimisation audit with concrete savings plan.", 60000, 150000],
  ],
  "3.1": [
    ["Redesign the checkout flow of our app — reference screen attached. Want fewer steps, clearer pricing and a premium dark UI in Figma.", 60000, 150000],
    ["Need a UX designer to run 8 usability tests on our onboarding flow and deliver a findings report with redesigned screens.", 50000, 120000],
    ["Build a Figma design system with tokens, components and dark/light themes for our fintech product. Reference attached.", 150000, 300000],
    ["Design App Store and Play Store screenshots for our app, similar style to the attached reference. 6 screens, 2 languages.", 15000, 40000],
  ],
  "3.2": [
    ["Complete brand identity for an artisanal coffee roastery in Bengaluru: logo, colour palette, typography and packaging labels.", 60000, 150000],
    ["Need 3D product renders of our skincare bottles in Blender for website and ads. 10 hero images with lifestyle backgrounds.", 40000, 90000],
    ["Rebrand our 20-year-old family textile business for a younger audience. Logo refresh, brand book and social templates.", 80000, 200000],
    ["Looking for AI-generated campaign visuals (Midjourney/Flux) for a Diwali collection launch — 25 final images, brand-consistent.", 25000, 60000],
  ],
  "3.3": [
    ["Produce a 60-second brand film for our boutique hotel in Goa. Drone shots, guest moments, music licensing included.", 150000, 350000],
    ["Need an editor for 20 Instagram Reels per month from our raw footage. Captions, trending audio and quick 48-hour turnaround.", 30000, 60000],
    ["Create a 3D CGI product ad for our new smartwatch, 15 and 30-second cuts for YouTube and Meta.", 120000, 280000],
    ["Shoot and edit a corporate explainer video with animated infographics for our SaaS platform. Voiceover in English and Hindi.", 70000, 160000],
  ],
  "4.1": [
    ["Grow organic traffic for our B2B SaaS blog. Need technical SEO audit, keyword strategy and 8 long-form articles a month.", 60000, 140000],
    ["Want our brand to show up in ChatGPT and Perplexity answers for 'best CRM for Indian SMEs'. Looking for a GEO/AEO specialist.", 80000, 200000],
    ["Build programmatic SEO pages for 500 city + service combinations on our Webflow site with unique content.", 100000, 250000],
    ["Local SEO for a chain of 6 dental clinics: Google Business Profile optimisation, reviews strategy and citations.", 25000, 60000],
  ],
  "4.2": [
    ["Set up a cold email engine with Instantly + Clay to book 20 meetings a month with US e-commerce brands.", 80000, 180000],
    ["Need a HubSpot expert to set up deal pipelines, lead scoring and automated follow-ups for a 10-person sales team.", 50000, 120000],
    ["Build a lead list of 5,000 verified decision-makers at Indian manufacturing companies with emails and phone numbers.", 30000, 70000],
    ["LinkedIn outbound for our IT services firm — profile optimisation, content and automated connection campaigns.", 40000, 90000],
  ],
  "4.3": [
    ["Meta Ads specialist for a fashion D2C brand. ₹5 lakh monthly spend, target ROAS of 3x. Creatives strategy is a must.", 40000, 100000],
    ["Run Google Search and Performance Max campaigns for a real estate project launch in Pune. Lead quality matters most.", 50000, 120000],
    ["Set up Triple Whale attribution and fix our broken conversion tracking across Meta, Google and Shopify.", 30000, 70000],
    ["Launch LinkedIn ads for a B2B webinar targeting CFOs in India. Need copy, creatives and campaign management for a month.", 35000, 80000],
  ],
  "4.4": [
    ["Secure press coverage for our Series A announcement in Economic Times, YourStory and Inc42. Launching in 3 weeks.", 100000, 250000],
    ["Need a PR consultant to position our founder as a thought leader — op-eds, podcast appearances and awards entries.", 60000, 150000],
    ["Write and distribute a press release on PR Newswire for our product launch in India and Southeast Asia.", 25000, 60000],
    ["Crisis communication support after a negative viral review. Need a response strategy and media handling this week.", 50000, 120000],
  ],
  "5.1": [
    ["Automate our order-to-invoice process with n8n: Shopify order → Zoho invoice → WhatsApp confirmation → Google Sheet log.", 30000, 70000],
    ["Build a voice AI agent on Vapi or Retell to call leads, qualify them and book site visits in our calendar. Hindi support needed.", 100000, 250000],
    ["Replace our spreadsheet chaos with an Airtable + Retool internal tool for tracking 300 field technicians.", 80000, 180000],
    ["Set up Zapier automations between Typeform, HubSpot, Slack and Gmail for our admissions team.", 15000, 40000],
  ],
  "5.2": [
    ["Hire and onboard 3 full-stack developers in Poland via an EOR. Need help with Deel setup, contracts and payroll.", 60000, 150000],
    ["Need an HR consultant to build our employee handbook, leave policy and Shops & Establishment compliance for 40 employees.", 40000, 90000],
    ["Recruit 10 customer support executives for our Indore office within 3 weeks. Hindi and English fluency required.", 50000, 100000],
    ["Set up a performance review system with OKRs and quarterly appraisals for a 60-person startup.", 50000, 120000],
  ],
  "5.3": [
    ["Manage our booth at a 3-day industry expo in Delhi — stall design, fabrication, staffing and lead capture.", 300000, 700000],
    ["Organise a 200-person annual offsite in Jaipur: venue, travel, team activities and gala dinner. Dates flexible next month.", 800000, 1500000],
    ["Need a virtual event partner to host a 1,000-attendee product launch webinar with breakout rooms and networking.", 80000, 200000],
    ["Build our Series A data room and investor pitch deck with financial model review before roadshow.", 100000, 250000],
  ],
  "6.1": [
    ["Launch a paid newsletter on Beehiiv for our personal finance community. Need setup, referral programme and first 4 issues.", 30000, 70000],
    ["Convert my YouTube cooking content into a Kajabi course with modules, worksheets and a sales page.", 50000, 120000],
    ["Set up and moderate a paid Discord community for a trading education brand with roles, bots and onboarding.", 40000, 90000],
    ["Need a ghostwriter for a weekly LinkedIn newsletter on startup finance. 4 issues per month, research included.", 25000, 50000],
  ],
  "6.2": [
    ["Talent manager needed to pitch my tech YouTube channel (420k subs) to brands and negotiate sponsorship deals.", 50000, 150000],
    ["Set up an affiliate programme on PartnerStack for our SaaS with partner onboarding kit and commission structure.", 40000, 100000],
    ["Build a brand-deal CRM in Airtable to track 50+ sponsors, deliverables, invoices and payment status.", 15000, 35000],
    ["Find podcast sponsors for our business podcast — 30k downloads per episode, Indian startup audience.", 30000, 80000],
  ],
  "6.3": [
    ["Need 20 fitness micro-influencers for a protein bar launch. Integrated Reels with 30-day paid usage rights.", 200000, 500000],
    ["UGC creators wanted: 15 raw-footage videos of real people using our skincare products for Meta ads.", 45000, 110000],
    ["Run a LinkedIn creator campaign with 5 B2B voices to promote our HR software to founders and HR heads.", 100000, 250000],
    ["Travel influencers for our Kerala homestay — 3-night stay, Reels and stories in exchange for barter plus fee.", 40000, 100000],
  ],
  "7.1": [
    ["Localise our mobile app UI and Play Store listing into Hindi, Tamil, Telugu and Bengali. Around 4,000 words.", 30000, 70000],
    ["Translate and culturally adapt our e-commerce site for the UAE market — Arabic RTL layout and local copy.", 80000, 180000],
    ["Need native German and French translators for our SaaS help centre, 120 articles, using Lokalise.", 120000, 280000],
    ["Japanese localisation of our pitch deck and product brochure for a Tokyo trade delegation next week.", 40000, 90000],
  ],
  "7.2": [
    ["Set up Stripe and Wise to collect USD, EUR and GBP from international clients with proper FIRC documentation.", 25000, 60000],
    ["Our Shopify store wants to sell to the US and UK. Need multi-currency checkout and sales tax setup with TaxJar.", 40000, 100000],
    ["Move our SaaS billing to Paddle as merchant of record and handle VAT/GST compliance globally.", 50000, 120000],
    ["Need advice on export of services, LUT filing and GST-free invoicing for our design agency's foreign clients.", 15000, 35000],
  ],
  "8.1": [
    ["Design a customer onboarding flow in Userpilot that cuts our SaaS time-to-value from 14 days to 3.", 60000, 150000],
    ["Set up Freshdesk with SLAs, macros and a knowledge base for a 12-agent support team handling 1,500 tickets/week.", 40000, 90000],
    ["Build a churn early-warning playbook and health scores in HubSpot for our B2B customer success team.", 50000, 120000],
    ["Need an Intercom chatbot with order tracking and returns flows for our fashion e-commerce site.", 35000, 80000],
  ],
  "8.2": [
    ["Community manager for our 8,000-member Discord — daily engagement, weekly AMAs and moderation in IST hours.", 40000, 80000],
    ["Launch a customer community on Circle for our edtech brand with onboarding, challenges and monthly events.", 60000, 150000],
    ["Build a custom moderation bot for our Telegram and Discord groups to filter spam and scam links.", 30000, 70000],
    ["Grow our subreddit and run Reddit AMAs to build awareness for our open-source developer tool.", 35000, 90000],
  ],
  "9.1": [
    ["Build a Shopify Plus store for our handcrafted jewellery brand with custom theme, COD, Shiprocket and WhatsApp alerts.", 120000, 280000],
    ["Migrate 8,000 SKUs from WooCommerce to Shopify without losing SEO rankings or customer data.", 80000, 180000],
    ["Headless commerce with Next.js + Shopify Hydrogen for a premium furniture brand. Fast, 3D product views.", 300000, 700000],
    ["Build a B2B wholesale marketplace for textile manufacturers in Surat with tiered pricing and GST invoices.", 400000, 900000],
  ],
  "9.2": [
    ["CRO audit for our D2C skincare store — 2.1% conversion, want 3%+. Checkout and product page A/B tests in VWO.", 50000, 120000],
    ["Set up Klaviyo flows: welcome, abandoned cart, browse abandonment and post-purchase for a 50k-customer list.", 40000, 90000],
    ["Add cart upsells and bundles with Rebuy to increase average order value for our nutrition brand.", 30000, 70000],
    ["Redesign our product detail pages with reviews, UGC videos and trust badges to improve conversions.", 45000, 100000],
  ],
  "10.1": [
    ["Build a BigQuery data warehouse pulling from Shopify, Meta Ads, Google Ads and Razorpay, with dbt models.", 150000, 350000],
    ["Need a Power BI dashboard for our 14-outlet restaurant chain — daily sales, food cost and staff productivity.", 50000, 120000],
    ["Set up Airbyte + Snowflake pipelines and Metabase dashboards for our logistics startup's operations team.", 180000, 400000],
    ["Clean and automate our monthly MIS reports currently built manually in Excel from 6 different sources.", 40000, 90000],
  ],
  "10.2": [
    ["Build a customer LTV and churn prediction model on 3 years of subscription data. Python, explainable outputs.", 120000, 280000],
    ["Set up Mixpanel product analytics with event tracking plan, funnels and retention cohorts for our mobile app.", 50000, 110000],
    ["Demand forecasting model for 400 SKUs across 3 warehouses to reduce stockouts during the festive season.", 150000, 350000],
    ["Analyse our PostHog data and recommend 5 product changes to improve week-4 retention.", 40000, 90000],
  ],
  "11.1": [
    ["Location analysis for opening 5 new cafés in Hyderabad — footfall, competition and rent benchmarks with GIS maps.", 80000, 200000],
    ["Looking for 25,000 sq ft Grade-A warehouse space near Bhiwandi with good highway access. Need a broker shortlist.", 50000, 150000],
    ["Need commercial real estate advisory to lease a 120-seat office in Gurugram, Cyber City or Golf Course Road.", 100000, 250000],
    ["Feasibility study for converting a heritage property in Jaipur into a boutique hotel.", 150000, 350000],
  ],
  "11.2": [
    ["Set up smart building automation for a 6-floor office: occupancy sensors, HVAC control and energy dashboard.", 300000, 800000],
    ["Implement property management software for 150 rental units — tenant portal, rent collection and maintenance tickets.", 80000, 200000],
    ["IoT-based water and electricity metering for a gated community of 400 apartments in Chennai.", 250000, 600000],
    ["Build a 3D virtual tour and listing site for our upcoming villa project near Pune.", 60000, 150000],
  ],
  "12.1": [
    ["Looking for a numerologist to audit 5 shortlisted names for our new fintech brand and suggest spelling tweaks.", 10000, 30000],
    ["Need an auspicious incorporation and launch date for our jewellery business, based on founder birth charts.", 8000, 25000],
    ["Founder compatibility numerology report for three co-partners entering a new manufacturing venture.", 12000, 35000],
    ["Brand name numerology check for 12 product names in our Ayurveda range before packaging goes to print.", 15000, 40000],
  ],
  "12.2": [
    ["Vastu consultation for our new 4,000 sq ft corporate office in Ahmedabad before the interior work starts.", 25000, 60000],
    ["Feng Shui layout review for a retail showroom in Mumbai — entrance, cash counter and display placement.", 20000, 50000],
    ["Vastu audit of a factory floor plan in Coimbatore, including machinery placement and owner's cabin.", 30000, 75000],
    ["Electional astrology for selecting launch dates for 4 product releases over the next quarter.", 15000, 40000],
  ],
};

async function main() {
  console.log("Seeding demo demands...");
  const passwordHash = await bcrypt.hash("Password!123", 12);

  const authors = [];
  for (const a of AUTHORS) {
    const city = CITIES[a.city]!;
    authors.push(
      await prisma.user.upsert({
        where: { email: a.email },
        update: {},
        create: {
          email: a.email,
          passwordHash,
          name: a.name,
          role: Role.BUSINESS,
          companyName: a.companyName,
          location: city.name,
          bio: `Sourcing partners for ${a.companyName}.`,
          isVerified: true,
          subscription: { create: {} },
        },
      }),
    );
  }

  const removed = await prisma.demand.deleteMany({ where: { authorId: { in: authors.map((a) => a.id) } } });
  if (removed.count) console.log(`  removed ${removed.count} previous demo demands`);

  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const rows = [];

  // DEMANDS and IMAGES are keyed by the previous taxonomy's ids; ids resolve to their current category.
  for (const [legacySubId, demands] of Object.entries(DEMANDS)) {
    const found = getSubCategoryById(legacySubId);
    if (!found) continue;
    const { parent, sub } = found;
    for (const [summary, budgetMin, budgetMax] of demands) {
      const author = pick(authors);
      // 60% of demands come from the author's own city, the rest elsewhere.
      const city = rand() < 0.6 ? CITIES.find((c) => c.name === author.location)! : pick(CITIES);
      const jitter = () => (rand() - 0.5) * 0.12; // ~±6 km

      const imageCount = 1 + Math.floor(rand() * 3); // 1–3
      let mediaUrls = pickMany(IMAGES[legacySubId.split(".")[0]!] ?? [], imageCount);
      if (legacySubId === "3.1") mediaUrls = [pick(SYSTEM_IMAGES), ...mediaUrls].slice(0, 3);

      const selectedTechInputs = Object.fromEntries(
        sub.requiredInputs.map((inp) => [inp.label, pickMany(inp.options, 1 + Math.floor(rand() * 2))]),
      );

      const createdAt = new Date(now - Math.floor(rand() * 60 * HOUR)); // last 2.5 days
      const timelineEnd = new Date(now + (6 + Math.floor(rand() * 162)) * HOUR); // 6h – 7d
      const isPriority = rand() < 0.15;

      rows.push({
        authorId: author.id,
        summary,
        budgetMin,
        budgetMax,
        currency: "INR",
        timelineEnd,
        categoryParentId: parent.id,
        categorySubId: sub.id,
        categoryName: parent.name,
        subCategoryName: sub.name,
        selectedTechInputs,
        mediaUrls,
        lat: city.lat + jitter(),
        lng: city.lng + jitter(),
        isPriority,
        priorityExpiresAt: isPriority ? timelineEnd : null,
        shareContact: rand() < 0.4,
        maxSlots: pick([3, 3, 3, 5, 5, 10]),
        createdAt,
      });
    }
  }

  await prisma.demand.createMany({ data: rows });
  console.log(`Created ${rows.length} demands across ${CATEGORIES_DATA.length} categories (password for demo authors: Password!123).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
