const QUOTES = [
  "Stahl wird nicht in der Kälte gehärtet.",
  "Jeder Hammerschlag zählt, auch die leisen.",
  "Form folgt Wiederholung.",
  "Die Glut hält länger als der erste Eindruck.",
  "Was heute schwer ist, ist bald dein Warm-up.",
  "Nicht die Hitze bricht das Metall - die Kälte davor.",
  "Ruhig atmen. Der Amboss läuft nicht weg.",
  "Kleine Schläge, langer Zusammenhalt.",
  "Du schmiedest nicht für heute, sondern für die nächsten zehn Einheiten.",
  "Müde Muskeln, klare Linie.",
  "Der Rhythmus zählt mehr als die Kraft des einzelnen Schlags.",
  "Noch eine Runde. Dann ist Pause auch verdient.",
  "Gutes Werkzeug entsteht nicht beim ersten Versuch.",
  "Halte die Spannung, nicht den Atem an.",
  "Was du heute formst, trägst du morgen.",
  "Ein Schritt zurück in der Pause, zwei nach vorne in der Arbeit.",
  "Konstanz schlägt Intensität - fast immer.",
  "Der Amboss gibt nach, nicht der Hammer.",
];

export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
