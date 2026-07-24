import { IsIn } from 'class-validator';
import { ANOMALY_STATUSES } from './list-anomalies.dto';

/** Body for PATCH /anomalies/:id — acknowledge or resolve a finding. */
export class UpdateAnomalyDto {
  @IsIn(ANOMALY_STATUSES)
  status!: string;
}
