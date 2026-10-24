'use strict';

/**
 * HealSmartAI — Free Smart Deterministic Symptom Assistant Engine (v2)
 *
 * Completely free, local, deterministic educational health information engine.
 * - Normalizes common symptom variations and synonyms.
 * - Evaluates deterministic emergency red-flag triggers FIRST (before any optional AI adapter).
 * - Matches individual symptom categories AND multi-symptom combinations/patterns.
 * - Incorporates user-provided severity, duration, and additional notes into context-aware explanations.
 * - Generates relevant follow-up questions when important details are missing.
 * - Never diagnoses diseases, never calculates probabilities/confidence scores, and never invents details.
 */

const LOCAL_ENGINE_STATEMENT =
  'FREE SMART DETERMINISTIC ENGINE: This response is generated locally by a structured, deterministic symptom-matching and combination rule engine — NOT by a paid AI API.';

const OPENAI_ASSISTED_STATEMENT =
  'OPTIONAL OPENAI EDUCATIONAL SUMMARY + LOCAL SAFETY RULES: Emergency red-flag screening was performed deterministically by the local rule engine, and educational explanations were supplemented by the optional OpenAI Assistant.';

const MEDICAL_DISCLAIMER =
  'MEDICAL DISCLAIMER: This information is strictly educational and non-diagnostic. It does not constitute medical advice, clinical diagnosis, or treatment, and keyword screening cannot reliably rule out medical emergencies. Always consult a qualified healthcare professional for any health concerns.';

const EMERGENCY_SCREENING_LIMITATION =
  'Keyword screening cannot reliably rule out medical emergencies. Even if no emergency red-flag terms are matched, seek immediate emergency medical attention if symptoms feel life-threatening, worsen rapidly, or cause severe distress.';

// ── 1. Deterministic Emergency Safety Red-Flag Triggers ────────────────────

const EMERGENCY_TRIGGERS = [
  {
    id: 'cardiac_chest',
    category: 'Chest Pain / Cardiac Warning Signs',
    keywords: [
      'chest pain',
      'chest tightness',
      'chest pressure',
      'crushing chest',
      'squeezing chest',
      'heart attack',
      'angina',
      'pain radiating to left arm',
      'pain in jaw and chest',
    ],
  },
  {
    id: 'breathing_distress',
    category: 'Severe Breathing Difficulty / Airway Emergency',
    keywords: [
      'shortness of breath',
      'difficulty breathing',
      'hard to breathe',
      'trouble breathing',
      'cant breathe',
      "can't breathe",
      'cannot breathe',
      'struggling to breathe',
      'gasping',
      'respiratory distress',
      'choking',
      'turning blue',
      'blue lips',
      'stridor',
    ],
  },
  {
    id: 'stroke_neurological',
    category: 'Stroke-Like or Acute Neurological Warning Signs',
    keywords: [
      'stroke',
      'facial droop',
      'face drooping',
      'slurred speech',
      'trouble speaking',
      'arm weakness',
      'one sided weakness',
      'numbness on one side',
      'sudden confusion',
      'sudden vision loss',
      'thunderclap headache',
      'worst headache of my life',
      'paralysis',
      'stiff neck with fever',
    ],
  },
  {
    id: 'consciousness_seizure',
    category: 'Loss of Consciousness / Seizure / Unresponsiveness',
    keywords: [
      'loss of consciousness',
      'unconscious',
      'fainted',
      'fainting',
      'syncope',
      'passed out',
      'passing out',
      'blacked out',
      'unresponsive',
      'seizure',
      'convulsion',
    ],
  },
  {
    id: 'severe_bleeding_anaphylaxis_trauma',
    category: 'Severe Bleeding, Anaphylaxis, or Acute Trauma',
    keywords: [
      'severe bleeding',
      'uncontrolled bleeding',
      'coughing up blood',
      'hemoptysis',
      'vomiting blood',
      'hematemesis',
      'black tarry stool',
      'head injury',
      'anaphylaxis',
      'swollen tongue',
      'swollen throat',
      'throat closing',
      'suicidal',
      'self harm',
    ],
  },
];

// ── 2. Synonym & Variation Normalization Dictionary ────────────────────────

