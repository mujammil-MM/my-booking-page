import prisma from '@/lib/prisma';
import { supabase, supabaseAdmin } from '@/lib/supabaseShared';
import { getCallDuration } from '@/lib/types';

type RawQualification = {
  id?: string;
  bookingId?: string;
  problem?: string;
  budgetRange?: string;
  timeline?: string;
  workedWithAgencyBefore?: string;
};

type RawBooking = Record<string, unknown>;

export type AppQualification = {
  problem: string;
  budgetRange: string;
  timeline: string;
  workedWithAgencyBefore: string;
};

export type AppBooking = {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  company: string;
  discussionTopic: string;
  callType: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  meetingLink: string;
  calendarEventId: string;
  status: string;
  rescheduleCount: number;
  createdAt: string;
  updatedAt?: string;
  qualification?: AppQualification;
};

type BookingListOptions = {
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  query?: string | null;
  limit?: number;
  offset?: number;
};

type CreateBookingInput = {
  clientName: string;
  email: string;
  phone: string;
  company?: string;
  discussionTopic?: string;
  callType: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  meetingLink?: string;
  calendarEventId?: string;
  status?: string;
  qualification?: Partial<AppQualification>;
};

const supabaseReadClient = supabaseAdmin ?? supabase;

function useSupabaseStore(): boolean {
  return Boolean(supabaseReadClient);
}

function mapQualification(raw?: RawQualification | null, booking?: RawBooking | null): AppQualification | undefined {
  const problem = String(raw?.problem ?? booking?.problem ?? '');
  const budgetRange = String(raw?.budgetRange ?? booking?.budget ?? '');
  const timeline = String(raw?.timeline ?? booking?.timeline ?? '');
  const workedWithAgencyBefore = String(raw?.workedWithAgencyBefore ?? booking?.prior_agency ?? '');

  if (!problem && !budgetRange && !timeline && !workedWithAgencyBefore) {
    return undefined;
  }

  return {
    problem,
    budgetRange,
    timeline,
    workedWithAgencyBefore,
  };
}

function addDuration(startTime: string, callType: string): string {
  const duration = getCallDuration(callType as never);
  const [hours, minutes] = startTime.split(':').map(Number);
  const total = hours * 60 + minutes + duration;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const outHours = Math.floor(wrapped / 60);
  const outMinutes = wrapped % 60;
  return `${String(outHours).padStart(2, '0')}:${String(outMinutes).padStart(2, '0')}`;
}

function normalizeTime(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    return '00:00';
  }

  return raw.slice(0, 5);
}

function mapBooking(raw: RawBooking, qualification?: RawQualification | null): AppBooking {
  const callType = String(raw.callType ?? raw.call_type ?? 'INTRO_15');
  const startTime = normalizeTime(raw.startTime ?? raw.time);
  const endTime = normalizeTime(raw.endTime) || addDuration(startTime, callType);
  const mappedQualification = mapQualification(qualification, raw);

  return {
    id: String(raw.id ?? ''),
    clientName: String(raw.clientName ?? raw.name ?? ''),
    email: String(raw.email ?? ''),
    phone: String(raw.phone ?? ''),
    company: String(raw.company ?? ''),
    discussionTopic: String(raw.discussionTopic ?? raw.discussion ?? ''),
    callType,
    date: String(raw.date ?? ''),
    startTime,
    endTime: endTime === '00:00' && startTime !== '00:00' ? addDuration(startTime, callType) : endTime,
    timeZone: String(raw.timeZone ?? raw.client_timezone ?? raw.clientTimeZone ?? 'UTC'),
    meetingLink: String(raw.meetingLink ?? raw.meeting_link ?? ''),
    calendarEventId: String(raw.calendarEventId ?? ''),
    status: String(raw.status ?? 'CONFIRMED'),
    rescheduleCount: Number(raw.rescheduleCount ?? 0),
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : raw.updated_at ? String(raw.updated_at) : undefined,
    qualification: mappedQualification,
  };
}

async function fetchQualificationMap(bookingIds: string[]): Promise<Record<string, RawQualification>> {
  if (!supabaseReadClient || bookingIds.length === 0) {
    return {};
  }

  const { data, error } = await supabaseReadClient
    .from('qualification_answers')
    .select('*')
    .in('bookingId', bookingIds);

  if (error || !data) {
    return {};
  }

  return Object.fromEntries(
    data.map((row: RawQualification) => [String(row.bookingId ?? ''), row])
  );
}

