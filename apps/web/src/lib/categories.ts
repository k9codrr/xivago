import taxonomyData from "./categories.data.json";

// export interface SubCategorySpec {
//   id: string;
//   name: string;
//   subtitle: string;
//   topSkills: string[];
//   requiredInputs: { label: string; options: string[] }[];
//   rates: {
//     hourlyUSD: string;
//     fixedUSD: string;
//     hourlyINR: string;
//     fixedINR: string;
//   };
// }

// export interface ParentCategorySpec {
//   id: string;
//   name: string;
//   subCategories: SubCategorySpec[];
// }

// export const CATEGORIES_DATA: ParentCategorySpec[] = [
//   {
//     id: "1",
//     name: "Compliance",
//     subCategories: [
//       {
//         id: "1.1",
//         name: "Corporate & Entity Formation",
//         subtitle: "Legal entity setup equity structuring & corporate governance",
//         topSkills: ["Corporate Law", "Entity Incorporation", "Cap Table Advisory", "Term Sheets", "Founder Agreements"],
//         requiredInputs: [
//           { label: "Supported Entities", options: ["Delaware C-Corp", "Pvt Ltd", "LLC", "Cayman SPC"] },
//           { label: "Cap Table Software", options: ["Carta", "Pulley"] },
//           { label: "Specializations", options: ["SAFE Notes", "Series A-C", "Founder Vesting"] },
//         ],
//         rates: {
//           hourlyUSD: "$35 – $90/hr",
//           fixedUSD: "$500 – $3,500",
//           hourlyINR: "₹2,800 – ₹7,500/hr",
//           fixedINR: "₹40,000 – ₹300,000",
//         },
//       },
//       {
//         id: "1.2",
//         name: "Tax & Financial Advisory",
//         subtitle: "Tax planning accounting compliance & cross-border advisory",
//         topSkills: ["Fractional CFO", "Tax Advisory & Audit Prep", "Cross-Border Taxes", "Financial Compliance"],
//         requiredInputs: [
//           { label: "Accounting Certifications", options: ["CPA", "CA", "ACCA", "CFA"] },
//           { label: "ERP/Software", options: ["QuickBooks", "Xero", "NetSuite"] },
//           { label: "Specializations", options: ["Transfer Pricing", "R&D Tax Credits", "Audit Prep", "Fractional CFO"] },
//         ],
//         rates: {
//           hourlyUSD: "$40 – $120/hr",
//           fixedUSD: "$1,000 – $6,000",
//           hourlyINR: "₹3,300 – ₹10,000/hr",
//           fixedINR: "₹80,000 – ₹500,000",
//         },
//       },
//       {
//         id: "1.3",
//         name: "IP & Regulatory Compliance",
//         subtitle: "Intellectual property data privacy & regulatory frameworks",
//         topSkills: ["Patents & Trademarks", "GDPR/SOC2/HIPAA Compliance", "Copyright Law", "Data Protection"],
//         requiredInputs: [
//           { label: "Regulatory Frameworks", options: ["SOC 2", "GDPR", "HIPAA", "ISO 27001"] },
//           { label: "IP Capabilities", options: ["USPTO", "WIPO", "EPO"] },
//           { label: "Templates Portfolio", options: ["NDAs", "MSAs", "SLAs"] },
//         ],
//         rates: {
//           hourlyUSD: "$45 – $110/hr",
//           fixedUSD: "$800 – $4,500",
//           hourlyINR: "₹3,700 – ₹9,000/hr",
//           fixedINR: "₹65,000 – ₹375,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "2",
//     name: "Tech & AI",
//     subCategories: [
//       {
//         id: "2.1",
//         name: "Software & Mobile Engineering",
//         subtitle: "Custom full-stack web platforms iOS and Android applications",
//         topSkills: ["Full-Stack Web Dev", "iOS & Android Apps", "React/Node/Python", "API Engineering"],
//         requiredInputs: [
//           { label: "Frontend", options: ["React", "Next.js", "Vue", "Webflow"] },
//           { label: "Backend", options: ["Node.js", "Python/FastAPI", "Go", "Java"] },
//           { label: "Mobile", options: ["React Native", "Flutter", "Swift", "Kotlin"] },
//           { label: "API Protocols", options: ["REST", "GraphQL", "gRPC"] },
//         ],
//         rates: {
//           hourlyUSD: "$25 – $65/hr",
//           fixedUSD: "$2,000 – $15,000",
//           hourlyINR: "₹2,000 – ₹5,500/hr",
//           fixedINR: "₹160,000 – ₹1,250,000",
//         },
//       },
//       {
//         id: "2.2",
//         name: "AI & Machine Learning Systems",
//         subtitle: "LLMs agentic workflows & custom AI model integrations",
//         topSkills: ["Custom LLMs & AI Agents", "LangChain/LlamaIndex", "Vector Databases", "Fine-Tuning"],
//         requiredInputs: [
//           { label: "LLM Frameworks", options: ["LangChain", "LlamaIndex", "Haystack"] },
//           { label: "Vector DBs", options: ["Pinecone", "Qdrant", "Weaviate"] },
//           { label: "Fine-Tuning", options: ["Llama 3", "Mistral", "LoRA", "Unsloth"] },
//           { label: "Agents", options: ["AutoGPT", "CrewAI", "LangGraph"] },
//         ],
//         rates: {
//           hourlyUSD: "$45 – $110/hr",
//           fixedUSD: "$3,500 – $25,000",
//           hourlyINR: "₹3,700 – ₹9,000/hr",
//           fixedINR: "₹300,000 – ₹2,000,000",
//         },
//       },
//       {
//         id: "2.3",
//         name: "Cloud Infrastructure & Security",
//         subtitle: "DevOps cloud hosting architecture & cybersecurity audits",
//         topSkills: ["AWS/GCP/Azure Architecture", "DevOps & CI/CD", "Penetration Testing", "Security Audits"],
//         requiredInputs: [
//           { label: "IaC Tools", options: ["Terraform", "CloudFormation", "Ansible"] },
//           { label: "CI/CD", options: ["GitHub Actions", "GitLab CI", "Jenkins"] },
//           { label: "Security Tools", options: ["Burp Suite", "Datadog", "Snyk"] },
//           { label: "Certifications", options: ["OSCP", "CEH", "AWS Security"] },
//         ],
//         rates: {
//           hourlyUSD: "$35 – $85/hr",
//           fixedUSD: "$1,500 – $10,000",
//           hourlyINR: "₹2,800 – ₹7,000/hr",
//           fixedINR: "₹125,000 – ₹800,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "3",
//     name: "Brand & Design",
//     subCategories: [
//       {
//         id: "3.1",
//         name: "UI/UX & Product Design",
//         subtitle: "Digital product interfaces design systems & user research",
//         topSkills: ["UI/UX Systems (Figma)", "Design Systems", "User Research", "Prototyping"],
//         requiredInputs: [
//           { label: "UI/UX Tools", options: ["Figma", "Framer", "Principle", "Rive"] },
//           { label: "Design Systems", options: ["Tailwind UI", "Material Design", "Tokens"] },
//           { label: "Methodologies", options: ["Usability Testing", "Heatmaps", "Journey Mapping"] },
//         ],
//         rates: {
//           hourlyUSD: "$25 – $60/hr",
//           fixedUSD: "$1,200 – $8,000",
//           hourlyINR: "₹2,000 – ₹5,000/hr",
//           fixedINR: "₹100,000 – ₹650,000",
//         },
//       },
//       {
//         id: "3.2",
//         name: "Brand Identity & Visuals",
//         subtitle: "Logo design visual branding & generative AI assets",
//         topSkills: ["Brand Identity & Logos", "Generative AI Visuals", "Brand Strategy", "3D Rendering"],
//         requiredInputs: [
//           { label: "Generative AI Tools", options: ["Midjourney v6", "Stable Diffusion XL", "ComfyUI", "Flux"] },
//           { label: "3D Software", options: ["Blender", "Cinema 4D", "Unreal Engine"] },
//           { label: "Deliverables", options: ["Brand Guidelines", "Vector Logos", "Typography"] },
//         ],
//         rates: {
//           hourlyUSD: "$20 – $55/hr",
//           fixedUSD: "$800 – $5,000",
//           hourlyINR: "₹1,600 – ₹4,500/hr",
//           fixedINR: "₹65,000 – ₹400,000",
//         },
//       },
//       {
//         id: "3.3",
//         name: "Media & Video Production",
//         subtitle: "Commercial video production motion graphics & pitch decks",
//         topSkills: ["Commercial Video Production", "Motion Design", "Pitch Decks", "CGI Ads"],
//         requiredInputs: [
//           { label: "Video/Motion Stacks", options: ["After Effects", "Premiere", "DaVinci", "Runway Gen-2"] },
//           { label: "Audio Tools", options: ["Pro Tools", "Logic Pro", "ElevenLabs"] },
//           { label: "Deliverables", options: ["3D CGI Ads", "Trailers", "CTV Commercials", "Pitch Decks"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $75/hr",
//           fixedUSD: "$1,500 – $12,000",
//           hourlyINR: "₹2,500 – ₹6,200/hr",
//           fixedINR: "₹125,000 – ₹1,000,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "4",
//     name: "Growth & Revenue",
//     subCategories: [
//       {
//         id: "4.1",
//         name: "Search & Generative Optimization",
//         subtitle: "GEO AEO and programmatic search engines visibility",
//         topSkills: ["Generative Engine Optimization (GEO/AEO)", "Programmatic SEO", "AI Content Strategy"],
//         requiredInputs: [
//           { label: "GEO/AEO Tooling", options: ["Perplexity API", "ChatGPT Plugins", "Profound", "Otterly.ai"] },
//           { label: "Programmatic SEO Engines", options: ["Webflow CMS + Make", "Custom Python"] },
//           { label: "SEO Tools", options: ["Ahrefs", "Semrush", "Screaming Frog"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $80/hr",
//           fixedUSD: "$1,500 – $9,000",
//           hourlyINR: "₹2,500 – ₹6,600/hr",
//           fixedINR: "₹125,000 – ₹750,000",
//         },
//       },
//       {
//         id: "4.2",
//         name: "Sales & Outbound Automation",
//         subtitle: "Automated lead generation cold email & CRM pipelines",
//         topSkills: ["B2B Lead Generation", "Cold Email Systems", "CRM Automation", "Sales Engineering"],
//         requiredInputs: [
//           { label: "Cold Email Stacks", options: ["Instantly", "Smartlead", "Clay.com", "Lemlist"] },
//           { label: "Data Providers", options: ["Apollo.io", "ZoomInfo", "Lusha"] },
//           { label: "CRM Platforms", options: ["HubSpot", "Salesforce", "Pipedrive", "GoHighLevel"] },
//         ],
//         rates: {
//           hourlyUSD: "$25 – $65/hr",
//           fixedUSD: "$1,000 – $6,000",
//           hourlyINR: "₹2,000 – ₹5,500/hr",
//           fixedINR: "₹80,000 – ₹500,000",
//         },
//       },
//       {
//         id: "4.3",
//         name: "Performance Marketing & Paid Ads",
//         subtitle: "Paid acquisition across digital social & offline media",
//         topSkills: ["Meta/Google/LinkedIn Ads", "DOOH & Billboard Ads", "Direct Mail", "Performance Marketing"],
//         requiredInputs: [
//           { label: "Ad Networks", options: ["Meta Ads", "Google PPC", "LinkedIn Campaign Mgr", "TikTok Ads", "DOOH"] },
//           { label: "Attribution Software", options: ["Triple Whale", "Northbeam", "Hyros"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $75/hr",
//           fixedUSD: "$1,200 – $8,000/mo",
//           hourlyINR: "₹2,500 – ₹6,200/hr",
//           fixedINR: "₹100,000 – ₹650,000/mo",
//         },
//       },
//       {
//         id: "4.4",
//         name: "PR & Earned Media",
//         subtitle: "Media placements press releases & thought leadership",
//         topSkills: ["Press Release Distribution", "Media Pitching", "Crisis PR", "Executive Ghostwriting"],
//         requiredInputs: [
//           { label: "Distribution Networks", options: ["PR Newswire", "Business Wire", "HARO/Connectively"] },
//           { label: "Media Tier Placements", options: ["TechCrunch", "Forbes", "Bloomberg", "WSJ"] },
//           { label: "Media List Size", options: ["1,000-5,000 Contacts", "5,000-25,000 Contacts", "Global Press Network"] },
//         ],
//         rates: {
//           hourlyUSD: "$35 – $90/hr",
//           fixedUSD: "$1,500 – $10,000",
//           hourlyINR: "₹2,800 – ₹7,500/hr",
//           fixedINR: "₹125,000 – ₹800,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "5",
//     name: "Operations",
//     subCategories: [
//       {
//         id: "5.1",
//         name: "Workflow & AI Automation",
//         subtitle: "No-code business automation voice AI & process optimization",
//         topSkills: ["Zapier/Make Automation", "Voice AI Agents (Bland/Vapi)", "Workflow Optimization"],
//         requiredInputs: [
//           { label: "No-Code Engines", options: ["Zapier", "Make.com", "n8n"] },
//           { label: "Voice AI Platforms", options: ["Bland.ai", "Vapi.ai", "Retell AI"] },
//           { label: "Database Tools", options: ["Airtable", "Supabase", "Retool"] },
//         ],
//         rates: {
//           hourlyUSD: "$25 – $60/hr",
//           fixedUSD: "$800 – $5,000",
//           hourlyINR: "₹2,000 – ₹5,000/hr",
//           fixedINR: "₹65,000 – ₹400,000",
//         },
//       },
//       {
//         id: "5.2",
//         name: "Global Workforce & HR",
//         subtitle: "Global payroll HR compliance & virtual assistant networks",
//         topSkills: ["Fractional COO", "Virtual Assistant Networks", "Global Payroll & HR", "Talent Ops"],
//         requiredInputs: [
//           { label: "Global EOR/PEO Platforms", options: ["Deel", "Remote.com", "Rippling"] },
//           { label: "HR Regions", options: ["US 1099/W2", "EU Labour Law", "India Shops & Est"] },
//           { label: "Capabilities", options: ["Sourcing", "Vetting", "Onboarding"] },
//         ],
//         rates: {
//           hourlyUSD: "$20 – $55/hr",
//           fixedUSD: "$1,000 – $6,000/mo",
//           hourlyINR: "₹1,600 – ₹4,500/hr",
//           fixedINR: "₹80,000 – ₹500,000/mo",
//         },
//       },
//       {
//         id: "5.3",
//         name: "Events & Corporate Advisory",
//         subtitle: "Executive roundtables trade shows M&A & strategic growth",
//         topSkills: ["Trade Show Design", "VIP Executive Dinners", "M&A Advisory", "Investor Relations"],
//         requiredInputs: [
//           { label: "Trade Show Budget Managed", options: ["<$50k", "$50k-$250k", "$250k+"] },
//           { label: "Virtual Event Platforms", options: ["Airmeet", "Hopin", "Zoom Events"] },
//           { label: "M&A/IR Experience", options: ["Data Room Mgmt", "Pitch Deck Strategy", "Cap Table Cleaning"] },
//         ],
//         rates: {
//           hourlyUSD: "$40 – $110/hr",
//           fixedUSD: "$2,500 – $15,000",
//           hourlyINR: "₹3,300 – ₹9,000/hr",
//           fixedINR: "₹200,000 – ₹1,250,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "6",
//     name: "Creator",
//     subCategories: [
//       {
//         id: "6.1",
//         name: "Digital Product & Newsletter Ops",
//         subtitle: "Monetize digital media paid newsletters & digital downloads",
//         topSkills: ["Substack/Beehiiv Ops", "Paid Community Design", "Digital Course Production", "Funnel Design"],
//         requiredInputs: [
//           { label: "Newsletter Platforms", options: ["Beehiiv", "Substack", "ConvertKit"] },
//           { label: "Community Platforms", options: ["Circle.so", "Skool", "Discord", "Slack"] },
//           { label: "Course Hosting", options: ["Kajabi", "Teachable", "Maven"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $70/hr",
//           fixedUSD: "$1,000 – $6,000",
//           hourlyINR: "₹2,500 – ₹5,800/hr",
//           fixedINR: "₹80,000 – ₹500,000",
//         },
//       },
//       {
//         id: "6.2",
//         name: "Sponsorship & Partnership Mgmt",
//         subtitle: "Brand sponsorship deals affiliate networks & strategic alliances",
//         topSkills: ["Brand Deal Negotiation", "Affiliate Program Setup", "Co-Marketing Alliances", "Ad Sales"],
//         requiredInputs: [
//           { label: "Brand Deal CRM", options: ["HubSpot", "Attio", "AirTable", "Custom Sheet"] },
//           { label: "Average Sponsorship CPM", options: ["$15-$30 CPM", "$30-$60 CPM", "$60+ Premium CPM"] },
//           { label: "Affiliate Networks", options: ["PartnerStack", "Impact", "CJ Affiliate"] },
//         ],
//         rates: {
//           hourlyUSD: "$35 – $85/hr",
//           fixedUSD: "$1,500 – $8,000",
//           hourlyINR: "₹2,800 – ₹7,000/hr",
//           fixedINR: "₹125,000 – ₹650,000",
//         },
//       },
//       {
//         id: "6.3",
//         name: "Influencer Marketing & UGC Campaigns",
//         subtitle: "Connect brands with B2B thought leaders B2C influencers and UGC video creators",
//         topSkills: ["B2B LinkedIn Thought Leadership", "Tech Product Reviews", "UGC Video Ads", "Sponsored Content", "Brand Ambassadorships"],
//         requiredInputs: [
//           { label: "Primary Niche", options: ["B2B Tech / SaaS", "FinTech / Wealth", "DTC / Fashion", "Fitness / Health", "Real Estate"] },
//           { label: "Social Channels", options: ["LinkedIn", "YouTube", "Instagram", "X (Twitter)"] },
//           { label: "Deliverable Types", options: ["Dedicated Video", "Integrated Reel/Short", "LinkedIn Post", "Newsletter Slot", "UGC Raw Footage"] },
//           { label: "Usage Rights Terms", options: ["Organic Only", "30-Day Paid Ad Rights", "Perpetual Commercial Rights"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $120/hr",
//           fixedUSD: "$300 – $5,000 / campaign",
//           hourlyINR: "₹2,500 – ₹10,000/hr",
//           fixedINR: "₹25,000 – ₹400,000 / campaign",
//         },
//       },
//     ],
//   },
//   {
//     id: "7",
//     name: "Local & Global",
//     subCategories: [
//       {
//         id: "7.1",
//         name: "Cross-Border Localization & Culturalization",
//         subtitle: "Translate adapt and culturally optimize products for international markets",
//         topSkills: ["App & Website Localization", "Cross-Cultural UX", "Multilingual Copy", "Transcreation"],
//         requiredInputs: [
//           { label: "Native Languages", options: ["English", "Spanish", "German", "French", "Mandarin", "Hindi", "Japanese", "Arabic"] },
//           { label: "CAT Tools", options: ["Lokalise", "Phrase", "Crowdin"] },
//           { label: "Culturalization Scope", options: ["App UI", "Marketing Landing", "Legal & T&C", "Customer Support"] },
//         ],
//         rates: {
//           hourlyUSD: "$20 – $50/hr",
//           fixedUSD: "$500 – $4,000",
//           hourlyINR: "₹1,600 – ₹4,000/hr",
//           fixedINR: "₹40,000 – ₹320,000",
//         },
//       },
//       {
//         id: "7.2",
//         name: "Global Payment & Tax Rails",
//         subtitle: "Set up international merchant accounts payout rails & compliance",
//         topSkills: ["Stripe/Wise/Merchant Account Config", "Global VAT/GST Compliance", "Localized Checkout"],
//         requiredInputs: [
//           { label: "Payment Gateways", options: ["Stripe Connect", "Wise", "Adyen", "PayPal"] },
//           { label: "Tax Platforms", options: ["TaxJar", "Avalara", "Lemon Squeezy", "Paddle"] },
//           { label: "Target Currencies", options: ["USD", "EUR", "GBP", "INR", "AED", "SGD"] },
//         ],
//         rates: {
//           hourlyUSD: "$35 – $85/hr",
//           fixedUSD: "$1,200 – $7,000",
//           hourlyINR: "₹2,800 – ₹7,000/hr",
//           fixedINR: "₹100,000 – ₹580,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "8",
//     name: "Customers",
//     subCategories: [
//       {
//         id: "8.1",
//         name: "Customer Success & Onboarding Systems",
//         subtitle: "Reduce churn scale customer support & build onboarding flows",
//         topSkills: ["Gainsight/HubSpot CS Setup", "Churn Reduction Strategy", "Onboarding Workflows", "Support QA"],
//         requiredInputs: [
//           { label: "CS Tools", options: ["Gainsight", "ChurnZero", "Vitally", "HubSpot CS"] },
//           { label: "Onboarding Software", options: ["Appcues", "Userpilot", "Chameleon"] },
//           { label: "Ticket Ops", options: ["Zendesk", "Intercom", "Freshdesk"] },
//         ],
//         rates: {
//           hourlyUSD: "$20 – $55/hr",
//           fixedUSD: "$800 – $5,000",
//           hourlyINR: "₹1,600 – ₹4,500/hr",
//           fixedINR: "₹65,000 – ₹400,000",
//         },
//       },
//       {
//         id: "8.2",
//         name: "Community Management & Moderation",
//         subtitle: "Build engage and moderate high-retention user communities",
//         topSkills: ["Discord/Circle/Slack Community Ops", "Automated Moderation", "Member Engagement", "Event Hosting"],
//         requiredInputs: [
//           { label: "Community Engines", options: ["Discord", "Circle", "Geneva", "Reddit"] },
//           { label: "Moderation Bots", options: ["Mee6", "Custom Python", "Hive Moderation"] },
//           { label: "Event Cadence", options: ["AMAs", "Spaces", "Webinars"] },
//         ],
//         rates: {
//           hourlyUSD: "$18 – $45/hr",
//           fixedUSD: "$600 – $3,500/mo",
//           hourlyINR: "₹1,500 – ₹3,700/hr",
//           fixedINR: "₹50,000 – ₹280,000/mo",
//         },
//       },
//     ],
//   },
//   {
//     id: "9",
//     name: "E-Commerce",
//     subCategories: [
//       {
//         id: "9.1",
//         name: "Headless Commerce & Marketplace Infrastructure",
//         subtitle: "Build scale and optimize online stores & multi-vendor platforms",
//         topSkills: ["Shopify Plus/Headless Commerce", "Marketplace Architecture", "Inventory API Integrations"],
//         requiredInputs: [
//           { label: "Storefront Stacks", options: ["Shopify Plus", "WooCommerce", "Magento", "BigCommerce"] },
//           { label: "Headless Frameworks", options: ["Next.js Commerce", "Hydrogen/Oxygen", "Sanity CMS"] },
//           { label: "Integrations", options: ["ERP Sync", "3PL Shipping", "Multi-Currency"] },
//         ],
//         rates: {
//           hourlyUSD: "$25 – $65/hr",
//           fixedUSD: "$1,500 – $10,000",
//           hourlyINR: "₹2,000 – ₹5,500/hr",
//           fixedINR: "₹125,000 – ₹800,000",
//         },
//       },
//       {
//         id: "9.2",
//         name: "Conversion Rate Optimization & Personalization",
//         subtitle: "Maximize store revenue checkout conversion & personalized UX",
//         topSkills: ["A/B Testing", "Dynamic Personalization (Klaviyo/Rebuy)", "Checkout Optimization"],
//         requiredInputs: [
//           { label: "A/B Testing Tools", options: ["VWO", "Optimizely", "Kameleoon"] },
//           { label: "Personalization Engines", options: ["Klaviyo", "Rebuy", "Nosto", "Attentive"] },
//           { label: "Focus Area", options: ["Checkout Optimization", "Product Detail Page", "Cart Upsells"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $75/hr",
//           fixedUSD: "$1,000 – $6,000",
//           hourlyINR: "₹2,500 – ₹6,200/hr",
//           fixedINR: "₹80,000 – ₹500,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "10",
//     name: "Data & Analytics",
//     subCategories: [
//       {
//         id: "10.1",
//         name: "Data Pipelines & Warehouse Engineering",
//         subtitle: "Centralize company data build pipelines & real-time dashboards",
//         topSkills: ["Snowflake/BigQuery Architecture", "dbt Pipelines", "Looker/Tableau Dashboards"],
//         requiredInputs: [
//           { label: "Data Warehouses", options: ["Snowflake", "BigQuery", "Redshift", "Databricks"] },
//           { label: "Transformation", options: ["dbt", "Fivetran", "Airbyte"] },
//           { label: "Visualization", options: ["Looker", "Tableau", "Power BI", "Metabase"] },
//         ],
//         rates: {
//           hourlyUSD: "$35 – $85/hr",
//           fixedUSD: "$2,000 – $12,000",
//           hourlyINR: "₹2,800 – ₹7,000/hr",
//           fixedINR: "₹160,000 – ₹1,000,000",
//         },
//       },
//       {
//         id: "10.2",
//         name: "Predictive Analytics & Customer LTV Modeling",
//         subtitle: "Forecast business metrics customer lifetime value & churn risks",
//         topSkills: ["Predictive LTV Models", "Churn Modeling", "Product Analytics (Mixpanel/Amplitude)"],
//         requiredInputs: [
//           { label: "Product Analytics", options: ["Mixpanel", "Amplitude", "PostHog"] },
//           { label: "Predictive ML", options: ["Prophet", "Scikit-learn", "XGBoost"] },
//           { label: "Data Privacy Protocols", options: ["HIPAA Compliant", "GDPR Compliant", "Anonymized Analytics"] },
//         ],
//         rates: {
//           hourlyUSD: "$40 – $100/hr",
//           fixedUSD: "$2,500 – $15,000",
//           hourlyINR: "₹3,300 – ₹8,300/hr",
//           fixedINR: "₹200,000 – ₹1,250,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "11",
//     name: "Real Estate",
//     subCategories: [
//       {
//         id: "11.1",
//         name: "Commercial Real Estate & Location Strategy",
//         subtitle: "Site selection commercial lease negotiation and physical office/retail location strategy",
//         topSkills: ["Commercial Lease Negotiation", "Site Selection", "Spatial Analytics", "Retail/Office Footprint Strategy"],
//         requiredInputs: [
//           { label: "CRE Analytics Software", options: ["CoStar", "Reonomy"] },
//           { label: "GIS Mapping Tools", options: ["Esri ArcGIS", "QGIS"] },
//           { label: "Portfolio Scope", options: ["Retail", "Office", "Industrial Warehousing"] },
//         ],
//         rates: {
//           hourlyUSD: "$35 – $90/hr",
//           fixedUSD: "$1,500 – $10,000",
//           hourlyINR: "₹2,800 – ₹7,500/hr",
//           fixedINR: "₹125,000 – ₹800,000",
//         },
//       },
//       {
//         id: "11.2",
//         name: "PropTech & Smart Asset Management",
//         subtitle: "IoT integration tenant portal builds and real estate automated ops",
//         topSkills: ["PropTech Software Setup", "Tenant Portals", "IoT Smart Building Setup", "Facility Automation"],
//         requiredInputs: [
//           { label: "PropTech Stacks", options: ["Yardi", "AppFolio", "Buildium"] },
//           { label: "IoT Protocols", options: ["Zigbee", "Z-Wave", "Modbus"] },
//           { label: "Frameworks", options: ["Tokenized Asset Frameworks", "Smart Building Automation"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $75/hr",
//           fixedUSD: "$1,200 – $8,000",
//           hourlyINR: "₹2,500 – ₹6,200/hr",
//           fixedINR: "₹100,000 – ₹650,000",
//         },
//       },
//     ],
//   },
//   {
//     id: "12",
//     name: "Numerology",
//     subCategories: [
//       {
//         id: "12.1",
//         name: "Business Numerology & Naming Vibrations",
//         subtitle: "Numerical alignment for business titles launching dates and corporate brand positioning",
//         topSkills: ["Chaldean Numerology", "Pythagorean Numerology", "Brand Name Numerical Analysis", "Corporate Identity Timing"],
//         requiredInputs: [
//           { label: "Numerology Systems", options: ["Chaldean", "Pythagorean", "Kabbalah"] },
//           { label: "Deliverables", options: ["Brand Name Audits", "Incorporation Date Selection", "Founder Compatibility Maps"] },
//         ],
//         rates: {
//           hourlyUSD: "$25 – $80/hr",
//           fixedUSD: "$500 – $3,500",
//           hourlyINR: "₹2,000 – ₹6,600/hr",
//           fixedINR: "₹40,000 – ₹300,000",
//         },
//       },
//       {
//         id: "12.2",
//         name: "Esoteric Brand Strategy & Vastu/Feng Shui Ops",
//         subtitle: "Spatial energy alignment corporate identity metaphysics and holistic brand positioning",
//         topSkills: ["Commercial Vastu Shastra", "Feng Shui Office Layouts", "Astrological Launch Timing", "Metaphysical Branding"],
//         requiredInputs: [
//           { label: "Methodology Frameworks", options: ["Vastu", "Feng Shui", "Electional Astrology"] },
//           { label: "Consulting Artifacts", options: ["Floorplan Energy Layouts", "Launch Date Catalogs"] },
//         ],
//         rates: {
//           hourlyUSD: "$30 – $85/hr",
//           fixedUSD: "$600 – $4,500",
//           hourlyINR: "₹2,500 – ₹7,000/hr",
//           fixedINR: "₹50,000 – ₹375,000",
//         },
//       },
//     ],
//   },
// ];