const SYNONYM_MAP = [
  { canonical: 'fever', variants: ['pyrexia', 'febrile', 'running a temp', 'high temp', 'temperature spike', 'feeling hot with chills', 'burning up', 'low grade fever', 'high temperature', 'chills', 'shivering', 'night sweats'] },
  { canonical: 'headache', variants: ['cephalalgia', 'head pain', 'throbbing head', 'pounding head', 'migraine', 'tension headache', 'temples hurting', 'sinus headache', 'sinus pressure', 'pain behind eyes'] },
  { canonical: 'cough', variants: ['coughing', 'hacking cough', 'dry cough', 'wet cough', 'productive cough', 'phlegm', 'mucus cough', 'barking cough', 'tickle in throat', 'chest congestion', 'wheezing', 'wheeze'] },
  { canonical: 'sore throat', variants: ['pharyngitis', 'throat pain', 'scratchy throat', 'raw throat', 'raspy throat', 'pain when swallowing', 'swallowing pain', 'odynophagia', 'swollen tonsils', 'hoarse voice', 'hoarseness', 'lost voice'] },
  { canonical: 'nasal congestion', variants: ['runny nose', 'stuffy nose', 'blocked nose', 'rhinorrhea', 'nasal drip', 'post nasal drip', 'post-nasal drip', 'sneezing', 'sinus congestion'] },
  { canonical: 'fatigue', variants: ['tired', 'tiredness', 'exhaustion', 'exhausted', 'lethargy', 'lethargic', 'low energy', 'no energy', 'worn out', 'general weakness', 'malaise', 'wiped out'] },
  { canonical: 'body aches', variants: ['muscle aches', 'myalgia', 'aching muscles', 'joint pain', 'arthralgia', 'sore muscles', 'all over body pain', 'chills and body aches'] },
  { canonical: 'nausea', variants: ['nauseous', 'queasy', 'sick to my stomach', 'feeling like throwing up', 'vomiting', 'throwing up', 'emesis', 'retching', 'upset stomach', 'motion sickness'] },
  { canonical: 'stomach discomfort', variants: ['stomach pain', 'stomach ache', 'stomachache', 'abdominal pain', 'belly pain', 'tummy ache', 'abdominal cramps', 'stomach cramps', 'bloating', 'indigestion', 'dyspepsia', 'heartburn', 'acid reflux', 'gas'] },
  { canonical: 'diarrhea', variants: ['loose stools', 'watery stools', 'frequent bowel movements', 'stomach flu', 'gi upset'] },
  { canonical: 'dizziness', variants: ['dizzy', 'lightheaded', 'lightheadedness', 'vertigo', 'room spinning', 'unsteady', 'off balance'] },
  { canonical: 'skin rash', variants: ['rash', 'hives', 'itchy skin', 'red spots', 'skin irritation', 'urticaria', 'dermatitis'] },
];

// ── 3. Structured Single-Category Knowledge Base ───────────────────────────