async function listSupabaseBookingsByDateRange(dateFrom?: string, dateTo?: string): Promise<AppBooking[]> {
  if (!supabaseReadClient) {
    return [];
  }

  let query = supabaseReadClient.from('bookings').select('*').order('date', { ascending: false });

  if (dateFrom) {
    query = query.gte('date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('date', dateTo);
  }

  const { data, error } = await query;

  if (error || !data) {
    throw error ?? new Error('Failed to fetch bookings from Supabase');
  }

  const qualificationMap = await fetchQualificationMap(data.map((row: RawBooking) => String(row.id)));
  return data.map((row: RawBooking) => mapBooking(row, qualificationMap[String(row.id)]));
}

export async function getBootstrapData() {
  if (!useSupabaseStore()) {
    const [settings, holidays] = await Promise.all([
      prisma.globalSettings.findUnique({
        where: { id: 'default' },
        select: { holidayMode: true },
      }),
      prisma.holiday.findMany({
        orderBy: { date: 'asc' },
        select: { id: true, date: true, note: true },
      }),
    ]);

    return {
      holidayMode: settings?.holidayMode ?? false,
      holidays,
    };
  }

  try {
    const [settingsResult, holidaysResult] = await Promise.all([
      supabaseReadClient!.from('global_settings').select('*').eq('id', 'default').maybeSingle(),
      supabaseReadClient!.from('holidays').select('*').order('date', { ascending: true }),
    ]);

    return {
      holidayMode: Boolean(settingsResult.data?.holidayMode ?? false),
      holidays: (holidaysResult.data ?? []).map(row => ({
        id: String(row.id),
        date: String(row.date),
        note: String(row.note ?? ''),
      })),
    };
  } catch (error) {
    console.error('Supabase bootstrap fallback:', error);
    return {
      holidayMode: false,
      holidays: [],
    };
  }
}

export async function getSettingsData() {
  const data = await getBootstrapData();
  return { holidayMode: data.holidayMode };
}

export async function updateSettingsData(holidayMode: boolean) {
  if (!supabaseAdmin) {
    return prisma.globalSettings.upsert({
      where: { id: 'default' },
      update: { holidayMode },
      create: { id: 'default', holidayMode },
    });
  }

  const { data, error } = await supabaseAdmin
    .from('global_settings')
    .upsert({ id: 'default', holidayMode }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listHolidaysData() {
  return (await getBootstrapData()).holidays;
}

export async function createHolidayData(date: string, note: string) {
  if (!supabaseAdmin) {
    return prisma.holiday.create({ data: { date, note } });
  }

  const { data, error } = await supabaseAdmin
    .from('holidays')
    .insert({ date, note })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteHolidayData(id: string) {
  if (!supabaseAdmin) {
    await prisma.holiday.delete({ where: { id } });
    return;
  }

  const { error } = await supabaseAdmin.from('holidays').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export async function getBookingData(id: string): Promise<AppBooking | null> {
  if (!useSupabaseStore()) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { qualification: true },
    });

    if (!booking) {
      return null;
    }

    return {
      ...booking,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  const { data, error } = await supabaseReadClient!.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    return null;
  }

  const qualificationMap = await fetchQualificationMap([String(data.id)]);
  return mapBooking(data, qualificationMap[String(data.id)]);
}

export async function listBookingsData(options: BookingListOptions = {}) {
  const { status, dateFrom, dateTo, query, limit = 50, offset = 0 } = options;

  if (!useSupabaseStore()) {
    const where = {
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { clientName: { contains: query } },
              { email: { contains: query } },
              { company: { contains: query } },
              { discussionTopic: { contains: query } },
            ],
          }
        : {}),
    };

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { qualification: true },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings: bookings.map(booking => ({
        ...booking,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      })),
      totalCount,
      limit,
      offset,
    };
  }

  const allBookings = await listSupabaseBookingsByDateRange(dateFrom ?? undefined, dateTo ?? undefined);
  const normalizedQuery = query?.trim().toLowerCase() ?? '';

  const filtered = allBookings.filter(booking => {
    if (status && booking.status !== status) {
      return false;
    }

    if (dateFrom && booking.date < dateFrom) {
      return false;
    }

    if (dateTo && booking.date > dateTo) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      booking.clientName,
      booking.email,
      booking.company,
      booking.discussionTopic,
    ].join(' ').toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  return {
    bookings: filtered.slice(offset, offset + limit),
    totalCount: filtered.length,
    limit,
    offset,
  };
}

