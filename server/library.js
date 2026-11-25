/**
 * The Great Library catalogue.
 *
 * Static, versioned content. Each book maps to a curriculum subject so the
 * existing lesson, quiz and tutor engines keep working, while chapters and
 * topics give the adventure its own structure. Book ids are stable: mastery,
 * bookmarks and quests reference them.
 *
 * Extra books added through the content system are merged at request time by
 * the API; this module stays the reviewed core collection.
 */

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const topic = (name, blurb) => ({ name, blurb });

const LANGUAGE_SKILLS = (language) => [
  topic(`${language} vocabulary`, `High-frequency words and phrases for everyday ${language}.`),
  topic(`${language} pronunciation`, `Sounds, stress and rhythm, with listen-and-repeat practice.`),
  topic(`${language} grammar`, `Sentence patterns and the rules that make ${language} predictable.`),
  topic(`${language} reading`, `Short texts with support, from signs and labels to paragraphs.`),
  topic(`${language} writing`, `Build sentences and short messages that say what you mean.`),
  topic(`${language} listening`, `Train your ear with slow, clear audio and comprehension checks.`),
  topic(`${language} conversation`, `Role-play real exchanges: greetings, requests, directions, opinions.`),
  topic(`${language} culture`, `Places, food, festivals and etiquette that give the language context.`),
];

const languageBook = (languages) => ({
  id: "languages",
  title: "Languages",
  subtitle: "Many Tongues, One Library",
  section: "craft",
  subject: "languages",
  icon: "🗣️",
  color: "#0f9d8f",
  blurb: "Living languages learned through words, sound, story and real conversation.",
  chapters: [
    ...languages.map((language) => ({ title: language, topics: LANGUAGE_SKILLS(language) })),
    {
      title: "Other languages",
      topics: [
        topic("Choosing a new language", "How to choose a language that fits your life and keep it interesting."),
        topic("Language learning strategies", "Spaced repetition, immersion and speaking before you feel ready."),
        topic("Finding a language guide", "Ask the library for an approved module; reviewed content is added over time."),
      ],
    },
  ],
});

