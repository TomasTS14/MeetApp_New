# Privacy rules

MeetApp's promise is that people can talk about events without being identifiable to strangers. These rules are enforced by the database, not by the app, so a modified client cannot break them. Each rule names the code that enforces it and the test that checks it (`supabase/tests/privacy_and_rsvp_test.sql`).

## Aliases

1. **Everyone gets a random alias per event**, such as "Quiet Otter", created the first time they comment. Organizers get one when they create the event, marked as organizer.
2. **Aliases are never reused across events**, so nobody can link one person's activity across events.
3. **Clients never see who is behind an alias.** `event_aliases` and `comments` have no client access at all. Comments are read through `event_comments()`, which decides the name per viewer.
4. **Friends see real usernames, everyone else sees the alias.** The name is worked out every time comments are read, so unfriending turns old comments back into aliases, and new friends see each other's names on old comments.
5. **The organizer's identity is hidden too.** `events.organizer_id` is not readable; the event page shows the organizer's alias (or username, for friends) with the organizer badge.

## Location

6. **A user's position is never stored.** The app sends it with each Nearby request and the database forgets it.
7. **Exact addresses are for attendees.** `get_event()` returns the address and exact point only to the organizer and people who said yes. Everyone else sees the area label and a point rounded to about 1 km.
8. **Nearby distances are rounded to 0.5 km**, so repeated queries from different spots cannot pinpoint an event.

## Friends, feed and blocking

9. **For you only shows friends**, and only what each friend allows in their settings: their comments (`share_activity_with_friends`) and the events they said yes or interested to (`share_attendance_with_friends`).
10. **Blocking cuts both ways.** A blocked pair cannot see each other's comments, the blocked person cannot open the blocker's events, and any friendship between them ends.
11. **Users only see their own RSVPs.** Event pages show counts, never lists of attendees.

## Reports and moderation

16. **Reports go to MeetApp admins only.** The reported person is never told who reported them, and reporters only see their own reports.
17. **Admins can see who wrote a reported comment.** Acting on abuse behind an alias needs it. `admin_reports()` returns the author only for reported items, only to admins (`private.admins`), and admins are added by hand in the SQL editor.
18. **Banning goes through the `ban-user` edge function**, which looks the author up on the server and bans them in Supabase Auth, so they can no longer sign in.
19. **Rate limits** refuse more than 10 comments a minute (200 a day), 30 friend requests, 20 reports and 10 new events a day, and 10 organizer updates an hour, per person.

## Private events

20. **Private events are seen only by the organizer, invited people and people who already answered.** They never appear in Nearby or For you, and they cannot be shared with the Share button.
21. **Invites go to friends only.** `invite_friends()` skips anyone who is not a friend or is blocked either way. The guest list (`event_invitees()`) is shown only to the organizer.
22. **The invite link carries a secret code** (`events.invite_code`) that only the organizer can read, through `event_invite_code()`. Opening the link while signed in adds the person to the invited people; a wrong code reveals nothing.

## Accounts and data (GDPR, Spain)

12. **Data is hosted in an EU region.**
13. **The verified badge is set by the ID verification provider only.** Users cannot set it, and MeetApp stores only the date of verification, never the ID document.
14. **Deleting an account deletes everything about the person.** Settings > Delete account calls the `delete-account` edge function, which removes their photos from storage and then the auth user; every table cascades from it. Settings > Download my data returns everything about the person as JSON (`export_my_data()`), without other people's data.
15. **Minimum age is 14**, the age of digital consent in Spain. Sign-up asks for it in phase 1.

## Adding new tables

New tables in `public` must start with `revoke all ... from anon, authenticated`, enable row level security, and grant only the columns the app needs. Anything that reveals who did what goes through a security definer function, never a direct grant.
