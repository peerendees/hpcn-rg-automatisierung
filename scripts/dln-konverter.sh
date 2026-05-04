#!/bin/bash
# ============================================================
# dln-konverter.sh
# Konvertiert Zeitabrechnung-CSV in Formular-App-Format:
# Ausgabe-Spalten Datum;Kunde;Tätigkeit;Von;Bis — der Text für „Tätigkeit“ kommt aus der Roh-Spalte note (nicht task).
# BER-84 | berent.ai
# Ablage: ~/Entwicklung/projekte/hpcn-rg-automatisierung/scripts/dln-konverter.sh
# Automatischer Start unter macOS: LaunchAgent-Vorlage → com.berent.dln-konverter.plist.example
# ============================================================

export LC_ALL=de_DE.UTF-8
INBOX="/Users/Shared/HPCN-Inbox"
OUTDIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Papierlos/HPCN/Dienstleistungsnachweise/DLNaktuell"
LOGFILE="$HOME/Library/Logs/dln-konverter.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOGFILE"
}

log "=== DLN-Konverter gestartet ==="

find "$INBOX" -maxdepth 1 -name "*.csv" | while read -r INFILE; do

  BASENAME=$(basename "$INFILE" .csv)

  # Bereits konvertierte Dateien überspringen
  if [[ "$BASENAME" == "HPCN DLN"* ]] || [[ "$BASENAME" == "Göhrum DLN"* ]]; then
    continue
  fi

  log "Verarbeite: ${BASENAME}.csv"

  # Präfix: HPCN im Dateinamen → HPCN, sonst → Göhrum
  if [[ "$BASENAME" == *HPCN* ]]; then
    PREFIX="HPCN"
  else
    PREFIX="Göhrum"
  fi

  # Roh-CSV: Tätigkeitstext steht in Spalte „note“ (nicht „task“)
  HEADER=$(head -1 "$INFILE")
  IFS=';' read -ra COLS <<< "$HEADER"

  DATE_COL=-1; CATEGORY_COL=-1; NOTE_COL=-1; START_COL=-1; END_COL=-1

  for i in "${!COLS[@]}"; do
    case "${COLS[$i]}" in
      date)        DATE_COL=$i ;;
      category)    CATEGORY_COL=$i ;;
      note)        NOTE_COL=$i ;;
      start_time)  START_COL=$i ;;
      end_time)    END_COL=$i ;;
    esac
  done

  if [[ $DATE_COL -eq -1 || $CATEGORY_COL -eq -1 || $NOTE_COL -eq -1 || $START_COL -eq -1 || $END_COL -eq -1 ]]; then
    log "FEHLER: Pflicht-Spalten nicht gefunden (date, category, note, start_time, end_time) in ${BASENAME}.csv — übersprungen"
    continue
  fi

  # Datumsbereich aus Dateinamen extrahieren: YYYYMMDD-YYYYMMDD[+Suffix]
  DATE_RANGE=$(echo "$BASENAME" | grep -oE '^[0-9]{8}-[0-9]{8}')
  if [[ -z "$DATE_RANGE" ]]; then
    log "FEHLER: Dateinamen-Format nicht erkannt (erwartet: YYYYMMDD-YYYYMMDD...): ${BASENAME}.csv — übersprungen"
    continue
  fi

  DATE_FROM="${DATE_RANGE:0:8}"   # z.B. 20251117
  YEAR="${DATE_FROM:0:4}"         # 2025
  MON="${DATE_FROM:4:2}"          # 11
  DAY="${DATE_FROM:6:2}"          # 17

  # KW aus Dateinamen-Datum berechnen (nicht aus aktuellem Datum!)
  # date -j -f erwartet: YYYYMMDD
  KW=$(date -j -f "%Y%m%d" "$DATE_FROM" "+%V" 2>/dev/null)
  if [[ -z "$KW" ]]; then
    log "FEHLER: KW konnte nicht berechnet werden für $DATE_FROM — übersprungen"
    continue
  fi

  OUTFILENAME="${PREFIX} DLN KW ${YEAR}-${KW}.csv"
  OUTFILE="${OUTDIR}/${OUTFILENAME}"

  log "Ausgabedatei: ${OUTFILENAME}"

  # Ausgabe-CSV (gleiche Spaltennamen wie bisher für die App)
  printf "%s
" "Datum;Kunde;Tätigkeit;Von;Bis" > "$OUTFILE"

  # Stunden summieren via awk
  TOTAL_MINUTES=$(awk -F';' -v dc=$((DATE_COL+1)) -v sc=$((START_COL+1)) -v ec=$((END_COL+1)) '
    NR > 1 && $dc != "" {
      split($sc, von, ":")
      split($ec, bis, ":")
      diff = (bis[1] * 60 + bis[2]) - (von[1] * 60 + von[2])
      if (diff > 0) total += diff
    }
    END { print total+0 }
  ' "$INFILE")

  # Datenzeilen schreiben
  tail -n +2 "$INFILE" | while IFS=';' read -ra ROW; do
    DATUM="${ROW[$DATE_COL]}"
    KUNDE="${ROW[$CATEGORY_COL]}"
    TAETIGKEIT="${ROW[$NOTE_COL]}"
    VON="${ROW[$START_COL]}"
    BIS="${ROW[$END_COL]}"
    [[ -z "$DATUM" ]] && continue
    echo "${DATUM};${KUNDE};${TAETIGKEIT};${VON};${BIS}" >> "$OUTFILE"
  done

  # Summe anhängen
  DECIMAL=$(echo "scale=1; $TOTAL_MINUTES / 60" | bc | sed 's/\./,/')
  echo ";;Summe;;${DECIMAL}" >> "$OUTFILE"

  log "Fertig: ${OUTFILENAME} — Gesamtstunden: ${DECIMAL}"

  # Eingabedatei löschen
  rm "$INFILE"
  log "Eingabedatei gelöscht: ${BASENAME}.csv"

done

log "=== DLN-Konverter beendet ==="
