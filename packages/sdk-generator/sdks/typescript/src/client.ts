// Auto-generated ControlPlane SDK Client
// DO NOT EDIT MANUALLY - regenerate from source

import { z } from 'zod';
import { ContractVersionSchema, ContractVersion } from './schemas.js';

export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class ControlPlaneClient {
  private config: ClientConfig;
  private contractVersion: ContractVersion = {
    major: 1,
    minor: 0,
    patch: 0,
  };

  constructor(config: ClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  getContractVersion(): ContractVersion {
    return this.contractVersion;
  }

  /**
   * Validates data against a Zod schema at runtime
   */
  validate<T>(schema: z.ZodType<T>, data: unknown): T {
    return schema.parse(data);
  }

  /**
   * Safely validates data, returning success/failure result
   */
  safeValidate<T>(
    schema: z.ZodType<T>,
    data: unknown
  ): { success: true; data: T } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
          'X-Contract-Version': this.serializeVersion(this.contractVersion),
          ...options?.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private serializeVersion(version: ContractVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }
}
