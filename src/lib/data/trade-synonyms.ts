/**
 * Trade-aware synonym groups for KB search expansion.
 *
 * Each inner array is a synonym group — any term in the group matches any other.
 * Terms are lower-cased. Multi-word phrases are supported.
 */
const SYNONYM_GROUPS: string[][] = [
  // Plumbing — fixtures
  ['faucet', 'tap', 'spigot'],
  ['drain cleaning', 'drain unclogging', 'clogged drain', 'blocked drain', 'snake the drain'],
  ['water heater', 'hot water tank', 'hot water heater'],
  ['toilet repair', 'fix the toilet', 'toilet replacement', 'toilet not flushing'],
  ['pipe repair', 'burst pipe', 'broken pipe', 'pipe replacement', 'pipe leak'],
  ['sump pump', 'sump pump installation', 'basement pump'],
  ['water softener', 'water treatment', 'hard water'],

  // Leak / drip (cross-trade)
  ['leak', 'leaking', 'dripping', 'drip'],
  ['roof repair', 'fix the roof', 'roof leak', 'leaking roof'],

  // Basement / suites
  ['secondary suite', 'legal suite', 'basement suite', 'in-law suite', 'secondary dwelling'],
  ['basement development', 'basement finishing', 'basement renovation', 'finish the basement', 'develop the basement'],

  // Kitchen / bath
  ['kitchen renovation', 'kitchen reno', 'kitchen remodel', 'redo the kitchen'],
  ['bathroom renovation', 'bathroom reno', 'bathroom remodel', 'redo the bathroom', 'bath reno'],
  ['tile installation', 'tiling', 'tile work', 'tile repair'],

  // Electrical
  ['electrical panel', 'breaker panel', 'fuse box', 'panel upgrade', 'electrical upgrade'],
  ['outlet installation', 'plug installation', 'receptacle', 'add an outlet'],
  ['lighting installation', 'light fixture', 'install lights', 'pot lights', 'recessed lighting'],

  // HVAC
  ['furnace', 'heating system', 'heater', 'furnace replacement', 'furnace repair'],
  ['air conditioning', 'ac', 'air conditioner', 'central air', 'ac unit'],
  ['heat pump', 'heat pump installation', 'heat pump repair'],
  ['duct cleaning', 'ductwork cleaning', 'hvac cleaning', 'air duct cleaning'],

  // Exterior / roofing
  ['gutter', 'eavestrough', 'eaves', 'downspout', 'gutter cleaning', 'eavestrough cleaning'],
  ['siding', 'siding installation', 'siding repair', 'siding replacement'],
  ['fence installation', 'fencing', 'fence repair', 'build a fence'],
  ['deck building', 'deck construction', 'build a deck', 'deck repair', 'new deck'],
  ['window replacement', 'new windows', 'window installation', 'window repair'],
  ['door replacement', 'new door', 'door installation', 'door repair'],
  ['driveway', 'concrete driveway', 'asphalt driveway', 'paving', 'interlocking'],

  // Insulation / energy
  ['insulation', 'attic insulation', 'wall insulation', 'spray foam', 'blown-in insulation'],

  // Painting
  ['interior painting', 'paint the interior', 'house painting', 'room painting'],
  ['exterior painting', 'paint the exterior', 'outside painting'],

  // Flooring
  ['flooring installation', 'new floors', 'floor replacement', 'hardwood floors', 'laminate flooring', 'vinyl flooring'],

  // Estimate / pricing
  ['estimate', 'quote', 'bid', 'price', 'how much', 'cost', 'pricing', 'rates'],
  ['warranty', 'guarantee'],

  // Urgency
  ['emergency', 'urgent', 'asap', 'right away', 'immediately', 'same day'],

  // Booking
  ['appointment', 'book', 'schedule', 'come out', 'site visit', 'on-site visit', 'in-person visit', 'send someone'],
];

/** Map from each normalised term to all other synonyms in its group. */
const SYNONYM_MAP = new Map<string, string[]>();

for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const others = group.filter((t) => t !== term);
    SYNONYM_MAP.set(term.toLowerCase(), others);
  }
}

/**
 * Expand a natural-language query with trade-specific synonyms.
 *
 * Steps:
 * 1. Lowercase the query.
 * 2. Check multi-word phrases (longest-first for specificity).
 * 3. Check single-word tokens (3+ chars) that weren't already matched.
 * 4. Return deduplicated array of all original + expanded terms.
 *
 * Returns an empty array when the input is empty or contains only short words.
 */
export function expandQueryWithSynonyms(query: string): string[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return [];

  const collected = new Set<string>();
  let remaining = lower;

  // --- Pass 1: multi-word phrase matching (longest phrases first) ---
  const multiWordPhrases = [...SYNONYM_MAP.keys()]
    .filter((k) => k.includes(' '))
    .sort((a, b) => b.length - a.length); // longest first

  for (const phrase of multiWordPhrases) {
    if (remaining.includes(phrase)) {
      collected.add(phrase);
      const synonyms = SYNONYM_MAP.get(phrase);
      if (synonyms) {
        for (const s of synonyms) collected.add(s);
      }
      // Remove the matched phrase from remaining so its constituent words
      // aren't double-counted as single tokens.
      remaining = remaining.replace(phrase, ' ');
    }
  }

  // --- Pass 2: single-word token matching (3+ chars) ---
  const tokens = remaining.split(/\s+/).filter((t) => t.length >= 3);

  for (const token of tokens) {
    collected.add(token);
    const synonyms = SYNONYM_MAP.get(token);
    if (synonyms) {
      for (const s of synonyms) collected.add(s);
    }
  }

  return [...collected];
}