export async function listBookingsForAvailability(dateFrom: string, dateTo: string) {
  if (!useSupabaseStore()) {
    return prisma.booking.findMany({
      where: {
        status: { not: 'CANCELLED' },
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: { date: true, startTime: true, endTime: true },
    });
  }

  const rows = await listSupabaseBookingsByDateRange(dateFrom, dateTo);
  return rows
    .filter(row => row.status !== 'CANCELLED')
    .map(row => ({
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
    }));
}

export async function findBookingConflictData(
  idToExclude: string | null,
  date: string,
  startTime: string,
  endTime: string,
  endDate: string
) {
  if (!useSupabaseStore()) {
    return prisma.booking.findFirst({
      where: {
        ...(idToExclude ? { id: { not: idToExclude } } : {}),
        status: { not: 'CANCELLED' },
        OR: [
          {
            date,
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } },
            ],
          },
          {
            date: endDate,
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } },
            ],
          },
        ],
      },
      select: { id: true },
    });
  }

  const rows = await listSupabaseBookingsByDateRange(
    date < endDate ? date : endDate,
    date > endDate ? date : endDate
  );

  return rows.find(row => {
    if (idToExclude && row.id === idToExclude) {
      return false;
    }

    if (row.status === 'CANCELLED') {
      return false;
    }

    if (row.date !== date && row.date !== endDate) {
      return false;
    }

    return (
      (row.startTime <= startTime && row.endTime > startTime) ||
      (row.startTime < endTime && row.endTime >= endTime) ||
      (row.startTime >= startTime && row.endTime <= endTime)
    );
  }) ?? null;
}

