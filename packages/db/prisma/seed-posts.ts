/**
 * Demo post seeder: ~130 requests and offers across every main category of the
 * current taxonomy (apps/web/src/lib/categories.data.json).
 *
 * Run: pnpm --filter @slotbook/db seed:posts
 *
 * - Requests (REQUIREMENT) come from demo buyers, offers (PROMOTE) from demo providers.
 * - Most posts stay open for 30 days; about one in five for 14 days, counted
 *   from when the post was created (the last ~2 days).
 * - Each post gets a provider, 1–2 problems and up to 5 tags from its sub category,
 *   and a completion timeline that fits the category, like the post flow sets them.
 *
 * Idempotent: every run deletes the posts owned by the demo authors below and
 * recreates them, which also refreshes the 14/30-day windows.
 */
import { DemandPostType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getSubCategoryById } from "../../../apps/web/src/lib/categories.js";
import { completionProfileFor } from "../../../apps/web/src/lib/completion-timeline.js";

const prisma = new PrismaClient();

// ── Deterministic RNG so each run produces the same posts ──
let rngState = 20261119;
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

// People posting requests ("I need…").
const REQUESTERS = [
  { name: "Ananya Sharma", companyName: null, city: 1 },
  { name: "Rahul Verma", companyName: "Verma Logistics", city: 9 },
  { name: "Priya Menon", companyName: null, city: 12 },
  { name: "Siddharth Jain", companyName: "Jain Agro Exports", city: 7 },
  { name: "Tanvi Deshpande", companyName: null, city: 6 },
  { name: "Mohammed Aslam", companyName: "Aslam Hospitality", city: 3 },
  { name: "Ritika Chawla", companyName: "Petal & Thread", city: 11 },
  { name: "Harish Kumar", companyName: null, city: 4 },
  { name: "Divya Pillai", companyName: "Brightpath Learning", city: 2 },
  { name: "Aman Gupta", companyName: "Gupta Home Solutions", city: 14 },
].map((a, i) => ({ ...a, role: Role.BUSINESS, email: `demo.req${i + 1}@xivago.in` }));

