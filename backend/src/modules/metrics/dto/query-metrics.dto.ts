import { IsDateString, IsOptional, IsString } from 'class-validator';

/** Flexible metric query for GET /metrics/query. */
export class QueryMetricsDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  metric?: string;

  /** ISO date. Defaults to 30 days ago. */
  @IsOptional()
  @IsDateString()
  start?: string;

  /** ISO date. Defaults to now. */
  @IsOptional()
  @IsDateString()
  end?: string;
}
