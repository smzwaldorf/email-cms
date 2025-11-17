# Event Registration System - Implementation Guide

## Overview

A Facebook/Luma-style event registration system integrated with the existing login system. Parents can browse events, register with a single click, specify attendees, food preferences, and payment details. Admins can manage events, view participants, and track attendance.

## ✅ What's Already Implemented

### 1. Database Schema (`supabase-events-migration.sql`)

Complete database structure with:

#### Core Tables
- **events**: Store event information (date, location, capacity, pricing, food options)
- **event_registrations**: Track user registrations with attendees, food preferences, payment
- **event_attendance**: Detailed attendance tracking per attendee
- **event_comments**: Q&A and discussion system

#### Key Features
- **Automatic participant counting**: Trigger updates `current_participants` on registration changes
- **Row Level Security**: Comprehensive RLS policies for all tables
- **Helper functions**: `is_event_full()`, `calculate_registration_fee()`
- **Payment tracking**: Support for multiple payment statuses
- **Attendance system**: Check-in tracking with timestamps

### 2. TypeScript Types (`src/types/index.ts`)

Complete type definitions:
- `Event`, `EventRegistration`, `EventAttendance`, `EventComment`
- Enums: `EventType`, `RegistrationStatus`, `PaymentStatus`
- Input types: `CreateEventInput`, `UpdateEventInput`, `CreateRegistrationInput`
- Helper functions: `getEventTypeDisplayName()`, `isEventFull()`, `isRegistrationOpen()`, `calculateTotalPrice()`

### 3. Events Service (`src/services/eventsService.ts`)

Complete API service with functions for:

**Event Operations:**
- `getPublishedEvents()` - Fetch all published events
- `getUpcomingEvents()` - Fetch future events
- `getPastEvents()` - Fetch historical events
- `getEventById()` - Fetch single event
- `getMyCreatedEvents()` - Fetch events created by current user
- `createEvent()` - Create new event
- `updateEvent()` - Update event
- `deleteEvent()` - Delete event

**Registration Operations:**
- `getMyRegistrations()` - Fetch user's registrations
- `getEventRegistrations()` - Fetch all registrations for an event (admin)
- `getUserRegistration()` - Check if user is registered
- `registerForEvent()` - Register for event
- `updateRegistration()` - Update registration
- `cancelRegistration()` - Cancel registration
- `markAttendance()` - Mark check-in (admin)
- `updatePaymentStatus()` - Update payment (admin)

---

## 📋 Components to Implement

### Core User-Facing Components

#### 1. EventCard Component (`src/components/EventCard.tsx`)

Display event in a card format (like Facebook event cards):

```tsx
interface EventCardProps {
  event: Event;
  onRegister?: (event: Event) => void;
  showActions?: boolean;
}

// Features:
// - Cover image or default gradient
// - Event title, type badge
// - Date, time, location
// - Participant count (X/Y spots filled)
// - Price tag if has_fee
// - "Interested" and "Join" buttons
// - Registration status indicator if already registered
```

**Key Features:**
- Visual capacity indicator (progress bar)
- Registration deadline countdown
- Price display with currency
- "Event Full" or "Waitlist Available" badges

#### 2. EventListPage (`src/pages/EventListPage.tsx`)

Browse all available events:

```tsx
// Features:
// - Tabs: "Upcoming", "Past", "My Events"
// - Filter by event type
// - Search by title
// - Sort by date/popularity
// - Grid of EventCard components
// - Featured events at top
// - Empty state when no events
```

**Layout:**
```
┌────────────────────────────────────────┐
│  [Upcoming] [Past] [My Events]         │
│  Search: [...] Filter: [All Events ▼]  │
├────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │ Event  │  │ Event  │  │ Event  │   │
│  │ Card 1 │  │ Card 2 │  │ Card 3 │   │
│  └────────┘  └────────┘  └────────┘   │
└────────────────────────────────────────┘
```

#### 3. EventDetailPage (`src/pages/EventDetailPage.tsx`)