// People posting offers ("I provide…").
const PROVIDERS = [
  { name: "Dr. Nisha Rao", companyName: "MindEase Clinic", city: 2 },
  { name: "Adv. Karthik Iyer", companyName: "Iyer & Associates", city: 4 },
  { name: "Saurabh Khanna", companyName: "Khanna Wealth Partners", city: 0 },
  { name: "Lakshmi Narayanan", companyName: "Shubh Muhurat Seva", city: 16 },
  { name: "Zoya Siddiqui", companyName: "Frame & Feather Studio", city: 0 },
  { name: "Vivek Bansal", companyName: "Bansal Tech Labs", city: 10 },
  { name: "Ayesha Khan", companyName: "Wanderlust Trails", city: 17 },
  { name: "Gaurav Mishra", companyName: "CareerCraft Coaching", city: 14 },
  { name: "Dr. Rohan Shetty", companyName: "PawsCare Vets", city: 6 },
  { name: "Simran Kaur", companyName: "Glow Studio", city: 11 },
].map((a, i) => ({ ...a, role: Role.VENDOR, email: `demo.pro${i + 1}@xivago.in` }));

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&q=70&auto=format&fit=crop`;

// Cover images per main category (all URLs verified to return 200).
const IMAGES: Record<string, string[]> = {
  "8": ["1556745757-8d76bdb6984b", "1521737604893-d14cc237f11d", "1523240795612-9a054b0db644", "1517245386807-bb43f82c33c4", "1543269865-cbf427effbad"].map(u),
  "10": ["1551288049-bebda4e38f71", "1543286386-713bdd548da4", "1460925895917-afdab827c52f", "1518186285589-2f7649de83e0", "1535320903710-d993d3d77d29", "1454165804606-c3d57bc86b40"].map(u),
  "13": ["1544367567-0f2fcb009e0b", "1571019613454-1cb2f99b2d8b", "1506126613408-eca07ce68773", "1576091160550-2173dba999ef", "1505751172876-fa1923c5c528", "1490645935967-10de6ba17061", "1512438248247-f0f2a5a8b7f0", "1559757148-5c350d0d3c56", "1517836357463-d25dfeac3438", "1532938911079-1b06ac7ceec7"].map(u),
  "14": ["1589829545856-d10d557cf95f", "1450101499163-c8848c66ca85", "1554224155-6726b3ff858f", "1507679799987-c73779587ccf", "1521791055366-0d553872125f", "1600880292203-757bb62b4baf", "1436450412740-6b988f486c6b", "1586282391129-76a6df230234"].map(u),
  "15": ["1554224155-6726b3ff858f", "1579621970563-ebec7560ff3e", "1565514020179-026b92b84bb6", "1611974789855-9c2a0a7236a3", "1526304640581-d334cdbbf45e", "1563986768609-322da13575f3", "1621761191319-c6fb62004040", "1460925895917-afdab827c52f"].map(u),
  "16": ["1486406146926-c627a92ad1ab", "1560518883-ce09059eeffa", "1600585154340-be6161a56a0c", "1497366811353-6870744d04b2", "1512917774080-9991f1c4c750", "1564013799919-ab600027ffc6"].map(u),
  "17": ["1436491865332-7a61a109cc05", "1488085061387-422e29b40080", "1569154941061-e231b4725ef1", "1500835556837-99ac94a94552", "1530521954074-e64f6810b32d"].map(u),
  "18": ["1589829545856-d10d557cf95f", "1532187863486-abf9dbad1b69", "1581091226825-a6a2a5aee158", "1507679799987-c73779587ccf", "1450101499163-c8848c66ca85"].map(u),
  "19": ["1611162617474-5b21e879e113", "1533750349088-cd871a92f312", "1557838923-2985c318be48", "1556761175-5973dc0f32e7", "1552664730-d307ca884978", "1497366216548-37526070297c", "1542744173-8e7e53415bb0", "1563013544-824ae1b704d3", "1472851294608-062f824d29cc", "1607082348824-0a96f2a4b9da"].map(u),
  "20": ["1521791136064-7986c2920216", "1573497019940-1c28c88b4f3e", "1552664730-d307ca884978", "1586281380349-632531db7ed4", "1507679799987-c73779587ccf", "1600880292203-757bb62b4baf"].map(u),
  "21": ["1532012197267-da84d127e765", "1515942661900-94b3d1972591", "1600431521340-491eca880813", "1518562180175-34a163b1a9a6", "1502134249126-9f3755a50d78", "1519681393784-d120267933ba"].map(u),
  "22": ["1540575467063-178a50c2df87", "1522071820081-009f0129c71c", "1600880292089-90a7e086ee0c", "1497366216548-37526070297c", "1526304640581-d334cdbbf45e", "1451187580459-43490279c0fa", "1556742049-0cfed4f6a45d"].map(u),
  "23": ["1519741497674-611481863552", "1511795409834-ef04bbd61622", "1530103862676-de8c9debad1d", "1464366400600-7168b8af9bc3", "1492684223066-81342ee5ff30", "1540575467063-178a50c2df87", "1555244162-803834f70033"].map(u),
  "24": ["1488646953014-85cb44e25828", "1476514525535-07fb3b4ae5f1", "1507525428034-b723cf961d3e", "1524492412937-b28074a5d7da", "1469854523086-cc02fe5d8800", "1501785888041-af3ef285b470", "1533105079780-92b9be482077"].map(u),
  "25": ["1486312338219-ce68d2c6f44d", "1519389950473-47ba0277781c", "1558494949-ef010cbdcc31", "1677442136019-21780ecad995", "1555066931-4365d14bab8c", "1517694712202-14dd9538aa97", "1550751827-4bd374c3f58b", "1504639725590-34d0984388bd", "1531297484001-80022131f5a1"].map(u),
  "26": ["1503676260728-1c00da094a0b", "1427504494785-3a9ca7044f45", "1497633762265-9d179a990aa6", "1513258496099-48168024aec0", "1456513080510-7bf3a84b82f8"].map(u),
  "27": ["1511895426328-dc8714191300", "1609220136736-443140cffec6", "1491438590914-bc09fcaaf77a", "1529156069898-49953e39b3ac"].map(u),
  "28": ["1548199973-03cce0bbc87b", "1587300003388-59208cc962cb", "1543466835-00a7907e9de1", "1601758228041-f3b2795255f1", "1450778869180-41d0601e046e", "1583337130417-3346a1be7dee"].map(u),
  "29": ["1522335789203-aabd1fc54bc9", "1487412947147-5cebf100ffc2", "1596462502278-27bfdc403348", "1560066984-138dadb4c035", "1515886657613-9f3515b0c78f", "1490481651871-ab68de25d43d"].map(u),
  "30": ["1561070791-2526d30994b5", "1572044162444-ad60f128bdea", "1492691527719-9d1e07e534b4", "1558655146-9f40138edfeb", "1598550476439-6847785fcea6", "1590602847861-f357a9332bbc", "1478737270239-2f02b77fc618", "1533035353720-f1c6a75cd8ab"].map(u),
};

// R = request (REQUIREMENT, "I need…"), O = offer (PROMOTE, "I provide…").
type P = [subId: string, kind: "R" | "O", summary: string, budget: number];

const POSTS: P[] = [
  // ── 13 Health & Wellness ──
  ["13.1", "R", "Looking for an online therapist for exam anxiety and panic attacks before my CA finals. Prefer evening video sessions in Hindi or English.", 1500],
  ["13.2", "R", "Need a clinical nutritionist for my father, recently diagnosed with Type 2 diabetes. Weekly diet plan with Indian vegetarian meals and monthly review.", 6000],
  ["13.3", "R", "First pregnancy, 14 weeks. Looking for a prenatal yoga instructor and a lactation consultant for home visits in Bandra.", 12000],
  ["13.4", "R", "Need a physiotherapist for post-ACL surgery rehab, 3 home sessions a week for 6 weeks in Whitefield.", 25000],
  ["13.5", "R", "Want a second opinion from a senior cardiologist on my mother's angioplasty recommendation. Reports and angiography CD ready to share.", 3500],
  ["13.1", "O", "RCI-licensed psychologist offering 50-minute online sessions for anxiety, burnout and relationship stress. Anonymous chat option available, Hindi/English/Kannada.", 1200],
  ["13.6", "O", "BAMS Ayurveda doctor with 12 years' experience. Online consultations for PCOS, gut health and stress, with personalised diet and herbal plans.", 800],
  ["13.8", "O", "Certified elder-care coordinator: home safety audit, caregiver hiring and a monthly care plan for parents living alone. Serving Pune and Mumbai.", 9000],

  // ── 14 Legal & Compliance ──
  ["14.1", "R", "Need a 30-minute call with a lawyer about a builder delaying possession of my flat by 2 years. Want to know RERA options.", 2000],
  ["14.2", "R", "Freelance designer with clients in the US and UK. Need a CA for GST registration, LUT filing and this year's ITR with foreign income.", 15000],
  ["14.5", "R", "Startup with 25 employees needs POSH policy, ICC setup and annual training as per the 2013 Act.", 35000],
  ["14.6", "R", "Drafting a co-founder agreement with vesting, IP assignment and exit clauses for a 3-founder SaaS startup.", 30000],
  ["14.8", "R", "Need help drafting and registering a will for my parents covering a flat in Chennai and ancestral land in Kerala.", 18000],
  ["14.9", "O", "DPDP Act compliance package for apps and websites: privacy policy, consent flows, data mapping and a DPO-on-call for 3 months.", 75000],
  ["14.10", "O", "FSSAI, Shops & Establishment, trade licence and MSME Udyam registration handled end to end for new restaurants and cloud kitchens.", 12000],
  ["14.4", "O", "Consumer court specialist. Drafting complaints, legal notices and representation for e-commerce, insurance and builder disputes.", 8000],

  // ── 15 Financial Advisory ──
  ["15.1", "R", "Couple in our early 30s, combined income ₹3.2 lakh a month. Want a full financial plan: emergency fund, home purchase in 4 years and child education.", 10000],
  ["15.2", "R", "Need a SEBI-registered advisor to review my ₹45 lakh mutual fund portfolio. Too many overlapping funds and no clear asset allocation.", 15000],
  ["15.4", "R", "Health insurance claim of ₹3.8 lakh rejected for 'pre-existing disease'. Need an expert to help with the ombudsman appeal.", 7500],
  ["15.6", "R", "NRI in Dubai. Need help with NRE/NRO accounts, repatriating sale proceeds of a Pune flat and tax filing in India.", 20000],
  ["15.3", "O", "Retirement planning for salaried professionals 40+: NPS, EPF, SWP strategy and a year-by-year cash-flow plan. Fee-only, no product selling.", 12000],
  ["15.5", "O", "Credit score repair and loan counselling. We fix CIBIL errors, negotiate settlements and plan debt consolidation. First call free.", 5000],
  ["15.7", "O", "Crypto tax and portfolio advisory: 30% tax and TDS computation, exchange statement reconciliation and safe custody setup.", 9000],

  // ── 16 Real Estate ──
  ["16.1", "R", "3BHK interior design for a new flat in Gachibowli, around 1,750 sq ft. Modern minimal style, modular kitchen and wardrobes included.", 900000],
  ["16.3", "R", "Buying a resale plot in Jaipur. Need title search for 30 years, encumbrance check and verification of the conversion order.", 25000],
  ["16.5", "R", "Need a pre-handover snag inspection for a 2BHK in Noida Sector 150: seepage, tiles, electricals and plumbing with a written report.", 8000],
  ["16.8", "R", "Restaurant chain looking for 2,500 sq ft ground-floor retail space in Koramangala or Indiranagar. Need a broker with good footfall data.", 50000],
  ["16.2", "O", "RERA-registered broker for residential resale and rentals across Thane and Navi Mumbai. Verified listings and paperwork support included.", 20000],
  ["16.4", "O", "Government-approved valuer. Independent valuation reports for home loans, capital gains, partition and court cases within 72 hours.", 6000],
  ["16.6", "O", "Full-service rental management for NRI owners: tenant screening, rent agreements, rent collection, repairs and quarterly inspections.", 4000],

  // ── 17 Immigration & Visa ──
  ["17.1", "R", "Planning MS in Computer Science in Germany for Winter 2027. Need help with university shortlist, SOP review and blocked account.", 40000],
  ["17.2", "R", "Software engineer with 6 years' experience. Need guidance on Canada Express Entry vs Germany Opportunity Card and CRS improvement.", 25000],
  ["17.4", "R", "Need help with a UK spouse visa application. Husband is on a Skilled Worker visa; want document checklist and file review.", 30000],
  ["17.7", "R", "Applying for a Schengen tourist visa for a family of four for a May trip. Need appointment booking, itinerary and cover letters.", 8000],
  ["17.3", "O", "Licensed RCIC consultant. Canada PR end to end: profile, ECA, IELTS strategy, PNP nominations and the final application.", 85000],
  ["17.5", "O", "UAE Golden Visa and Portugal investor residency advisory for business owners and investors. Clear timelines and fixed fees.", 150000],
  ["17.6", "O", "Relocation support for families moving to Bengaluru or Dubai: home search, school admissions, FRRO and bank setup.", 60000],

  // ── 18 IP & Patent ──
  ["18.1", "R", "Need a prior-art search and patentability opinion for an IoT irrigation controller before we file in India.", 30000],
  ["18.2", "R", "Looking for a patent agent to draft and file a complete specification for a medical device, with PCT filing later.", 120000],
  ["18.3", "R", "Register the trademark for our café brand in classes 30 and 43. Also want a search to check for conflicting marks.", 15000],
  ["18.5", "R", "A competitor is selling copies of our patented kitchen tool on Amazon. Need cease-and-desist and a takedown strategy.", 50000],
  ["18.4", "O", "Copyright registration for books, music, software and artwork, plus licensing agreements for creators and publishers.", 7000],
  ["18.6", "O", "Software IP protection: trade-secret policies, contractor IP assignment, open-source licence audits and design registration.", 40000],

  // ── 19 Business ──
  ["19.2", "R", "First-time founder building a B2B SaaS for clinics. Looking for a mentor for fortnightly calls on pricing, GTM and hiring.", 20000],
  ["19.3", "R", "Raising a ₹4 Cr pre-seed for our EV charging startup. Need help with pitch deck, financial model and investor introductions.", 150000],
  ["19.4", "R", "Need a performance marketer for our organic skincare brand. Meta and Google ads, ₹3 lakh monthly spend, target ROAS of 3x.", 50000],
  ["19.6", "R", "Rebranding our 25-year-old sweets business for younger customers. New logo, packaging and Instagram launch campaign.", 180000],
  ["19.9", "R", "Want to launch our handloom sarees on Shopify, Amazon and Myntra. Need catalogue shoot, listings and an ads plan.", 120000],
  ["19.11", "R", "Automate our lead flow with n8n: website form to CRM, WhatsApp follow-up and Google Sheet reports for a 6-person sales team.", 40000],
  ["19.8", "O", "Fractional HR for startups of 10–100 people: hiring pipelines, policies, payroll setup, appraisals and compliance.", 45000],
  ["19.10", "O", "Franchise consulting for food and retail brands: unit economics, franchise agreement, SOP manuals and franchisee onboarding.", 200000],
  ["19.12", "O", "PMP-certified program manager available for 6-month engagements. Agile delivery, vendor management and weekly reporting.", 150000],

  // ── 20 Career Coaching ──
  ["20.1", "R", "Preparing for product manager interviews at FAANG companies. Need 5 mock interviews on product sense and execution with feedback.", 15000],
  ["20.2", "R", "Need my resume and LinkedIn rewritten for a move from sales to customer success. 8 years' experience, targeting SaaS companies.", 6000],
  ["20.3", "R", "Mechanical engineer, 4 years in manufacturing. Want a career coach to plan a move into data analytics within a year.", 12000],
  ["20.5", "R", "Have two offers from fintech companies. Need help comparing ESOPs and negotiating the base salary before Friday.", 5000],
  ["20.4", "O", "ICF-certified executive coach for first-time managers and directors. 8-session programme on leadership, feedback and delegation.", 60000],
  ["20.6", "O", "Campus placement bootcamp for final-year engineering students: aptitude, coding rounds, GD practice and HR interviews.", 3500],

  // ── 21 Spiritual & Puja ──
  ["21.1", "R", "Need a pandit for griha pravesh puja and havan at our new home in Indore. Samagri arrangement included.", 11000],
  ["21.1", "R", "Looking for a priest to perform Satyanarayan katha at home on the coming Purnima in Lucknow, in Hindi.", 5100],
  ["21.2", "R", "Want a detailed kundli matching for marriage and a consultation on the right muhurat for the wedding.", 3100],
  ["21.5", "R", "Need an officiant for an interfaith wedding ceremony (Hindu–Christian) in Goa. Bilingual ceremony preferred.", 35000],
  ["21.3", "O", "Numerology and tarot readings over video call. Name corrections for business and newborns, with a written report.", 1500],
  ["21.4", "O", "Guided meditation and Reiki healing, online or in Coimbatore. 4-week programme for stress, sleep and focus.", 6000],
  ["21.6", "O", "Certified gemologist. Lab-tested gemstones with authenticity certificates and consultation on wearing them correctly.", 2500],

  // ── 22 B2B Strategy & Expert Networks ──
  ["22.1", "R", "PE fund needs a 1-hour expert call with a former procurement head of a large Indian pharma company.", 25000],
  ["22.2", "R", "European kitchenware brand entering India. Need a market entry study covering channels, pricing, import duties and BIS certification.", 400000],
  ["22.3", "R", "Commercial due diligence on a ₹60 Cr ed-tech acquisition target: customer interviews, cohorts and competitive landscape.", 600000],
  ["22.5", "R", "Need an expert to cut lead times at our auto-components plant. Lean manufacturing and supplier consolidation advice.", 250000],
  ["22.4", "O", "Digital transformation advisory for mid-size manufacturers: ERP selection, shop-floor IoT and a 12-month roadmap.", 300000],
  ["22.6", "O", "BRSR and ESG reporting for listed and pre-IPO companies: materiality assessment, carbon accounting and sustainability report.", 350000],
  ["22.8", "O", "Localisation and cultural adaptation for brands entering the Middle East, Japan and Germany: copy, UX review and launch checks.", 120000],

  // ── 23 Events ──
  ["23.1", "R", "Planning a 300-guest wedding in Udaipur in February. Need a planner for venue, decor, guest hospitality and the sangeet.", 2500000],
  ["23.2", "R", "Annual sales conference for 150 people in Goa: venue, AV, travel, team activities and an awards night.", 1800000],
  ["23.3", "R", "Need a planner for my daughter's 5th birthday at home in Chandigarh. Jungle theme, games host and a return-gift setup for 40 kids.", 45000],
  ["23.6", "R", "Looking for a caterer for a 120-guest housewarming lunch. South Indian vegetarian menu, served on banana leaf.", 90000],
  ["23.4", "O", "Floral and themed decor for weddings, haldi, mehendi and corporate events across Rajasthan. In-house fabrication team.", 150000],
  ["23.5", "O", "Bilingual emcee and Bollywood band for weddings and corporate nights. 10 years of experience, 600+ events hosted.", 75000],
  ["23.7", "O", "Candid wedding photography and cinematic films, with drone shots and same-day highlights. Pan-India travel.", 200000],

  // ── 24 Travel ──
  ["24.1", "R", "10-day Japan itinerary for a family of 4 in April: Tokyo, Kyoto, Osaka. Vegetarian food options and a JR pass plan needed.", 15000],
  ["24.3", "R", "Honeymoon in the Maldives, 6 nights. Looking for an overwater villa with all-inclusive meals and seaplane transfers.", 450000],
  ["24.4", "R", "Char Dham Yatra for parents aged 65+ in May. Need a comfortable package with helicopter for Kedarnath and a doctor on call.", 180000],
  ["24.6", "R", "Corporate travel partner for a 40-person team offsite in Vietnam: flights, visas, hotels and local transport.", 2000000],
  ["24.2", "O", "Certified heritage walk guide in Old Delhi and Agra. Private food and history tours in English, French and Hindi.", 3500],
  ["24.5", "O", "Guided Himalayan treks: Hampta Pass, Kedarkantha, Valley of Flowers. Small groups, certified leaders and all gear included.", 14000],
  ["24.8", "O", "Points and miles coaching: earn business-class flights with credit-card points. Personalised strategy and award booking.", 4000],

  // ── 25 Software and Tech ──
  ["25.1", "R", "Need a React Native developer to build a booking app for our chain of 8 salons, with Razorpay payments and WhatsApp reminders.", 350000],
  ["25.2", "R", "Move our Django app from a single VPS to AWS ECS with Terraform, CI/CD and automated backups. Zero downtime required.", 180000],
  ["25.3", "R", "Build a RAG chatbot over 2,000 internal SOP documents for our support team. Needs Hindi and English answers.", 250000],
  ["25.4", "R", "Need a VAPT for our fintech web app and APIs before an RBI audit. Report with CVSS scores and a retest.", 150000],
  ["25.5", "R", "Looking for a UX designer to redesign our B2B dashboard in Figma. 25 screens with a component library.", 120000],
  ["25.7", "R", "Office of 30 laptops needs IT support: network setup, Google Workspace admin, endpoint security and monthly maintenance.", 25000],
  ["25.6", "O", "Webflow and Framer websites for startups and creators, delivered in 10 days. CMS, SEO setup and animations included.", 60000],
  ["25.9", "O", "Fractional CTO for early-stage startups: architecture reviews, hiring your first engineers and investor tech due diligence.", 150000],
  ["25.10", "O", "QA automation with Playwright and Appium. Regression suites, CI integration and release sign-off for web and mobile apps.", 90000],

  // ── 26 Education & Tutoring ──
  ["26.1", "R", "Need a home tutor for Class 10 CBSE Maths and Science in Sector 62, Noida. 4 evenings a week until board exams.", 12000],
  ["26.2", "R", "Looking for a JEE Advanced physics mentor for doubt-solving and mock-test analysis. Online, 3 sessions a week.", 18000],
  ["26.3", "R", "Need an IELTS coach to move my writing score from 6.0 to 7.5 in 6 weeks. Daily essay feedback preferred.", 15000],
  ["26.5", "R", "Want a counsellor for US undergrad applications: college list, Common App essays and scholarship strategy for Fall 2027.", 200000],
  ["26.4", "O", "Native-level German tutor for A1–B2 and Goethe exam prep. Small online batches and 1:1 classes available.", 9000],
  ["26.6", "O", "Hindustani classical vocal and harmonium lessons, online or at my studio in Kolkata. All ages welcome.", 3000],
  ["26.7", "O", "Special educator for children with dyslexia and ADHD. Assessments, IEP planning and 1:1 remedial sessions.", 8000],

  // ── 27 Relationships & Family ──
  ["27.1", "R", "Married 6 years, struggling with communication after our first baby. Looking for a couples counsellor for online sessions.", 3000],
  ["27.3", "R", "Need a child psychologist for my 7-year-old's screen addiction and tantrums. Parent coaching sessions preferred.", 2500],
  ["27.2", "R", "Looking for a personalised matchmaking service for my brother, 32, a doctor in Hyderabad. Telugu families preferred.", 50000],
  ["27.4", "O", "Divorce and co-parenting support: emotional counselling, parenting plans and coordination with your lawyer.", 4000],
  ["27.3", "O", "Certified parenting coach for toddlers and teens. 6-session programme on tantrums, screen time and confidence.", 9000],

  // ── 28 Pets & Veterinary ──
  ["28.1", "R", "My 9-year-old Labrador has been limping for a week. Need an online vet consultation with an orthopaedics opinion.", 800],
  ["28.2", "R", "Need a dog trainer for a 5-month-old Indie puppy: leash pulling, biting and basic obedience at home in Andheri.", 12000],
  ["28.4", "R", "Relocating from Bengaluru to Toronto with two cats. Need full pet relocation: vaccines, import permits and airline crates.", 150000],
  ["28.3", "O", "Home pet grooming in Pune: bath, haircut, nail trim and tick treatment. Hygienic van setup, all breeds.", 1500],
  ["28.1", "O", "Experienced vet available for video consultations from 7am to 11pm. Diet, skin, vaccination and behaviour queries.", 500],

  // ── 29 Beauty & Styling ──
  ["29.1", "R", "Need a personal stylist to rebuild my work wardrobe for a new leadership role. Mumbai, includes a shopping trip.", 25000],
  ["29.2", "R", "Persistent acne and pigmentation. Looking for a skincare consultation with a dermat-approved routine I can afford.", 2000],
  ["29.4", "R", "Bridal makeup and hair for my wedding day plus reception, with trial session. Lucknow, airbrush preferred.", 60000],
  ["29.3", "O", "Image consulting for executives: grooming, body language, business etiquette and wardrobe audit, 1:1 or for teams.", 20000],
  ["29.2", "O", "Certified makeup artist offering 1:1 self-makeup classes. Learn everyday, office and party looks in 3 sessions.", 7500],

  // ── 30 Creative, Media & Content ──
  ["30.1", "R", "Growing my finance YouTube channel (40k subscribers). Need a coach for content strategy, thumbnails and retention.", 15000],
  ["30.2", "R", "Need an editor for my 70,000-word business book manuscript: structural edit, copyedit and help with publishing options.", 80000],
  ["30.4", "R", "Launching a business podcast. Need studio recording, editing and show notes for 12 episodes.", 60000],
  ["30.6", "R", "Need illustrations for a children's picture book: 24 spreads in watercolour style, with print-ready files.", 90000],
  ["30.5", "O", "Public speaking coach for TEDx talks, keynotes and investor pitches. Voice, storytelling and stage presence.", 12000],
  ["30.7", "O", "Newsletter operations on Beehiiv and Substack: setup, growth loops, sponsorship packaging and weekly issue production.", 35000],
  ["30.8", "O", "Sponsorship management for YouTubers and podcasters: rate cards, brand pitching, negotiation and contracts.", 25000],

  // ── 8 Customers ──
  ["8.1", "R", "SaaS with 400 B2B customers. Need customer onboarding playbooks and in-app guides to cut time-to-value from 3 weeks to 5 days.", 120000],
  ["8.3", "R", "Need 20 customer interviews with small retail store owners in Tier-2 cities, with a findings report.", 90000],
  ["8.4", "R", "Looking for an outsourced support team of 6 agents for Hindi and English chat and calls, 9am to 9pm.", 180000],
  ["8.2", "O", "Community management for Discord, WhatsApp and Circle groups: moderation, weekly events and engagement reporting.", 40000],
  ["8.5", "O", "Loyalty programme design for D2C brands: points, tiers, referral loops and retention campaigns on WhatsApp and email.", 70000],

  // ── 10 Data & Analytics ──
  ["10.1", "R", "Build a BigQuery warehouse pulling from Shopify, Meta Ads, Google Ads and Razorpay, with dbt models and daily refresh.", 200000],
  ["10.2", "R", "Need a churn prediction model on 2 years of subscription data, with explainable outputs our team can act on.", 150000],
  ["10.3", "R", "Power BI dashboard for a 12-outlet restaurant chain: daily sales, food cost, wastage and staff productivity.", 70000],
  ["10.5", "O", "Data labelling team of 40 for image, text and audio annotation. Indian languages supported, QA-checked output.", 50000],
  ["10.3", "O", "Looker Studio and Metabase dashboards for startups, set up in a week. Clean metrics definitions and automated reports.", 30000],
];

// Requirement roles a request maps to, by main category (only set when the role exists).
const ROLE_FOR_MAIN: Record<string, string> = {
  "25": "Developer",
  "10": "Analyst",
  "30": "Freelancer",
  "29": "Freelancer",
  "16": "Agent",
  "23": "Contractor",
  "8": "Workforce",
};

async function main() {
  console.log("Seeding demo requests and offers...");
  const passwordHash = await bcrypt.hash("Password!123", 12);

  const upsertAuthors = async (list: typeof REQUESTERS) => {
    const out = [];
    for (const a of list) {
      const city = CITIES[a.city]!;
      out.push(
        await prisma.user.upsert({
          where: { email: a.email },
          update: {},
          create: {
            email: a.email,
            passwordHash,
            name: a.name,
            role: a.role,
            companyName: a.companyName,
            location: city.name,
            bio: a.role === Role.VENDOR ? `${a.companyName ?? a.name} — services on Xivago.` : `Looking for trusted experts.`,
            isVerified: true,
            subscription: { create: {} },
          },
        }),
      );
    }
    return out;
  };
  const requesters = await upsertAuthors(REQUESTERS);
  const providers = await upsertAuthors(PROVIDERS);

  const removed = await prisma.demand.deleteMany({
    where: { authorId: { in: [...requesters, ...providers].map((a) => a.id) } },
  });
  if (removed.count) console.log(`  removed ${removed.count} previous demo posts`);

  const roles = await prisma.requirementRole.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const roleId = (name: string | undefined) => roles.find((r) => r.name === name)?.id ?? null;

  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const rows = [];
  let skipped = 0;
  let days14 = 0;

  for (const [subId, kind, summary, budget] of POSTS) {
    const found = getSubCategoryById(subId);
    if (!found) {
      console.warn(`  skipped unknown sub category ${subId}`);
      skipped++;
      continue;
    }
    const { parent, sub } = found;
    const isRequest = kind === "R";
    const author = pick(isRequest ? requesters : providers);
    const city = rand() < 0.65 ? CITIES.find((c) => c.name === author.location)! : pick(CITIES);
    const jitter = () => (rand() - 0.5) * 0.12; // ~±6 km

    const provider = sub.providers.length ? pick(sub.providers) : undefined;
    const problems = provider ? pickMany(provider.problems, 1 + Math.floor(rand() * 2)) : [];
    const tags = Array.from(new Set(problems.flatMap((p) => p.tags))).slice(0, 5);

    const profile = completionProfileFor(sub.id, parent.id);
    const completionTimeline = pick(profile.options);
    const completionDate = completionTimeline === "DATE" ? new Date(now + (10 + Math.floor(rand() * 80)) * DAY) : null;

    // Posted within the last ~40 hours; open for 30 days (about 1 in 5 for 14 days).
    const createdAt = new Date(now - Math.floor(rand() * 40 * HOUR));
    const openDays = rand() < 0.2 ? 14 : 30;
    if (openDays === 14) days14++;
    const timelineEnd = new Date(createdAt.getTime() + openDays * DAY);

    const imageCount = 1 + Math.floor(rand() * 2); // 1–2
    const mediaUrls = pickMany(IMAGES[parent.id] ?? [], imageCount);

    const selectedTechInputs = Object.fromEntries(
      sub.requiredInputs.map((inp) => [inp.label, pickMany(inp.options, 1 + Math.floor(rand() * 2))]),
    );

    const isPriority = rand() < 0.12;

    rows.push({
      authorId: author.id,
      postType: isRequest ? DemandPostType.REQUIREMENT : DemandPostType.PROMOTE,
      requirementRoleId: isRequest ? roleId(ROLE_FOR_MAIN[parent.id] ?? "Consultant") : null,
      summary,
      budgetMin: budget,
      budgetMax: budget,
      currency: "INR",
      timelineEnd,
      completionTimeline,
      completionDate,
      categoryParentId: parent.id,
      categorySubId: sub.id,
      categoryName: parent.name,
      subCategoryName: sub.name,
      categoryProviderId: provider?.id ?? null,
      categoryProblemIds: problems.map((p) => p.id),
      tags,
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

  await prisma.demand.createMany({ data: rows });
  const requests = rows.filter((r) => r.postType === DemandPostType.REQUIREMENT).length;
  const mains = new Set(rows.map((r) => r.categoryParentId)).size;
  console.log(
    `Created ${rows.length} posts (${requests} requests, ${rows.length - requests} offers) across ${mains} main categories; ` +
      `${rows.length - days14} open for 30 days, ${days14} for 14 days.` +
      (skipped ? ` Skipped ${skipped}.` : ""),
  );
  console.log("Demo authors: demo.req1-10@xivago.in and demo.pro1-10@xivago.in, password Password!123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
