/**
 * The Asterwood subject library.
 * Every subject, department and topic from the product specification, with the
 * educational stage each topic normally belongs to. Stages are guidance only —
 * the learning engine always lets demonstrated knowledge override age.
 */

export const AGE_GROUPS = [
  { id: "early", label: "Early learning", ages: "3–5", min: 3, max: 5, tone: "playful" },
  { id: "foundation", label: "Foundational", ages: "6–8", min: 6, max: 8, tone: "playful" },
  { id: "elementary", label: "Elementary", ages: "9–11", min: 9, max: 11, tone: "bright" },
  { id: "middle", label: "Middle school", ages: "12–13", min: 12, max: 13, tone: "bright" },
  { id: "secondary", label: "Secondary", ages: "14–17", min: 14, max: 17, tone: "focus" },
  { id: "higher", label: "Higher education", ages: "18–24", min: 18, max: 24, tone: "focus" },
  { id: "adult", label: "Adult learning", ages: "25–44", min: 25, max: 44, tone: "calm" },
  { id: "continuing", label: "Continuing education", ages: "45–64", min: 45, max: 64, tone: "calm" },
  { id: "lifelong", label: "Lifelong learning", ages: "65+", min: 65, max: 120, tone: "calm" },
];

export const STAGES = [
  { id: "early", label: "Early years" },
  { id: "elementary", label: "Elementary" },
  { id: "middle", label: "Middle school" },
  { id: "high", label: "High school" },
  { id: "college", label: "College & adult" },
];

export function ageGroupForAge(age) {
  const n = Number(age);
  if (!Number.isFinite(n)) return AGE_GROUPS[3];
  return AGE_GROUPS.find((g) => n >= g.min && n <= g.max) || AGE_GROUPS[AGE_GROUPS.length - 1];
}

export function levelForAge(age) {
  const n = Number(age);
  if (!Number.isFinite(n)) return "middle";
  if (n <= 5) return "early";
  if (n <= 8) return "foundation";
  if (n <= 11) return "elementary";
  if (n <= 13) return "middle";
  if (n <= 17) return "high";
  return "college";
}

export const LEVEL_LABELS = {
  early: "Early years",
  foundation: "Foundations",
  elementary: "Elementary",
  middle: "Middle school",
  high: "High school",
  college: "College & adult",
};

const S = (name, level) => ({ name, level });

