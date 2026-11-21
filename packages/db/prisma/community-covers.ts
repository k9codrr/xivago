/**
 * Cover images for the seeded communities, picked per subcategory (and a few
 * name keywords) so each community gets a photo that matches its topic.
 *
 * All photos are from Unsplash (free to use, hotlinking is the expected way to
 * serve them) and were checked by hand to exist and fit their topic.
 *
 * Used by seed-communities.ts (new communities) and
 * backfill-community-covers.ts (existing communities without a cover).
 */

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

/* ---------- Photo library, grouped by what they show ---------- */

const P = {
  meditation: ["1506126613408-eca07ce68773", "1508672019048-805c876b67e2", "1545389336-cf090694435e"],
  yoga: ["1544367567-0f2fcb009e0b", "1545389336-cf090694435e"],
  workout: ["1571019613454-1cb2f99b2d8b", "1517836357463-d25dfeac3438", "1534438327276-14e5300c3a48"],
  medical: ["1505751172876-fa1923c5c528", "1576091160399-112ba8d25d1d", "1579684385127-1ef15d508118", "1519494026892-80bbd2d6fd0d"],
  mind: ["1559757148-5c350d0d3c56", "1544027993-37dbfe43562a", "1527137342181-19aab11a8ee8", "1493836512294-502baa1986e2"],
  food: ["1490645935967-10de6ba17061", "1512621776951-a57141f2eefd", "1498837167922-ddd27525d352"],
  pregnancy: ["1555252333-9f8e92e65df9", "1584515933487-779824d29309"],
  wellnessOils: ["1600428877878-1a0fd85beda8", "1512290923902-8a9f81dc236c"],
  sleep: ["1520206183501-b80df61043c2", "1541781774459-bb2af2f05b55"],
  elder: ["1576765608535-5f04d1e3f289", "1447005497901-b3e9ee359928"],

  justice: ["1589829545856-d10d557cf95f", "1436450412740-6b988f486c6b", "1505664194779-8beaceb93744"],
  signing: ["1450101499163-c8848c66ca85", "1521791055366-0d553872125f", "1603796846097-bee99e4a601f"],
  tax: ["1554224154-26032ffc0d07", "1554224155-6726b3ff858f"],
  security: ["1614064641938-3bbee52942c7", "1550751827-4bd374c3f58b", "1563986768609-322da13575f3", "1563986768494-4dee2763ff3f"],

  savings: ["1579621970563-ebec7560ff3e", "1554224155-6726b3ff858f", "1559526324-4b87b5e36e44"],
  markets: ["1611974789855-9c2a0a7236a3", "1590283603385-17ffb3a7f29f", "1460925895917-afdab827c52f"],
  crypto: ["1518546305927-5a555bb7020d", "1621761191319-c6fb62004040", "1639762681485-074b7f938ba0", "1639322537228-f710d846310a"],

  house: ["1560518883-ce09059eeffa", "1564013799919-ab600027ffc6", "1600596542815-ffad4c1539a9"],
  interior: ["1618221195710-dd6b41faaea6", "1586023492125-27b2c045efd7", "1600210492486-724fe5c67fb0", "1502672260266-1c1ef2d93688"],
  construction: ["1504307651254-35680f356dfd", "1541888946425-d81bb19240f5"],
  apartment: ["1560448204-e02f11c3d0e2", "1502672260266-1c1ef2d93688", "1600585152220-90363fe7e115"],
  city: ["1486406146926-c627a92ad1ab"],

  flight: ["1436491865332-7a61a109cc05", "1569154941061-e231b4725ef1", "1530521954074-e64f6810b32d", "1544016768-982d1554f0b9"],
  campus: ["1541339907198-e08756dedf3f", "1562774053-701939374585"],
  nomad: ["1527631746610-bca00a040d60", "1499750310107-5fef28a66643"],

  research: ["1532012197267-da84d127e765", "1507413245164-6160d8298b31", "1513475382585-d06e58bcb0e0"],
  engineering: ["1581091226825-a6a2a5aee158"],

  office: ["1497366216548-37526070297c", "1559136555-9303baea8ebd"],
  team: ["1522071820081-009f0129c71c", "1556761175-5973dc0f32e7", "1542744173-8e7e53415bb0", "1552664730-d307ca884978"],
  marketing: ["1557838923-2985c318be48", "1460925895917-afdab827c52f"],
  branding: ["1561070791-2526d30994b5", "1558655146-d09347e92766"],
  logistics: ["1586528116311-ad8dd3c8310d", "1494412574643-ff11b0a5c1c3"],
  handshake: ["1600880292203-757bb62b4baf"],
  shopping: ["1556742049-0cfed4f6a45d", "1563013544-824ae1b704d3"],
  store: ["1441986300917-64674bd600d8", "1556740758-90de374c12ad"],
  analytics: ["1551288049-bebda4e38f71", "1553877522-43269d4ea984"],

  interview: ["1565688534245-05d6b5be184a", "1521737604893-d14cc237f11d"],
  resume: ["1586281380349-632531db7ed4"],
  professional: ["1573497019940-1c28c88b4f3e"],

  temple: ["1514222134-b57cbb8ce073"],
  stars: ["1419242902214-272b3f66ee7a", "1532968961962-8a0cb3a2d4f5", "1462331940025-496dfbfc7564"],

  energy: ["1466611653911-95081537e5b7", "1509391366360-2e959784a276", "1473341304170-971dccb5ac1e"],
  lab: ["1532187863486-abf9dbad1b69", "1576086213369-97a306d36557"],

  wedding: ["1519741497674-611481863552", "1606800052052-a08af7148866", "1465495976277-4387d4b0b4c6"],
  conference: ["1540575467063-178a50c2df87", "1505373877841-8d25f7d46678", "1475721027785-f74eccf877e2"],
  party: ["1530103862676-de8c9debad1d", "1464349095431-e9a21285b5f3", "1492684223066-81342ee5ff30"],
  decor: ["1511795409834-ef04bbd61622"],
  concert: ["1501386761578-eac5c94b800a", "1470229722913-7c0e2dbbafd3", "1492684223066-81342ee5ff30"],
  catering: ["1555244162-803834f70033", "1414235077428-338989a2e8c0", "1511795409834-ef04bbd61622"],
  camera: ["1502920917128-1aa500764cbd", "1516035069371-29a1b244cc32", "1492691527719-9d1e07e534b4"],

  travel: ["1488646953014-85cb44e25828", "1469854523086-cc02fe5d8800", "1476514525535-07fb3b4ae5f1"],
  beach: ["1507525428034-b723cf961d3e", "1573843981267-be1999ff37cd", "1520250497591-112f2f40a3f4"],
  landmark: ["1524492412937-b28074a5d7da"],
  mountains: ["1464822759023-fed622ff2c3b", "1551632811-561732d1e306"],
  backpacking: ["1501785888041-af3ef285b470", "1503220317375-aaad61436b1b"],

  code: ["1498050108023-c5249f4df085", "1461749280684-dccba630e2f6", "1555066931-4365d14bab8c"],
  hardware: ["1518770660439-4636190af475", "1531297484001-80022131f5a1"],
  servers: ["1558494949-ef010cbdcc31", "1544197150-b99a580bb7a8"],
  ai: ["1677442136019-21780ecad995", "1620712943543-bcc4688e7485"],
  design: ["1586717791821-3f44a563fa4c", "1561070791-2526d30994b5"],
  web: ["1467232004584-a241de8bcf5d", "1547658719-da2b51169166"],
  techTeam: ["1519389950473-47ba0277781c"],

  school: ["1503676260728-1c00da094a0b", "1509062522246-3755977927d7"],
  study: ["1434030216411-0b793f4b4173", "1456513080510-7bf3a84b82f8", "1606326608606-aa0b62935f2b"],
  books: ["1457369804613-52c61a468e7d", "1427504494785-3a9ca7044f45", "1546410531-bb4caa6b424d"],
  music: ["1511379938547-c1f69419868d", "1507838153414-b4b713384a76", "1510915361894-db8b60106cb1"],
  kids: ["1503454537195-1dcabb73ffb9", "1476703993599-0035a21b17a9"],

  family: ["1511895426328-dc8714191300", "1609220136736-443140cffec6", "1476703993599-0035a21b17a9"],
  couple: ["1518199266791-5375a83190b7", "1522673607200-164d1b6ce486", "1516589178581-6cd7833ae3b2"],

  vet: ["1628009368231-7bb7cfcb0def", "1576201836106-db1758fd1c97"],
  dogs: ["1548199973-03cce0bbc87b", "1587300003388-59208cc962cb", "1583337130417-3346a1be7dee"],
  cats: ["1514888286974-6c03e2ca1dba"],
  pets: ["1450778869180-41d0601e046e", "1548199973-03cce0bbc87b", "1576201836106-db1758fd1c97"],
  grooming: ["1516734212186-a967f81ad0d7"],

  makeup: ["1487412947147-5cebf100ffc2", "1522335789203-aabd1fc54bc9"],
  fashion: ["1490481651871-ab68de25d43d", "1445205170230-053b83016050"],
  salon: ["1560066984-138dadb4c035"],

  creator: ["1598550476439-6847785fcea6", "1516035069371-29a1b244cc32"],
  writing: ["1455390582262-044cdead277a", "1471107340929-a87cd0f5b5f3"],
  studio: ["1598488035139-bdbb2231ce04", "1478737270239-2f02b77fc618"],
  art: ["1513364776144-60967b0f800f"],
  mic: ["1475721027785-f74eccf877e2", "1478737270239-2f02b77fc618"],
} satisfies Record<string, string[]>;

