import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const MAX_LOG_PAGE_SIZE = 1000;
export const DEFAULT_LOG_PAGE_SIZE = 100;

/** Filters for GET /logs. */
export class QueryLogsDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIn(['debug', 'info', 'warn', 'error'])
  level?: string;

  /** Substring match against the message. */
  @IsOptional()
  @IsString()
  q?: string;

  /** ISO date. Defaults to 24 hours ago. */
  @IsOptional()
  @IsDateString()
  start?: string;

  /** ISO date. Defaults to now. */
  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOG_PAGE_SIZE)
  limit?: number;
}