export const SUBJECTS = [
  {
    id: "math",
    name: "Mathematics",
    icon: "➗",
    color: "#7c5cf0",
    group: "Core",
    blurb: "Numbers, patterns, shapes and the language of problem solving.",
    departments: [
      {
        name: "Early mathematics",
        level: "early",
        topics: ["Number recognition", "Counting", "Number sequencing", "Shapes", "Patterns", "Basic addition", "Basic subtraction", "Comparing quantities", "Time and money"].map((t) => S(t, "early")),
      },
      {
        name: "Elementary mathematics",
        level: "elementary",
        topics: ["Multiplication", "Division", "Fractions", "Decimals", "Percentages", "Measurement", "Geometry", "Word problems", "Basic algebra"].map((t) => S(t, "elementary")),
      },
      {
        name: "Middle school mathematics",
        level: "middle",
        topics: ["Ratios and proportions", "Integers", "Expressions", "Equations", "Coordinate plane", "Probability", "Statistics", "Pre-algebra", "Geometry"].map((t) => S(t, "middle")),
      },
      {
        name: "High school mathematics",
        level: "high",
        topics: ["Algebra I", "Algebra II", "Geometry", "Trigonometry", "Precalculus", "Calculus", "Statistics", "Advanced probability", "Discrete mathematics"].map((t) => S(t, "high")),
      },
      {
        name: "College & adult mathematics",
        level: "college",
        topics: ["Differential calculus", "Integral calculus", "Linear algebra", "Multivariable calculus", "Differential equations", "Mathematical proofs", "Number theory", "Applied mathematics", "Financial mathematics"].map((t) => S(t, "college")),
      },
    ],
  },
  {
    id: "reading",
    name: "Reading & Language Arts",
    icon: "📖",
    color: "#e0699a",
    group: "Core",
    blurb: "Letters, stories, grammar and the confidence to write your own ideas.",
    departments: [
      {
        name: "Early reading",
        level: "early",
        topics: ["Alphabet recognition", "Phonics", "Letter sounds", "Sight words", "Rhyming words", "Listening comprehension"].map((t) => S(t, "early")),
      },
      {
        name: "Elementary language arts",
        level: "elementary",
        topics: ["Vocabulary", "Spelling", "Reading comprehension", "Sentence formation", "Grammar", "Punctuation", "Creative writing", "Reading fluency"].map((t) => S(t, "elementary")),
      },
      {
        name: "Secondary language arts",
        level: "high",
        topics: ["Essay writing", "Poetry", "Literature", "Public speaking", "Critical reading", "Research writing"].map((t) => S(t, "high")),
      },
      {
        name: "Advanced composition",
        level: "college",
        topics: ["Advanced composition", "Literary analysis", "Academic research"].map((t) => S(t, "college")),
      },
    ],
  },
  {
    id: "science",
    name: "Science",
    icon: "🔬",
    color: "#21a89a",
    group: "Core",
    blurb: "Biology, earth science, space, chemistry and physics — with safe experiments.",
    departments: [
      {
        name: "Biology",
        level: "middle",
        topics: ["Plants", "Animals", "Human biology", "Cells", "Genetics", "Ecosystems", "Evolution", "Microbiology", "Botany", "Zoology", "Anatomy", "Physiology"].map((t) => S(t, "middle")),
      },
      {
        name: "Earth science",
        level: "elementary",
        topics: ["Rocks and minerals", "Fossils", "Dinosaurs", "Volcanoes", "Earthquakes", "Mountains", "Oceans", "Rivers", "Soil", "Weather", "Climate", "Erosion", "Plate tectonics", "Natural resources"].map((t) => S(t, "elementary")),
      },
      {
        name: "Astronomy & space",
        level: "elementary",
        topics: ["The solar system", "Stars", "Planets", "Moons", "Galaxies", "Black holes", "Constellations", "Space exploration", "Telescopes", "The universe", "The Big Bang", "Astrophysics"].map((t) => S(t, "elementary")),
      },
      {
        name: "Chemistry",
        level: "high",
        topics: ["Atoms", "Molecules", "Elements", "The periodic table", "Chemical reactions", "Acids and bases", "Compounds", "Organic chemistry", "Biochemistry"].map((t) => S(t, "high")),
      },
      {
        name: "Physics",
        level: "high",
        topics: ["Gravity", "Motion", "Energy", "Electricity", "Magnetism", "Light", "Sound", "Forces", "Thermodynamics", "Quantum physics"].map((t) => S(t, "high")),
      },
    ],
  },
  {
    id: "social",
    name: "Social Studies",
    icon: "🌍",
    color: "#d98a2b",
    group: "Core",
    blurb: "People, places, timelines and the choices that shaped our world.",
    departments: [
      {
        name: "History",
        level: "middle",
        topics: ["World history", "Ancient civilizations", "Ancient Egypt", "Ancient Greece", "Ancient Rome", "African history", "Caribbean history", "American history", "European history", "Asian history", "Indigenous history", "Archaeology", "Anthropology"].map((t) => S(t, "middle")),
      },
      {
        name: "Geography & cultures",
        level: "elementary",
        topics: ["Geography", "Map reading", "World cultures", "Human geography", "Natural resources"].map((t) => S(t, "elementary")),
      },
      {
        name: "Civics & economics",
        level: "high",
        topics: ["Government", "Civics", "Economics", "Political systems", "Personal finance"].map((t) => S(t, "high")),
      },
    ],
  },
  {
    id: "bible",
    name: "Bible Study",
    icon: "🕊️",
    color: "#4a7fd4",
    group: "Optional",
    optional: true,
    blurb: "Scripture, context and thoughtful questions. Always optional, never assumed.",
    departments: [
      {
        name: "Old Testament",
        level: "elementary",
        topics: ["Old Testament", "Bible characters", "Bible history", "Books of the Bible", "Bible timelines", "Ten Commandments", "Prophecies"].map((t) => S(t, "elementary")),
      },
      {
        name: "New Testament",
        level: "elementary",
        topics: ["New Testament", "Parables", "Scripture memorization", "Bible reading plans", "Chapter summaries", "Verse explanations", "Biblical vocabulary"].map((t) => S(t, "elementary")),
      },
      {
        name: "Bible study skills",
        level: "middle",
        topics: ["Biblical geography", "Christian history", "Bible quizzes", "Bible study activities", "Biblical principles"].map((t) => S(t, "middle")),
      },
    ],
  },
  {
    id: "computing",
    name: "Computer Science",
    icon: "💻",
    color: "#4e7cf6",
    group: "Modern skills",
    blurb: "Coding, systems and artificial intelligence, from first algorithms to real projects.",
    departments: [
      { name: "Computing foundations", level: "elementary", topics: ["Computer basics", "Algorithms", "Block coding", "Digital citizenship"].map((t) => S(t, "elementary")) },
      { name: "Programming", level: "middle", topics: ["Coding and programming", "Python", "JavaScript", "Web development", "Data structures"].map((t) => S(t, "middle")) },
      { name: "Advanced computing", level: "high", topics: ["Artificial intelligence", "Machine learning", "Databases", "Cybersecurity"].map((t) => S(t, "high")) },
      { name: "Engineering", level: "middle", topics: ["Engineering design", "Robotics", "Electronics", "Structural engineering"].map((t) => S(t, "middle")) },
    ],
  },
  {
    id: "arts",
    name: "Art, Music & Design",
    icon: "🎨",
    color: "#c458d6",
    group: "Creative",
    blurb: "Drawing, colour, rhythm and design thinking.",
    departments: [
      { name: "Visual art", level: "elementary", topics: ["Art and design", "Drawing", "Colour theory", "Sculpture"].map((t) => S(t, "elementary")) },
      { name: "Music", level: "elementary", topics: ["Music theory", "Rhythm and beat", "Reading music", "Instruments"].map((t) => S(t, "elementary")) },
    ],
  },
  {
    id: "languages",
    name: "Foreign Languages",
    icon: "🗣️",
    color: "#0f9d8f",
    group: "Modern skills",
    blurb: "Spanish, French and more — vocabulary, phrases and conversation practice.",
    departments: [
      { name: "Language learning", level: "elementary", topics: ["Spanish", "French", "Mandarin", "Latin", "Conversation practice", "Vocabulary building", "Grammar essentials"].map((t) => S(t, "elementary")) },
    ],
  },
  {
    id: "life",
    name: "Life Skills & Wellbeing",
    icon: "🌱",
    color: "#5f9e3f",
    group: "Life",
    blurb: "Money, health, home, growing things and thinking clearly.",
    departments: [
      { name: "Practical life", level: "middle", topics: ["Personal finance", "Home economics", "Cooking", "Gardening", "Agriculture", "Building things"].map((t) => S(t, "middle")) },
      { name: "Wellbeing", level: "middle", topics: ["Health education", "Psychology", "Life skills", "Study skills", "Public speaking"].map((t) => S(t, "middle")) },
      { name: "Thinking & enterprise", level: "high", topics: ["Critical thinking", "Philosophy", "Entrepreneurship", "Business studies", "Environmental studies"].map((t) => S(t, "high")) },
    ],
  },
];

export const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));

export function allTopics() {
  const out = [];
  for (const subject of SUBJECTS) {
    for (const dept of subject.departments) {
      for (const topic of dept.topics) {
        out.push({ subjectId: subject.id, subject: subject.name, department: dept.name, level: topic.level, topic: topic.name });
      }
    }
  }
  return out;
}

export function findSubjectByTopic(topic) {
  const needle = String(topic || "").toLowerCase().trim();
  if (!needle) return null;
  for (const subject of SUBJECTS) {
    for (const dept of subject.departments) {
      for (const t of dept.topics) {
        if (t.name.toLowerCase() === needle) return { subject, dept, topic: t };
      }
    }
  }
  return null;
}