Detailed event view with registration:

```tsx
// Features:
// - Full event description (Markdown support)
// - Date, time, location with map link
// - Organizer info
// - Participant list (first N avatars + count)
// - Food options display
// - Comments/Q&A section
// - Large "Join Event" button (Facebook-style)
// - Registration modal on click
// - Share button
```

**Sections:**
1. Hero section with cover image
2. Event details
3. Registration button (changes based on status)
4. Attendees preview
5. Comments/Questions

#### 4. EventRegistrationModal (`src/components/EventRegistrationModal.tsx`)

Registration form modal:

```tsx
interface EventRegistrationModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Form Fields:
// 1. Number of attendees (auto-suggest from family members)
// 2. Attendee names (text inputs for each)
// 3. Food preferences (dropdown per attendee if providesFood)
// 4. Dietary restrictions (textarea)
// 5. Special requirements (textarea)
// 6. Notes (optional)
// 7. Total price calculation (real-time)
// 8. Payment method selection (if hasFee)
// 9. Terms & conditions checkbox
```

**Smart Features:**
- Auto-populate attendee count from family members
- Real-time price calculation
- Form validation
- Success animation on registration

#### 5. MyEventsPage (`src/pages/MyEventsPage.tsx`)

User's registered events:

```tsx
// Tabs:
// - "Upcoming": Future events user registered for
// - "Past": Past events user attended
// - "Cancelled": Cancelled registrations

// For each registration:
// - Event card
// - Registration details (# attendees, food choices)
// - Payment status badge
// - Check-in status for past events
// - "Cancel Registration" button
// - "View Receipt" button
```

### Admin/Teacher Components

#### 6. EventManagementPage (`src/pages/EventManagementPage.tsx`)

Admin dashboard for event management:

```tsx
// Features:
// - List of all events (published + unpublished)
// - Create Event button → opens EventFormModal
// - Edit/Delete actions per event
// - Quick publish/unpublish toggle
// - Participant count per event
// - "View Participants" link
// - Duplicate event feature
// - Bulk actions
```

**Table Columns:**
- Title
- Date
- Type
- Registrations (X/Y)
- Status (Published/Draft)
- Actions (Edit/Delete/Participants)

#### 7. EventFormModal (`src/components/EventFormModal.tsx`)

Create/Edit event form:

```tsx
interface EventFormModalProps {
  event?: Event; // If editing
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Form Sections:
// 1. Basic Info: Title, Description (Markdown editor), Type
// 2. Date & Time: Event date, end date, registration deadline
// 3. Location: Location name, details, online toggle, meeting URL
// 4. Capacity: Max participants, waitlist toggle
// 5. Pricing: Has fee toggle, price per person, currency
// 6. Food: Provides food toggle, food options (multi-input)
// 7. Settings: Requires approval, allow plus ones, max per registration
// 8. Visibility: Target audience (checkboxes), publish toggle
// 9. Media: Cover image upload, attachments
// 10. Tags: Tag input
```

#### 8. EventParticipantsPage (`src/pages/EventParticipantsPage.tsx`)

Participant management for specific event:

```tsx
// Features:
// - Event summary at top
// - Search participants by name/email
// - Filter by: Registration status, Payment status, Check-in status
// - Export to CSV
// - Bulk actions: Mark paid, Mark checked-in, Send email
//
// Participant Table Columns:
// - Name (with avatar)
// - Email & Phone
// - # Attendees
// - Food Preferences
// - Payment Status (badge + action)
// - Check-in Status (checkbox)
// - Actions (Edit, Cancel, Send Email)

// Actions:
// - Mark as paid → updatePaymentStatus()
// - Check-in → markAttendance()
// - View details → expand row
// - Send reminder email
```

**Quick Stats:**
- Total registrations
- Total attendees
- Checked in / Not checked in
- Paid / Pending payment

---

## 🎨 UI/UX Design Guidelines

### Color Scheme (Match Waldorf Palette)

