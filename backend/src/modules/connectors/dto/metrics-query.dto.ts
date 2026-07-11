import { IsOptional, IsDateString } from 'class-validator';

/** Query params for pulling a date range of metrics from a connector. */
export class MetricsQueryDto {
  /** ISO date (YYYY-MM-DD). Defaults to 7 days ago. */
  @IsOptional()
  @IsDateString()
  start?: string;

  /** ISO date (YYYY-MM-DD). Defaults to today. */
  @IsOptional()
  @IsDateString()
  end?: string;
}