const RAW_BOOKS = [
  {
    id: "math",
    title: "Mathematics",
    subtitle: "The Art of Numbers",
    section: "foundations",
    subject: "math",
    icon: "➗",
    color: "#7c5cf0",
    blurb: "Numbers, patterns, shapes and the quiet logic behind almost everything.",
    chapters: [
      {
        title: "Understanding Numbers",
        topics: [
          topic("Numbers and counting", "What numbers mean, how counting works and where we use it."),
          topic("Place value", "Why the position of a digit changes its value."),
          topic("Comparing numbers", "Greater, smaller, equal and how to prove it."),
          topic("Number patterns", "Spot the rule, continue the sequence, explain the pattern."),
        ],
      },
      {
        title: "The Four Operations",
        topics: [
          topic("Addition", "Joining groups and counting on with confidence."),
          topic("Subtraction", "Taking away, finding the difference and checking your work."),
          topic("Multiplication", "Equal groups, arrays and repeated addition."),
          topic("Division", "Sharing fairly and grouping into equal parts."),
          topic("Order of operations", "Brackets, powers and the order that keeps answers consistent."),
        ],
      },
      {
        title: "Parts of a Whole",
        topics: [
          topic("Fractions", "Equal parts, numerators and denominators in real situations."),
          topic("Decimals", "Tenths and hundredths written with place value."),
          topic("Percentages", "Per hundred: discounts, increases and comparisons."),
          topic("Ratios and proportions", "Compare quantities and scale recipes, maps and models."),
          topic("Negative numbers", "Below zero: temperature, debt and coordinate movement."),
        ],
      },
      {
        title: "Patterns and Algebra",
        topics: [
          topic("Algebra", "Letters as unknown numbers and general rules."),
          topic("Expressions", "Build, simplify and evaluate algebraic expressions."),
          topic("Equations", "Balance both sides and solve for the unknown."),
          topic("Inequalities", "Ranges, boundaries and graphing 'less than' and 'more than'."),
          topic("Functions", "Inputs, outputs and the relationship between them."),
        ],
      },
      {
        title: "Shape, Space and Measure",
        topics: [
          topic("Geometry", "Points, lines, planes and the shapes built from them."),
          topic("Shapes", "Classify polygons by sides, angles and symmetry."),
          topic("Angles", "Measure, estimate and reason with angles."),
          topic("Measurement", "Units, conversions and choosing the right instrument."),
          topic("Perimeter", "Distance around a shape, with real-world fences and frames."),
          topic("Area", "Space inside a shape, from grid squares to formulas."),
          topic("Volume", "Space inside a solid, and why units are cubed."),
        ],
      },
      {
        title: "Data and Advanced Mathematics",
        topics: [
          topic("Statistics", "Collect, summarise and interpret data honestly."),
          topic("Probability", "Chance, likelihood and the language of uncertainty."),
          topic("Graphs", "Choose, read and draw the right graph for the data."),
          topic("Trigonometry", "Angles and side ratios in right triangles."),
          topic("Precalculus", "Functions, sequences and the tools just before calculus."),
          topic("Calculus", "Rates of change and accumulated totals."),
          topic("Financial mathematics", "Interest, growth, loans and long-term planning."),
          topic("Mathematical reasoning", "Explain why a result must be true, not just that it works."),
          topic("Advanced mathematics", "Proof, abstraction and the ideas beyond the syllabus."),
        ],
      },
    ],
  },
  {
    id: "reading",
    title: "Language Arts",
    subtitle: "The Reader's Compass",
    section: "foundations",
    subject: "reading",
    icon: "📖",
    color: "#e0699a",
    blurb: "Reading, writing and speaking with clarity, imagination and care.",
    chapters: [
      {
        title: "First Letters",
        topics: [
          topic("Alphabet and phonics", "Letter names, sounds and how they combine."),
          topic("Reading fundamentals", "Fluency, phrasing and making meaning from print."),
          topic("Vocabulary", "Grow words through context, roots and deliberate use."),
          topic("Spelling", "Patterns, rules and the exceptions worth learning."),
        ],
      },
      {
        title: "Building Sentences",
        topics: [
          topic("Grammar", "The jobs words do inside a sentence."),
          topic("Punctuation", "Marks that guide breath, meaning and clarity."),
          topic("Sentence structure", "Simple, compound and complex sentences that flow."),
          topic("Paragraph writing", "One idea, supported and linked to the next."),
        ],
      },
      {
        title: "Reading for Meaning",
        topics: [
          topic("Reading comprehension", "Retrieve, infer and evaluate what a text says."),
          topic("Fiction", "Character, setting, conflict and the reader's expectations."),
          topic("Nonfiction", "Structure, evidence and reading for information."),
          topic("Literary analysis", "Read closely: voice, imagery, theme and form."),
        ],
      },
      {
        title: "Writing with Purpose",
        topics: [
          topic("Creative writing", "Images, voice and choices that make writing alive."),
          topic("Essay writing", "Thesis, evidence and a conclusion that earns its place."),
          topic("Research writing", "Questions, sources, notes and honest citation."),
          topic("Poetry", "Line, sound, image and the pressure of few words."),
          topic("Storytelling", "Shape a story an audience wants to follow."),
        ],
      },
      {
        title: "The Spoken Word",
        topics: [
          topic("Public speaking", "Voice, pace, structure and managing nerves."),
          topic("Debate", "Claim, evidence, rebuttal and listening to the other side."),
          topic("Communication skills", "Say what you mean and check what was heard."),
          topic("Advanced composition", "Long-form writing with a sustained argument and style."),
        ],
      },
    ],
  },
  {
    id: "science",
    title: "Science",
    subtitle: "The Observing Mind",
    section: "sciences",
    subject: "science",
    icon: "🔬",
    color: "#21a89a",
    blurb: "Ask, test, explain: the disciplined curiosity behind how the world works.",
    chapters: [
      {
        title: "How Science Works",
        topics: [
          topic("Scientific method", "Question, hypothesis, test, evidence, revise."),
          topic("Observation and experimentation", "Notice carefully, change one thing and record honestly."),
          topic("Matter", "Solids, liquids, gases and the particles behind them."),
          topic("Energy", "Transfer, store and the conservation of energy."),
        ],
      },
      {
        title: "Forces and Energy",
        topics: [
          topic("Forces and motion", "Pushes, pulls and how motion changes."),
          topic("Electricity", "Circuits, current, voltage and safety."),
          topic("Magnetism", "Fields, poles and everyday uses."),
          topic("Waves and sound", "Vibration, frequency and how sound travels."),
          topic("Light", "Reflection, refraction and how we see."),
        ],
      },
      {
        title: "Chemistry",
        topics: [
          topic("Chemistry fundamentals", "Atoms, elements, compounds and mixtures."),
          topic("Atoms and molecules", "The building blocks and how they bond."),
          topic("Chemical reactions", "Rearranging atoms, with evidence of change."),
          topic("Periodic table", "Organising elements by their properties."),
          topic("Organic chemistry", "Carbon compounds and the chemistry of life."),
        ],
      },
      {
        title: "Living Systems",
        topics: [
          topic("Biology", "The study of life at every scale."),
          topic("Cells", "The smallest living units and what they do."),
          topic("Genetics", "Inheritance, DNA and variation."),
          topic("Evolution", "How populations change over generations."),
          topic("Microbiology", "Microscopic life, useful and harmful."),
          topic("Human biology", "Body systems and how they keep you alive."),
          topic("Ecology", "Organisms, populations and their environments."),
        ],
      },
      {
        title: "Earth, Environment and Research",
        topics: [
          topic("Environmental science", "Human impact, resources and sustainability."),
          topic("Physics", "Matter, motion, energy and the rules they follow."),
          topic("Thermodynamics", "Heat, work and why some changes only go one way."),
          topic("Scientific research", "Design a fair investigation and communicate findings."),
        ],
      },
    ],
  },
  {
    id: "earth",
    title: "Earth and Nature",
    subtitle: "The Living Planet",
    section: "sciences",
    subject: "science",
    icon: "🌍",
    color: "#9a6b3f",
    blurb: "From molten core to living soil: the slow, powerful systems of our planet.",
    chapters: [
      {
        title: "Under Our Feet",
        topics: [
          topic("Earth structure", "Crust, mantle, outer core and inner core."),
          topic("Rocks and minerals", "How rocks form, change and tell stories."),
          topic("Fossils", "Evidence of ancient life, preserved by chance."),
          topic("Paleontology", "Reconstructing organisms from fragments."),
          topic("Dinosaurs", "Diversity, extinction and what fossils reveal."),
          topic("Geological time", "Millions of years, arranged and measured."),
        ],
      },
      {
        title: "A Restless Planet",
        topics: [
          topic("Plate tectonics", "Moving plates and the features they create."),
          topic("Volcanoes", "Magma, eruption styles and their effects."),
          topic("Earthquakes", "Stress, faulting and measuring seismic waves."),
          topic("Natural disasters", "Hazards, preparation and community response."),
          topic("Mountains", "Uplift, erosion and the shaping of high ground."),
        ],
      },
      {
        title: "Weather and Water",
        topics: [
          topic("Weather", "Air pressure, fronts and daily forecasts."),
          topic("Climate", "Long-term patterns and the difference from weather."),
          topic("Oceans", "Currents, depth zones and the ocean's role in climate."),
          topic("Rivers and lakes", "Drainage, flow and freshwater systems."),
          topic("Soil science", "Texture, nutrients and the life inside soil."),
        ],
      },
      {
        title: "Life and Protection",
        topics: [
          topic("Natural resources", "Renewable, finite and how we use them."),
          topic("Ecosystems", "Energy flow and interdependence."),
          topic("Conservation", "Protecting habitats and species with evidence."),
          topic("Biodiversity", "Why variety makes systems resilient."),
          topic("Environmental protection", "Choices, policies and everyday action."),
        ],
      },
    ],
  },
  {
    id: "space",
    title: "Space and Astronomy",
    subtitle: "The Celestial Atlas",
    section: "sciences",
    subject: "science",
    icon: "🔭",
    color: "#4d6fd6",
    blurb: "Look up: the sky is a library written in light.",
    chapters: [
      {
        title: "The Night Sky",
        topics: [
          topic("The night sky", "What is visible, when, and how to find it."),
          topic("Stars", "Light, distance, colour and stellar life cycles."),
          topic("Planets", "Worlds orbiting the Sun, and how they differ."),
          topic("Moons", "Natural satellites and the forces that shape them."),
        ],
      },
      {
        title: "Our Solar System",
        topics: [
          topic("The solar system", "The Sun, planets, belts and the scale between them."),
          topic("The Sun", "The star that powers every system on Earth."),
          topic("Constellations", "Star patterns as navigation and storytelling."),
          topic("Galaxies", "Vast systems of stars, gas and dark matter."),
          topic("Nebulae", "Clouds where stars are born and die."),
          topic("Black holes", "Gravity so strong that light cannot escape."),
        ],
      },
      {
        title: "Exploration",
        topics: [
          topic("Space exploration", "Robots, telescopes and humans beyond Earth."),
          topic("Astronauts", "Training, life in orbit and returning home."),
          topic("Rockets", "Thrust, staging and escaping gravity."),
          topic("Satellites", "Orbits that support communication and weather."),
          topic("Telescopes", "Collecting light to see farther and earlier."),
        ],
      },
      {
        title: "The Universe",
        topics: [
          topic("The universe", "Its scale, age and expansion."),
          topic("Cosmology", "Models of the universe's beginning and fate."),
          topic("Astrobiology", "What life needs, and where it might exist elsewhere."),
        ],
      },
    ],
  },
  {
    id: "history",
    title: "History",
    subtitle: "Echoes of the Past",
    section: "humanities",
    subject: "social",
    icon: "🏛️",
    color: "#c08a3e",
    blurb: "People, decisions and consequences across time — told from many sides.",
    chapters: [
      {
        title: "Ancient Worlds",
        topics: [
          topic("Ancient civilizations", "Cities, writing, trade and the first states."),
          topic("Ancient Egypt", "Nile agriculture, belief and monumental architecture."),
          topic("Ancient Greece", "City-states, philosophy and early democracy."),
          topic("Ancient Rome", "Republic, empire and law that outlived it."),
          topic("African history", "Kingdoms, trade routes and long intellectual traditions."),
          topic("Caribbean history", "Indigenous, colonial and independent histories."),
        ],
      },
      {
        title: "The Wider World",
        topics: [
          topic("Asian history", "Dynasties, trade networks and modern transformation."),
          topic("European history", "Competing powers and ideas that reshaped continents."),
          topic("Indigenous histories", "Knowledge, sovereignty and survival."),
          topic("Medieval history", "Faith, feudalism, trade and cultural exchange."),
        ],
      },
      {
        title: "Ideas and Revolutions",
        topics: [
          topic("Renaissance", "Art, science and the rediscovery of old questions."),
          topic("Industrial Revolution", "Machines, cities and the reshaping of work."),
          topic("World War I", "Alliances, technology and a changed world."),
          topic("World War II", "Global conflict, atrocity and the post-war order."),
          topic("American history", "Colonisation, constitution and contested democracy."),
          topic("Civil rights history", "Movements, courage and unfinished work."),
          topic("Modern history", "Decolonisation, technology and interdependence."),
        ],
      },
      {
        title: "Investigating the Past",
        topics: [
          topic("Historical research", "Questions, sources, bias and interpretation."),
          topic("Archaeology", "Reading material evidence with care."),
          topic("Historical geography", "How borders, terrain and trade explain events."),
        ],
      },
    ],
  },
  {
    id: "geography",
    title: "Geography and Cultures",
    subtitle: "The Map Room",
    section: "humanities",
    subject: "social",
    icon: "🗺️",
    color: "#2f9e8f",
    blurb: "Maps, places and the lives that shape and are shaped by them.",
    chapters: [
      {
        title: "The Shape of the World",
        topics: [
          topic("Continents", "Landmasses, boundaries and how we divide them."),
          topic("Countries", "States, sovereignty and changing maps."),
          topic("Capitals", "Political centres and why they move."),
          topic("Oceans", "Currents, trade and global climate."),
          topic("Mountains", "Uplift, barriers and mountain communities."),
          topic("Rivers", "Waterways as routes, borders and lifelines."),
        ],
      },
      {
        title: "Reading the Land",
        topics: [
          topic("Maps", "Scale, projection, symbols and interpretation."),
          topic("Compass directions", "Orientation and the basics of navigation."),
          topic("Climate zones", "Latitude, altitude and atmospheric patterns."),
          topic("Biomes", "Rainforest, desert, tundra and the life they support."),
          topic("Population", "Distribution, density and why people move."),
        ],
      },
      {
        title: "People and Place",
        topics: [
          topic("Languages", "Language families, spread and change."),
          topic("World cultures", "Practices, beliefs and the danger of stereotypes."),
          topic("Traditions", "Rituals, food and heritage across generations."),
          topic("Migration", "Push, pull and the making of diverse places."),
          topic("Human geography", "Cities, economies and how space is used."),
        ],
      },
      {
        title: "Physical and Political",
        topics: [
          topic("Physical geography", "Landforms, water and living systems."),
          topic("Geopolitics", "Resources, borders and power between states."),
        ],
      },
    ],
  },
  {
    id: "bible",
    title: "Bible Study",
    subtitle: "The Illuminated Word",
    section: "wisdom",
    subject: "bible",
    icon: "🕊️",
    color: "#4a7fd4",
    blurb: "Scripture read with context, honesty, and a clear line between text and commentary.",
    chapters: [
      {
        title: "The Whole Story",
        topics: [
          topic("Bible overview", "The Bible's shape, genres and long arc."),
          topic("Old Testament", "Books, themes and historical setting."),
          topic("New Testament", "Gospels, letters and early communities."),
          topic("Biblical history", "What the text says and what history adds."),
        ],
      },
      {
        title: "Places and Prophets",
        topics: [
          topic("Biblical geography", "Hills, rivers, roads and why location matters."),
          topic("Major prophets", "Voices of warning, hope and justice."),
          topic("Minor prophets", "Short books with sharp messages."),
          topic("Biblical timelines", "Order events without flattening complexity."),
        ],
      },
      {
        title: "The Gospels and the Early Church",
        topics: [
          topic("The Gospels", "Four accounts, four emphases."),
          topic("Acts", "The movement beyond Jerusalem."),
          topic("Epistles", "Letters addressing real communities and questions."),
          topic("Parables", "Stories that invite a second look."),
          topic("Biblical characters", "Context, choices and what the text emphasises."),
        ],
      },
      {
        title: "Living and Reading",
        topics: [
          topic("Prayer", "Practices of attention, thanks and request."),
          topic("Faith", "Trust, doubt and what the text means by belief."),
          topic("Christian living", "Ethics, community and care for others."),
          topic("Biblical principles", "Distinguish enduring principles from cultural detail."),
          topic("Scripture memorization", "Remember accurately, with meaning."),
          topic("Bible interpretation", "Genre, context, translation and humility."),
          topic("KJV reading and study", "Reading the King James text with its language and history."),
        ],
      },
    ],
  },
  {
    id: "finance",
    title: "Financial Literacy",
    subtitle: "The Merchant's Ledger",
    section: "wisdom",
    subject: "life",
    icon: "🪙",
    color: "#b58a2e",
    blurb: "Money as a tool: decisions, trade-offs and long-term freedom.",
    chapters: [
      {
        title: "Money Basics",
        topics: [
          topic("Understanding money", "Value, exchange and what money does."),
          topic("Saving", "Pay yourself first and build a cushion."),
          topic("Budgeting", "Give every coin a job without making life joyless."),
          topic("Spending decisions", "Needs, wants, trade-offs and waiting."),
          topic("Banking", "Accounts, safety and how banks make money."),
        ],
      },
      {
        title: "Borrowing and Cost",
        topics: [
          topic("Credit", "Scores, trust and the cost of buying later."),
          topic("Debt", "Good uses, bad cycles and how to escape them."),
          topic("Interest", "Simple vs compound, and the direction that helps you."),
          topic("Taxes", "Why they exist and how progressive systems work."),
          topic("Financial responsibility", "Planning, honesty and avoiding exploitation."),
        ],
      },
      {
        title: "Growing Value",
        topics: [
          topic("Investing", "Risk, return and time horizon."),
          topic("Stocks", "Part-ownership, volatility and long-term thinking."),
          topic("Bonds", "Lending, yield and relative safety."),
          topic("Retirement", "Saving early and the power of decades."),
          topic("Compound interest", "Growth on growth, and why starting matters."),
          topic("Real estate", "Property, leverage and the costs people forget."),
          topic("Building wealth", "Income, margin, assets and patience."),
        ],
      },
      {
        title: "Enterprise",
        topics: [
          topic("Entrepreneurship", "Spot a problem, test a solution."),
          topic("Business ownership", "Structures, responsibilities and trade-offs."),
          topic("Financial planning", "Goals, timelines and realistic numbers."),
        ],
      },
    ],
  },
  {
    id: "gardening",
    title: "Gardening and Agriculture",
    subtitle: "The Green Apothecary",
    section: "craft",
    subject: "life",
    icon: "🌱",
    color: "#5f9e3f",
    blurb: "Grow things: soil, water, patience and a working understanding of life.",
    chapters: [
      {
        title: "Plant Life",
        topics: [
          topic("Plant biology", "Roots, stems, leaves and how plants make food."),
          topic("Seeds", "Dormancy, viability and choosing the right seed."),
          topic("Germination", "The conditions a seed needs to wake up."),
          topic("Soil", "Texture, structure and living soil."),
          topic("Composting", "Turning waste into fertility."),
        ],
      },
      {
        title: "Keeping Plants Alive",
        topics: [
          topic("Watering", "How much, how often and how to tell."),
          topic("Sunlight", "Light levels, direction and seasonal change."),
          topic("Plant nutrition", "Nutrients, deficiencies and feeding without harm."),
          topic("Houseplants", "Indoor conditions and forgiving first plants."),
          topic("Pest management", "Prevention first, gentle intervention second."),
          topic("Pruning", "Why, when and the cuts that help."),
        ],
      },
      {
        title: "Growing Food and Beauty",
        topics: [
          topic("Vegetable gardening", "Planning beds, seasons and harvests."),
          topic("Fruit gardening", "Trees, bushes and the patience they ask for."),
          topic("Herbs", "Small-space growing and everyday use."),
          topic("Flowers", "Colour, pollinators and cutting gardens."),
          topic("Trees", "Long-lived planting and care."),
          topic("Plant propagation", "From seed, cutting and division."),
        ],
      },
      {
        title: "Systems and Scale",
        topics: [
          topic("Hydroponics", "Growing without soil and the trade-offs."),
          topic("Greenhouses", "Controlled climates and season extension."),
          topic("Sustainable gardening", "Water, soil and biodiversity over shortcuts."),
          topic("Agriculture", "From small plots to food systems."),
          topic("Food production", "Where food comes from and what it costs."),
          topic("Permaculture", "Design that mimics living systems."),
        ],
      },
    ],
  },
  {
    id: "computing",
    title: "Technology and Computing",
    subtitle: "The Clockwork Codex",
    section: "craft",
    subject: "computing",
    icon: "💻",
    color: "#4e7cf6",
    blurb: "Understand the machines, then build something with them.",
    chapters: [
      {
        title: "How Computers Work",
        topics: [
          topic("Computer fundamentals", "Input, process, storage and output."),
          topic("Computer hardware", "CPUs, memory, storage and the parts that matter."),
          topic("Operating systems", "Managing hardware, files and programs."),
          topic("Internet fundamentals", "Networks, addresses and how data travels."),
          topic("Digital literacy", "Files, formats, backups and effective search."),
        ],
      },
      {
        title: "Safety and Ethics",
        topics: [
          topic("Online safety", "Privacy, passwords, scams and asking for help."),
          topic("Cybersecurity", "Threats, defences and why updates matter."),
          topic("Digital ethics", "Consent, data, bias and responsible building."),
        ],
      },
      {
        title: "Code",
        topics: [
          topic("Coding fundamentals", "Sequence, selection, repetition and abstraction."),
          topic("Programming logic", "Break a problem into steps a machine can follow."),
          topic("HTML", "Structure content for the web."),
          topic("CSS", "Style and layout with the cascade."),
          topic("JavaScript", "Behaviour, events and the language of the browser."),
          topic("Python", "Readable code for scripts, data and first projects."),
          topic("Databases", "Store, query and relate information."),
        ],
      },
      {
        title: "Building the Future",
        topics: [
          topic("Web development", "Front end, back end and how they meet."),
          topic("Artificial intelligence", "How systems learn patterns and where they fail."),
          topic("Robotics", "Sensors, actuators and control loops."),
          topic("Software development", "Version control, testing and working with others."),
        ],
      },
    ],
  },
  {
    id: "art",
    title: "Art and Design",
    subtitle: "The Prism Workshop",
    section: "craft",
    subject: "arts",
    icon: "🎨",
    color: "#c458d6",
    blurb: "See more clearly, then make something only you would make.",
    chapters: [
      {
        title: "Learning to See",
        topics: [
          topic("Drawing", "Observation, line and the discipline of looking."),
          topic("Sketching", "Fast studies that capture an idea."),
          topic("Painting", "Colour, medium and building a surface."),
          topic("Color theory", "Harmony, contrast and the emotions of colour."),
          topic("Composition", "Guide the eye and give an image structure."),
        ],
      },
      {
        title: "Design",
        topics: [
          topic("Perspective", "Depth, vanishing points and believable space."),
          topic("Typography", "Type as voice, rhythm and information."),
          topic("Graphic design", "Solve a communication problem visually."),
          topic("Illustration", "Image that tells or supports a story."),
          topic("Digital art", "Tools, layers and a workflow that stays flexible."),
          topic("Photography", "Light, framing and the decisive moment."),
          topic("Visual communication", "Clarity before decoration."),
        ],
      },
      {
        title: "Identity and Layout",
        topics: [
          topic("Branding", "Consistency, meaning and recognition."),
          topic("Layout design", "Grids, hierarchy and breathing room."),
          topic("Art history", "Context for the styles you inherit."),
          topic("Traditional crafts", "Materials, technique and slow making."),
        ],
      },
      {
        title: "Make",
        topics: [
          topic("Sculpture", "Form in three dimensions."),
          topic("Textile arts", "Fibre, pattern and construction."),
          topic("Creative thinking", "Generate, combine and refine ideas."),
        ],
      },
    ],
  },
  {
    id: "music",
    title: "Music and Performing Arts",
    subtitle: "The Resonant Hall",
    section: "craft",
    subject: "arts",
    icon: "🎵",
    color: "#d05f8a",
    blurb: "Rhythm, harmony, stagecraft and the courage to perform.",
    chapters: [
      {
        title: "The Elements of Music",
        topics: [
          topic("Musical fundamentals", "Pitch, duration, dynamics and timbre."),
          topic("Rhythm", "Beat, metre and patterns that move."),
          topic("Melody", "Shape, phrase and memorable lines."),
          topic("Harmony", "Chords, intervals and tension and release."),
          topic("Music theory", "The grammar behind what sounds right."),
          topic("Reading sheet music", "Notation, clefs, rhythm and sight-reading."),
        ],
      },
      {
        title: "Voice and Instruments",
        topics: [
          topic("Singing", "Breath, pitch and singing without strain."),
          topic("Vocal techniques", "Range, resonance and healthy practice."),
          topic("Instruments", "Families, timbres and how they make sound."),
          topic("Piano fundamentals", "Keyboard layout, scales and first pieces."),
          topic("Guitar fundamentals", "Chords, rhythm and strumming."),
        ],
      },
      {
        title: "Creating",
        topics: [
          topic("Music history", "Styles, technologies and the societies around them."),
          topic("Composition", "Develop a musical idea into a whole."),
          topic("Songwriting", "Words, melody and the marriage between them."),
          topic("Choir", "Blend, listening and collective timing."),
        ],
      },
      {
        title: "Performance",
        topics: [
          topic("Theater", "Story, space and audience."),
          topic("Acting", "Objective, action and truthful response."),
          topic("Dance", "Body, rhythm and expression."),
          topic("Performance skills", "Preparation, presence and recovering from mistakes."),
        ],
      },
    ],
  },
  languageBook(["English", "Spanish", "French", "Portuguese", "German", "Italian", "Japanese", "Mandarin", "Korean", "Arabic", "Swahili", "Jamaican Patois"]),
  {
    id: "health",
    title: "Health and Wellness",
    subtitle: "The Restorative Garden",
    section: "life",
    subject: "life",
    icon: "🌿",
    color: "#3f9e78",
    blurb: "General education about bodies, minds and habits — not medical advice.",
    chapters: [
      {
        title: "The Body",
        topics: [
          topic("Human anatomy", "Organ systems and how they fit together."),
          topic("Body systems", "Circulation, digestion, nerves and more."),
          topic("Nutrition", "Energy, nutrients and balanced eating."),
          topic("Food groups", "What each group contributes."),
        ],
      },
      {
        title: "Daily Health",
        topics: [
          topic("Sleep education", "Why sleep matters and how to protect it."),
          topic("Exercise fundamentals", "Movement, strength and recovery."),
          topic("Hygiene", "Everyday habits that prevent illness."),
          topic("Healthy habits", "Small changes that survive busy weeks."),
        ],
      },
      {
        title: "Mind and Emotions",
        topics: [
          topic("Mental wellness education", "Stress, mood and when to ask for help."),
          topic("Emotional intelligence", "Name, understand and regulate feelings."),
          topic("Stress management", "Breathing, boundaries and realistic planning."),
        ],
      },
      {
        title: "Safety and Development",
        topics: [
          topic("First aid education", "Basic response and when to call for help."),
          topic("Personal safety", "Boundaries, consent and trusted adults."),
          topic("Developmental education", "Age-appropriate understanding of growth and change."),
        ],
      },
    ],
  },
  {
    id: "life",
    title: "Life Skills",
    subtitle: "The Practical Toolkit",
    section: "life",
    subject: "life",
    icon: "🧰",
    color: "#8a7a3f",
    blurb: "The ordinary competencies that make an extraordinary difference.",
    chapters: [
      {
        title: "Home",
        topics: [
          topic("Cooking", "Technique, timing and feeding yourself well."),
          topic("Food preparation", "Knife skills, hygiene and planning."),
          topic("Kitchen safety", "Heat, sharp tools and cross-contamination."),
          topic("Cleaning", "Products, routines and safe mixing."),
          topic("Laundry", "Fabric care, labels and stains."),
          topic("Home maintenance", "Small repairs and knowing when to call someone."),
          topic("Basic sewing", "Repair a seam and replace a button."),
        ],
      },
      {
        title: "Managing Life",
        topics: [
          topic("Organization", "Systems that fit the person using them."),
          topic("Time management", "Priorities, estimates and protecting focus."),
          topic("Personal responsibility", "Own the task, the mistake and the repair."),
          topic("Shopping", "Lists, comparison and avoiding impulse."),
          topic("Consumer awareness", "Rights, scams and reading the fine print."),
          topic("Transportation literacy", "Routes, safety and planning a journey."),
        ],
      },
      {
        title: "Thinking and Relating",
        topics: [
          topic("Communication", "Listen, clarify and say the hard thing kindly."),
          topic("Problem-solving", "Define, generate, test and review."),
          topic("Decision-making", "Values, evidence and reversible choices."),
          topic("Goal setting", "Make it specific, timed and yours."),
        ],
      },
      {
        title: "Preparedness",
        topics: [
          topic("Emergency preparedness", "Plans, supplies and staying calm."),
        ],
      },
    ],
  },
  {
    id: "business",
    title: "Business and Enterprise",
    subtitle: "The Founder's Folio",
    section: "life",
    subject: "life",
    icon: "📈",
    color: "#b06a3c",
    blurb: "Turn a useful idea into something that serves people and sustains itself.",
    chapters: [
      {
        title: "Foundations",
        topics: [
          topic("Business fundamentals", "Value, customers, costs and cash."),
          topic("Business ideas", "Find problems worth solving."),
          topic("Market research", "Ask better questions before building."),
          topic("Business planning", "A living map, not a decoration."),
        ],
      },
      {
        title: "Reaching People",
        topics: [
          topic("Branding", "What people remember and why."),
          topic("Marketing", "Reach the right people with a clear message."),
          topic("Sales", "Help someone decide without pressure."),
          topic("Customer service", "Solve the problem and keep trust."),
          topic("Pricing", "Cost, value and the courage to charge."),
        ],
      },
      {
        title: "Numbers",
        topics: [
          topic("Profit and loss", "Revenue, costs and what is actually left."),
          topic("Bookkeeping", "Records that make decisions possible."),
          topic("Inventory", "Stock, cash flow and avoiding dead weight."),
          topic("E-commerce", "Selling online without losing the human touch."),
        ],
      },
      {
        title: "Leading",
        topics: [
          topic("Entrepreneurship", "Initiative, resilience and learning in public."),
          topic("Leadership", "Direction, trust and developing others."),
          topic("Management", "Systems, people and predictable delivery."),
          topic("Business ethics", "Profit without exploitation."),
        ],
      },
    ],
  },
  {
    id: "psychology",
    title: "Psychology and Behavior",
    subtitle: "The Mirror Gallery",
    section: "humanities",
    subject: "life",
    icon: "🧠",
    color: "#7a6fd0",
    blurb: "How people think, feel and act — studied, not diagnosed.",
    chapters: [
      {
        title: "Foundations",
        topics: [
          topic("Introduction to psychology", "Questions, methods and the limits of explanation."),
          topic("Human development", "Change across the lifespan."),
          topic("Memory", "Encoding, storage, retrieval and forgetting."),
          topic("Learning", "Conditioning, practice and transfer."),
        ],
      },
      {
        title: "Inner Life",
        topics: [
          topic("Emotions", "What they signal and how they shape decisions."),
          topic("Personality", "Trait models, stability and context."),
          topic("Cognitive biases", "Predictable shortcuts and predictable errors."),
        ],
      },
      {
        title: "People Together",
        topics: [
          topic("Social psychology", "Groups, norms, conformity and influence."),
          topic("Communication", "Interpretation, listening and misreading."),
          topic("Relationships", "Attachment, boundaries and repair."),
        ],
      },
      {
        title: "Thinking Well",
        topics: [
          topic("Critical thinking", "Evidence, assumptions and argument quality."),
          topic("Behavioral science", "Designing studies and reading claims carefully."),
        ],
      },
    ],
  },
  {
    id: "civics",
    title: "Law, Civics and Government",
    subtitle: "The Civic Forum",
    section: "humanities",
    subject: "social",
    icon: "⚖️",
    color: "#6b7f9e",
    blurb: "How societies organise power, protect rights and make decisions together.",
    chapters: [
      {
        title: "Citizenship",
        topics: [
          topic("Citizenship", "Belonging, rights and responsibilities."),
          topic("Government systems", "Democracy, monarchy, republic and more."),
          topic("Branches of government", "Legislative, executive and judicial roles."),
          topic("Constitution", "Founding rules and how they change."),
        ],
      },
      {
        title: "Law and Rights",
        topics: [
          topic("Laws and rights", "Where law comes from and what it protects."),
          topic("Courts", "Trials, evidence and the rule of law."),
          topic("Human rights", "Universal claims and their hard cases."),
          topic("Legal literacy", "Contracts, responsibilities and asking for help."),
        ],
      },
      {
        title: "Participation",
        topics: [
          topic("Elections", "Voting systems, campaigns and representation."),
          topic("Civic responsibilities", "Taxes, service, informed participation."),
          topic("International organizations", "Cooperation, treaties and limits."),
          topic("Community participation", "Local action and collective problem-solving."),
        ],
      },
    ],
  },
  {
    id: "sports",
    title: "Sports and Physical Education",
    subtitle: "The Training Yard",
    section: "life",
    subject: "life",
    icon: "🏅",
    color: "#c25a4a",
    blurb: "Move well, train sensibly and enjoy the game for life.",
    chapters: [
      {
        title: "Move",
        topics: [
          topic("Sports fundamentals", "Rules, roles and fair play."),
          topic("Fitness principles", "Overload, progression and recovery."),
          topic("Teamwork", "Communication, positions and trust."),
          topic("Coordination", "Balance, agility and body awareness."),
        ],
      },
      {
        title: "Train",
        topics: [
          topic("Strength", "Safe loading and consistent progression."),
          topic("Flexibility", "Mobility, stretching and injury prevention."),
          topic("Endurance", "Aerobic base and pacing."),
          topic("Safe exercise practices", "Warm-up, hydration and listening to your body."),
        ],
      },
      {
        title: "Understand the Game",
        topics: [
          topic("Sports history", "How games spread and changed."),
          topic("Rules and strategy", "Read the game and make better decisions."),
          topic("Nutrition for activity", "Fuel before, during and after."),
        ],
      },
    ],
  },
];

