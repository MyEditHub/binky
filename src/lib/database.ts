import Database from '@tauri-apps/plugin-sql';
import { BaseDirectory, copyFile, exists, mkdir, readDir, remove } from '@tauri-apps/plugin-fs';

/**
 * Load the database with automatic backup before migrations run.
 * Creates a timestamped backup copy in backups/ directory.
 * If backup fails, logs warning but continues (non-fatal).
 */
export async function loadDatabaseWithBackup(): Promise<Database> {
  const dbPath = 'binky.db';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = 'backups';
  const backupPath = `${backupDir}/binky-${timestamp}.db`;

  try {
    const dbExists = await exists(dbPath, { baseDir: BaseDirectory.AppData });

    if (dbExists) {
      // Ensure backup directory exists
      const backupDirExists = await exists(backupDir, { baseDir: BaseDirectory.AppData });
      if (!backupDirExists) {
        await mkdir(backupDir, { baseDir: BaseDirectory.AppData, recursive: true });
      }

      // Create backup before loading (migrations run on load)
      await copyFile(dbPath, backupPath, {
        fromPathBaseDir: BaseDirectory.AppData,
        toPathBaseDir: BaseDirectory.AppData
      });
      console.log(`Database backed up to ${backupPath}`);

      // Clean old backups (keep last 5)
      await cleanOldBackups();
    }
  } catch (err) {
    console.warn('Database backup failed (non-fatal):', err);
    // Continue even if backup fails - don't block app startup
  }

  return await Database.load('sqlite:binky.db');
}

/**
 * Clean old backups - keep only last 5.
 * Silently logs errors if cleanup fails.
 */
export async function cleanOldBackups(): Promise<void> {
  try {
    const backupDir = 'backups';
    const backupDirExists = await exists(backupDir, { baseDir: BaseDirectory.AppData });

    if (!backupDirExists) {
      return;
    }

    // List all files in backups directory
    const entries = await readDir(backupDir, { baseDir: BaseDirectory.AppData });

    // Filter for .db files and sort by name (timestamp-based names sort chronologically)
    const backupFiles = entries
      .filter(entry => entry.name.endsWith('.db'))
      .sort((a, b) => b.name.localeCompare(a.name)); // Newest first

    // Keep only last 5, remove the rest
    const filesToRemove = backupFiles.slice(5);

    for (const file of filesToRemove) {
      const filePath = `${backupDir}/${file.name}`;
      await remove(filePath, { baseDir: BaseDirectory.AppData });
      console.log(`Removed old backup: ${filePath}`);
    }
  } catch (err) {
    console.warn('Failed to clean old backups (non-fatal):', err);
  }
}
