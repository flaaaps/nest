import { constants as fsConstants } from 'node:fs';
import { access, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDefaultConfig, type NestConfig } from '@nest/shared';
import { validateConfig } from './schema.ts';

export const CONFIG_FILE_NAME = 'config.json';

export type StoreState =
  | { status: 'ok'; config: NestConfig; created: boolean }
  | { status: 'invalid'; message: string };

/**
 * Persists the dashboard configuration as a single JSON file.
 *
 * - On first start a default configuration is written.
 * - A file that cannot be parsed or validated is never overwritten silently:
 *   the store reports `invalid` and the original file is moved aside only when
 *   the user explicitly saves a new configuration.
 * - Writes are atomic (temp file + rename) and the previous version is kept
 *   as `config.json.bak`.
 */
export class ConfigStore {
  readonly dir: string;
  readonly filePath: string;
  private state: StoreState = { status: 'invalid', message: 'configuration not loaded' };
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.dir = path.resolve(dir);
    this.filePath = path.join(this.dir, CONFIG_FILE_NAME);
  }

  getState(): StoreState {
    return this.state;
  }

  async load(): Promise<StoreState> {
    await mkdir(this.dir, { recursive: true });

    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const config = createDefaultConfig();
      await this.writeAtomic(config);
      this.state = { status: 'ok', config, created: true };
      return this.state;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      this.state = {
        status: 'invalid',
        message: `${this.filePath} is not valid JSON: ${(error as Error).message}`,
      };
      return this.state;
    }

    const result = validateConfig(parsed);
    if (!result.ok) {
      this.state = { status: 'invalid', message: `${this.filePath} is invalid: ${result.message}` };
      return this.state;
    }

    this.state = { status: 'ok', config: result.config, created: false };
    return this.state;
  }

  /**
   * Validates and persists a complete configuration. Rejects with an Error
   * carrying `code = 'INVALID_CONFIG'` when validation fails.
   */
  async save(value: unknown): Promise<NestConfig> {
    const result = validateConfig(value);
    if (!result.ok) {
      const error = new Error(result.message) as Error & { code: string };
      error.code = 'INVALID_CONFIG';
      throw error;
    }

    // Serialize writes so concurrent saves cannot interleave.
    const job = this.writeQueue.then(async () => {
      if (this.state.status === 'invalid' && (await exists(this.filePath))) {
        // Preserve the unreadable file instead of overwriting it.
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        await rename(this.filePath, `${this.filePath}.invalid-${stamp}`);
      } else if (await exists(this.filePath)) {
        await copyFile(this.filePath, `${this.filePath}.bak`);
      }
      await this.writeAtomic(result.config);
      this.state = { status: 'ok', config: result.config, created: false };
      return result.config;
    });
    this.writeQueue = job.catch(() => undefined);
    return job;
  }

  private async writeAtomic(config: NestConfig): Promise<void> {
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
    await rename(tmp, this.filePath);
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