export function topicsForLevel(level) {
  const order = ["early", "foundation", "elementary", "middle", "high", "college"];
  const max = Math.max(0, order.indexOf(level));
  return allTopics().filter((t) => order.indexOf(t.level) <= max);
}

/** Topic knowledge used by the built-in curriculum engine (works without any AI key). */
export const KNOWLEDGE = {
  counting: {
    idea: "Counting means matching one number word to one object, in order, without skipping or double-counting.",
    steps: ["Touch each object once as you say a number.", "The last number you say is the total.", "The order of the objects does not change the total."],
    example: (i) => `Line up your ${i} toys. Touch each one and count: 1, 2, 3… The last number tells you how many ${i} you have.`,
    check: "If you count 7 shells and then move them into a circle, do you still have 7?",
    practice: ["Count the chairs in your room.", "Count 12 steps out loud.", "Which is more: 6 or 9?"],
  },
  addition: {
    idea: "Addition joins two or more groups into one total.",
    steps: ["Start with the larger number.", "Count on the smaller number.", "Check by counting the whole group again."],
    example: (i) => `You have 4 ${i} and find 3 more. Start at 4 and count on: 5, 6, 7. So 4 + 3 = 7.`,
    check: "What is 8 + 5? Show me how you counted on.",
    practice: ["6 + 2", "9 + 4", "13 + 6"],
  },
  subtraction: {
    idea: "Subtraction takes away from a group, or finds the difference between two groups.",
    steps: ["Start at the total.", "Count backwards the amount you take away.", "Check by adding your answer back."],
    example: (i) => `10 ${i} on the table, 4 are put away. Count back: 9, 8, 7, 6. So 10 − 4 = 6.`,
    check: "What is 15 − 7? How can you check it with addition?",
    practice: ["9 − 3", "14 − 6", "20 − 11"],
  },
  multiplication: {
    idea: "Multiplication is repeated addition: equal groups counted quickly.",
    steps: ["Count how many equal groups you have.", "Count how many are in each group.", "Multiply: groups × size.", "Check with repeated addition."],
    example: (i) => `You have 4 boxes with 3 ${i} in each. That is 3 + 3 + 3 + 3 = 12, so 4 × 3 = 12.`,
    check: "A pack holds 6 stickers. How many in 7 packs? Explain your thinking.",
    practice: ["6 × 4", "8 × 7", "12 × 5"],
  },
  division: {
    idea: "Division splits a total into equal groups, or asks how many groups fit inside.",
    steps: ["Identify the total.", "Identify the group size (or number of groups).", "Share out equally.", "Check by multiplying back."],
    example: (i) => `18 ${i} shared between 3 friends. Give one at a time: each gets 6. So 18 ÷ 3 = 6, and 3 × 6 = 18 confirms it.`,
    check: "24 ÷ 6 — is that sharing into 6 groups, or making groups of 6? Do you get the same answer?",
    practice: ["35 ÷ 5", "48 ÷ 6", "72 ÷ 9"],
  },
  fractions: {
    idea: "A fraction shows equal parts of a whole. The bottom number says how many equal parts, the top says how many you have.",
    steps: ["Cut the whole into equal parts — equal is the key word.", "Count the parts you are talking about (numerator).", "Count all the equal parts (denominator).", "Write it as numerator/denominator."],
    example: (i) => `A pizza cut into 4 equal slices. You eat 1 slice: that is 1/4 of the ${i}-sized pizza. Eat 3 slices and 1 slice is left: 3/4 eaten, 1/4 left.`,
    check: "Which is bigger: 2/3 or 3/5? Explain without just guessing.",
    practice: ["Write 3/4 as a fraction of 12.", "Add 1/4 + 2/4.", "Which is larger: 1/2 or 3/8?"],
  },
  decimals: {
    idea: "Decimals are fractions written with place value: tenths, hundredths, thousandths.",
    steps: ["Line up the decimal points before adding or subtracting.", "Pad with zeros so both numbers have the same places.", "For multiplying, multiply whole numbers, then place the decimal point."],
    example: () => "0.7 is 7 tenths = 7/10. 0.25 is 25 hundredths = 1/4. 0.7 + 0.25 = 0.95.",
    check: "Why is 0.5 larger than 0.45?",
    practice: ["0.6 + 0.35", "1.2 × 0.4", "Convert 3/8 to a decimal."],
  },
  percentages: {
    idea: "Percent means 'per hundred'. 25% is 25 out of every 100 — a quarter.",
    steps: ["Turn the percent into a fraction (÷100) or decimal.", "Multiply by the amount.", "Sanity check: is the answer smaller than the whole? For under 100%, yes."],
    example: () => "A 40-dollar game is 25% off. 25% = 1/4, and 1/4 of 40 is 10. New price: 40 − 10 = 30.",
    check: "A jacket costs 80 and is 30% off. What do you pay?",
    practice: ["Find 15% of 60.", "What is 20% of 250?", "A price rises from 50 to 65 — what percent increase?"],
  },
  algebra: {
    idea: "Algebra uses letters for unknown numbers so we can write general rules and solve for them.",
    steps: ["Name the unknown with a letter.", "Translate the words into an equation.", "Undo operations in reverse order.", "Substitute your answer back to check."],
    example: () => "I'm thinking of a number, double it, add 3, and I get 11. Let the number be x: 2x + 3 = 11. Subtract 3 → 2x = 8. Divide by 2 → x = 4.",
    check: "Solve 3x − 5 = 16 and then check it.",
    practice: ["2x + 7 = 19", "5(x − 2) = 20", "The sum of a number and its double is 27."],
  },
  equations: {
    idea: "An equation is a balance. Whatever you do to one side, you must do to the other.",
    steps: ["Simplify each side.", "Move variable terms to one side.", "Move numbers to the other side.", "Divide by the coefficient, then check."],
    example: () => "4x + 3 = x + 18 → subtract x: 3x + 3 = 18 → subtract 3: 3x = 15 → x = 5.",
    check: "Why must you do the same thing to both sides?",
    practice: ["4x + 3 = x + 18", "2(x + 1) = 14", "x/3 + 4 = 9"],
  },
  geometry: {
    idea: "Geometry studies shapes, sizes, angles and space — and the relationships between them.",
    steps: ["Name the shape and label what you know.", "Choose the formula that matches the quantities.", "Substitute with units.", "Check the units make sense (area is squared)."],
    example: () => "Area of a rectangle = length × width. A garden 6 m by 4 m has area 24 m². Perimeter = 2(6 + 4) = 20 m.",
    check: "A square has perimeter 36 cm. What is its area?",
    practice: ["Area of a triangle with base 10 and height 6.", "Angles in a triangle add to what?", "Circumference of a circle with radius 3."],
  },
  trigonometry: {
    idea: "Trigonometry connects angles with side ratios in right triangles: sine, cosine, tangent.",
    steps: ["Label opposite, adjacent and hypotenuse from the angle.", "Pick SOH-CAH-TOA.", "Write the ratio, then solve for the unknown.", "Check the calculator is in degrees or radians."],
    example: () => "A ramp rises 3 m over a 5 m hypotenuse. sin θ = 3/5 = 0.6, so θ ≈ 36.9°.",
    check: "Which ratio would you use to find the height when you know an angle and the adjacent side?",
    practice: ["sin 30°", "Find x if tan 40° = x/7", "A 10 m ladder leans at 70° — how high does it reach?"],
  },
  calculus: {
    idea: "Calculus studies change. Derivatives measure instantaneous rate of change; integrals accumulate totals.",
    steps: ["Identify the function and what is changing.", "For a derivative, apply the power rule: d/dx xⁿ = n·xⁿ⁻¹.", "For an integral, reverse it: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C.", "Interpret the result in context."],
    example: () => "Distance s(t) = 5t². Velocity is s′(t) = 10t, so at t = 3 the velocity is 30 units per second.",
    check: "What does a negative derivative tell you about a moving object?",
    practice: ["Differentiate x³ + 2x.", "∫3x² dx", "Find the slope of y = x² at x = 4."],
  },
  probability: {
    idea: "Probability measures how likely something is, from 0 (impossible) to 1 (certain).",
    steps: ["Count all equally likely outcomes.", "Count the outcomes you want.", "Divide: wanted ÷ total.", "For independent events, multiply probabilities."],
    example: () => "Rolling a die, P(even) = 3/6 = 1/2. Rolling two sixes: 1/6 × 1/6 = 1/36.",
    check: "If you flip two coins, why isn't the chance of two heads 1/2?",
    practice: ["P(red) with 5 red and 15 blue marbles.", "Probability of rolling above 4 on a die.", "Two dice: P(sum = 7)."],
  },
  statistics: {
    idea: "Statistics summarises data so patterns can be seen: mean, median, mode and spread.",
    steps: ["Order the data.", "Find the mean (total ÷ count) and median (middle value).", "Look at spread — range or standard deviation.", "Ask what the numbers do NOT tell you."],
    example: () => "Scores 4, 6, 6, 8, 11: mean = 35/5 = 7, median = 6, mode = 6, range = 7.",
    check: "Why can the mean be misleading when one value is very large?",
    practice: ["Mean of 3, 7, 8, 10.", "Median of 2, 5, 9, 12, 20.", "What does a wide range suggest?"],
  },
  "ratios and proportions": {
    idea: "A ratio compares two amounts. A proportion says two ratios are equal.",
    steps: ["Write the ratio in the order the question asks.", "Set up the proportion.", "Cross-multiply and solve.", "Check the units are consistent."],
    example: () => "Paint mixes 2 parts blue to 3 parts white. For 12 parts white: 2/3 = x/12 → x = 8 parts blue.",
    check: "If 3 books cost 12, what do 7 cost — and why is it not 28?",
    practice: ["Simplify 18:24.", "A recipe for 4 uses 300 g; for 10?", "Solve 5/8 = x/40."],
  },
  integers: {
    idea: "Integers include negatives. Adding a negative moves left; multiplying two negatives gives a positive.",
    steps: ["Picture a number line.", "Adding a positive moves right; adding a negative moves left.", "Subtracting a negative is the same as adding.", "For multiplication, count the negative signs."],
    example: () => "−5 + 8 = 3 (start at −5, move right 8). −3 × −4 = 12 (two negatives make a positive).",
    check: "Why does −2 × −3 equal +6?",
    practice: ["−7 + 2", "−4 × 5", "8 − (−3)"],
  },
  "coordinate plane": {
    idea: "The coordinate plane locates points with an x (across) and y (up) value.",
    steps: ["Start at the origin (0,0).", "Move along x first — right is positive.", "Then move along y — up is positive.", "Write the point as (x, y)."],
    example: () => "Point (3, −2): right 3, down 2. It sits in the fourth quadrant.",
    check: "Where is (−4, 5) compared with the origin?",
    practice: ["Plot (2, 3).", "Which quadrant holds (−1, −1)?", "What is the midpoint of (0,0) and (6,4)?"],
  },
  phonics: {
    idea: "Phonics connects letters and letter groups to the sounds they make, so new words can be decoded.",
    steps: ["Say the sound of each letter, not its name.", "Blend the sounds smoothly.", "Look for digraphs like sh, ch, th.", "Re-read the word in the sentence for meaning."],
    example: () => "c–a–t blends to 'cat'. sh–i–p blends to 'ship' — two letters, one sound.",
    check: "What sounds do you hear in 'fish'?",
    practice: ["Sound out 'mop'.", "Find the digraph in 'chop'.", "Blend s–t–o–p."],
  },
  "sight words": {
    idea: "Sight words are very common words read instantly, by sight, so reading flows.",
    steps: ["Look at the whole word.", "Say it, then spell it aloud.", "Use it in a short sentence.", "Review it tomorrow and next week."],
    example: () => "Words like 'the', 'and', 'you', 'said' appear on almost every page. Recognising them instantly frees attention for meaning.",
    check: "Can you use 'because' in a sentence of your own?",
    practice: ["Read: the, said, come, they.", "Write a sentence with 'were'.", "Find two sight words on this page."],
  },
  vocabulary: {
    idea: "Vocabulary grows fastest when a new word is connected to something you already know and then used.",
    steps: ["Say the word and its meaning.", "Link it to a word you know (synonym or antonym).", "Use it in your own sentence.", "Revisit it in a week."],
    example: (i) => `'Enormous' means very big. A dinosaur footprint could be enormous. Your turn: something enormous near you?`,
    check: "What is a word that means the opposite of 'enormous'?",
    practice: ["Define 'curious'.", "Use 'fragile' in a sentence.", "Synonym for 'rapid'."],
  },
  "reading comprehension": {
    idea: "Comprehension means building meaning: what the text says, what it implies, and how it fits together.",
    steps: ["Preview the title and headings.", "Read once for the main idea.", "Read again for details and vocabulary.", "Summarise in your own words, then check the text."],
    example: () => "A paragraph about a boy packing a bag at dawn, quietly, tells us he is leaving early — even if it never says 'he left'.",
    check: "What is the main idea of the last thing you read?",
    practice: ["Summarise a page in one sentence.", "Find one fact and one opinion.", "Predict what happens next."],
  },
  grammar: {
    idea: "Grammar is the set of patterns that makes a sentence clear to another person.",
    steps: ["Find the subject (who or what).", "Find the verb (the action or state).", "Check they agree (singular/plural).", "Check tense stays consistent."],
    example: () => "'The dogs runs' is wrong because 'dogs' is plural, so it should be 'The dogs run'.",
    check: "Which is correct: 'She don't know' or 'She doesn't know'?",
    practice: ["Fix: 'They was late.'", "Identify the verb in 'The cat slept.'", "Make 'I walk' past tense."],
  },
  punctuation: {
    idea: "Punctuation shows the reader where to pause, stop and group ideas.",
    steps: ["End a statement with a full stop.", "Use a question mark for questions and an exclamation mark sparingly.", "Use commas to separate items and clauses.", "Use apostrophes for possession and contractions."],
    example: () => "'Let's eat, Grandma!' versus 'Let's eat Grandma!' — the comma changes everything.",
    check: "Where does the apostrophe go in 'the dog's bowl' and why?",
    practice: ["Punctuate: 'where are you going'", "Add commas: 'I bought apples pears and plums.'", "Its or it's: '___ raining.'"],
  },
  "essay writing": {
    idea: "An essay makes one clear claim and supports it with ordered evidence.",
    steps: ["Write a thesis: one sentence that states your claim.", "Plan 2–4 body paragraphs, each with one idea.", "Support each idea with evidence and explanation.", "Conclude by showing why the claim matters."],
    example: () => "Thesis: School gardens improve science learning. Paragraph 1: hands-on observation. Paragraph 2: long-term data. Paragraph 3: ownership and responsibility.",
    check: "What is the difference between a thesis and a topic?",
    practice: ["Write a thesis about reading.", "Outline three body paragraphs.", "Rewrite a weak conclusion."],
  },
  cells: {
    idea: "Cells are the smallest living units. Every living thing is made of one or more cells.",
    steps: ["Learn the shared parts: membrane, cytoplasm, genetic material.", "Learn plant extras: cell wall, chloroplasts, large vacuole.", "Link structure to job — chloroplasts make food from light.", "Compare cell types."],
    example: () => "A leaf cell has chloroplasts to capture sunlight, while a root hair cell has a long thin shape to absorb water.",
    check: "Why do plant cells need a cell wall but animal cells do not?",
    practice: ["Name three parts both cell types share.", "What does the nucleus do?", "Why are cells small?"],
  },
  photosynthesis: {
    idea: "Plants use light energy to turn water and carbon dioxide into sugar, releasing oxygen.",
    steps: ["Light is absorbed by chlorophyll in chloroplasts.", "Water arrives from roots; CO₂ enters through stomata.", "Light energy builds glucose.", "Oxygen leaves as a by-product."],
    example: () => "Word equation: carbon dioxide + water → (light + chlorophyll) → glucose + oxygen.",
    check: "Does photosynthesis happen at night? Why or why not?",
    practice: ["Write the word equation.", "Where does the water come from?", "Why are leaves green?"],
  },
  genetics: {
    idea: "Genes are instructions made of DNA, passed from parents to offspring, and they influence traits.",
    steps: ["DNA is organised into genes on chromosomes.", "Alleles are versions of a gene.", "Dominant alleles show when present once; recessive need two.", "Punnett squares predict offspring ratios."],
    example: () => "Two heterozygous parents (Bb × Bb) give 1 BB : 2 Bb : 1 bb — so 3 in 4 show the dominant trait.",
    check: "How can two brown-eyed parents have a blue-eyed child?",
    practice: ["Cross Bb × bb.", "What is an allele?", "Difference between genotype and phenotype?"],
  },
  ecosystems: {
    idea: "An ecosystem is living things plus their environment, linked by energy flow and cycling matter.",
    steps: ["Identify producers, consumers, decomposers.", "Trace energy from the sun through a food chain.", "Notice competition and interdependence.", "Consider what happens if one part changes."],
    example: () => "Grass → rabbit → fox. Remove the foxes and rabbits multiply, overgrazing the grass.",
    check: "What would happen to a pond if all the algae disappeared?",
    practice: ["Draw a food chain.", "Name a decomposer.", "What is a habitat?"],
  },
  fossils: {
    idea: "Fossils are preserved traces of past life, usually formed when remains are buried quickly and minerals replace them over a very long time.",
    steps: ["An organism dies and is buried quickly in mud or sand.", "Soft parts decay; hard parts remain.", "Layers build up and pressure increases.", "Minerals slowly replace the remains; erosion later exposes them."],
    example: () => "A dinosaur that died in a river delta could be buried in silt. Millions of years later, its bones are stone — and a palaeontologist finds them in a cliff.",
    check: "Why are fossils of soft-bodied animals so rare?",
    practice: ["Order the fossil formation steps.", "What is a mould fossil?", "Why do we find sea fossils on mountains?"],
  },
  "plate tectonics": {
    idea: "Earth's outer shell is broken into plates that move slowly on the mantle, causing earthquakes, volcanoes and mountains.",
    steps: ["The lithosphere is split into plates.", "Heat from the mantle drives slow convection.", "Plate boundaries are divergent, convergent or transform.", "Most earthquakes and volcanoes occur at boundaries."],
    example: () => "The Himalayas are still rising because the Indian plate pushes into the Eurasian plate — a convergent boundary.",
    check: "Why do most earthquakes happen near plate edges rather than in the middle of continents?",
    practice: ["Name the three boundary types.", "What is subduction?", "Where is the Ring of Fire?"],
  },
  volcanoes: {
    idea: "A volcano is an opening where molten rock, ash and gas escape from inside Earth.",
    steps: ["Magma forms in the mantle or at subduction zones.", "Pressure pushes it upward through cracks.", "At the surface it erupts as lava and ash.", "Cooled lava builds new rock and land."],
    example: () => "Hawaii is built from shield volcanoes fed by a hot spot under the Pacific plate.",
    check: "Why are some eruptions gentle and others explosive?",
    practice: ["Difference between magma and lava?", "What is a hot spot?", "Name one benefit of volcanic soil."],
  },
  "solar system": {
    idea: "Our solar system is the Sun plus everything bound to it: eight planets, moons, asteroids and comets.",
    steps: ["The Sun holds 99.8% of the system's mass.", "Inner planets are rocky; outer planets are gas and ice giants.", "Gravity keeps orbits stable.", "Distances are measured in astronomical units."],
    example: () => "Order from the Sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune. Light takes about 8 minutes to reach Earth.",
    check: "Why do the outer planets have so many moons?",
    practice: ["Name the four rocky planets.", "What is an AU?", "Why is Venus hotter than Mercury?"],
  },
  planets: {
    idea: "A planet is a large body orbiting a star that has cleared its orbit and is rounded by its own gravity.",
    steps: ["Orbit a star.", "Be massive enough to be round.", "Clear neighbouring debris.", "Compare size, atmosphere, day and year."],
    example: () => "A day on Venus is longer than its year, and it spins backwards compared with most planets.",
    check: "Why is Pluto no longer called a planet?",
    practice: ["Which planet is largest?", "Which has the strongest winds?", "Why is Mars red?"],
  },
  atoms: {
    idea: "Atoms are the building blocks of matter: a nucleus of protons and neutrons with electrons around it.",
    steps: ["Protons are positive, neutrons neutral, electrons negative.", "Atomic number = protons, which decides the element.", "Electrons occupy shells.", "Bonding involves the outer electrons."],
    example: () => "Carbon has 6 protons. Two atoms with different numbers of neutrons are isotopes of the same element.",
    check: "What makes one element different from another?",
    practice: ["How many protons in oxygen (atomic number 8)?", "Charge of an electron?", "What is an ion?"],
  },
  "the periodic table": {
    idea: "The periodic table arranges elements by atomic number, revealing repeating patterns in properties.",
    steps: ["Read the symbol and atomic number.", "Groups (columns) share outer-electron counts.", "Periods (rows) show shells filling.", "Metals sit left, non-metals right."],
    example: () => "Group 1 metals like sodium react vigorously with water; Group 18 noble gases barely react at all — because their outer shells are full.",
    check: "Why are noble gases so unreactive?",
    practice: ["Which group contains helium?", "What does the atomic number tell you?", "Find a metal and a non-metal."],
  },
  "chemical reactions": {
    idea: "A chemical reaction rearranges atoms into new substances; mass is conserved.",
    steps: ["Identify reactants and products.", "Balance the equation so atoms match.", "Note energy changes and observable signs.", "Check the reaction type: synthesis, decomposition, combustion, displacement."],
    example: () => "2H₂ + O₂ → 2H₂O. Four hydrogen atoms and two oxygen atoms on each side.",
    check: "Why must an equation be balanced?",
    practice: ["Balance H₂ + O₂ → H₂O.", "Name a sign a reaction happened.", "Is melting ice a chemical change?"],
  },
  forces: {
    idea: "A force is a push or pull that can change an object's motion or shape; forces come in pairs.",
    steps: ["Identify every force acting on the object.", "Add them to find the net force.", "Net force changes motion (F = ma).", "Remember the equal and opposite reaction."],
    example: () => "A 10 kg box pushed with 30 N against 10 N of friction: net 20 N, so a = F/m = 2 m/s².",
    check: "If forces are equal and opposite, why does anything move at all?",
    practice: ["Net force: 12 N right, 5 N left.", "F = ma with 20 N and 4 kg.", "Name the force slowing a sliding book."],
  },
  gravity: {
    idea: "Gravity is the attraction between masses; near Earth it accelerates falling objects at about 9.8 m/s².",
    steps: ["Gravity acts between any two masses.", "Weight = mass × gravitational field strength.", "Air resistance affects fall speed, not the gravity itself.", "Orbits are free-fall with sideways motion."],
    example: () => "A 60 kg person weighs about 588 N on Earth but only 98 N on the Moon, where gravity is weaker.",
    check: "Why do a feather and a hammer fall together on the Moon?",
    practice: ["Weight of 5 kg on Earth.", "Why does mass not change in space?", "What keeps the Moon in orbit?"],
  },
  energy: {
    idea: "Energy is the capacity to do work. It transfers between forms but is never created or destroyed.",
    steps: ["Identify the energy stores (kinetic, potential, thermal, chemical).", "Trace the transfers.", "Remember conservation.", "Useful vs wasted energy."],
    example: () => "A rollercoaster trades gravitational potential energy for kinetic energy as it drops — some becomes sound and heat.",
    check: "Where does the energy go when a ball stops bouncing?",
    practice: ["Calculate KE of 2 kg at 3 m/s (½mv²).", "Name three energy forms in a phone.", "What is wasted energy?"],
  },
  electricity: {
    idea: "Electric current is the flow of charge driven by voltage through a circuit.",
    steps: ["A circuit must be closed.", "Voltage pushes; resistance opposes.", "Ohm's law: V = IR.", "Series shares current; parallel shares voltage."],
    example: () => "A 12 V battery across 4 Ω gives I = V/R = 3 A.",
    check: "Why do household lights stay on when one bulb breaks?",
    practice: ["V = IR with 6 V, 2 Ω.", "Series vs parallel difference.", "Name a conductor and an insulator."],
  },
  light: {
    idea: "Light travels in straight lines, can reflect, refract and split into colours.",
    steps: ["Light travels about 300,000 km/s in a vacuum.", "Reflection: angle in equals angle out.", "Refraction: bending when speed changes between media.", "White light contains a spectrum."],
    example: () => "A straw looks bent in water because light from it bends as it leaves the water — refraction.",
    check: "Why is the sky blue but sunsets red?",
    practice: ["Law of reflection.", "What is a prism doing?", "Why do shadows form?"],
  },
  sound: {
    idea: "Sound is a longitudinal vibration travelling through a medium as a pressure wave.",
    steps: ["An object vibrates.", "Vibrations push air molecules, creating compressions and rarefactions.", "The wave travels at about 343 m/s in air.", "Pitch = frequency, volume = amplitude."],
    example: () => "A guitar string vibrating 440 times a second produces the note A above middle C.",
    check: "Why can't sound travel through space?",
    practice: ["What is frequency measured in?", "Why does sound travel faster in water?", "How does an echo happen?"],
  },
  "ancient egypt": {
    idea: "Ancient Egypt flourished along the Nile for over 3,000 years, supported by farming, writing and a strong state.",
    steps: ["The Nile's floods renewed fertile soil.", "Unified kingdoms created a powerful pharaoh.", "Hieroglyphs and papyrus recorded administration.", "Monuments and tombs reveal beliefs about the afterlife."],
    example: () => "The Great Pyramid at Giza was built around 2560 BCE — before Rome existed by more than two thousand years.",
    check: "Why was the Nile so central to Egyptian civilisation?",
    practice: ["What are hieroglyphs?", "Why did Egyptians mummify bodies?", "Name the writing material they used."],
  },
  "ancient greece": {
    idea: "Ancient Greek city-states created influential ideas about democracy, philosophy, theatre and science.",
    steps: ["Geography made independent city-states (poleis).", "Athens developed direct democracy.", "Philosophers questioned how to know things.", "Greek culture spread through trade and conquest."],
    example: () => "Athenian citizens voted directly on laws — though only adult male citizens could participate.",
    check: "How was Athenian democracy different from modern democracy?",
    practice: ["What is a polis?", "Name two Greek philosophers.", "What was the Olympic Games' purpose?"],
  },
  "ancient rome": {
    idea: "Rome grew from a city-state to an empire whose law, language and engineering shaped later societies.",
    steps: ["A republic with a senate governed early Rome.", "Military expansion created an empire.", "Roads, aqueducts and law unified it.", "Internal pressures and invasions ended the western empire."],
    example: () => "Roman concrete and arch engineering let the Pantheon's dome stand for nearly two thousand years.",
    check: "What is meant by 'Roman law' influencing modern systems?",
    practice: ["Republic vs empire?", "What was an aqueduct for?", "Why did the western empire fall?"],
  },
  "map reading": {
    idea: "Maps use scale, direction and symbols to represent places accurately on paper or screen.",
    steps: ["Read the title and legend.", "Find the scale and estimate distance.", "Orient using north.", "Use grid references for exact spots."],
    example: () => "If 1 cm represents 2 km, then 5 cm on the map is 10 km on the ground.",
    check: "Why can't every map show everything?",
    practice: ["Convert 4 cm at 1:50,000.", "What does a contour line show?", "Find a compass bearing."],
  },
  parables: {
    idea: "A parable is a short story told to teach a moral or spiritual lesson, often using everyday life.",
    steps: ["Read the story and note who is listening.", "Identify the ordinary situation.", "Look for the comparison at the heart of it.", "Ask what the lesson asks of the listener."],
    example: () => "The Good Samaritan (Luke 10:25–37) answers 'who is my neighbour?' with a story about a despised outsider showing mercy.",
    check: "What question was the parable of the Good Samaritan answering?",
    practice: ["Which parable teaches about forgiveness?", "Why did Jesus often teach in stories?", "Name two parables."],
  },
  "ten commandments": {
    idea: "The Ten Commandments (Exodus 20) are the core moral instructions given to Israel at Sinai.",
    steps: ["Read Exodus 20:1–17.", "Note the first four concern our relationship with God.", "The last six concern how we treat others.", "Compare how different traditions number them."],
    example: () => "Exodus 20:3 — 'You shall have no other gods before me.' This is usually counted as the first commandment.",
    check: "Which commandments are about how we treat other people?",
    practice: ["Recite the fifth commandment.", "Which book and chapter? ", "Why do traditions number them differently?"],
  },
};

