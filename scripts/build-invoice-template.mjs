/**
 * Erzeugt assets/templates/invoice-template.docx aus quellen/Vorlage-HPCN-Rechnung.docx
 * mit docxtemplater-Platzhaltern — Layout, Spaltenbreiten (tblGrid/tcW), Logos bleiben aus der Vorlage.
 *
 * Aufruf: node scripts/build-invoice-template.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "quellen", "Vorlage-HPCN-Rechnung.docx");
const outDir = path.join(root, "assets", "templates");
const outFile = path.join(outDir, "invoice-template.docx");

/** Echtes Zeilen-Tag <w:tr> / <w:tr …>, nicht <w:trPr> (lastIndexOf("<w:tr",…) würde trPr treffen). */
function lastWTrOpen(xml, beforeIndex) {
  let pos = beforeIndex;
  while (true) {
    const idx = xml.lastIndexOf("<w:tr", pos);
    if (idx === -1) return -1;
    if (xml.startsWith("<w:trPr", idx)) {
      pos = idx - 1;
      continue;
    }
    return idx;
  }
}

function patchDataRow(xml) {
  const marker = "<w:t>01</w:t>";
  const i = xml.indexOf(marker);
  if (i === -1) throw new Error("Positionszeile mit 01 nicht gefunden.");
  const trStart = lastWTrOpen(xml, i);
  if (trStart === -1) throw new Error("<w:tr> vor Positionszeile 01 nicht gefunden.");
  const trEnd = xml.indexOf("</w:tr>", i) + "</w:tr>".length;
  let row = xml.slice(trStart, trEnd);

  const subs = [
    ["<w:t>01</w:t>", "<w:t>{#positions}{pos}</w:t>"],
    ["<w:t>32,0</w:t>", "<w:t>{hours}</w:t>"],
    ["<w:t>70,00</w:t>", "<w:t>{ep}</w:t>"],
    ["<w:t>2.240,00</w:t>", "<w:t>{gp}{/positions}</w:t>"],
  ];
  for (const [a, b] of subs) {
    if (!row.includes(a)) throw new Error(`In Datenzeile erwartet: ${a}`);
    row = row.replace(a, b);
  }

  // LE-Spalte: nur die „Std.“-Zeile der Positionszeile (nicht die Kopfzeile „LE/Std.“)
  if (!row.includes("<w:t>Std.</w:t>")) {
    throw new Error('LE-Spalte „Std.“ in Datenzeile nicht gefunden.');
  }
  row = row.replace("<w:t>Std.</w:t>", "<w:t>{le}</w:t>", 1);

  // Spezifikation (breite Zelle 5386): zweites Vorkommen in dieser Zeile = Datumsblock
  const specOpen = '<w:tc><w:tcPr><w:tcW w:w="5386" w:type="dxa"/>';
  const s = row.indexOf(specOpen);
  if (s === -1) throw new Error("Spezifikations-Zelle 5386 in Datenzeile nicht gefunden.");
  const e = row.indexOf("</w:tc>", s) + "</w:tc>".length;
  const tcPr = row.slice(s, s + row.slice(s).indexOf("</w:tcPr>") + "</w:tcPr>".length);
  const simpleInner = `${tcPr}<w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:lineRule="auto" w:line="240" w:before="0" w:after="0"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:eastAsia="Times New Roman" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Arial" w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>{spec}</w:t></w:r></w:p></w:tc>`;
  row = row.slice(0, s) + simpleInner + row.slice(e);

  return xml.slice(0, trStart) + row + xml.slice(trEnd);
}

function removeSecondDataRow(xml) {
  const i02 = xml.indexOf("<w:t>02</w:t>");
  if (i02 === -1) throw new Error("Zweite Positionszeile (02) nicht gefunden.");
  const trStart = lastWTrOpen(xml, i02);
  if (trStart === -1) throw new Error("<w:tr> vor Positionszeile 02 nicht gefunden.");
  const trEnd = xml.indexOf("</w:tr>", i02) + "</w:tr>".length;
  return xml.slice(0, trStart) + xml.slice(trEnd);
}

const buf = fs.readFileSync(src);
const zip = await JSZip.loadAsync(buf);
let xml = await zip.file("word/document.xml").async("string");

xml = xml.replace(/<w:t>\{\{\}\}<\/w:t>/g, "<w:t>{invoiceDate}</w:t>");
xml = xml.replace(
  /<w:t>Rechnungs-Nr\.: 608841<\/w:t>/g,
  "<w:t>Rechnungs-Nr.: {invoiceNumber}</w:t>",
);
xml = xml.replace(
  /<w:t>Projekt: KUNKEL, M\.<\/w:t>/g,
  "<w:t>Projekt: {projectTitle}</w:t>",
);

xml = removeSecondDataRow(xml);
xml = patchDataRow(xml);

// Summen (eindeutige Textknoten aus der Vorlage)
xml = xml.replace(/<w:t>3\.920,00<\/w:t>/g, "<w:t>{netTotal}</w:t>");
xml = xml.replace(/<w:t>744,80<\/w:t>/g, "<w:t>{vatAmount}</w:t>");
xml = xml.replace(/<w:t>4\.664,80<\/w:t>/g, "<w:t>{grossTotal}</w:t>");
xml = xml.replace(
  /<w:t>Zahlbar bis zum 11\.12\.2025 ohne Abzug\. Vielen Dank für Ihren Auftrag!<\/w:t>/g,
  "<w:t>Zahlbar bis zum {payUntil} ohne Abzug. Vielen Dank für Ihren Auftrag!</w:t>",
);

fs.mkdirSync(outDir, { recursive: true });
zip.file("word/document.xml", xml);
const outBuf = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
});
fs.writeFileSync(outFile, outBuf);
console.log("OK:", outFile, "(" + outBuf.length + " bytes)");
