import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { Browser, Page } from '@playwright/test';

const MAILPIT = 'http://127.0.0.1:54324';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs SQL as postgres in the local Supabase database and returns the text result. */
export function sql(query: string): string {
  return execFileSync('docker', ['exec', 'supabase_db_meetapp', 'psql', '-U', 'postgres', '-tAc', query])
    .toString()
    .trim();
}

/** A suffix that keeps usernames and emails unique across runs. */
export const stamp = () => String(Date.now()).slice(-7);

async function latestCode(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const code = (msg.Text || msg.HTML).match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await sleep(1000);
  }
  throw new Error('no sign-in code for ' + email);
}

/** Enters the email and the emailed code on the sign-in screen the page is showing. */
export async function enterCode(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByText('Send me a code').click();
  await page.getByText(/We sent a 6-digit code/).waitFor();
  await page.getByLabel('Code').fill(await latestCode(email));
  await page.getByText('Sign in', { exact: true }).click();
}

/** Finishes sign-up for a new account: username and the age check. */
export async function finishProfile(page: Page, username: string) {
  await page.getByLabel('Username').fill(username);
  await page.getByRole('switch').first().click();
  await page.getByText('Continue', { exact: true }).click();
}

/**
 * Signs in a person in their own browser context. Pass a username for a new account;
 * leave it out for a seeded one (lucia, marc).
 */
export async function signIn(browser: Browser, email: string, username?: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await enterCode(page, email);
  if (username) await finishProfile(page, username);
  await page.getByText('For you', { exact: true }).first().waitFor();
  return page;
}

export const tab = (page: Page, name: string) => page.getByText(name, { exact: true }).first().click();

export async function openSeededEvent(page: Page, title = 'Jazz jam session') {
  await tab(page, 'Nearby');
  await page.getByText('List', { exact: true }).click();
  await page.getByText(title).click();
}

export const PHOTO = path.resolve(__dirname, '../../mobile/assets/images/icon.png');
