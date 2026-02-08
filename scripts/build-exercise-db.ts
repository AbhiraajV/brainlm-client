/**
 * Build script: Convert megaGymDataset.csv → exercise-database.json
 *
 * Usage: npx tsx scripts/build-exercise-db.ts
 *
 * Reads the CSV from ../gym-exercise-data/megaGymDataset.csv,
 * maps BodyPart → MuscleGroup and Equipment → EquipmentType,
 * and outputs lib/gym/exercise-database.json.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// FIELD MAPPINGS
// ============================================================================

const BODY_PART_TO_MUSCLE_GROUP: Record<string, string> = {
  Abdominals: 'abs',
  Abductors: 'glute_medius',
  Adductors: 'adductors',
  Biceps: 'biceps',
  Calves: 'calves',
  Chest: 'chest',
  Forearms: 'forearms',
  Glutes: 'glutes',
  Hamstrings: 'hamstrings',
  Lats: 'lats',
  'Lower Back': 'lower_back',
  'Middle Back': 'back',
  Neck: 'traps',
  Quadriceps: 'quadriceps',
  Shoulders: 'shoulders',
  Traps: 'traps',
  Triceps: 'triceps',
};

const EQUIPMENT_TO_TYPE: Record<string, string> = {
  Bands: 'resistance_band',
  Barbell: 'barbell',
  'Body Only': 'bodyweight',
  Cable: 'cable',
  Dumbbell: 'dumbbell',
  'E-Z Curl Bar': 'ez_bar',
  'Exercise Ball': 'other',
  'Foam Roll': 'other',
  Kettlebells: 'kettlebell',
  Machine: 'machine',
  'Medicine Ball': 'other',
  None: 'bodyweight',
  Other: 'other',
};

// ============================================================================
// CSV PARSER (simple, handles quoted fields with commas/newlines)
// ============================================================================

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(field);
        field = '';
        if (row.length > 1) rows.push(row); // skip empty rows
        row = [];
        if (ch === '\r') i++; // skip \r\n
      } else {
        field += ch;
      }
    }
  }

  // Last field/row
  if (field || row.length > 0) {
    row.push(field);
    if (row.length > 1) rows.push(row);
  }

  return rows;
}

// ============================================================================
// MAIN
// ============================================================================

const csvPath = resolve(__dirname, '../../gym-exercise-data/megaGymDataset.csv');
const outputPath = resolve(__dirname, '../lib/gym/exercise-database.json');

console.log('Reading CSV from:', csvPath);
const csvText = readFileSync(csvPath, 'utf-8');
const rows = parseCSV(csvText);

// Header: ,Title,Desc,Type,BodyPart,Equipment,Level,Rating,RatingDesc
const header = rows[0];
console.log('Header:', header);

const titleIdx = header.indexOf('Title');
const typeIdx = header.indexOf('Type');
const bodyPartIdx = header.indexOf('BodyPart');
const equipmentIdx = header.indexOf('Equipment');
const levelIdx = header.indexOf('Level');

if (titleIdx < 0 || bodyPartIdx < 0 || equipmentIdx < 0) {
  console.error('Missing required columns');
  process.exit(1);
}

interface GlobalExercise {
  id: number;
  name: string;
  muscleGroup: string;
  equipmentType: string;
  bodyPart: string;
  equipment: string;
  type: string;
  level: string;
}

const exercises: GlobalExercise[] = [];
const seenNames = new Set<string>();

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const title = row[titleIdx]?.trim();
  if (!title) continue;

  // Skip duplicates by name
  const nameLower = title.toLowerCase();
  if (seenNames.has(nameLower)) continue;
  seenNames.add(nameLower);

  const bodyPart = row[bodyPartIdx]?.trim() || '';
  const equipment = row[equipmentIdx]?.trim() || '';
  const type = row[typeIdx]?.trim() || '';
  const level = row[levelIdx]?.trim() || '';

  const muscleGroup = BODY_PART_TO_MUSCLE_GROUP[bodyPart] || 'full_body';
  const equipmentType = EQUIPMENT_TO_TYPE[equipment] || 'other';

  exercises.push({
    id: exercises.length, // sequential 0-based
    name: title,
    muscleGroup,
    equipmentType,
    bodyPart,
    equipment,
    type,
    level,
  });
}

console.log(`Processed ${exercises.length} unique exercises from ${rows.length - 1} rows`);

writeFileSync(outputPath, JSON.stringify(exercises));
console.log('Written to:', outputPath);
