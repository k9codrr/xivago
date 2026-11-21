"""
Regenerates the category data from the Xivago category workbook.

    python apps/web/scripts/category-import/generate.py

The workbook is the source of truth. Anything from the previous taxonomy
(legacy-categories.json) that resembles a workbook sub category is merged into
it (see MERGE); anything genuinely additional is kept (see MOVE / KEEP_MAINS).
Every retired id gets an alias, so stored demands, profiles and links resolve.

IDs are positional: re-ordering the workbook renumbers categories. Stdlib only.
"""
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, "..", ".."))
XLSX = os.path.join(WEB, "public", "Xivago_Categories Latest.xlsx")
LEGACY = os.path.join(HERE, "legacy-categories.json")
OUT_TREE = os.path.join(WEB, "src", "lib", "categories.data.json")
OUT_TAGS = os.path.join(WEB, "src", "lib", "category-tags.data.json")
OUT_COMMUNITIES = os.path.join(WEB, "..", "..", "packages", "db", "prisma", "data", "communities.json")

FIRST_DOC_MAIN_ID = 13  # legacy mains used 1-12, so workbook ids never collide with an alias key
SHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Legacy sub -> the workbook sub it duplicates. Its providers/problems/inputs are merged in.
MERGE = {
    "1.1": "Corporate, Startup & Contract Law", "1.2": "Tax, Accounting & CPA Compliance",
    "1.3": "Data Privacy & Regulatory Compliance", "1.4": "Corporate, Startup & Contract Law",
    "1.6": "ESG & Sustainability Advisory",
    "2.1": "Software Development & Code Review", "2.2": "AI, Machine Learning & Data Science",
    "2.3": "Cloud, DevOps & Infrastructure", "2.5": "Blockchain & Web3 Development",
    "2.6": "Tech Support & IT Troubleshooting",
    "3.1": "Product Management & UX/UI Design", "3.2": "Branding, PR & Communications",
    "3.3": "Photography & Video Production Coaching", "3.4": "Writing, Editing & Publishing",
    "3.6": "No-code, Website & App Building",
    "4.1": "Digital Marketing & Growth", "4.2": "Sales & Business Development",
    "4.3": "Digital Marketing & Growth", "4.4": "Branding, PR & Communications",
    "4.5": "Digital Marketing & Growth", "4.6": "Digital Marketing & Growth", "4.7": "Digital Marketing & Growth",
    "5.2": "HR, Hiring & People Operations", "5.3": "Corporate Events & Conferences",
    "5.4": "Operations, Supply Chain & Process Improvement", "5.6": "Tax, Accounting & CPA Compliance",
    "6.3": "Content Creator & Influencer Coaching", "6.4": "Music Production, Podcasting & Audio",
    "6.5": "Content Creator & Influencer Coaching", "6.6": "Resume, LinkedIn & Personal Branding",
    "7.2": "NRI & Cross-Border Finance", "7.3": "Market Entry & Regulatory Strategy",
    "7.4": "Work Visa & Skilled Migration", "7.5": "Franchise & Small Business Setup",
    "9.1": "E-commerce & D2C Brands", "9.2": "E-commerce & D2C Brands", "9.3": "E-commerce & D2C Brands",
    "9.4": "E-commerce & D2C Brands", "9.5": "E-commerce & D2C Brands",
    "10.4": "Data Privacy & Regulatory Compliance",
    "11.3": "Independent Property Valuation", "11.4": "Consultants, Agents & Brokers",
    "11.5": "Architecture, Interior Design & Vastu / Feng Shui",
    "12.1": "Numerology, Tarot & Palmistry", "12.2": "Architecture, Interior Design & Vastu / Feng Shui",
    "12.3": "Numerology, Tarot & Palmistry", "12.4": "Astrology & Horoscope Consultation",
}
# Legacy sub with no workbook counterpart -> the workbook main category it now lives under.
MOVE = {
    "1.5": "Legal & Compliance", "2.4": "Software and Tech",
    "3.5": "Creative, Media & Content Creation",
    "5.1": "Business", "5.5": "Business",
    "6.1": "Creative, Media & Content Creation", "6.2": "Creative, Media & Content Creation",
    "7.1": "B2B Strategy & Expert Networks",
    "11.1": "Real Estate", "11.2": "Real Estate",
    "12.5": "Spiritual & Puja Services",
}
# Legacy mains with no workbook counterpart keep their id and remaining subs.
KEEP_MAINS = {"8", "10"}
# Retired legacy main -> the workbook main that replaced it.
MAIN_ALIAS = {
    "1": "Legal & Compliance", "2": "Software and Tech", "3": "Creative, Media & Content Creation",
    "4": "Business", "5": "Business", "6": "Creative, Media & Content Creation",
    "7": "Immigration, Visa & Relocation Consultancy", "9": "Business", "11": "Real Estate",
    "12": "Spiritual & Puja Services",
}