// export function getParentCategoryById(id: string): ParentCategorySpec | undefined {
//   return CATEGORIES_DATA.find((c) => c.id === id);
// }

// export function getSubCategoryById(subId: string): { parent: ParentCategorySpec; sub: SubCategorySpec } | undefined {
//   for (const parent of CATEGORIES_DATA) {
//     const sub = parent.subCategories.find((s) => s.id === subId);
//     if (sub) return { parent, sub };
//   }
//   return undefined;
// }

// Category taxonomy
// Flow: Main Category -> Sub Category -> Provider -> Problem -> Tags
// Each Sub Category also lists the industries it serves.
// IDs: sub "1.4" -> provider "1.4.2" -> problem "1.4.2.1"
// Rates have been removed from the taxonomy.

export interface ProblemSpec {
  id: string;
  title: string;
  tags: string[];
}

export interface ProviderSpec {
  id: string;
  name: string;
  problems: ProblemSpec[];
}

export interface SubCategorySpec {
  id: string;
  name: string;
  subtitle: string;
  industries: string[];
  topSkills: string[];
  requiredInputs: { label: string; options: string[] }[];
  providers: ProviderSpec[];
}

export interface ParentCategorySpec {
  id: string;
  name: string;
  subCategories: SubCategorySpec[];
}