/* ---------- Subcategory → photos ---------- */

const BY_SUBCATEGORY: Record<string, string[]> = {
  // Health & Wellness
  "Mental Health & Emotional Wellness": [...P.mind, P.meditation[0]!],
  "Specialized Health & Nutrition": P.food,
  "Women's Health, Fertility & Pregnancy": [...P.pregnancy, P.medical[0]!],
  "Fitness, Yoga & Physiotherapy": [...P.yoga, ...P.workout],
  "Second Medical Opinion & Chronic Care": P.medical,
  "Ayurveda, Homeopathy & Integrative Medicine": [...P.wellnessOils, P.food[0]!],
  "Sleep, Addiction & Habit Coaching": [...P.sleep, P.meditation[1]!],
  "Elder Care & Caregiver Guidance": P.elder,

  // Legal & Compliance
  "Micro Legal & Statutory Advice": P.justice,
  "Tax, Accounting & CPA Compliance": P.tax,
  "Family & Matrimonial Law": [P.justice[0]!, P.family[0]!, P.signing[0]!],
  "Consumer Protection & Dispute Resolution": [...P.justice, P.shopping[1]!],
  "Employment & Labor Law": [P.justice[1]!, P.office[0]!, P.signing[1]!],
  "Corporate, Startup & Contract Law": [...P.signing, P.office[1]!],
  "Criminal Law & Cyber Crime": [P.justice[1]!, ...P.security.slice(0, 2)],
  "Wills, Estate & Succession Planning": [P.signing[0]!, P.house[0]!, P.justice[2]!],
  "Data Privacy & Regulatory Compliance": P.security,

  // Financial Advisory & Wealth Coaching
  "Personal Financial Planning & Budgeting": P.savings,
  "Investment & Portfolio Advisory": P.markets,
  "Retirement & Pension Planning": [P.savings[0]!, P.elder[0]!, P.beach[0]!],
  "Insurance Advisory & Claims": [P.signing[0]!, P.house[0]!, P.medical[0]!],
  "Debt, Credit Score & Loan Counseling": [P.tax[1]!, P.savings[2]!, P.shopping[1]!],
  "NRI & Cross-Border Finance": [P.flight[0]!, P.savings[0]!, P.markets[2]!],
  "Crypto & Digital Assets Advisory": P.crypto,

  // Real Estate
  "Architecture, Interior Design & Vastu / Feng Shui": P.interior,
  "Consultants, Agents & Brokers": P.house,
  "Title, Deed & Legal Verification": [P.signing[0]!, P.house[0]!, P.justice[2]!],
  "Independent Property Valuation": [P.house[1]!, P.house[2]!, P.city[0]!],
  "Home Inspection & Construction Quality": P.construction,
  "Property Management & Rental Advisory": P.apartment,
  "Real Estate Investment & Financing": [P.city[0]!, P.house[2]!, P.markets[2]!],

  // Immigration, Visa & Relocation Consultancy
  "Student Visa & Study Abroad Counseling": [...P.campus, P.flight[2]!],
  "Work Visa & Skilled Migration": [P.flight[0]!, P.office[0]!, P.flight[3]!],
  "Permanent Residency & Citizenship": [P.flight[1]!, P.house[0]!, P.signing[2]!],
  "Family, Spouse & Dependent Visas": [P.family[0]!, P.flight[2]!, P.family[1]!],
  "Investor, Business & Golden Visas": [P.city[0]!, P.flight[3]!, P.markets[2]!],
  "Relocation & Settlement Services": [P.apartment[2]!, P.house[0]!, P.flight[0]!],
  "Tourist, Visit & Digital Nomad Visas": [...P.nomad, P.travel[0]!],

  // IP & Patent Law Advisory
  "Patent Search & Patentability": P.research,
  "Patent Drafting, Filing & Prosecution": [P.signing[0]!, P.research[0]!, P.engineering[0]!],
  "Trademark Search & Registration": [...P.branding, P.research[2]!],
  "Copyright & Creative Rights": [P.art[0]!, P.writing[0]!, P.camera[0]!],
  "IP Licensing, Infringement & Enforcement": [P.justice[0]!, P.signing[1]!, P.justice[1]!],
  "Industrial Design, Trade Secrets & Software IP": [P.engineering[0]!, P.code[0]!, P.security[0]!],

  // Business
  "Business Coaching & SME Growth": [P.team[0]!, P.store[1]!, P.analytics[1]!],
  "Startup Coaching & Mentoring": [P.office[1]!, P.team[1]!, P.team[3]!],
  "Fundraising & Investor Readiness": [P.team[2]!, P.markets[2]!, P.savings[0]!],
  "Digital Marketing & Growth": [...P.marketing, P.analytics[0]!],
  "Sales & Business Development": [P.handshake[0]!, P.team[2]!, P.analytics[1]!],
  "Branding, PR & Communications": [...P.branding, P.mic[0]!],
  "Operations, Supply Chain & Process Improvement": P.logistics,
  "HR, Hiring & People Operations": [P.handshake[0]!, P.interview[0]!, P.team[0]!],
  "E-commerce & D2C Brands": P.shopping,
  "Franchise & Small Business Setup": P.store,

  // Career Coaching & Mock Interviews
  "Mock Interviews & Interview Preparation": P.interview,
  "Resume, LinkedIn & Personal Branding": [P.resume[0]!, P.professional[0]!],
  "Career Transition & Guidance": [P.professional[0]!, P.interview[1]!, P.office[0]!],
  "Leadership & Executive Coaching": [P.team[2]!, P.conference[2]!, P.team[3]!],
  "Salary Negotiation & Offer Evaluation": [P.handshake[0]!, P.signing[1]!, P.tax[1]!],
  "Campus Placement & Early Career": [...P.campus, P.interview[1]!],

  // Spiritual & Puja Services
  "Puja, Havan & Ritual Booking": [P.temple[0]!, P.meditation[1]!],
  "Astrology & Horoscope Consultation": P.stars,
  "Numerology, Tarot & Palmistry": [P.stars[1]!, P.stars[2]!, P.stars[0]!],
  "Meditation, Spiritual Healing & Energy Work": P.meditation,
  "Multi-faith Ceremonies & Officiants": [P.temple[0]!, P.wedding[1]!, P.wedding[2]!],

  // B2B Strategy & Expert Networks
  "Industry Expert Calls": [P.team[3]!, P.conference[1]!, P.team[2]!],
  "Market Entry & Regulatory Strategy": [P.analytics[0]!, P.city[0]!, P.team[3]!],
  "Due Diligence & Investment Research": [P.markets[0]!, P.analytics[0]!, P.research[2]!],
  "Technology & Digital Transformation Advisory": [P.servers[0]!, P.ai[0]!, P.techTeam[0]!],
  "Supply Chain & Manufacturing Expertise": [...P.logistics, P.engineering[0]!],
  "ESG & Sustainability Advisory": P.energy,
  "Healthcare & Life Sciences Expertise": [...P.lab, P.medical[2]!],

  // Events
  "Wedding Planning & Consultancy": P.wedding,
  "Corporate Events & Conferences": P.conference,
  "Birthday & Private Party Planning": P.party,
  "Event Decor, Design & Production": [P.decor[0]!, P.wedding[0]!, P.concert[1]!],
  "Entertainment, Artists & Emcees": P.concert,
  "Catering & Menu Consultancy": P.catering,
  "Event Photography & Videography": P.camera,

  // Travel
  "Custom Itinerary & Trip Planning": P.travel,
  "Destination Experts & Local Guides": [P.landmark[0]!, P.travel[1]!, P.travel[2]!],
  "Luxury & Honeymoon Travel": P.beach,
  "Pilgrimage & Spiritual Tours": [P.temple[0]!, P.landmark[0]!, P.meditation[1]!],
  "Adventure & Expedition Travel": [...P.mountains, P.travel[2]!],
  "Business & Corporate Travel": [P.flight[0]!, P.flight[2]!, P.nomad[1]!],
  "Medical Tourism": [P.medical[3]!, P.medical[2]!, P.flight[1]!],
  "Budget Travel, Points & Miles": [...P.backpacking, P.travel[0]!],

  // Software and Tech
  "Software Development & Code Review": P.code,
  "Cloud, DevOps & Infrastructure": P.servers,
  "AI, Machine Learning & Data Science": [...P.ai, P.analytics[0]!],
  "Cybersecurity": P.security,
  "Product Management & UX/UI Design": [...P.design, P.techTeam[0]!],
  "No-code, Website & App Building": P.web,
  "Tech Support & IT Troubleshooting": [...P.hardware, P.servers[1]!],
  "Blockchain & Web3 Development": [P.crypto[2]!, P.crypto[3]!, P.crypto[0]!],
  "Fractional CTO & Tech Architecture": [P.techTeam[0]!, P.code[2]!, P.servers[0]!],

  // Education & Tutoring
  "K-12 Tutoring & Homework Help": [...P.school, P.study[0]!],
  "Competitive & Entrance Exam Prep": P.study,
  "Study Abroad Test Prep (IELTS, GRE, GMAT, SAT)": [P.study[2]!, P.campus[1]!, P.study[1]!],
  "Language Learning": P.books,
  "College Admissions & Academic Counseling": [...P.campus, P.books[1]!],
  "Music, Arts & Hobby Lessons": [...P.music, P.art[0]!],
  "Special Education & Learning Differences": [...P.kids, P.school[1]!],

  // Relationships, Parenting & Family
  "Relationship & Couples Coaching": P.couple,
  "Dating & Matchmaking": [P.couple[2]!, P.couple[0]!, P.couple[1]!],
  "Parenting & Child Development": [...P.kids, P.family[1]!],
  "Divorce, Separation & Co-parenting Support": [P.family[1]!, P.signing[0]!, P.mind[2]!],

  // Pets & Veterinary
  "Online Vet Consultation": P.vet,
  "Pet Training & Behavior": P.dogs,
  "Pet Nutrition, Grooming & Care": [P.grooming[0]!, P.cats[0]!, P.pets[0]!],
  "Pet Relocation, Adoption & Travel": [P.pets[0]!, P.vet[1]!, P.dogs[1]!],

  // Beauty, Fashion & Personal Styling
  "Personal Styling & Wardrobe Consulting": P.fashion,
  "Skincare, Haircare & Makeup Consultation": [...P.makeup, P.salon[0]!, P.wellnessOils[0]!],
  "Image Consulting, Grooming & Etiquette": [P.professional[0]!, P.salon[0]!, P.fashion[1]!],
  "Bridal & Occasion Styling": [P.wedding[2]!, P.makeup[0]!, P.wedding[1]!],

  // Creative, Media & Content Creation
  "Content Creator & Influencer Coaching": [...P.creator, P.camera[2]!],
  "Writing, Editing & Publishing": [...P.writing, P.books[1]!],
  "Photography & Video Production Coaching": P.camera,
  "Music Production, Podcasting & Audio": P.studio,
  "Public Speaking, Voice & Communication Coaching": [...P.mic, P.conference[0]!],
};

