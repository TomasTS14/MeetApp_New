# Screen map

MeetApp has five tabs and one shared event page. The same screens run on iOS, Android and the web. Every piece of text lives in `mobile/locales/en.json` and `mobile/locales/es.json`.

```
Tabs:  Profile · For you (home) · Your events · Nearby · Settings
                      │               │            │
                      └───────────────┴────────────┴──► Event page
                                                         ├─ Photos, details, RSVP buttons
                                                         ├─ Organizer updates thread
                                                         └─ Comments (aliases)
```

| Screen | What it shows | Data it uses | Phase |
| --- | --- | --- | --- |
| Profile | Photo, username, short bio, up to 10 Spotify songs with the embedded player, verified badge. Edit mode for your own profile; other people's profiles add "Add friend" and "Block". | `profiles`, `profile_songs`, `friendships`, `blocks` | 1 (basic), 3 (friends), 4 (songs) |
| For you | Friends' comments and the events they're going to, plus organizer updates from events you said yes or interested to. Newest first. | `for_you_feed()` | 3 |
| Your events | Two lists: events you organize, and events you said yes, interested or are waitlisted for. A "Create event" button. | `my_events()`, insert into `events` | 1 |
| Nearby | A list in phase 1, a swipe deck in phase 2. A distance slider (1 to 200 km), date filter ("Today", "This weekend", "Next 7 days") and category chips; changing any of them reloads. Swipe right for yes, left for no, up for interested, tap to open. Undo for the last swipe. | `nearby_events()`, `set_rsvp()` | 1 (list), 2 (deck) |
| Settings | Language (English or Spanish), text size, theme, privacy switches, blocked people, sign out, delete account. | `user_settings`, `blocks` | 3, 4 |
| Event page | Photo carousel, title, date, area (exact address once you said yes), spots left and waitlist, organizer alias with badges, RSVP buttons, organizer updates, then the comments and questions. Organizers also see Edit, Post update and Cancel event. | `get_event()`, `event_updates`, `event_comments()`, `post_comment()`, `set_rsvp()` | 1 (details and RSVP), 2 (comments, updates) |
| Create or edit event | Title, description, category, date and time, max participants, place search (Mapbox) that fills the address, area label and point, photos. | insert or update `events`, `event_photos` | 1 |
| Sign in and onboarding | Email, Google or Apple sign-in, choose a username, confirm you are 14 or older, allow location, pick interests. | Supabase Auth, `profiles` | 1 |

## Open design questions for the wireframes

- Does the swipe deck show events already answered "interested"? The default is no: they live in Your events.
- How many cards between ad cards (phase 5)? Starting point: one ad every 8 cards.