/** One row of the flat Main Category -> Sub Category -> Provider -> Problem -> Tags view */
export interface CategoryFlowRow {
  mainCategoryId: string;
  mainCategory: string;
  subCategoryId: string;
  subCategory: string;
  providerId: string;
  provider: string;
  problemId: string;
  problem: string;
  tags: string[];
  industries: string[];
}

interface RawProvider {
  id: string;
  name: string;
  /** Solves the sub category's shared problems (workbook rows state problems per sub category). */
  shared: boolean;
  own: ProblemSpec[];
}

interface RawSubCategory extends Omit<SubCategorySpec, "providers"> {
  shared: Omit<ProblemSpec, "id">[];
  providers: RawProvider[];
}

interface RawTaxonomy {
  mains: { id: string; name: string; subs: RawSubCategory[] }[];
  aliases: Record<string, string>;
}

// Generated by scripts/category-import/generate.py -- edit the workbook, not the JSON.
const taxonomy = taxonomyData as unknown as RawTaxonomy;

export const CATEGORIES_DATA: ParentCategorySpec[] = taxonomy.mains.map((main) => ({
  id: main.id,
  name: main.name,
  subCategories: main.subs.map(({ shared, providers, ...sub }) => ({
    ...sub,
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      problems: [
        ...(provider.shared ? shared.map((p, i) => ({ id: `${provider.id}.${i + 1}`, ...p })) : []),
        ...provider.own,
      ],
    })),
  })),
}));