export async function createBookingData(input: CreateBookingInput): Promise<AppBooking> {
  if (!supabaseAdmin) {
    const booking = await prisma.booking.create({
      data: {
        clientName: input.clientName,
        email: input.email,
        phone: input.phone,
        company: input.company || '',
        discussionTopic: input.discussionTopic || '',
        callType: input.callType,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        timeZone: input.timeZone,
        meetingLink: input.meetingLink || '',
        calendarEventId: input.calendarEventId || '',
        status: input.status || 'CONFIRMED',
        qualification: input.qualification
          ? {
              create: {
                problem: input.qualification.problem || '',
                budgetRange: input.qualification.budgetRange || '',
                timeline: input.qualification.timeline || '',
                workedWithAgencyBefore: input.qualification.workedWithAgencyBefore || '',
              },
            }
          : undefined,
      },
      include: { qualification: true },
    });

    return {
      ...booking,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  const modernPayload = {
    clientName: input.clientName,
    email: input.email,
    phone: input.phone,
    company: input.company || '',
    discussionTopic: input.discussionTopic || '',
    callType: input.callType,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    timeZone: input.timeZone,
    meetingLink: input.meetingLink || '',
    calendarEventId: input.calendarEventId || '',
    status: input.status || 'CONFIRMED',
    rescheduleCount: 0,
  };

  let insertedRow: RawBooking | null = null;

  const modernInsert = await supabaseAdmin.from('bookings').insert(modernPayload).select('*').maybeSingle();
  if (!modernInsert.error && modernInsert.data) {
    insertedRow = modernInsert.data;
  } else {
    const legacyInsert = await supabaseAdmin
      .from('bookings')
      .insert({
        name: input.clientName,
        email: input.email,
        phone: input.phone,
        company: input.company || '',
        call_type: input.callType,
        date: input.date,
        time: `${input.startTime}:00`,
        meeting_link: input.meetingLink || '',
        created_at: new Date().toISOString(),
        discussion: input.discussionTopic || '',
        problem: input.qualification?.problem || '',
        budget: input.qualification?.budgetRange || '',
        timeline: input.qualification?.timeline || '',
        prior_agency: input.qualification?.workedWithAgencyBefore || '',
        client_timezone: input.timeZone,
      })
      .select('*')
      .maybeSingle();

    if (legacyInsert.error || !legacyInsert.data) {
      throw legacyInsert.error || modernInsert.error || new Error('Failed to create booking');
    }

    insertedRow = legacyInsert.data;
  }

  if (insertedRow && input.qualification) {
    const qualificationInsert = await supabaseAdmin.from('qualification_answers').insert({
      bookingId: insertedRow.id,
      problem: input.qualification.problem || '',
      budgetRange: input.qualification.budgetRange || '',
      timeline: input.qualification.timeline || '',
      workedWithAgencyBefore: input.qualification.workedWithAgencyBefore || '',
    });

    if (qualificationInsert.error) {
      console.warn('Qualification insert skipped:', qualificationInsert.error.message);
    }
  }

  const booking = await getBookingData(String(insertedRow?.id));
  if (!booking) {
    throw new Error('Created booking could not be reloaded');
  }

  return booking;
}

export async function updateBookingData(id: string, data: Partial<AppBooking> & { qualification?: Partial<AppQualification> }) {
  if (!supabaseAdmin) {
    const updated = await prisma.booking.update({
      where: { id },
      data: {
        ...(data.date ? { date: data.date } : {}),
        ...(data.startTime ? { startTime: data.startTime } : {}),
        ...(data.endTime ? { endTime: data.endTime } : {}),
        ...(data.timeZone ? { timeZone: data.timeZone } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(typeof data.rescheduleCount === 'number' ? { rescheduleCount: data.rescheduleCount } : {}),
      },
      include: { qualification: true },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const modernUpdate = await supabaseAdmin
    .from('bookings')
    .update({
      ...(data.date ? { date: data.date } : {}),
      ...(data.startTime ? { startTime: data.startTime } : {}),
      ...(data.endTime ? { endTime: data.endTime } : {}),
      ...(data.timeZone ? { timeZone: data.timeZone } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(typeof data.rescheduleCount === 'number' ? { rescheduleCount: data.rescheduleCount } : {}),
    })
    .eq('id', id);

  if (modernUpdate.error) {
    const legacyUpdate = await supabaseAdmin
      .from('bookings')
      .update({
        ...(data.date ? { date: data.date } : {}),
        ...(data.startTime ? { time: `${data.startTime}:00` } : {}),
        ...(data.timeZone ? { client_timezone: data.timeZone } : {}),
      })
      .eq('id', id);

    if (legacyUpdate.error) {
      throw legacyUpdate.error;
    }
  }

  const booking = await getBookingData(id);
  if (!booking) {
    throw new Error('Updated booking could not be reloaded');
  }

  return booking;
}

export async function getAnalyticsSummaryData() {
  const rows = useSupabaseStore()
    ? await listSupabaseBookingsByDateRange()
    : (await prisma.booking.findMany({
        include: { qualification: true },
      })).map(booking => ({
        ...booking,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      }));

  const today = new Date().toISOString().split('T')[0];
  const total = rows.length;
  const cancelled = rows.filter(row => row.status === 'CANCELLED').length;
  const noShow = rows.filter(row => row.status === 'NO_SHOW').length;
  const completed = rows.filter(row => row.status === 'COMPLETED').length;
  const upcoming = rows.filter(row => row.status === 'CONFIRMED' && row.date >= today).length;

  const slotCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.status !== 'CANCELLED') {
      slotCounts.set(row.startTime, (slotCounts.get(row.startTime) || 0) + 1);
    }
    typeCounts.set(row.callType, (typeCounts.get(row.callType) || 0) + 1);
  }

  const popularSlots = Array.from(slotCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([time, count]) => ({ time, count }));

  const bookingsByType = Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count }));

  return {
    totalBookings: total,
    upcomingBookings: upcoming,
    completedBookings: completed,
    cancelledBookings: cancelled,
    noShowBookings: noShow,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    popularSlots,
    bookingsByType,
  };
}

export async function getDailyAnalyticsData() {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - 30);
  const fromDate = dateLimit.toISOString().split('T')[0];
  const rows = useSupabaseStore()
    ? await listSupabaseBookingsByDateRange(fromDate)
    : (await prisma.booking.findMany({
        where: {
          date: { gte: fromDate },
          status: { not: 'CANCELLED' },
        },
        select: { date: true },
      })).map(row => ({ date: row.date }));

  const countsByDate: Record<string, number> = {};
  for (let i = 0; i <= 30; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    countsByDate[d.toISOString().split('T')[0]] = 0;
  }

  for (const row of rows) {
    if ((row as AppBooking).status && (row as AppBooking).status === 'CANCELLED') {
      continue;
    }

    const date = String((row as { date: string }).date);
    if (date in countsByDate) {
      countsByDate[date] += 1;
    }
  }

  return Object.keys(countsByDate)
    .sort()
    .map(date => ({
      date,
      count: countsByDate[date],
      displayDate: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
}