export function knowledgeFor(topic) {
  const key = String(topic || "").toLowerCase().trim();
  if (KNOWLEDGE[key]) return KNOWLEDGE[key];
  const match = Object.keys(KNOWLEDGE).find((k) => key.includes(k) || k.includes(key));
  return match ? KNOWLEDGE[match] : null;
}

export const INTERESTS = [
  { id: "animals", label: "Animals", emoji: "🦊" },
  { id: "dinosaurs", label: "Dinosaurs", emoji: "🦕" },
  { id: "fossils", label: "Fossils", emoji: "🦴" },
  { id: "space", label: "Space", emoji: "🚀" },
  { id: "planets", label: "Planets", emoji: "🪐" },
  { id: "gardening", label: "Gardening", emoji: "🌻" },
  { id: "nature", label: "Nature", emoji: "🌿" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "drawing", label: "Drawing", emoji: "✏️" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "history", label: "History", emoji: "🏺" },
  { id: "geography", label: "Geography", emoji: "🗺️" },
  { id: "technology", label: "Technology", emoji: "💡" },
  { id: "coding", label: "Coding", emoji: "💻" },
  { id: "cooking", label: "Cooking", emoji: "🍳" },
  { id: "building", label: "Building things", emoji: "🔧" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "reading", label: "Reading", emoji: "📚" },
  { id: "writing", label: "Writing", emoji: "✍️" },
  { id: "bible", label: "Religion & Bible study", emoji: "🕊️" },
  { id: "experiments", label: "Science experiments", emoji: "🧪" },
];