/**
 * Maps an id from the previous taxonomy to its current id. Demands, profiles
 * and links saved before the workbook import still resolve through this.
 */
export function resolveCategoryId(id: string): string {
  return taxonomy.aliases[id] ?? id;
}

/** Every retired id -> current id, for the one-off stored-data migration. */
export const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, string>> = taxonomy.aliases;

export function getParentCategoryById(id: string): ParentCategorySpec | undefined {
  const current = resolveCategoryId(id);
  return CATEGORIES_DATA.find((c) => c.id === current);
}

export function getSubCategoryById(subId: string): { parent: ParentCategorySpec; sub: SubCategorySpec } | undefined {
  const id = resolveCategoryId(subId);
  for (const parent of CATEGORIES_DATA) {
    const sub = parent.subCategories.find((s) => s.id === id);
    if (sub) return { parent, sub };
  }
  return undefined;
}

export function getProviderById(
  providerId: string,
): { parent: ParentCategorySpec; sub: SubCategorySpec; provider: ProviderSpec } | undefined {
  const id = resolveCategoryId(providerId);
  for (const parent of CATEGORIES_DATA) {
    for (const sub of parent.subCategories) {
      const provider = sub.providers.find((p) => p.id === id);
      if (provider) return { parent, sub, provider };
    }
  }
  return undefined;
}

