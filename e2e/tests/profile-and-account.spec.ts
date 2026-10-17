import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { openSeededEvent, PHOTO, signIn, sleep, sql, stamp, tab } from './helpers';

test('songs, sharing, calendar, data export and account deletion', async ({ browser }) => {
  const s = stamp();
  const ana = 'ana_' + s;
  const email = `ana${s}@example.com`;
  const page = await signIn(browser, email, ana);
  const add = async (link: string) => {
    await page.getByLabel('Add a song').fill(link);
    await page.getByText('Add song', { exact: true }).click();
  };

  await test.step('profile photo is shrunk before upload', async () => {
    await tab(page, 'Profile');
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Change photo').click();
    await (await chooser).setFiles(PHOTO);
    await expect.poll(() => sql(`select metadata->>'mimetype' from storage.objects where bucket_id = 'avatars'
      and owner_id = (select id::text from auth.users where email = '${email}')`)).toBe('image/jpeg');
  });

  await test.step('songs: only Spotify tracks, no duplicates', async () => {
    await add('https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT');
    await page.getByText("That isn't a Spotify song link").waitFor();
    await add('https://open.spotify.com/intl-es/track/4cOdK2wGLETKBW3PvgPWqT?si=x');
    await page.getByText('Never Gonna Give You Up').waitFor();
    await add('spotify:track:0VjIjW4GlUZAMYd2vXMi3b');
    await page.getByText('Blinding Lights').waitFor();
    await add('https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b');
    await page.getByText('That song is already on your profile.').waitFor();
    await add('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp');
    await page.getByText('3 of 10').waitFor();
    await page.getByRole('button', { name: 'Remove' }).nth(1).click();
    await page.getByText('2 of 10').waitFor();
    await expect(page.getByText('Blinding Lights')).toHaveCount(0);
  });

  const lucia = await signIn(browser, 'lucia@example.com');
  await test.step('others see the songs but cannot change them', async () => {
    await lucia.goto('/user/' + ana);
    await lucia.getByText('Mr. Brightside').waitFor();
    await expect(lucia.getByText('Add song')).toHaveCount(0);
    await lucia.getByLabel('Play Mr. Brightside').click();
    await lucia.locator('iframe[title="Mr. Brightside"]').waitFor({ state: 'attached' });
  });

  await test.step('share link and calendar file', async () => {
    await openSeededEvent(page);
    await page.getByText('Share', { exact: true }).click();
    await page.getByText('Link copied.').waitFor();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const download = page.waitForEvent('download');
    await page.getByText('Add to calendar', { exact: true }).click();
    const ics = fs.readFileSync(await (await download).path(), 'utf8');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('Jazz jam session');
    await lucia.goto(link);
    await lucia.getByText('Jazz jam session').first().waitFor();
  });

  await test.step('download my data', async () => {
    await page.goBack();
    await tab(page, 'Settings');
    const download = page.waitForEvent('download');
    await page.getByText('Download my data', { exact: true }).click();
    const data = JSON.parse(fs.readFileSync(await (await download).path(), 'utf8'));
    expect(data.profile.username).toBe(ana);
    expect(data.songs).toHaveLength(2);
  });

  await test.step('delete account removes the person', async () => {
    await page.getByText('Delete account', { exact: true }).click();
    await page.getByText('Delete your account for good?').waitFor();
    await page.getByText('Delete for good', { exact: true }).click();
    await page.getByText('Send me a code').waitFor({ timeout: 30_000 });
    await sleep(500);
    expect(sql(`select count(*) from auth.users where email = '${email}'`)).toBe('0');
    expect(sql(`select count(*) from storage.objects where bucket_id = 'avatars' and name like '%'
      and owner_id is not null and owner_id not in (select id::text from auth.users)`)).toBe('0');
  });
});