export const ACHIEVEMENTS = [
  { code: "first_lesson", name: "First Lesson Completed", icon: "🌱", description: "Finished your very first lesson." },
  { code: "math_explorer", name: "Math Explorer", icon: "➗", description: "Completed 3 mathematics lessons." },
  { code: "reading_champion", name: "Reading Champion", icon: "📖", description: "Completed 3 reading lessons." },
  { code: "science_detective", name: "Science Detective", icon: "🔬", description: "Completed 3 science lessons." },
  { code: "history_explorer", name: "History Explorer", icon: "🏺", description: "Completed 3 social studies lessons." },
  { code: "bible_scholar", name: "Bible Scholar", icon: "🕊️", description: "Completed 3 Bible study lessons." },
  { code: "vocabulary_builder", name: "Vocabulary Builder", icon: "💬", description: "Saved 10 flashcards." },
  { code: "streak_7", name: "Seven-Day Learning Streak", icon: "🔥", description: "Learned something 7 days in a row." },
  { code: "quiz_ace", name: "Quiz Ace", icon: "🎯", description: "Scored 80% or higher on a quiz." },
  { code: "perfect_score", name: "Perfect Score", icon: "⭐", description: "Answered every quiz question correctly." },
  { code: "curious_mind", name: "Curious Mind", icon: "💭", description: "Asked 10 questions in a conversation." },
  { code: "bookworm", name: "Bookworm", icon: "📚", description: "Saved 5 items to your library." },
  { code: "xp_100", name: "Century Club", icon: "💯", description: "Earned 100 XP." },
  { code: "xp_500", name: "Learning Legend", icon: "🏆", description: "Earned 500 XP." },
  { code: "first_mastery", name: "First Mastery", icon: "🕯️", description: "Mastered a topic with real assessment evidence." },
  { code: "five_mastered", name: "Five Lights", icon: "✨", description: "Mastered five topics across the Library." },
  { code: "library_explorer", name: "Library Explorer", icon: "🗺️", description: "Studied in three different Library sections." },
  { code: "quest_first", name: "Commission Complete", icon: "📜", description: "Claimed your first quest reward." },
  { code: "quest_ten", name: "Trusted Adventurer", icon: "🧭", description: "Claimed ten quest rewards." },
  { code: "lorekeeper", name: "Lorekeeper", icon: "🔮", description: "Reached level 5." },
];