export function getProblemById(
  problemId: string,
): { parent: ParentCategorySpec; sub: SubCategorySpec; provider: ProviderSpec; problem: ProblemSpec } | undefined {
  const id = resolveCategoryId(problemId);
  for (const parent of CATEGORIES_DATA) {
    for (const sub of parent.subCategories) {
      for (const provider of sub.providers) {
        const problem = provider.problems.find((q) => q.id === id);
        if (problem) return { parent, sub, provider, problem };
      }
    }
  }
  return undefined;
}

/** Flattens the tree into Main Category -> Sub Category -> Provider -> Problem -> Tags rows */
export function getCategoryFlowRows(): CategoryFlowRow[] {
  const rows: CategoryFlowRow[] = [];
  for (const parent of CATEGORIES_DATA) {
    for (const sub of parent.subCategories) {
      for (const provider of sub.providers) {
        for (const problem of provider.problems) {
          rows.push({
            mainCategoryId: parent.id,
            mainCategory: parent.name,
            subCategoryId: sub.id,
            subCategory: sub.name,
            providerId: provider.id,
            provider: provider.name,
            problemId: problem.id,
            problem: problem.title,
            tags: problem.tags,
            industries: sub.industries,
          });
        }
      }
    }
  }
  return rows;
}

export function getAllTags(): string[] {
  return Array.from(new Set(getCategoryFlowRows().flatMap((r) => r.tags))).sort();
}

export function getAllIndustries(): string[] {
  return Array.from(new Set(CATEGORIES_DATA.flatMap((c) => c.subCategories.flatMap((s) => s.industries)))).sort();
}

export function getSubCategoriesByIndustry(industry: string): { parent: ParentCategorySpec; sub: SubCategorySpec }[] {
  const q = industry.toLowerCase();
  return CATEGORIES_DATA.flatMap((parent) =>
    parent.subCategories.filter((s) => s.industries.some((i) => i.toLowerCase() === q)).map((sub) => ({ parent, sub })),
  );
}

export function getRowsByTag(tag: string): CategoryFlowRow[] {
  const q = tag.toLowerCase().replace(/-/g, " ");
  return getCategoryFlowRows().filter((r) => r.tags.includes(q));
}

/** Free-text search across category, sub category, provider, problem, tags and industries */
export function searchCategoryFlow(query: string): CategoryFlowRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getCategoryFlowRows().filter((r) =>
    [r.mainCategory, r.subCategory, r.provider, r.problem, ...r.tags, ...r.industries].some((f) => f.toLowerCase().includes(q)),
  );
}