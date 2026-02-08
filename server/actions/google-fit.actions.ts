'use server';

import { prisma } from '@/server/prisma/client';
import { requireUser } from '@/server/auth/require-user';
import { getValidToken } from '@/lib/google-fit/tokens';
import type {
  GoogleFitStatus,
  GoogleFitData,
  WeightDataPoint,
  BodyFatDataPoint,
  StepsDataPoint,
  SleepSession,
} from '@/lib/google-fit/types';

const FITNESS_API = 'https://www.googleapis.com/fitness/v1/users/me';

export async function getGoogleFitStatus(): Promise<GoogleFitStatus> {
  const user = await requireUser();

  const connection = await prisma.googleFitConnection.findUnique({
    where: { userId: user.id },
    select: { createdAt: true, scopes: true },
  });

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: true,
    connectedAt: connection.createdAt.toISOString(),
    scopes: connection.scopes,
  };
}

export async function fetchGoogleFitData(
  startDate: string,
  endDate: string
): Promise<GoogleFitData> {
  const user = await requireUser();
  const token = await getValidToken(user.id);

  if (!token) {
    throw new Error('Google Fit not connected');
  }

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const startNs = startMs * 1_000_000;
  const endNs = endMs * 1_000_000;

  const headers = {
    Authorization: `Bearer ${token.accessToken}`,
    'Content-Type': 'application/json',
  };

  const [weight, bodyFat, steps, sleep] = await Promise.all([
    fetchAggregateData(headers, startNs, endNs, 'com.google.weight', parseWeightBuckets),
    fetchAggregateData(headers, startNs, endNs, 'com.google.body.fat.percentage', parseBodyFatBuckets),
    fetchAggregateData(headers, startNs, endNs, 'com.google.step_count.delta', parseStepsBuckets),
    fetchSleepSessions(headers, startMs, endMs),
  ]);

  return {
    weight,
    bodyFat,
    steps,
    sleep,
    fetchedAt: new Date().toISOString(),
    periodStart: startDate,
    periodEnd: endDate,
  };
}

export async function disconnectGoogleFit(): Promise<void> {
  const user = await requireUser();

  await prisma.googleFitConnection.deleteMany({
    where: { userId: user.id },
  });
}

// --- Internal helpers ---

async function fetchAggregateData<T>(
  headers: Record<string, string>,
  startTimeNanos: number,
  endTimeNanos: number,
  dataTypeName: string,
  parseBuckets: (buckets: AggBucket[]) => T[]
): Promise<T[]> {
  try {
    const resp = await fetch(`${FITNESS_API}/dataset:aggregate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName }],
        bucketByTime: { durationMillis: 86400000 }, // 1 day
        startTimeMillis: Math.floor(startTimeNanos / 1_000_000),
        endTimeMillis: Math.floor(endTimeNanos / 1_000_000),
      }),
    });

    if (!resp.ok) {
      console.error(`Google Fit aggregate ${dataTypeName} failed:`, resp.status);
      return [];
    }

    const data = await resp.json();
    return parseBuckets(data.bucket ?? []);
  } catch (err) {
    console.error(`Google Fit aggregate ${dataTypeName} error:`, err);
    return [];
  }
}

interface AggBucket {
  startTimeMillis: string;
  dataset: Array<{
    point: Array<{
      value: Array<{ fpVal?: number; intVal?: number }>;
    }>;
  }>;
}

function parseWeightBuckets(buckets: AggBucket[]): WeightDataPoint[] {
  const results: WeightDataPoint[] = [];
  for (const bucket of buckets) {
    const points = bucket.dataset?.[0]?.point ?? [];
    for (const point of points) {
      const val = point.value?.[0]?.fpVal;
      if (val != null) {
        results.push({
          date: new Date(Number(bucket.startTimeMillis)).toISOString().split('T')[0],
          weightKg: Math.round(val * 10) / 10,
        });
      }
    }
  }
  return results;
}

function parseBodyFatBuckets(buckets: AggBucket[]): BodyFatDataPoint[] {
  const results: BodyFatDataPoint[] = [];
  for (const bucket of buckets) {
    const points = bucket.dataset?.[0]?.point ?? [];
    for (const point of points) {
      const val = point.value?.[0]?.fpVal;
      if (val != null) {
        results.push({
          date: new Date(Number(bucket.startTimeMillis)).toISOString().split('T')[0],
          bodyFatPercent: Math.round(val * 10) / 10,
        });
      }
    }
  }
  return results;
}

function parseStepsBuckets(buckets: AggBucket[]): StepsDataPoint[] {
  const results: StepsDataPoint[] = [];
  for (const bucket of buckets) {
    const points = bucket.dataset?.[0]?.point ?? [];
    for (const point of points) {
      const val = point.value?.[0]?.intVal;
      if (val != null && val > 0) {
        results.push({
          date: new Date(Number(bucket.startTimeMillis)).toISOString().split('T')[0],
          steps: val,
        });
      }
    }
  }
  return results;
}

async function fetchSleepSessions(
  headers: Record<string, string>,
  startMs: number,
  endMs: number
): Promise<SleepSession[]> {
  try {
    const params = new URLSearchParams({
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      activityType: '72', // Sleep
    });

    const resp = await fetch(`${FITNESS_API}/sessions?${params.toString()}`, {
      headers,
    });

    if (!resp.ok) {
      console.error('Google Fit sleep sessions failed:', resp.status);
      return [];
    }

    const data = await resp.json();
    const sessions: SleepSession[] = [];

    for (const s of data.session ?? []) {
      const start = new Date(Number(s.startTimeMillis));
      const end = new Date(Number(s.endTimeMillis));
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

      sessions.push({
        date: start.toISOString().split('T')[0],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes,
      });
    }

    return sessions;
  } catch (err) {
    console.error('Google Fit sleep sessions error:', err);
    return [];
  }
}
