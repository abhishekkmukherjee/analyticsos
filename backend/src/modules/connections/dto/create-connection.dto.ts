import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateConnectionDto {
  /** Connector source key, e.g. 'ga4', 'stripe', 'meta_ads'. */
  @IsString()
  @MinLength(1)
  source!: string;

  /** Human label shown in the UI. Defaults to the source key. */
  @IsOptional()
  @IsString()
  displayName?: string;

  /** Source-specific credentials/settings (stored as JSON). */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