```css
/* Event Status Colors */
.event-upcoming { background: waldorf-sage; }
.event-past { background: gray-400; }
.event-full { background: waldorf-clay; }
.event-featured { border: 2px solid waldorf-peach; }

/* Registration Status */
.status-confirmed { color: green-600; }
.status-pending { color: yellow-600; }
.status-waitlist { color: orange-600; }
.status-cancelled { color: red-600; }

/* Payment Status */
.payment-paid { color: green-600; }
.payment-pending { color: orange-600; }
.payment-waived { color: blue-600; }
```

### Component Design Patterns

#### Button Styles
```tsx
// Primary action (Join Event)
<button className="w-full px-6 py-4 bg-waldorf-sage text-white font-bold rounded-xl hover:bg-opacity-90 transition-all shadow-lg">
  加入活動
</button>

// Secondary action (View Details)
<button className="px-4 py-2 border-2 border-waldorf-sage text-waldorf-sage rounded-lg hover:bg-waldorf-cream transition">
  查看詳情
</button>
```

#### Card Layout
```tsx
<div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
  {/* Cover Image */}
  <div className="h-48 bg-gradient-to-r from-waldorf-sage to-waldorf-peach">
    <img src={coverImage} className="w-full h-full object-cover" />
  </div>

  {/* Content */}
  <div className="p-6">
    <h3 className="text-2xl font-bold text-waldorf-brown">{title}</h3>
    {/* ... */}
  </div>
</div>
```

---

## 🔧 Implementation Steps

### Phase 1: Core User Features (Week 1-2)

1. **Setup Database**
   ```bash
   # Run in Supabase SQL Editor
   # Execute: supabase-events-migration.sql
   ```

2. **Create EventCard Component**
   - Visual design matching Waldorf palette
   - Responsive layout
   - Action buttons with proper states

3. **Create EventListPage**
   - Fetch and display events using `getUpcomingEvents()`
   - Implement tabs, filters, search
   - Loading and empty states

4. **Create EventDetailPage**
   - Full event display with all details
   - Comments section (optional for v1)
   - Registration button

5. **Create EventRegistrationModal**
   - Form with validation
   - Smart attendee suggestions
   - Real-time price calculation
   - Success/error handling

6. **Create MyEventsPage**
   - Display user's registrations using `getMyRegistrations()`
   - Cancel registration functionality
   - Receipt viewing (if payment implemented)

7. **Add Routes to App.tsx**
   ```tsx
   <Route path="/events" element={<ProtectedRoute><EventListPage /></ProtectedRoute>} />
   <Route path="/events/:eventId" element={<ProtectedRoute><EventDetailPage /></ProtectedRoute>} />
   <Route path="/my-events" element={<ProtectedRoute><MyEventsPage /></ProtectedRoute>} />
   ```

8. **Add Navigation Links**
   - Update UserMenu with "Events" link
   - Add to main navigation if exists

### Phase 2: Admin Features (Week 3-4)

9. **Create EventManagementPage**
    - Event CRUD interface
    - List with quick actions
    - Metrics dashboard

10. **Create EventFormModal**
    - Comprehensive form with all fields
    - Validation
    - Image upload (optional, can use URLs first)

11. **Create EventParticipantsPage**
    - Participant list with filters
    - Check-in interface
    - Payment management
    - CSV export

12. **Add Admin Routes**
    ```tsx
    <Route path="/admin/events" element={<ProtectedRoute><EventManagementPage /></ProtectedRoute>} />
    <Route path="/admin/events/:eventId/participants" element={<ProtectedRoute><EventParticipantsPage /></ProtectedRoute>} />
    ```

### Phase 3: Enhancement (Week 5+)

13. **Add Comments System** (Optional)
    - EventComments component
    - Real-time updates
    - Organizer replies

14. **Email Notifications**
    - Registration confirmation
    - Event reminders
    - Cancellation notifications

15. **Payment Gateway Integration**
    - Choose provider (Stripe, TapPay, ECPay in Taiwan)
    - Payment flow
    - Receipt generation