export const SECTIONS = [
  { id: "foundations", name: "Foundations Hall", icon: "📚", blurb: "Numbers and words: the roots of every other shelf.", color: "#7c5cf0", ambient: "warm" },
  { id: "sciences", name: "Sciences Atrium", icon: "🔭", blurb: "Stars, matter, living things and the observing mind.", color: "#21a89a", ambient: "teal" },
  { id: "humanities", name: "Humanities Gallery", icon: "🏛️", blurb: "Time, place, people and the systems they build.", color: "#c08a3e", ambient: "amber" },
  { id: "wisdom", name: "Wisdom Sanctum", icon: "🕯️", blurb: "Scripture, money and the long view.", color: "#4a7fd4", ambient: "blue" },
  { id: "craft", name: "Craft Wing", icon: "🎨", blurb: "Make, grow, code, draw, play and speak.", color: "#c458d6", ambient: "violet" },
  { id: "life", name: "Living Quarters", icon: "🌿", blurb: "Health, home, enterprise and the body in motion.", color: "#5f9e3f", ambient: "green" },
];

export const CHAMBERS = [
  { id: "quest_board", name: "Quest Board", blurb: "Daily commissions and long missions from your tutor.", route: "/quests", icon: "📜", level: 1 },
  { id: "achievement_hall", name: "Achievement Hall", blurb: "Badges, milestones and the evidence behind them.", route: "/achievements", icon: "🏆", level: 1 },
  { id: "study_room", name: "Quiet Study Room", blurb: "A desk, a lamp and the lessons you already began.", route: "/lessons", icon: "📖", level: 1 },
  { id: "discovery_room", name: "Discovery Room", blurb: "Follow a curiosity into a different wing of the Library.", route: "/world?section=craft", icon: "🧭", level: 1 },
  { id: "observatory", name: "Observatory", blurb: "A quiet dome above the stacks for big questions.", route: "/world?section=sciences", icon: "🔭", level: 2 },
  { id: "hidden_archive", name: "Hidden Archive", blurb: "Deeper knowledge chambers, opened by mastery.", route: "/world?section=wisdom", icon: "🗝️", level: 3 },
  { id: "study_chamber", name: "Personal Study", blurb: "Your own desk, plans and unfinished work.", route: "/schedule", icon: "🕯️", level: 1 },
];