const SYMPTOM_RULES = [
  {
    id: 'fever',
    category: 'Fever & Thermoregulatory Response',
    canonical_terms: ['fever'],
    keywords: ['fever', 'chills', 'high temperature', 'febrile', 'shivering', 'night sweats', 'sweating', 'pyrexia', 'running a temp', 'burning up'],
    educational_info:
      'Fever is a regulated elevation in core body temperature, most commonly triggered by the immune system in response to viral or bacterial infections, or inflammatory processes.',
    self_care: [
      'Drink plenty of water, clear broths, or oral electrolyte solutions to replace fluids lost through sweating.',
      'Rest in a comfortable, well-ventilated room and dress in breathable layers.',
      'Apply a lukewarm damp cloth to the forehead for comfort (avoid ice-cold baths or alcohol rubs).',
      'Consult a pharmacist or healthcare professional regarding safe use of over-the-counter fever reducers.',
    ],
    when_to_seek_care: [
      'Adult temperature reaches or exceeds 103°F (39.4°C) or persists for more than 3 days.',
      'Fever is accompanied by severe headache, stiff neck, confusion, shortness of breath, or persistent vomiting.',
      'Occurs in a young infant, older adult, pregnant person, or someone with a weakened immune system.',
    ],
    follow_up_questions: [
      'Have you measured your temperature with a thermometer, and if so, what was the highest reading?',
      'Are you experiencing chills, night sweats, or localized pain (such as ear, throat, or urinary discomfort)?',
    ],
  },
  {
    id: 'headache',
    category: 'Headache & Cranial Discomfort',
    canonical_terms: ['headache'],
    keywords: ['headache', 'migraine', 'head pain', 'tension headache', 'sinus pressure', 'throbbing head', 'pounding head', 'temples hurting', 'cephalalgia', 'pain behind eyes'],
    educational_info:
      'Headaches include common tension-type headaches (often associated with muscle tension, stress, dehydration, or screen strain), migraines, and sinus pressure headaches.',
    self_care: [
      'Rest in a quiet, darkened room and take breaks from bright screens.',
      'Hydrate with water, especially if fluid intake has been low today.',
      'Place a cool or warm compress over the forehead, temples, or back of the neck.',
      'Practice gentle neck and shoulder relaxation and maintain regular meal and sleep times.',
    ],
    when_to_seek_care: [
      'Sudden, explosive "thunderclap" headache that peaks within seconds or minutes.',
      'Headache accompanied by fever, stiff neck, confusion, double vision, weakness, or numbness.',
      'Headache that starts after a head injury or steadily worsens over days to weeks.',
    ],
    follow_up_questions: [
      'Where is the head discomfort located (e.g., both sides, one side, forehead, or base of the skull) and does it feel throbbing or dull?',
      'Do bright lights, loud sounds, or movement make the headache worse?',
    ],
  },
  {
    id: 'cough',
    category: 'Cough & Airway Irritation',
    canonical_terms: ['cough'],
    keywords: ['cough', 'coughing', 'dry cough', 'wet cough', 'productive cough', 'phlegm', 'chest congestion', 'wheeze', 'wheezing', 'hacking cough', 'tickle in throat'],
    educational_info:
      'Coughing is a protective reflex that clears mucus and irritants from the respiratory tract. It commonly accompanies viral upper respiratory infections, post-nasal drip, allergies, or dry indoor air.',
    self_care: [
      'Sip warm caffeine-free fluids such as warm water, herbal tea, or clear broth to soothe the airway.',
      'Use a cool-mist humidifier or inhale steam from a warm shower to moisten dry airways.',
      'Avoid exposure to tobacco smoke, dust, and strong chemical fumes.',
      'Rest with the head slightly elevated on pillows to reduce nighttime coughing from post-nasal drainage.',
    ],
    when_to_seek_care: [
      'Cough lasts longer than 2 to 3 weeks or progressively worsens.',
      'Accompanied by shortness of breath, audible wheezing, chest pain, or high fever.',
      'Coughing up blood or rust-colored phlegm.',
    ],
    follow_up_questions: [
      'Is your cough dry and hacking, or is it producing phlegm/mucus?',
      'Does the cough worsen at night, during exercise, or when exposed to cold air or allergens?',
    ],
  },
  {
    id: 'sore_throat',
    category: 'Sore Throat & Pharyngeal Discomfort',
    canonical_terms: ['sore throat'],
    keywords: ['sore throat', 'throat pain', 'scratchy throat', 'raw throat', 'swallowing pain', 'pain when swallowing', 'hoarse voice', 'hoarseness', 'tonsils', 'pharyngitis', 'odynophagia'],
    educational_info:
      'Pharyngeal discomfort is frequently linked to viral upper respiratory infections, dry air, allergy-related post-nasal drip, or voice strain, though bacterial infections (such as strep throat) also require evaluation.',
    self_care: [
      'Gargle gently with warm salt water (1/2 teaspoon of salt dissolved in a glass of warm water).',
      'Drink soothing warm liquids or cool water and use throat lozenges to keep the mucosa moist.',
      'Rest your voice and run a humidifier in dry sleeping areas.',
      'Avoid acidic, spicy, or rough foods that scratch the throat.',
    ],
    when_to_seek_care: [
      'Severe difficulty swallowing saliva, drooling, or difficulty opening the mouth fully.',
      'High fever, tender swollen lymph nodes in the neck, or white patches/exudate on the tonsils.',
      'Sore throat lasting more than 5 to 7 days without improvement.',
    ],
    follow_up_questions: [
      'Does it hurt sharply when you swallow solids or liquids, or Have you noticed white spots on your tonsils?',
      'Do you also have a cough and runny nose, or is the sore throat isolated with a fever?',
    ],
  },
  {
    id: 'nasal_congestion',
    category: 'Nasal Congestion & Upper Sinus Symptoms',
    canonical_terms: ['nasal congestion'],
    keywords: ['nasal congestion', 'runny nose', 'stuffy nose', 'blocked nose', 'rhinorrhea', 'post nasal drip', 'post-nasal drip', 'sneezing', 'sinus congestion'],
    educational_info:
      'Nasal stuffiness, sneezing, and drainage commonly occur when nasal passages become inflamed due to viral colds, environmental allergies, or changes in humidity.',
    self_care: [
      'Use gentle isotonic saline nasal sprays or rinses (with distilled or previously boiled water) to clear nasal passages.',
      'Inhale warm steam from a shower or use a room humidifier.',
      'Stay well hydrated so mucus remains thin and easier to clear.',
    ],
    when_to_seek_care: [
      'Symptoms last more than 10 days without improvement or worsen after initially starting to improve ("double sickening").',
      'Accompanied by severe facial pain, swelling around the eyes, or high fever.',
    ],
    follow_up_questions: [
      'Is the nasal drainage clear and watery, or thick and accompanied by facial pressure?',
      'Do you have a history of seasonal or environmental allergies?',
    ],
  },
  {
    id: 'fatigue',
    category: 'Fatigue & Systemic Low Energy',
    canonical_terms: ['fatigue', 'body aches'],
    keywords: ['fatigue', 'tired', 'tiredness', 'exhaustion', 'exhausted', 'lethargy', 'low energy', 'weakness', 'body aches', 'muscle aches', 'myalgia', 'joint pain', 'malaise', 'worn out'],
    educational_info:
      'Systemic fatigue and generalized body aches often accompany the immune response to viral illnesses, sleep disruption, physical overexertion, dehydration, or prolonged stress.',
    self_care: [
      'Allow extra time for restorative sleep and avoid overexertion while recovering.',
      'Maintain steady hydration and eat balanced, nutrient-dense meals.',
      'Use gentle stretching or a warm bath/shower to ease mild muscle soreness.',
    ],
    when_to_seek_care: [
      'Fatigue persists for 2 weeks or longer despite adequate sleep, nutrition, and hydration.',
      'Accompanied by unexplained weight loss, night sweats, persistent fever, or shortness of breath.',
      'Muscle weakness is sudden, localized to one side of the body, or accompanied by dark-colored urine.',
    ],
    follow_up_questions: [
      'Did the fatigue come on suddenly over a day or two, or has it built up gradually over weeks?',
      'How has your sleep quality and daily fluid intake been recently?',
    ],
  },
  {
    id: 'nausea',
    category: 'Nausea & Upper Digestive Upset',
    canonical_terms: ['nausea'],
    keywords: ['nausea', 'nauseous', 'vomiting', 'queasy', 'throwing up', 'motion sickness', 'upset stomach', 'sick to my stomach', 'emesis', 'retching'],
    educational_info:
      'Nausea and vomiting can be triggered by viral gastroenteritis, foodborne irritation, medication side effects, migraine headaches, motion sensitivity, or vestibular changes.',
    self_care: [
      'Take small, frequent sips of water, clear electrolyte solution, or mild ginger/peppermint tea.',
      'Once liquids are tolerated, reintroduce bland foods gradually (such as crackers, toast, rice, or applesauce).',
      'Avoid strong odors, greasy or spicy foods, caffeine, and alcohol.',
      'Rest sitting upright or slightly elevated for 30–60 minutes after eating or drinking.',
    ],
    when_to_seek_care: [
      'Unable to keep fluids down for 24 hours or showing signs of dehydration (very dark urine, dry mouth, dizziness when standing).',
      'Accompanied by severe abdominal pain, high fever, stiff neck, or confusion.',
      'Vomiting blood or material resembling dark coffee grounds.',
    ],
    follow_up_questions: [
      'Are you able to keep small sips of water down without vomiting?',
      'Did the nausea start shortly after eating a specific meal or starting a new medication?',
    ],
  },
  {
    id: 'stomach_discomfort',
    category: 'Stomach Discomfort, Bloating & Lower GI Symptoms',
    canonical_terms: ['stomach discomfort', 'diarrhea'],
    keywords: ['stomach discomfort', 'stomach pain', 'stomach ache', 'abdominal pain', 'belly pain', 'tummy ache', 'bloating', 'indigestion', 'heartburn', 'acid reflux', 'diarrhea', 'loose stools', 'watery stools', 'constipation', 'cramps', 'gas'],
    educational_info:
      'Abdominal discomfort, cramping, indigestion, or altered bowel habits are commonly related to dietary triggers, mild viral gastroenteritis, acid reflux, or temporary changes in gut motility.',
    self_care: [
      'Eat smaller, lighter meals and avoid lying flat immediately after eating.',
      'Replenish water and electrolytes promptly if experiencing loose or frequent stools.',
      'Limit fatty, fried, heavily spiced, or dairy-heavy foods while the digestive tract settles.',
      'Use a warm heating pad over the abdomen for mild cramping comfort.',
    ],
    when_to_seek_care: [
      'Sudden, severe, or localized abdominal pain (for example, sharp lower-right abdominal pain) or a rigid, tender abdomen.',
      'Diarrhea lasting more than 2 days in adults, or stools that are bloody or black/tarry.',
      'Accompanied by persistent fever, persistent vomiting, or yellowing of the skin/eyes.',
    ],
    follow_up_questions: [
      'Is the discomfort generalized (all over the abdomen) or localized to a specific area (such as upper center or lower right)?',
      'Have you noticed any changes in bowel habits, such as diarrhea, constipation, or heartburn after meals?',
    ],
  },
  {
    id: 'dizziness',
    category: 'Dizziness, Lightheadedness & Balance Symptoms',
    canonical_terms: ['dizziness'],
    keywords: ['dizziness', 'dizzy', 'lightheaded', 'lightheadedness', 'vertigo', 'room spinning', 'unsteady', 'off balance'],
    educational_info:
      'Dizziness can describe lightheadedness (feeling faint, often linked to dehydration, standing up quickly, or low blood sugar) or vertigo (a spinning sensation often connected to the inner ear).',
    self_care: [
      'Sit or lie down immediately when feeling dizzy to prevent falls or injury.',
      'Change positions slowly when moving from lying down to sitting or standing.',
      'Drink water or electrolyte fluids and avoid sudden head movements.',
    ],
    when_to_seek_care: [
      'Dizziness is accompanied by chest pain, shortness of breath, fainting, slurred speech, double vision, or one-sided weakness.',
      'Severe spinning vertigo prevents walking or is accompanied by sudden hearing loss.',
    ],
    follow_up_questions: [
      'Does it feel like the room is spinning around you (vertigo), or do you feel lightheaded like you might faint when standing up?',
    ],
  },
  {
    id: 'skin_rash',
    category: 'Skin Rash, Hives & Dermatological Irritation',
    canonical_terms: ['skin rash'],
    keywords: ['skin rash', 'rash', 'hives', 'itchy skin', 'red spots', 'skin irritation', 'urticaria', 'dermatitis'],
    educational_info:
      'Skin rashes and hives can arise from contact irritation (soaps, plants, fabrics), allergic reactions to foods or medications, viral exanthems, or heat and sweat irritation.',
    self_care: [
      'Keep the area clean and cool using mild, fragrance-free soap and cool compresses.',
      'Avoid scratching and wear loose, soft cotton clothing over the affected skin.',
      'Avoid newly introduced skincare products, detergents, or suspected triggers.',
    ],
    when_to_seek_care: [
      'Rash is accompanied by swelling of the lips, tongue, or face, or any difficulty breathing (seek emergency care immediately).',
      'Rash spreads rapidly, blisters/peels, looks like small purple/red pinpricks that do not fade when pressed, or is accompanied by fever.',
    ],
    follow_up_questions: [
      'Is the rash itchy, painful, raised (like hives), or blistering, and have you recently started any new medications or foods?',
    ],
  },
];