TYPE_KEY = {
    "Core topic": "core", "Provider type": "provider", "Community": "community", "Persona": "persona",
    "Format / audience": "format", "Lead intent": "lead", "Search variant": "variant",
}
ACRONYMS = {
    "ai", "api", "aws", "b2b", "b2c", "bba", "ca", "cat", "cbse", "ceo", "cfa", "cfo", "clat", "cpa", "cs", "cto", "d2c",
    "dbt", "dei", "diy", "emi", "esg", "gate", "gdpr", "gmat", "gre", "gst", "h1b", "hr", "ib", "ibs", "icse", "ielts",
    "iot", "ip", "ipo", "it", "ivf", "jee", "kyc", "lgbtq", "llm", "mba", "ml", "mvp", "neet", "nft", "ngo", "nri", "oci",
    "ocd", "pcos", "phd", "pm", "pr", "pte", "ptsd", "qa", "rera", "saas", "sat", "seo", "sip", "sme", "ssc", "toefl",
    "ttc", "uae", "ui", "uk", "upsc", "us", "usa", "ux", "vc", "adhd", "m&a", "hni", "dao", "cxo", "gcc", "rti", "dpo",
    "grc", "nps", "rwa", "eb2", "eb5", "niw", "ilr", "ead", "pct", "sdr", "bdr", "erp", "coo", "l&d", "gd", "kp", "cio",
    "csr", "sre", "gcp", "nlp", "ctf", "soc", "pg", "pe", "ms", "gi",
}
ACRONYM_FIX = {"nris": "NRIs", "smes": "SMEs", "vcs": "VCs", "web3": "Web3", "okrs": "OKRs", "pms": "PMs", "djs": "DJs"}
SMALL_WORDS = {"a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"}