function decorateChapter(bookId, index, chapter) {
  return {
    id: `${bookId}-ch-${index + 1}`,
    number: index + 1,
    title: chapter.title,
    topics: chapter.topics.map((t, i) => {
      const name = typeof t === "string" ? t : t.name;
      const blurb = typeof t === "string"
        ? `Explore ${name.toLowerCase()} with a lesson, guided practice and a mastery check.`
        : t.blurb;
      return {
        id: `${bookId}.${slug(name) || `topic-${i + 1}`}.${i + 1}`,
        name,
        blurb,
        index: i,
      };
    }),
  };
}

export const BOOKS = RAW_BOOKS.map((book) => {
  const chapters = book.chapters.map((c, i) => decorateChapter(book.id, i, c));
  const topics = chapters.flatMap((c) => c.topics.map((t) => ({ ...t, chapterId: c.id, chapterTitle: c.title })));
  return {
    ...book,
    chapters,
    topicCount: topics.length,
    chapterCount: chapters.length,
    topics,
  };
});

export const BOOK_MAP = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
export const SECTION_MAP = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export const TOPIC_INDEX = (() => {
  const map = new Map();
  for (const book of BOOKS) {
    for (const topicItem of book.topics) {
      map.set(topicItem.id, { book, topic: topicItem, chapter: book.chapters.find((c) => c.id === topicItem.chapterId) });
    }
  }
  return map;
})();