16. **Advanced Features**
    - Event calendar view
    - iCal export
    - Social sharing
    - Waitlist management
    - Recurring events

---

## 📝 Example Component Code Snippets

### EventCard Component Example

```tsx
import { Event, isEventFull, isRegistrationOpen, getEventTypeDisplayName } from '../types';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface EventCardProps {
  event: Event;
  onRegister?: () => void;
  showActions?: boolean;
}

export function EventCard({ event, onRegister, showActions = true }: EventCardProps) {
  const eventFull = isEventFull(event);
  const registrationOpen = isRegistrationOpen(event);
  const spotsLeft = event.maxParticipants
    ? event.maxParticipants - event.currentParticipants
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Cover Image */}
      <div className="h-48 bg-gradient-to-r from-waldorf-sage to-waldorf-peach relative">
        {event.coverImageUrl && (
          <img
            src={event.coverImageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        )}
        {event.isFeatured && (
          <div className="absolute top-4 right-4 bg-waldorf-peach text-white px-3 py-1 rounded-full text-sm font-semibold">
            精選活動
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Event Type Badge */}
        <span className="inline-block px-3 py-1 bg-waldorf-cream text-waldorf-brown rounded-full text-sm font-semibold mb-3">
          {getEventTypeDisplayName(event.eventType)}
        </span>

        {/* Title */}
        <h3 className="text-2xl font-bold text-waldorf-brown mb-2 line-clamp-2">
          {event.title}
        </h3>

        {/* Date & Location */}
        <div className="space-y-2 text-gray-600 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{format(new Date(event.eventDate), 'PPP p', { locale: zhTW })}</span>
          </div>

          {event.location && (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{event.currentParticipants} 人已報名</span>
            {spotsLeft !== null && (
              <span>剩餘 {spotsLeft} 名額</span>
            )}
          </div>
          {event.maxParticipants && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-waldorf-sage h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (event.currentParticipants / event.maxParticipants) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Price */}
        {event.hasFee && (
          <div className="mb-4">
            <span className="text-2xl font-bold text-waldorf-brown">
              ${event.pricePerPerson}
            </span>
            <span className="text-gray-600 ml-1">/ 人</span>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="space-y-2">
            {eventFull ? (
              event.allowWaitlist ? (
                <button className="w-full px-4 py-3 bg-yellow-500 text-white font-semibold rounded-lg">
                  加入候補名單
                </button>
              ) : (
                <button disabled className="w-full px-4 py-3 bg-gray-300 text-gray-600 font-semibold rounded-lg cursor-not-allowed">
                  活動已額滿
                </button>
              )
            ) : registrationOpen ? (
              <button
                onClick={onRegister}
                className="w-full px-4 py-3 bg-waldorf-sage text-white font-semibold rounded-lg hover:bg-opacity-90 transition"
              >
                立即報名
              </button>
            ) : (
              <button disabled className="w-full px-4 py-3 bg-gray-300 text-gray-600 font-semibold rounded-lg cursor-not-allowed">
                報名已截止
              </button>
            )}

            <button className="w-full px-4 py-2 border-2 border-waldorf-sage text-waldorf-sage rounded-lg hover:bg-waldorf-cream transition">
              查看詳情
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### EventListPage Structure

```tsx
import { useState, useEffect } from 'react';
import { getUpcomingEvents, getPastEvents, getMyRegistrations } from '../services/eventsService';
import { Event, EventRegistration } from '../types';
import { EventCard } from '../components/EventCard';
import { useNavigate } from 'react-router-dom';

