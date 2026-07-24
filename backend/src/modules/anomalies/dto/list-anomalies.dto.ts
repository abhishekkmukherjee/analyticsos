import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const ANOMALY_STATUSES = ['open', 'acknowledged', 'resolved'] as const;

/** Filters for GET /anomalies. */
export class ListAnomaliesDto {
  @IsOptional()
  @IsIn(ANOMALY_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