export const TUTOR_PERSONALITIES = [
  { id: "friendly", name: "Friendly teacher", blurb: "Warm, encouraging, always checks you understood.", emoji: "😊" },
  { id: "patient", name: "Patient mentor", blurb: "Never rushes. Explains as many ways as you need.", emoji: "🌿" },
  { id: "curious", name: "Curious explorer", blurb: "Loves wondering aloud and asking 'why?' with you.", emoji: "🔭" },
  { id: "coach", name: "Energetic coach", blurb: "Upbeat, goal-focused, big on celebrating effort.", emoji: "⚡" },
  { id: "professor", name: "Calm professor", blurb: "Precise, structured, thorough explanations.", emoji: "🎓" },
  { id: "buddy", name: "Playful study buddy", blurb: "Jokes, games and learning side by side.", emoji: "🎈" },
];

export const VOICE_STYLES = [
  { id: "friendly", name: "Friendly", hint: "warm, clear" },
  { id: "calm", name: "Calm", hint: "slow, soothing" },
  { id: "energetic", name: "Energetic", hint: "bright, quick" },
  { id: "gentle", name: "Gentle", hint: "soft, patient" },
  { id: "professional", name: "Professional", hint: "even, precise" },
  { id: "playful", name: "Playful", hint: "lively, fun" },
];