// ── 4. Multi-Symptom Combination Rules (Pattern Synthesis) ─────────────────

const COMBINATION_RULES = [
  {
    id: 'combo_upper_respiratory_viral',
    title: 'Multi-Symptom Pattern: Fever + Cough / Sore Throat / Nasal Congestion',
    required_any_sets: [['fever'], ['cough', 'sore throat', 'nasal congestion']],
    explanation:
      'Combining an elevated temperature (fever/chills) with upper airway symptoms (cough, sore throat, or nasal congestion) is a classic pattern seen in common viral upper respiratory tract infections (such as seasonal colds or influenza-like illnesses).',
    guidance:
      'Prioritize rest, consistent fluid intake, and monitoring breathing comfort. Seek medical evaluation if fever remains high for more than 3 days, breathing becomes labored, or throat pain prevents swallowing fluids.',
  },
  {
    id: 'combo_flu_like_systemic',
    title: 'Multi-Symptom Pattern: Fever + Fatigue / Body Aches + Headache',
    required_any_sets: [['fever'], ['fatigue', 'body aches'], ['headache', 'cough', 'sore throat', 'sore_throat']],
    explanation:
      'The combination of fever, systemic fatigue or muscle aches, and headache or airway irritation reflects a systemic immune response frequently associated with febrile viral syndromes.',
    guidance:
      'Focus on hydration, rest, and symptom tracking. Important red flags that warrant urgent clinical evaluation include a stiff neck, confusion, inability to stay awake, or shortness of breath.',
  },
  {
    id: 'combo_gastroenteritis_pattern',
    title: 'Multi-Symptom Pattern: Nausea / Vomiting + Stomach Discomfort / Diarrhea',
    required_any_sets: [['nausea'], ['stomach discomfort', 'stomach_discomfort', 'diarrhea']],
    explanation:
      'Experiencing upper digestive upset (nausea/vomiting) alongside abdominal cramping, stomach discomfort, or loose stools commonly points toward acute gastrointestinal irritation (such as viral gastroenteritis or food-related upset).',
    guidance:
      'Preventing dehydration is the primary self-care priority: take small, frequent sips of oral rehydration fluids. Seek medical attention if you cannot keep fluids down for 24 hours, notice signs of dehydration (dizziness on standing, dark urine), or have severe localized abdominal pain.',
  },
  {
    id: 'combo_dehydration_orthostatic',
    title: 'Multi-Symptom Pattern: Dizziness / Lightheadedness + Fatigue or GI Fluid Loss',
    required_any_sets: [['dizziness'], ['fatigue', 'body aches', 'nausea', 'stomach discomfort', 'stomach_discomfort', 'diarrhea', 'fever']],
    explanation:
      'Feeling dizzy or lightheaded alongside fatigue, fever, or digestive upset can occur when fluid intake falls behind fluid loss, leading to mild dehydration or temporary drops in blood pressure when standing.',
    guidance:
      'Sit or lie down if lightheaded, rise slowly from sitting/lying positions, and sip water or electrolyte solutions steadily. Seek prompt care if fainting occurs or if dizziness persists despite hydration.',
  },
  {
    id: 'combo_pharyngeal_febrile',
    title: 'Multi-Symptom Pattern: Sore Throat + Fever (Without Cough)',
    required_any_sets: [['sore throat'], ['fever']],
    exclude_ids: ['cough'],
    explanation:
      'A sore throat paired with fever in the absence of a cough can occur with viral pharyngitis, but clinicians also evaluate this pattern for bacterial causes such as streptococcal pharyngitis (strep throat).',
    guidance:
      'Consider scheduling a non-emergency clinical evaluation (such as a rapid throat swab) while using warm salt-water gargles and fluids for comfort. Seek urgent care if you develop drooling, muffled voice, or trouble swallowing.',
  },
];

