import { supabase } from '../lib/supabase';
import {
  Event,
  EventRegistration,
  CreateEventInput,
  UpdateEventInput,
  CreateRegistrationInput,
  UpdateRegistrationInput,
  PaymentStatus,
} from '../types';

/**
 * Events Service
 * Handles all event-related API calls to Supabase
 */

// ============================================
// EVENT CRUD OPERATIONS
// ============================================

/**
 * Fetch all published events
 */
export async function getPublishedEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, creator:created_by(id, first_name, last_name, display_name, avatar_url)')
    .eq('is_published', true)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return mapEvents(data || []);
}

/**
 * Fetch upcoming events
 */
export async function getUpcomingEvents(limit?: number): Promise<Event[]> {
  let query = supabase
    .from('events')
    .select('*, creator:created_by(id, first_name, last_name, display_name, avatar_url)')
    .eq('is_published', true)
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return mapEvents(data || []);
}

/**
 * Fetch past events
 */
export async function getPastEvents(limit?: number): Promise<Event[]> {
  let query = supabase
    .from('events')
    .select('*, creator:created_by(id, first_name, last_name, display_name, avatar_url)')
    .eq('is_published', true)
    .lt('event_date', new Date().toISOString())
    .order('event_date', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error} = await query;

  if (error) throw error;
  return mapEvents(data || []);
}

/**
 * Fetch single event by ID
 */
export async function getEventById(eventId: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .select('*, creator:created_by(id, first_name, last_name, display_name, avatar_url)')
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return mapEvent(data);
}

/**
 * Fetch events created by current user (for admins/teachers)
 */
export async function getMyCreatedEvents(): Promise<Event[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('events')
    .select('*, creator:created_by(id, first_name, last_name, display_name, avatar_url)')
    .eq('created_by', user.id)
    .order('event_date', { ascending: false });

  if (error) throw error;
  return mapEvents(data || []);
}

/**
 * Create new event
 */
export async function createEvent(input: CreateEventInput): Promise<Event> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('events')
    .insert({
      ...snakeCaseKeys(input),
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return mapEvent(data);
}

/**
 * Update event
 */
export async function updateEvent(input: UpdateEventInput): Promise<Event> {
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from('events')
    .update(snakeCaseKeys(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapEvent(data);
}

/**
 * Delete event
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

// ============================================
// REGISTRATION OPERATIONS
// ============================================

/**
 * Fetch user's registrations
 */
export async function getMyRegistrations(): Promise<EventRegistration[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('event_registrations')
    .select('*, event:events(*), user:profiles(*)')
    .eq('user_id', user.id)
    .order('registered_at', { ascending: false });

  if (error) throw error;
  return mapRegistrations(data || []);
}

/**
 * Fetch registrations for a specific event
 */
export async function getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*, user:profiles(id, first_name, last_name, email, phone_number)')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: true });

  if (error) throw error;
  return mapRegistrations(data || []);
}

/**
 * Check if user is registered for an event
 */
export async function getUserRegistration(eventId: string): Promise<EventRegistration | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRegistration(data) : null;
}

/**
 * Register for an event
 */
export async function registerForEvent(input: CreateRegistrationInput): Promise<EventRegistration> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get user profile for contact info
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, phone_number')
    .eq('id', user.id)
    .single();

  // Get event to calculate total amount
  const event = await getEventById(input.eventId);
  const totalAmount = event.hasFee ? event.pricePerPerson * input.numAttendees : 0;

  const { data, error } = await supabase
    .from('event_registrations')
    .insert({
      ...snakeCaseKeys(input),
      user_id: user.id,
      total_amount: totalAmount,
      contact_email: profile?.email,
      contact_phone: profile?.phone_number,
      registration_status: 'CONFIRMED',
      payment_status: event.hasFee ? 'PENDING' : 'WAIVED',
    })
    .select()
    .single();

  if (error) throw error;
  return mapRegistration(data);
}

/**
 * Update registration
 */