export const LEARNING_STYLES = [
  { id: "visual", label: "Visual — diagrams and colours", emoji: "👁️" },
  { id: "audio", label: "Listening and talking it through", emoji: "🎧" },
  { id: "reading", label: "Reading and writing", emoji: "📄" },
  { id: "hands-on", label: "Hands-on and building things", emoji: "🛠️" },
  { id: "interactive", label: "Interactive games and quizzes", emoji: "🎮" },
];

export const LESSON_LENGTHS = [
  { id: "quick", label: "Quick lesson", minutes: [5, 10], blurb: "5–10 minutes — one clear idea." },
  { id: "standard", label: "Standard lesson", minutes: [15, 25], blurb: "15–25 minutes — teach, practice, check." },
  { id: "extended", label: "Extended lesson", minutes: [30, 60], blurb: "30–60 minutes — deep dive with projects." },
];

export const DAILY_CHALLENGE_BANK = [
  { subject: "math", text: "A pack of 6 dinosaur cards costs 4.50. How much do 4 packs cost?", answer: "18.00", hint: "Find the cost of one pack first." },
  { subject: "math", text: "What is 15% of 80?", answer: "12", hint: "10% is 8, and 5% is half of that." },
  { subject: "science", text: "Name the process plants use to make food from sunlight.", answer: "photosynthesis", hint: "It happens in the chloroplasts." },
  { subject: "science", text: "Which planet is known as the Red Planet?", answer: "mars", hint: "Its colour comes from iron oxide." },
  { subject: "reading", text: "What is the plural of 'child'?", answer: "children", hint: "It is an irregular plural." },
  { subject: "reading", text: "Which word is a synonym for 'enormous'?", answer: "huge", hint: "Think of something very big." },
  { subject: "social", text: "Which ancient civilisation built the pyramids at Giza?", answer: "egypt", hint: "Think of the Nile." },
  { subject: "bible", text: "In which book and chapter are the Ten Commandments found?", answer: "exodus 20", hint: "The second book of the Bible." },
];
