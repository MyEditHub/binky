import Database from '@tauri-apps/plugin-sql';

/**
 * Read a setting value from the settings table.
 * Returns null if the key does not exist or if the database is unavailable.
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const db = await Database.load('sqlite:binky.db');
    const rows = await db.select<{ value: string }[]>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    if (rows.length === 0) {
      return null;
    }
    return rows[0].value;
  } catch (err) {
    console.warn(`getSetting(${key}) failed (non-fatal):`, err);
    return null;
  }
}

/**
 * Write a setting value into the settings table using INSERT OR REPLACE.
 * Silently logs errors - callers can continue if persistence fails.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  try {
    const db = await Database.load('sqlite:binky.db');
    await db.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  } catch (err) {
    console.warn(`setSetting(${key}) failed (non-fatal):`, err);
  }
}

/**
 * Returns true if this is the first launch (firstLaunchCompleted not set).
 * Defaults to true (show tutorial) if the database is unavailable.
 */
export async function isFirstLaunch(): Promise<boolean> {
  const value = await getSetting('firstLaunchCompleted');
  return value !== 'true';
}

/**
 * Persist the fact that the tutorial has been completed.
 */
export async function markFirstLaunchComplete(): Promise<void> {
  await setSetting('firstLaunchCompleted', 'true');
}
