/**
 * Optional King James Version reading room.
 *
 * The scripture text below is the Authorized (King James) Version, 1611,
 * which is in the public domain. Editorial notes are deliberately kept in a
 * separate field and are never presented as scripture.
 */

export const KJV_NOTE =
  "The King James Version (Authorized Version, 1611) is in the public domain. Verse text is scripture; the shaded editorial note is commentary written for this Library and is not part of the biblical text. Traditions read these passages differently, and this room does not settle those differences for you.";

export const KJV_PASSAGES = [
  {
    id: "genesis-1",
    reference: "Genesis 1:1–5",
    title: "In the beginning",
    book: "Genesis",
    verses: [
      { n: 1, text: "In the beginning God created the heaven and the earth." },
      { n: 2, text: "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters." },
      { n: 3, text: "And God said, Let there be light: and there was light." },
      { n: 4, text: "And God saw the light, that it was good: and God divided the light from the darkness." },
      { n: 5, text: "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day." },
    ],
    note:
      "Literary context: the passage moves from unformed darkness to ordered light and named time. Readers from different traditions debate genre, translation and how literally to read the creation account; those debates are not settled by the verses alone.",
  },
  {
    id: "psalm-23",
    reference: "Psalm 23:1–6",
    title: "The shepherd psalm",
    book: "Psalms",
    verses: [
      { n: 1, text: "The LORD is my shepherd; I shall not want." },
      { n: 2, text: "He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
      { n: 3, text: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake." },
      { n: 4, text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me." },
      { n: 5, text: "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over." },
      { n: 6, text: "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever." },
    ],
    note:
      "Literary context: a short poem that moves from provision to danger and back to welcome. The shepherd image is agricultural; the table image shifts to hospitality. Different traditions use this psalm in very different settings.",
  },
  {
    id: "john-1",
    reference: "John 1:1–5",
    title: "The Word and the light",
    book: "John",
    verses: [
      { n: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
      { n: 2, text: "The same was in the beginning with God." },
      { n: 3, text: "All things were made by him; and without him was not any thing made that was made." },
      { n: 4, text: "In him was life; and the life was the light of men." },
      { n: 5, text: "And the light shineth in darkness; and the darkness comprehended it not." },
    ],
    note:
      "Literary context: the opening echoes Genesis and uses 'Word' (logos) in a way that carried philosophical weight in the ancient world. Christian traditions read the passage in different ways; careful readers note the echoes before drawing conclusions.",
  },
  {
    id: "matthew-5",
    reference: "Matthew 5:3–10",
    title: "The Beatitudes",
    book: "Matthew",
    verses: [
      { n: 3, text: "Blessed are the poor in spirit: for theirs is the kingdom of heaven." },
      { n: 4, text: "Blessed are they that mourn: for they shall be comforted." },
      { n: 5, text: "Blessed are the meek: for they shall inherit the earth." },
      { n: 6, text: "Blessed are they which do hunger and thirst after righteousness: for they shall be filled." },
      { n: 7, text: "Blessed are the merciful: for they shall obtain mercy." },
      { n: 8, text: "Blessed are the pure in heart: for they shall see God." },
      { n: 9, text: "Blessed are the peacemakers: for they shall be called the children of God." },
      { n: 10, text: "Blessed are they which are persecuted for righteousness' sake: for theirs is the kingdom of heaven." },
    ],
    note:
      "Literary context: a series of blessings that reverse expected status. 'Blessed' is broader than 'happy'; it describes a state God is said to favour. The passage is often read alongside the rest of the Sermon on the Mount.",
  },
];