/** Used when a community's subcategory isn't in the table above. */
const BY_CATEGORY: Record<string, string[]> = {
  "Health & Wellness": [...P.meditation, ...P.medical],
  "Legal & Compliance": P.justice,
  "Financial Advisory & Wealth Coaching": [...P.savings, ...P.markets],
  "Real Estate": P.house,
  "Immigration, Visa & Relocation Consultancy": P.flight,
  "IP & Patent Law Advisory": P.research,
  Business: P.team,
  "Career Coaching & Mock Interviews": P.interview,
  "Spiritual & Puja Services": [...P.meditation, P.temple[0]!],
  "B2B Strategy & Expert Networks": [...P.team, ...P.analytics],
  Events: [...P.party, ...P.conference],
  Travel: P.travel,
  "Software and Tech": P.code,
  "Education & Tutoring": [...P.school, ...P.study],
  "Relationships, Parenting & Family": P.family,
  "Pets & Veterinary": P.pets,
  "Beauty, Fashion & Personal Styling": [...P.makeup, ...P.fashion],
  "Creative, Media & Content Creation": [...P.camera, ...P.studio],
};

/** Name keywords that beat the subcategory pick, e.g. a "Cat Parents Club" gets a cat. */
const BY_KEYWORD: [RegExp, string[]][] = [
  [/\bcats?\b|kitten/i, P.cats],
  [/\bdogs?\b|pupp(y|ies)|canine/i, P.dogs],
  [/\byoga\b/i, P.yoga],
  [/\bmeditat/i, P.meditation],
  [/\bgym\b|fitness|workout/i, P.workout],
  [/wedding|bridal|\bbrides?\b/i, P.wedding],
  [/crypto|bitcoin|web3|blockchain|\bdefi\b|\bnft/i, P.crypto],
  [/\bai\b|machine learning|\bml\b|\bllm/i, P.ai],
  [/astrolog|horoscope|\bzodiac/i, P.stars],
  [/podcast/i, P.studio],
  [/photograph/i, P.camera],
];