// ── 5. Helper Functions ────────────────────────────────────────────────────

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes raw user symptom strings & additional notes into canonical terms and synonym mappings.
 */
function normalizeSymptoms(symptoms, additionalNotes) {
  const normalizedList = symptoms.map((s) => normalizeText(s)).filter(Boolean);
  const notesNormalized = normalizeText(additionalNotes || '');
  const fullCorpus = [...normalizedList, notesNormalized].filter(Boolean).join(' | ');

  const detectedCanonical = new Set();
  const normalizedMappings = [];

  for (const entry of SYNONYM_MAP) {
    const matchedVariants = [];
    if (fullCorpus.includes(entry.canonical)) {
      matchedVariants.push(entry.canonical);
    }
    for (const variant of entry.variants) {
      const normVariant = normalizeText(variant);
      if (normVariant && fullCorpus.includes(normVariant)) {
        matchedVariants.push(variant);
      }
    }
    if (matchedVariants.length > 0) {
      detectedCanonical.add(entry.canonical);
      normalizedMappings.push({
        canonical_symptom: entry.canonical,
        matched_expressions: Array.from(new Set(matchedVariants)),
      });
    }
  }

  return {
    normalizedList,
    notesNormalized,
    fullCorpus,
    detectedCanonical: Array.from(detectedCanonical),
    normalizedMappings,
  };
}