def read_sheets(path):
    z = zipfile.ZipFile(path)
    shared = [
        "".join(t.text or "" for t in si.iter(SHEET_NS + "t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(SHEET_NS + "si")
    ]
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    out = {}
    for sheet in ET.fromstring(z.read("xl/workbook.xml")).find(SHEET_NS + "sheets"):
        target = rels[sheet.get(REL_NS + "id")].lstrip("/")
        target = target if target.startswith("xl/") else "xl/" + target
        rows = []
        for r in ET.fromstring(z.read(target)).iter(SHEET_NS + "row"):
            row = []
            for c in r.findall(SHEET_NS + "c"):
                letters = re.match(r"[A-Z]+", c.get("r")).group(0)
                idx = 0
                for ch in letters:
                    idx = idx * 26 + ord(ch) - 64
                v = c.find(SHEET_NS + "v")
                val = shared[int(v.text)] if c.get("t") == "s" and v is not None else (v.text if v is not None else None)
                row += [None] * (idx - len(row))
                row[idx - 1] = val
            if any(row):
                rows.append(row)
        out[sheet.get("name")] = rows
    return out


def split_top_level(text):
    """Splits on commas outside parentheses: 'Trainers (NASM, ACE), physios' -> 2 items."""
    parts, depth, cur = [], 0, ""
    for ch in text:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth <= 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def sentence(text):
    text = text.strip().rstrip(".").strip()
    return text[:1].upper() + text[1:]


def norm_tag(tag):
    return re.sub(r"\s+", " ", tag.replace("-", " ")).strip().lower()


def norm_name(name):
    """Order- and plural-insensitive key, used to spot near-identical names."""
    words = re.sub(r"[^a-z0-9 ]+", " ", name.lower()).split()
    return " ".join(sorted(w[:-1] if w.endswith("s") and len(w) > 3 else w for w in words))


def unique(items):
    return list(OrderedDict.fromkeys(items))


def title_case(name):
    words = []
    for i, w in enumerate(name.split()):
        if w in ACRONYM_FIX:
            words.append(ACRONYM_FIX[w])
        elif w in ACRONYMS:
            words.append(w.upper())
        elif i > 0 and w in SMALL_WORDS:
            words.append(w)
        else:
            words.append(w[:1].upper() + w[1:])
    return " ".join(words)


def slugify(name):  # keep in step with slugify() in apps/web/src/lib/validation/community.ts
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", name.strip().lower()))[:60]


def problem_tags(title, core, cursor, count=5):
    """Display tags for one problem statement: core tags it mentions, then the next unused ones."""
    lowered = title.lower()
    hits = [t for t in core if re.search(r"\b" + re.escape(t) + r"\b", lowered)][:count]
    i = cursor
    while len(hits) < count and i < cursor + len(core):
        tag = core[i % len(core)]
        if tag not in hits:
            hits.append(tag)
        i += 1
    return hits, i


def main():
    sheets = read_sheets(XLSX)
    legacy = {m["id"]: m for m in json.load(open(LEGACY, encoding="utf8"))}
    legacy_subs = {s["id"]: s for m in legacy.values() for s in m["subCategories"]}

    # Every legacy sub must have exactly one fate, so a legacy id can't vanish silently.
    kept = {sid for sid in legacy_subs if sid.split(".")[0] in KEEP_MAINS and sid not in MERGE}
    fates = set(MERGE) | set(MOVE) | kept
    assert fates == set(legacy_subs), sorted(fates ^ set(legacy_subs))

    tag_rows = {}
    for _main, sub_name, tag, tag_type in (r[:4] for r in sheets["Tags"][1:]):
        tag_rows.setdefault(sub_name.strip(), {}).setdefault(TYPE_KEY[tag_type], []).append(norm_tag(tag))

    mains, sub_by_name, main_by_name, tags_out, communities = [], {}, {}, {}, OrderedDict()
    for row in sheets["Categories"][1:]:
        main_name, sub_name, providers_text, problem_text, _tags, solution = row[:6]
        community_text = row[7] or ""
        main_name, sub_name = main_name.strip(), sub_name.strip()
        main = main_by_name.get(main_name)
        if main is None:
            main = {"id": str(FIRST_DOC_MAIN_ID + len(mains)), "name": main_name, "subs": []}
            mains.append(main)
            main_by_name[main_name] = main
        sub_id = f"{main['id']}.{len(main['subs']) + 1}"
        grouped = {k: unique(v) for k, v in tag_rows.get(sub_name, {}).items()}
        core = grouped.get("core", [])
        assert core, sub_name

        shared, cursor = [], 0
        for piece in unique(sentence(p) for p in problem_text.split(";") if p.strip()):
            picked, cursor = problem_tags(piece, core, cursor)
            shared.append({"title": piece, "tags": picked})

        names = unique(sentence(p) for p in split_top_level(providers_text))
        sub = {
            "id": sub_id,
            "name": sub_name,
            "subtitle": sentence(solution),
            "industries": [main_name],
            "topSkills": [sentence(t) for t in core[:4]],
            "requiredInputs": [],
            "shared": shared,
            "providers": [
                {"id": f"{sub_id}.{i + 1}", "name": n, "shared": True, "own": []} for i, n in enumerate(names)
            ],
        }
        main["subs"].append(sub)
        sub_by_name[sub_name] = sub
        tags_out[sub_id] = grouped

        for raw in community_text.split(","):
            raw = raw.strip().lower()
            key = norm_name(raw)
            if raw and key not in communities:
                name = title_case(raw)[:80]
                communities[key] = {
                    "name": name,
                    "slug": slugify(name),
                    "description": f"{name}: a community for {sub_name} on Xivago ({main_name}).",
                }

    aliases = {old: main_by_name[new]["id"] for old, new in MAIN_ALIAS.items()}

    def legacy_problems(provider, new_provider_id, start):
        out = []
        for i, problem in enumerate(provider["problems"]):
            pid = f"{new_provider_id}.{start + i + 1}"
            aliases[problem["id"]] = pid
            out.append({"id": pid, "title": problem["title"], "tags": unique(norm_tag(t) for t in problem["tags"])})
        return out

    def add_legacy_tags(sub, legacy_sub):
        bucket = tags_out.setdefault(sub["id"], {})
        extra = [norm_tag(t) for p in legacy_sub["providers"] for q in p["problems"] for t in q["tags"]]
        extra += [norm_tag(s) for s in legacy_sub["topSkills"]]
        extra += [norm_tag(o) for inp in legacy_sub["requiredInputs"] for o in inp["options"]]
        bucket["core"] = unique(bucket.get("core", []) + extra)

    # Merge: the workbook wins; legacy adds only what the workbook sub doesn't already have.
    for legacy_id in sorted(MERGE, key=lambda s: [int(x) for x in s.split(".")]):
        source, target = legacy_subs[legacy_id], sub_by_name[MERGE[legacy_id]]
        aliases[legacy_id] = target["id"]
        target["industries"] = unique(target["industries"] + source["industries"])
        target["topSkills"] = unique(target["topSkills"] + source["topSkills"])[:6]
        have_labels = {r["label"] for r in target["requiredInputs"]}
        target["requiredInputs"] += [r for r in source["requiredInputs"] if r["label"] not in have_labels]
        add_legacy_tags(target, source)
        for provider in source["providers"]:
            key = norm_name(provider["name"])
            existing = next((p for p in target["providers"] if norm_name(p["name"]) == key), None)
            if existing is None:
                existing = {
                    "id": f"{target['id']}.{len(target['providers']) + 1}",
                    "name": provider["name"],
                    "shared": False,
                    "own": [],
                }
                target["providers"].append(existing)
            aliases[provider["id"]] = existing["id"]
            offset = len(target["shared"]) if existing["shared"] else 0
            existing["own"] += legacy_problems(provider, existing["id"], offset + len(existing["own"]))

    def as_plain_sub(new_id, source):
        sub = {
            "id": new_id,
            "name": source["name"],
            "subtitle": source["subtitle"],
            "industries": source["industries"],
            "topSkills": source["topSkills"],
            "requiredInputs": source["requiredInputs"],
            "shared": [],
            "providers": [],
        }
        for i, provider in enumerate(source["providers"]):
            pid = f"{new_id}.{i + 1}"
            aliases[provider["id"]] = pid
            sub["providers"].append(
                {"id": pid, "name": provider["name"], "shared": False, "own": legacy_problems(provider, pid, 0)}
            )
        add_legacy_tags(sub, source)
        return sub

    for legacy_id, main_name in MOVE.items():
        main = main_by_name[main_name]
        new_id = f"{main['id']}.{len(main['subs']) + 1}"
        aliases[legacy_id] = new_id
        main["subs"].append(as_plain_sub(new_id, legacy_subs[legacy_id]))

    for main_id in sorted(KEEP_MAINS, key=int):
        mains.append({
            "id": main_id,
            "name": legacy[main_id]["name"],
            "subs": [as_plain_sub(s["id"], s) for s in legacy[main_id]["subCategories"] if s["id"] in kept],
        })

    aliases = {k: v for k, v in aliases.items() if k != v}

    os.makedirs(os.path.dirname(OUT_COMMUNITIES), exist_ok=True)
    compact = {"ensure_ascii": False, "separators": (",", ":")}
    with open(OUT_TREE, "w", encoding="utf8", newline="\n") as f:
        json.dump({"mains": mains, "aliases": aliases}, f, **compact)
    with open(OUT_TAGS, "w", encoding="utf8", newline="\n") as f:
        json.dump(tags_out, f, **compact)
    with open(OUT_COMMUNITIES, "w", encoding="utf8", newline="\n") as f:
        json.dump(list(communities.values()), f, ensure_ascii=False, indent=0)

    subs = [s for m in mains for s in m["subs"]]
    print(
        f"{len(mains)} mains, {len(subs)} subs, {sum(len(s['providers']) for s in subs)} providers, "
        f"{len(aliases)} aliases, {len(communities)} communities, "
        f"{len({t for b in tags_out.values() for l in b.values() for t in l})} unique tags"
    )
    for path in (OUT_TREE, OUT_TAGS, OUT_COMMUNITIES):
        print(os.path.relpath(path, WEB), os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf8")
    main()