const FALLBACK = [...P.team, ...P.travel, ...P.meditation];

const DESCRIPTION_PATTERN = /a community for (.+) on Xivago \((.+)\)\.$/;

/** Topic ("Mental Health & Emotional Wellness") and category ("Health & Wellness") parsed from a seeded description. */
export function parseCommunityTopic(description: string | null | undefined) {
  const m = description?.match(DESCRIPTION_PATTERN);
  return m ? { subcategory: m[1]!, category: m[2]! } : null;
}

/** Small stable hash so the same community always gets the same photo. */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Picks a topic-matching cover URL for a community.
 * `indexInGroup` (position among communities of the same subcategory) spreads
 * neighbours across the pool so a list doesn't repeat the same photo back-to-back;
 * without it a hash of the slug is used.
 */
export function coverImageFor(c: { name: string; slug: string; description?: string | null }, indexInGroup?: number) {
  const topic = parseCommunityTopic(c.description);
  const pool =
    BY_KEYWORD.find(([re]) => re.test(c.name))?.[1] ??
    (topic && (BY_SUBCATEGORY[topic.subcategory] ?? BY_CATEGORY[topic.category])) ??
    FALLBACK;
  const i = indexInGroup ?? hash(c.slug);
  return unsplash(pool[i % pool.length]!);
}

/** Covers for a batch, rotating through each subcategory's photos in list order. */
export function assignCoverImages<T extends { name: string; slug: string; description?: string | null }>(communities: T[]) {
  const seen = new Map<string, number>();
  return communities.map((c) => {
    const group = parseCommunityTopic(c.description)?.subcategory ?? "";
    const n = seen.get(group) ?? 0;
    seen.set(group, n + 1);
    return { ...c, coverImage: coverImageFor(c, n) };
  });
}