/**
 * Parses a human-entered duration string (e.g., "2 hours", "5 days", "3 weeks") into a duration classification.
 */
function analyzeDuration(durationStr) {
  if (!durationStr || !String(durationStr).trim()) {
    return { category: 'unspecified', daysEstimate: null, summary: null };
  }
  const text = normalizeText(durationStr);

  // Check weeks / months
  const monthsMatch = text.match(/(\d+)\s*month/);
  if (monthsMatch || text.includes('month')) {
    const n = monthsMatch ? parseInt(monthsMatch[1], 10) : 1;
    return {
      category: 'prolonged',
      daysEstimate: n * 30,
      summary: `Prolonged duration reported ("${durationStr}"). Symptoms lasting multiple weeks or months warrant a scheduled evaluation with a healthcare professional.`,
    };
  }

  const weeksMatch = text.match(/(\d+)\s*week/);
  if (weeksMatch || text.includes('week')) {
    const n = weeksMatch ? parseInt(weeksMatch[1], 10) : 1;
    return {
      category: n >= 1 ? 'prolonged' : 'subacute',
      daysEstimate: n * 7,
      summary: `Persistent duration reported ("${durationStr}"). Because symptoms have lasted a week or longer, discussing them with a clinician is recommended even if severity is mild or moderate.`,
    };
  }

  const daysMatch = text.match(/(\d+)\s*day/);
  if (daysMatch) {
    const n = parseInt(daysMatch[1], 10);
    if (n >= 5) {
      return {
        category: 'prolonged',
        daysEstimate: n,
        summary: `Extended duration reported ("${durationStr}", ~${n} days). Many self-limiting viral symptoms begin improving within 3–5 days; persistent symptoms merit clinical guidance.`,
      };
    }
    return {
      category: 'acute',
      daysEstimate: n,
      summary: `Acute timeline reported ("${durationStr}"). Monitor closely over the next 24–48 hours for any progression or new red-flag signs.`,
    };
  }

  if (text.includes('hour') || text.includes('minute') || text.includes('today') || text.includes('morning') || text.includes('just started') || text.includes('last night')) {
    return {
      category: 'recent_onset',
      daysEstimate: 0.5,
      summary: `Recent onset reported ("${durationStr}"). Track how symptoms evolve over the first 24–48 hours and watch for any sudden escalation.`,
    };
  }

  return {
    category: 'reported',
    daysEstimate: null,
    summary: `Reported duration: "${durationStr}". Sharing this timeline helps a clinician understand how your symptoms are progressing.`,
  };
}

/**
 * Deterministic Emergency Safety Layer — ALWAYS runs first and cannot be overridden.
 */
function evaluateEmergencySafety(fullCorpus, normalizedList, severity) {
  const matchedEmergencies = [];

  for (const trigger of EMERGENCY_TRIGGERS) {
    const matchedKeywords = trigger.keywords.filter((kw) => {
      const normKw = normalizeText(kw);
      return (
        normalizedList.some((input) => input.includes(normKw)) ||
        fullCorpus.includes(normKw)
      );
    });
    if (matchedKeywords.length > 0) {
      matchedEmergencies.push({
        id: trigger.id,
        category: trigger.category,
        matched_terms: Array.from(new Set(matchedKeywords)),
      });
    }
  }

  // Combination red-flag check: fever + stiff neck, or chest discomfort + dizziness/sweating/shortness of breath
  if (
    fullCorpus.includes('fever') &&
    (fullCorpus.includes('stiff neck') || fullCorpus.includes('neck stiffness') || fullCorpus.includes('confusion'))
  ) {
    if (!matchedEmergencies.some((e) => e.id === 'stroke_neurological')) {
      matchedEmergencies.push({
        id: 'meningeal_red_flag',
        category: 'Fever Combined with Stiff Neck or Confusion',
        matched_terms: ['fever + stiff neck / confusion'],
      });
    }
  }

  const hasEmergencyWarning = matchedEmergencies.length > 0;

  if (hasEmergencyWarning) {
    return {
      is_emergency_warning: true,
      warning_level: 'HIGH_PRIORITY_SAFETY_NOTICE',
      headline: 'IMMEDIATE SAFETY ALERT: Potential Emergency Red-Flag Symptoms Detected',
      message:
        'One or more symptoms you entered (such as chest pain, breathing difficulty, stroke-like signs, fainting, or severe bleeding/swelling) can be warning signs of a life-threatening medical emergency. Do NOT wait for online or self-care guidance — call your local emergency number (e.g., 911 / 112 / 999) or go to the nearest emergency department immediately.',
      immediate_action:
        'Seek immediate professional emergency evaluation (call emergency services or go to the nearest emergency room). Do not drive yourself if experiencing chest pain, severe shortness of breath, fainting, or neurological symptoms.',
      screening_limitation: EMERGENCY_SCREENING_LIMITATION,
      matched_emergency_categories: matchedEmergencies,
      deterministic_override: true,
    };
  }

  return {
    is_emergency_warning: false,
    warning_level: severity === 'severe' ? 'ELEVATED_SEVERITY_NOTICE' : 'STANDARD_SAFETY_NOTICE',
    headline:
      severity === 'severe'
        ? 'Prompt Clinical Evaluation Recommended (Severe Symptom Level)'
        : 'Standard Non-Emergency Educational Screening',
    message:
      severity === 'severe'
        ? 'No specific emergency red-flag keywords were matched, but because you rated your symptoms as SEVERE, prompt evaluation by a licensed healthcare professional is strongly recommended.'
        : 'No pre-configured emergency red-flag keywords were matched in your input. However, deterministic keyword screening cannot rule out urgent medical conditions.',
    immediate_action:
      'If you develop chest pain, difficulty breathing, sudden weakness or numbness, slurred speech, confusion, severe abdominal pain, or fainting, seek emergency medical care immediately.',
    screening_limitation: EMERGENCY_SCREENING_LIMITATION,
    matched_emergency_categories: [],
    deterministic_override: true,
  };
}

