import { expect, test } from '@playwright/test';
import { openSeededEvent, signIn, sleep, sql, stamp, tab } from './helpers';

test.beforeAll(() => {
  sql(`insert into private.admins (user_id) select id from auth.users where email = 'marc@example.com'
       on conflict do nothing`);
});

test('spam is rate limited, reported, removed and its author banned', async ({ browser }) => {
  const s = stamp();
  const ana = 'ana_' + s;
  const spam = `Cheap watches at spam.example ${s}`;
  const spammer = await signIn(browser, `ana${s}@example.com`, ana);

  await test.step('the 11th comment in a minute is refused', async () => {
    await openSeededEvent(spammer);
    await spammer.getByLabel('Your comment').fill(spam);
    await spammer.getByText('Post comment', { exact: true }).click();
    await spammer.getByText(spam).waitFor();
    for (let i = 0; i < 10; i++) {
      await spammer.getByLabel('Your comment').fill('spam ' + i);
      await spammer.getByText('Post comment', { exact: true }).click();
      await sleep(400);
    }
    await spammer.getByText("You're doing that too often").waitFor();
  });

  const bea = await signIn(browser, `bea${s}@example.com`, 'bea_' + s);
  await test.step('another person reports the comment', async () => {
    await openSeededEvent(bea);
    await bea.getByText(spam).waitFor();
    // Comments are oldest first, so the spam comment is the first one ana posted.
    await bea.getByLabel('Report comment').first().click();
    await bea.getByText('Spam or scam').click();
    await bea.getByLabel('Details (optional)').fill('Selling watches ' + s);
    await bea.getByText('Send report').locator('visible=true').click();
    await bea.getByText('Thanks for reporting').locator('visible=true').waitFor();
    await bea.getByText('Done', { exact: true }).locator('visible=true').click();
    await sleep(1000);
  });

  await test.step('people who are not admins have no report queue', async () => {
    await bea.goBack();
    await tab(bea, 'Settings');
    await bea.getByText('Language').waitFor();
    await expect(bea.getByText('Reports to review')).toHaveCount(0);
  });

  await test.step('an admin removes the comment and bans its author', async () => {
    const marc = await signIn(browser, 'marc@example.com');
    await tab(marc, 'Settings');
    await marc.getByText('Reports to review').click();
    const card = marc.getByText('Selling watches ' + s, { exact: false });
    await card.waitFor();
    await marc.getByText('Remove and ban').first().click();
    await marc.getByText('Tap again to ban @' + ana).click();
    await card.waitFor({ state: 'detached' });
  });

  expect(sql(`select banned_until > now() from auth.users where email = 'ana${s}@example.com'`)).toBe('t');
  expect(sql(`select count(*) from public.comments where body = '${spam}' and deleted_at is not null`)).toBe('1');

  await bea.goto('/');
  await openSeededEvent(bea);
  await bea.getByText('Comment deleted').first().waitFor();
});
