export interface GoogleFitStatus {
  connected: boolean;
  connectedAt?: string;
  scopes?: string;
}

export interface WeightDataPoint {
  date: string;
  weightKg: number;
}

export interface BodyFatDataPoint {
  date: string;
  bodyFatPercent: number;
}

export interface StepsDataPoint {
  date: string;
  steps: number;
}

export interface SleepSession {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface GoogleFitData {
  weight: WeightDataPoint[];
  bodyFat: BodyFatDataPoint[];
  steps: StepsDataPoint[];
  sleep: SleepSession[];
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
}