export function EventListPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'my-events'>('upcoming');
  const [events, setEvents] = useState<Event[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, [activeTab]);

  async function loadEvents() {
    setLoading(true);
    try {
      if (activeTab === 'upcoming') {
        const data = await getUpcomingEvents();
        setEvents(data);
      } else if (activeTab === 'past') {
        const data = await getPastEvents();
        setEvents(data);
      } else {
        const data = await getMyRegistrations();
        setMyRegistrations(data);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-waldorf-cream to-waldorf-sage p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-4xl font-bold text-waldorf-brown mb-8">活動列表</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-300">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'upcoming'
                ? 'text-waldorf-brown border-b-2 border-waldorf-sage'
                : 'text-gray-600 hover:text-waldorf-brown'
            }`}
          >
            即將舉行
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'past'
                ? 'text-waldorf-brown border-b-2 border-waldorf-sage'
                : 'text-gray-600 hover:text-waldorf-brown'
            }`}
          >
            過往活動
          </button>
          <button
            onClick={() => setActiveTab('my-events')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'my-events'
                ? 'text-waldorf-brown border-b-2 border-waldorf-sage'
                : 'text-gray-600 hover:text-waldorf-brown'
            }`}
          >
            我的活動
          </button>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-waldorf-sage"></div>
            <p className="mt-4 text-gray-600">載入中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTab === 'my-events' ? (
              myRegistrations.length > 0 ? (
                myRegistrations.map((reg) => (
                  reg.event && (
                    <EventCard
                      key={reg.id}
                      event={reg.event}
                      onRegister={() => navigate(`/events/${reg.event!.id}`)}
                    />
                  )
                ))
              ) : (
                <div className="col-span-3 text-center py-12">
                  <p className="text-gray-600">您還沒有報名任何活動</p>
                </div>
              )
            ) : events.length > 0 ? (
              events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRegister={() => navigate(`/events/${event.id}`)}
                />
              ))
            ) : (
              <div className="col-span-3 text-center py-12">
                <p className="text-gray-600">目前沒有活動</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 🚀 Quick Start Guide

### 1. Database Setup

```sql
-- In Supabase SQL Editor, run:
-- File: supabase-events-migration.sql
```

### 2. Test the API

```tsx
// In a React component or console:
import { getUpcomingEvents, registerForEvent } from './services/eventsService';

// Fetch events
const events = await getUpcomingEvents();
console.log(events);

// Register for an event
const registration = await registerForEvent({
  eventId: 'event-uuid',
  numAttendees: 2,
  attendeeNames: ['Parent Name', 'Child Name'],
  foodPreferences: { 0: '素食', 1: '葷食' },
  notes: 'Looking forward to it!',
});
console.log(registration);
```

### 3. Add Routes to App.tsx

```tsx
import { EventListPage } from '@/pages/EventListPage';

// In Routes:
<Route path="/events" element={<ProtectedRoute><EventListPage /></ProtectedRoute>} />
```

### 4. Add Navigation Link

Update UserMenu or main navigation:

```tsx
<Link to="/events" className="...">
  活動
</Link>
```

---

## 📊 Key Metrics to Track

### For Parents:
- Events attended
- Total spending on events
- Favorite event types

### For Admins:
- Total events created
- Average attendance rate
- Most popular events
- Revenue from paid events
- No-show rate

---

## 🔒 Security Considerations

1. **RLS Policies**: Already implemented in migration
2. **Payment Security**: Use secure payment gateways (Stripe, TapPay)
3. **Data Privacy**: Limit participant list visibility
4. **Admin Access**: Verify role before showing admin features
5. **Rate Limiting**: Prevent spam registrations

---

## 💡 Future Enhancements

1. **SMS Notifications**: Event reminders via SMS
2. **QR Code Check-in**: Generate QR codes for quick check-in
3. **Feedback System**: Post-event surveys
4. **Photo Gallery**: Upload event photos
5. **Certificates**: Attendance certificates
6. **Recurring Events**: Weekly/monthly events
7. **Event Templates**: Quick event creation from templates
8. **Mobile App**: React Native companion app

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Date-fns**: https://date-fns.org/ (for date formatting)
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Hook Form**: https://react-hook-form.com/ (for forms)

---

**Version**: 1.0
**Created**: 2025-11-16
**Status**: Foundation Complete - Ready for Component Development
**Estimated Development Time**: 4-6 weeks for full implementation