/* Reviewed core books plus approved custom volumes added through the CMS. */
const CUSTOM_BOOKS = new Map();
const CUSTOM_TOPICS = new Map();

export function registerCustomBooks(books = []) {
  CUSTOM_BOOKS.clear();
  CUSTOM_TOPICS.clear();
  for (const raw of books) {
    if (!raw || !raw.id || !Array.isArray(raw.chapters)) continue;
    const chapters = raw.chapters.map((chapter, index) => ({
      id: chapter.id || `${raw.id}-ch-${index + 1}`,
      number: index + 1,
      title: String(chapter.title || `Chapter ${index + 1}`).slice(0, 120),
      topics: (Array.isArray(chapter.topics) ? chapter.topics : []).map((t, i) => ({
        id: t.id || `${raw.id}.custom.${slug(t.name || `topic-${i + 1}`)}.${i + 1}`,
        name: String(t.name || `Topic ${i + 1}`).slice(0, 120),
        blurb: String(t.blurb || "A reviewed custom topic in this volume.").slice(0, 400),
        index: i,
      })),
    }));
    const topics = chapters.flatMap((c) => c.topics.map((t) => ({ ...t, chapterId: c.id, chapterTitle: c.title })));
    const book = {
      ...raw,
      chapters,
      topics,
      topicCount: topics.length,
      chapterCount: chapters.length,
      official: false,
    };
    CUSTOM_BOOKS.set(book.id, book);
    for (const t of topics) CUSTOM_TOPICS.set(t.id, { book, topic: t, chapter: chapters.find((c) => c.id === t.chapterId) });
  }
}

export function allBooks() {
  return [...BOOKS, ...CUSTOM_BOOKS.values()];
}

export function getBook(bookId) {
  return CUSTOM_BOOKS.get(bookId) || BOOK_MAP[bookId] || null;
}

export function totalTopics() {
  return allBooks().reduce((n, b) => n + b.topicCount, 0);
}

export function findTopic(topicId) {
  return TOPIC_INDEX.get(topicId) || CUSTOM_TOPICS.get(topicId) || null;
}

export function topicByText(text) {
  const needle = String(text || "").toLowerCase().trim();
  if (!needle) return null;
  for (const book of allBooks()) {
    const exact = book.topics.find((t) => t.name.toLowerCase() === needle);
    if (exact) return { book, topic: exact };
  }
  for (const book of allBooks()) {
    const partial = book.topics.find((t) => needle.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(needle));
    if (partial) return { book, topic: partial };
  }
  return null;
}

export function bookSummary(book) {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    section: book.section,
    subject: book.subject,
    icon: book.icon,
    color: book.color,
    blurb: book.blurb,
    chapterCount: book.chapterCount,
    topicCount: book.topicCount,
  };
}

export const TOTAL_TOPICS = BOOKS.reduce((n, b) => n + b.topicCount, 0);