export async function updateRegistration(input: UpdateRegistrationInput): Promise<EventRegistration> {
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from('event_registrations')
    .update(snakeCaseKeys(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapRegistration(data);
}

/**
 * Cancel registration
 */
export async function cancelRegistration(registrationId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('event_registrations')
    .update({
      registration_status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', registrationId);

  if (error) throw error;
}

/**
 * Mark attendance (admin only)
 */
export async function markAttendance(
  registrationId: string,
  checkedIn: boolean,
  actualAttendees?: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updates: any = {
    checked_in: checkedIn,
    actual_attendees: actualAttendees,
  };

  if (checkedIn) {
    updates.checked_in_at = new Date().toISOString();
    updates.checked_in_by = user.id;
  }

  const { error } = await supabase
    .from('event_registrations')
    .update(updates)
    .eq('id', registrationId);

  if (error) throw error;
}

/**
 * Update payment status (admin only)
 */
export async function updatePaymentStatus(
  registrationId: string,
  status: PaymentStatus,
  paymentReference?: string
): Promise<void> {
  const updates: any = {
    payment_status: status,
  };

  if (status === 'PAID') {
    updates.paid_at = new Date().toISOString();
    if (paymentReference) {
      updates.payment_reference = paymentReference;
    }
  }

  const { error } = await supabase
    .from('event_registrations')
    .update(updates)
    .eq('id', registrationId);

  if (error) throw error;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert camelCase keys to snake_case for Supabase
 */
function snakeCaseKeys(obj: any): any {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Map database event to Event type
 */
function mapEvent(data: any): Event {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    eventType: data.event_type,
    eventDate: data.event_date,
    eventEndDate: data.event_end_date,
    registrationDeadline: data.registration_deadline,
    location: data.location,
    locationDetails: data.location_details,
    isOnline: data.is_online,
    meetingUrl: data.meeting_url,
    maxParticipants: data.max_participants,
    currentParticipants: data.current_participants,
    allowWaitlist: data.allow_waitlist,
    hasFee: data.has_fee,
    pricePerPerson: parseFloat(data.price_per_person || 0),
    currency: data.currency,
    providesFood: data.provides_food,
    foodOptions: data.food_options,
    requiresApproval: data.requires_approval,
    allowPlusOnes: data.allow_plus_ones,
    maxAttendeesPerRegistration: data.max_attendees_per_registration,
    targetAudience: data.target_audience,
    isPublished: data.is_published,
    isFeatured: data.is_featured,
    coverImageUrl: data.cover_image_url,
    attachments: data.attachments,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    publishedAt: data.published_at,
    tags: data.tags,
    customFields: data.custom_fields,
    creator: data.creator,
  };
}

function mapEvents(data: any[]): Event[] {
  return data.map(mapEvent);
}

/**
 * Map database registration to EventRegistration type
 */
function mapRegistration(data: any): EventRegistration {
  return {
    id: data.id,
    eventId: data.event_id,
    userId: data.user_id,
    familyId: data.family_id,
    numAttendees: data.num_attendees,
    attendeeNames: data.attendee_names,
    attendeeAges: data.attendee_ages,
    foodPreferences: data.food_preferences,
    dietaryRestrictions: data.dietary_restrictions,
    specialRequirements: data.special_requirements,
    totalAmount: parseFloat(data.total_amount || 0),
    paymentStatus: data.payment_status,
    paymentMethod: data.payment_method,
    paymentReference: data.payment_reference,
    paidAt: data.paid_at,
    registrationStatus: data.registration_status,
    checkedIn: data.checked_in,
    checkedInAt: data.checked_in_at,
    checkedInBy: data.checked_in_by,
    actualAttendees: data.actual_attendees,
    registeredAt: data.registered_at,
    cancelledAt: data.cancelled_at,
    cancellationReason: data.cancellation_reason,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    notes: data.notes,
    adminNotes: data.admin_notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    event: data.event ? mapEvent(data.event) : undefined,
    user: data.user,
  };
}

function mapRegistrations(data: any[]): EventRegistration[] {
  return data.map(mapRegistration);
}
