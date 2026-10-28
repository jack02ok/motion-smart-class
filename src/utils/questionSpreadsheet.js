import { cleanText, safeImageUrl } from "./security.js";
import { QUESTION_GAME_MODES } from "../data/modeQuestions.js";

export const QUESTION_SHEET_HEADERS = [
  "id",
  "question",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
  "category",
  "grade",
  "difficulty",
  "topic",
  "gameModes",
  "passage",
  "imageUrl",
  "imageAlt",
  "imageLayout",
  "timeLimit",
  "pointWeight",
  "explanation"
];

const normalizeHeader = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function cellValue(row, names) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const name of names) {
    if (normalized.has(normalizeHeader(name))) return normalized.get(normalizeHeader(name));
  }
  return "";
}

function normalizeAnswer(value) {
  const answer = String(value ?? "").trim().toUpperCase();
  if (/^[ABCD]$/.test(answer)) return answer.charCodeAt(0) - 65;
  const numeric = Number(answer);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 3 ? numeric : 0;
}

export function worksheetRowsToQuestions(rows) {
  return rows.map((row) => ({
    id: cleanText(cellValue(row, ["id"]), 80),
    question: cleanText(cellValue(row, ["question", "pertanyaan", "soal"]), 1000),
    options: [
      cellValue(row, ["optionA", "pilihanA", "opsiA"]),
      cellValue(row, ["optionB", "pilihanB", "opsiB"]),
      cellValue(row, ["optionC", "pilihanC", "opsiC"]),
      cellValue(row, ["optionD", "pilihanD", "opsiD"])
    ].map((value) => cleanText(value, 300)),
    correctAnswer: normalizeAnswer(cellValue(row, ["correctAnswer", "jawabanBenar", "kunciJawaban"])),
    category: cleanText(cellValue(row, ["category", "kategori"]), 30).toLowerCase(),
    grade: Number(cellValue(row, ["grade", "kelas"])) || 4,
    difficulty: cleanText(cellValue(row, ["difficulty", "kesulitan"]), 30).toLowerCase(),
    topic: cleanText(cellValue(row, ["topic", "topik"]), 100),
    gameModes: String(cellValue(row, ["gameModes", "modePermainan"]) || "")
      .split(/[|;,]/)
      .map((mode) => mode.trim())
      .filter((mode) => QUESTION_GAME_MODES.includes(mode)),
    passage: cleanText(cellValue(row, ["passage", "bacaan"]), 3000),
    imageUrl: safeImageUrl(cellValue(row, ["imageUrl", "urlGambar", "gambar"])),
    imageAlt: cleanText(cellValue(row, ["imageAlt", "deskripsiGambar"]), 160),
    imageLayout: cleanText(cellValue(row, ["imageLayout", "posisiGambar"]), 20),
    timeLimit: Number(cellValue(row, ["timeLimit", "batasWaktu"])) || 40,
    pointWeight: Number(cellValue(row, ["pointWeight", "bobotSkor"])) || 100,
    explanation: cleanText(cellValue(row, ["explanation", "pembahasan"]), 2000)
  }));
}

export async function readQuestionWorkbook(arrayBuffer) {
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === "soal") || workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook tidak memiliki worksheet.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true });
  if (!rows.length) throw new Error("Worksheet tidak memiliki data soal.");
  if (rows.length > 5000) throw new Error("Workbook melebihi batas 5.000 soal per impor.");
  return worksheetRowsToQuestions(rows);
}

export async function createQuestionWorkbook(questions, bookType = "xlsx") {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Belum ada soal guru untuk diekspor.");
  }
  const XLSX = await import("@e965/xlsx");
  const rows = questions.map((question) => ({
    id: cleanText(question.id, 80),
    question: cleanText(question.question, 1000),
    optionA: cleanText(question.options?.[0], 300),
    optionB: cleanText(question.options?.[1], 300),
    optionC: cleanText(question.options?.[2], 300),
    optionD: cleanText(question.options?.[3], 300),
    correctAnswer: ["A", "B", "C", "D"][Number(question.correctAnswer)] || "A",
    category: question.category === "literasi" ? "literasi" : "numerasi",
    grade: Number(question.grade) || 4,
    difficulty: ["easy", "medium", "hard"].includes(question.difficulty) ? question.difficulty : "medium",
    topic: cleanText(question.topic, 100),
    gameModes: Array.isArray(question.gameModes) ? question.gameModes.join(";") : "",
    passage: cleanText(question.passage, 3000),
    imageUrl: safeImageUrl(question.imageUrl),
    imageAlt: cleanText(question.imageAlt, 160),
    imageLayout: ["contain", "wide", "compact"].includes(question.imageLayout) ? question.imageLayout : "contain",
    timeLimit: Number(question.timeLimit) || 40,
    pointWeight: Number(question.pointWeight) || 100,
    explanation: cleanText(question.explanation, 2000)
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: QUESTION_SHEET_HEADERS });
  worksheet["!cols"] = QUESTION_SHEET_HEADERS.map((header) => ({
    wch: ["question", "passage", "explanation"].includes(header) ? 42 : header.startsWith("option") ? 24 : header.includes("image") ? 30 : 16
  }));
  worksheet["!autofilter"] = { ref: `A1:S${rows.length + 1}` };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Soal");
  const normalizedType = bookType === "xls" ? "xls" : "xlsx";
  return XLSX.write(workbook, { type: "array", bookType: normalizedType, compression: normalizedType === "xlsx" });
}

export function downloadWorkbook(data, filename) {
  const blob = new Blob([data], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
