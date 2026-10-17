import { expect, test } from '@playwright/test';
import { enterCode, finishProfile, PHOTO, signIn, sleep, sql, stamp, tab } from './helpers';

test('private events are seen only by invited people, and invite links survive sign-up', async ({ browser }) => {
  const s = stamp();
  const ana = 'ana_' + s;
  const title = `Birthday ${s}`;
  const organizer = await signIn(browser, `ana${s}@example.com`, ana);
  sql(`insert into public.friendships (requester_id, addressee_id, status)
       select a.id, l.id, 'accepted' from public.profiles a, public.profiles l
       where a.username = '${ana}' and l.username = 'lucia'`);

  await test.step('organizer creates a private event with a photo', async () => {
    await tab(organizer, 'Your events');
    await organizer.getByText('Create event').first().click();
    await organizer.getByLabel('Title', { exact: true }).fill(title);
    await organizer.getByLabel('Address', { exact: true }).fill('Carrer de Cuba 10, Valencia');
    await organizer.getByLabel('Area', { exact: true }).fill('Russafa, Valencia');
    const chooser = organizer.waitForEvent('filechooser');
    await organizer.getByText('Add photo').click();
    await (await chooser).setFiles(PHOTO);
    await sleep(1500);
    await organizer.getByRole('switch', { name: 'Private event' }).click();
    await organizer.getByText('Create event', { exact: true }).last().click();
    await organizer.getByText('You organize this event.').waitFor({ timeout: 30_000 });
  });
  const eventId = organizer.url().match(/event\/([0-9a-f-]{36})/)![1];
  expect(sql(`select visibility from public.events where id = '${eventId}'`)).toBe('private');
  // Photos are shrunk to JPEG before upload.
  expect(sql(`select metadata->>'mimetype' from storage.objects
              where bucket_id = 'event-photos' and name like '${eventId}/%'`)).toBe('image/jpeg');
  await expect(organizer.getByText('Share', { exact: true })).toHaveCount(0);

  await organizer.getByText('Invite people').waitFor();
  await organizer.getByRole('button', { name: 'Invite', exact: true }).first().click();
  await organizer.getByText('No answer yet').waitFor();
  await organizer.getByText('Share invite link').click();
  await organizer.getByText('Invite link copied.').waitFor();
  const link = await organizer.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(new RegExp(`/event/${eventId}\\?invite=`));

  await test.step('an invited friend finds it in Your events and answers', async () => {
    const lucia = await signIn(browser, 'lucia@example.com');
    await tab(lucia, 'Your events');
    await lucia.getByText('Invited', { exact: true }).first().waitFor();
    await lucia.getByText(title).click();
    await lucia.getByText('Going', { exact: true }).locator('visible=true').click();
    await sleep(800);
    await organizer.reload();
    await organizer.getByText('Going', { exact: true }).first().waitFor();
  });

  await test.step('a stranger cannot see it, and a wrong code says so', async () => {
    const dan = await signIn(browser, `dan${s}@example.com`, 'dan_' + s);
    await dan.goto(`/event/${eventId}`);
    await dan.getByText("This event doesn't exist or you can't see it.").waitFor();
    await dan.goto(`/event/${eventId}?invite=nope`);
    await dan.getByText("This invite link doesn't work anymore").waitFor();
  });

  await test.step('someone signed out opens the link, signs up and lands on the event', async () => {
    const carl = await (await browser.newContext()).newPage();
    await carl.goto(link);
    await carl.getByText('Sign in or create an account to see the event').waitFor();
    await enterCode(carl, `carl${s}@example.com`);
    await finishProfile(carl, 'carl_' + s);
    await expect(carl).toHaveURL(new RegExp(`/event/${eventId}`), { timeout: 30_000 });
    await carl.getByText(title).locator('visible=true').first().waitFor();
    await carl.getByText('Interested', { exact: true }).locator('visible=true').click();
    await sleep(800);
  });

  expect(sql(`select string_agg(p.username || ':' || coalesce(r.status::text, 'none'), ', ' order by p.username)
              from public.event_invites i join public.profiles p on p.id = i.user_id
              left join public.rsvps r on r.event_id = i.event_id and r.user_id = i.user_id
              where i.event_id = '${eventId}'`)).toBe(`carl_${s}:interested, lucia:yes`);
});