/**
 * Evaluates symptoms deterministically using the Free Smart Symptom Engine.
 */
function evaluateSymptomsLocal({
  symptoms,
  duration = null,
  severity = 'mild',
  additional_notes = null,
}) {
  const cleanSymptoms = Array.isArray(symptoms)
    ? symptoms.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const cleanDuration = duration && String(duration).trim() ? String(duration).trim() : null;
  const cleanNotes =
    additional_notes && String(additional_notes).trim() ? String(additional_notes).trim() : null;
  const validSeverity = ['mild', 'moderate', 'severe'].includes(severity) ? severity : 'mild';

  // 1. Normalize inputs & synonyms
  const {
    normalizedList,
    fullCorpus,
    detectedCanonical,
    normalizedMappings,
  } = normalizeSymptoms(cleanSymptoms, cleanNotes);

  // 2. Run deterministic Emergency Safety Layer FIRST
  const emergencySafety = evaluateEmergencySafety(fullCorpus, normalizedList, validSeverity);

  // 3. Match individual symptom rule categories (via keywords OR normalized canonical synonyms)
  const matchedCategories = [];
  const educationalDetails = [];
  const selfCareSet = new Set();
  const seekCareSet = new Set();
  const followUpSet = new Set();
  const matchedRuleIds = new Set();

  for (const rule of SYMPTOM_RULES) {
    const matchedKeywords = rule.keywords.filter((kw) => {
      const normKw = normalizeText(kw);
      return (
        normalizedList.some((input) => input.includes(normKw)) ||
        fullCorpus.includes(normKw)
      );
    });

    const canonicalMatches = (rule.canonical_terms || []).filter((c) =>
      detectedCanonical.includes(c)
    );

    if (matchedKeywords.length > 0 || canonicalMatches.length > 0) {
      matchedRuleIds.add(rule.id);
      const combinedTerms = Array.from(new Set([...matchedKeywords, ...canonicalMatches]));
      matchedCategories.push({
        id: rule.id,
        category: rule.category,
        matched_keywords: combinedTerms,
      });
      educationalDetails.push({
        category: rule.category,
        information: rule.educational_info,
      });
      rule.self_care.forEach((item) => selfCareSet.add(item));
      rule.when_to_seek_care.forEach((item) => seekCareSet.add(item));
      (rule.follow_up_questions || []).forEach((q) => followUpSet.add(q));
    }
  }

  // 4. Evaluate Multi-Symptom Combination Rules
  const matchedCombinations = [];
  const activeTokens = new Set([...detectedCanonical, ...Array.from(matchedRuleIds)]);

  for (const combo of COMBINATION_RULES) {
    if (combo.exclude_ids && combo.exclude_ids.some((ex) => activeTokens.has(ex))) {
      continue;
    }
    const allSetsSatisfied = combo.required_any_sets.every((group) =>
      group.some((token) => activeTokens.has(token))
    );
    if (allSetsSatisfied) {
      matchedCombinations.push({
        id: combo.id,
        title: combo.title,
        explanation: combo.explanation,
        guidance: combo.guidance,
      });
      educationalDetails.unshift({
        category: combo.title,
        information: `${combo.explanation} ${combo.guidance}`,
      });
    }
  }

  // 5. Fallback for unrecognized symptoms
  if (matchedCategories.length === 0) {
    matchedCategories.push({
      id: 'general_unclassified',
      category: 'General / Unclassified Symptom Inquiry',
      matched_keywords: cleanSymptoms.slice(0, 5),
    });
    educationalDetails.push({
      category: 'General Health Inquiry',
      information:
        'The entered symptom description did not match a specific pre-configured category in our local rule catalog. Symptoms can vary based on personal medical history, onset, and daily context.',
    });
    selfCareSet.add(
      'Rest in a comfortable position and monitor whether your symptoms change, improve, or progress.'
    );
    selfCareSet.add(
      'Maintain normal hydration with water unless advised otherwise by a healthcare professional.'
    );
    selfCareSet.add(
      'Keep a brief written log of when the symptoms started, what makes them better or worse, and any associated changes.'
    );
    seekCareSet.add(
      'Consult a licensed healthcare provider or pharmacist for personalized evaluation of any unfamiliar, persistent, or concerning symptoms.'
    );
    seekCareSet.add(
      'Seek prompt medical care if symptoms worsen rapidly, interfere with daily activities, or cause significant distress.'
    );
    followUpSet.add(
      'Can you describe the exact location or character of the symptom (for example: dull, sharp, throbbing, or pressure-like)?'
    );
    followUpSet.add(
      'Are you experiencing any common accompanying symptoms such as fever, fatigue, nausea, cough, or dizziness?'
    );
  }

  // 6. Context-Aware Explanations (Severity, Duration, Additional Notes)
  const durationAnalysis = analyzeDuration(cleanDuration);
  const contextExplanations = [];

  if (validSeverity === 'severe') {
    contextExplanations.push({
      aspect: 'High Reported Severity (Severe)',
      explanation:
        'You indicated that your symptoms feel SEVERE. Severe symptoms can significantly impact hydration, rest, or daily function and warrant prompt evaluation by a qualified healthcare professional rather than relying solely on self-care.',
    });
    seekCareSet.add(
      'Because you marked symptom severity as SEVERE, arrange a prompt evaluation with a healthcare professional or urgent care clinic.'
    );
  } else if (validSeverity === 'moderate') {
    contextExplanations.push({
      aspect: 'Moderate Symptom Severity',
      explanation:
        'You marked your symptoms as MODERATE. If moderate symptoms interfere with normal daily activities, sleep, or hydration, or do not begin improving within a few days, a clinical consultation is advisable.',
    });
  } else {
    contextExplanations.push({
      aspect: 'Mild Symptom Severity',
      explanation:
        'You marked your symptoms as MILD. Mild symptoms can often be monitored at home with supportive self-care while watching closely for any worsening or persistent timeline.',
    });
  }

  if (durationAnalysis.summary) {
    contextExplanations.push({
      aspect: `Duration Context (${durationAnalysis.category.replace(/_/g, ' ')})`,
      explanation: durationAnalysis.summary,
    });
    if (durationAnalysis.category === 'prolonged') {
      seekCareSet.add(
        `Because your reported duration ("${cleanDuration}") is prolonged, schedule a professional medical evaluation to investigate persistent symptoms.`
      );
    }
  } else {
    // Missing duration -> add targeted follow-up question
    followUpSet.add(
      'How long have these symptoms been present (for example, a few hours, 2–3 days, or more than a week), and are they getting better, staying the same, or worsening?'
    );
  }

  if (cleanNotes) {
    contextExplanations.push({
      aspect: 'Additional Context Considered',
      explanation: `Your additional notes ("${cleanNotes}") were included in symptom normalization and red-flag screening. Be sure to share these specific details with a clinician during any evaluation.`,
    });
  } else {
    followUpSet.add(
      'Are there any specific triggers, recent exposures, new medications, or activities that seem to make the symptoms better or worse?'
    );
  }

  if (cleanSymptoms.length === 1 && matchedCategories[0]?.id !== 'general_unclassified') {
    followUpSet.add(
      `Aside from "${cleanSymptoms[0]}", have you noticed any other symptoms such as fever, chills, fatigue, nausea, or changes in appetite?`
    );
  }

  // Ensure educational_information also includes a concise synthesis of context
  educationalDetails.push({
    category: 'Reported Severity & Timeline Context',
    information: contextExplanations.map((c) => c.explanation).join(' '),
  });

  const followUpQuestions = Array.from(followUpSet).slice(0, 6);

  return {
    engine_used: 'local_rule_engine',
    engine_label: 'Free Smart Assistant (Local Deterministic Engine)',
    engine_type: 'deterministic_smart_engine_v2',
    engine_statement: LOCAL_ENGINE_STATEMENT,
    openai_enabled: false,
    openai_used: false,
    submitted_symptoms: cleanSymptoms,
    normalized_symptoms: normalizedMappings,
    matched_categories: matchedCategories,
    matched_combinations: matchedCombinations,
    context_explanations: contextExplanations,
    educational_information: educationalDetails,
    follow_up_questions: followUpQuestions,
    self_care_tips: Array.from(selfCareSet),
    when_to_seek_medical_advice: Array.from(seekCareSet),
    emergency_safety: emergencySafety,
    submitted_context: {
      symptoms: cleanSymptoms,
      duration: cleanDuration,
      severity: validSeverity,
      additional_notes: cleanNotes,
    },
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

module.exports = {
  evaluateSymptomsLocal,
  evaluateEmergencySafety,
  normalizeSymptoms,
  analyzeDuration,
  LOCAL_ENGINE_STATEMENT,
  OPENAI_ASSISTED_STATEMENT,
  MEDICAL_DISCLAIMER,
  EMERGENCY_SCREENING_LIMITATION,
};
