import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { AuthContext } from '../../common/auth/auth-context';
import { ConnectorRegistry } from '../connectors/registry';
import type { ConnectorMetric } from '../connectors/base-connector';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1024;
const CONTEXT_RANGE_DAYS = 7;

export interface ChatAnswer {
  answer: string;
  mode: 'live' | 'mock';
  groundedOn: { source: string; metricCount: number };
}

/**
 * Minimal AI chat: pulls the tenant's recent GA4 metrics, hands them to Claude
 * as grounding context, and returns the answer. Runs live when
 * ANTHROPIC_API_KEY is set, otherwise returns a deterministic mock so the
 * endpoint is usable without a key.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  constructor(private readonly registry: ConnectorRegistry) {}

  async ask(user: AuthContext, message: string): Promise<ChatAnswer> {
    const metrics = await this.gatherContext(user.tenantId);
    const context = summarize(metrics);

    if (!this.anthropic) {
      this.logger.warn('Chat running in MOCK mode (no ANTHROPIC_API_KEY).');
      return {
        answer: this.mockAnswer(message, context),
        mode: 'mock',
        groundedOn: { source: 'ga4', metricCount: metrics.length },
      };
    }

    const response = await this.anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system:
        'You are AnalyticsOS, an assistant that answers questions about a ' +
        "customer's web analytics. Use only the metrics provided as context. " +
        'Be concise and cite concrete numbers.',
      messages: [
        {
          role: 'user',
          content: `Context (last ${CONTEXT_RANGE_DAYS} days of GA4 metrics):\n${context}\n\nQuestion: ${message}`,
        },
      ],
    });

    const answer = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return {
      answer,
      mode: 'live',
      groundedOn: { source: 'ga4', metricCount: metrics.length },
    };
  }

  private async gatherContext(tenantId: string): Promise<ConnectorMetric[]> {
    const ga4 = this.registry.get('ga4');
    if (!ga4) return [];
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - CONTEXT_RANGE_DAYS);
    return ga4.collect(tenantId, start, end);
  }

  private mockAnswer(message: string, context: string): string {
    return (
      `(mock) You asked: "${message}". Based on the last ` +
      `${CONTEXT_RANGE_DAYS} days of GA4 data:\n${context}\n` +
      'Add ANTHROPIC_API_KEY to .env for a real, reasoned answer.'
    );
  }
}

/** Roll the raw metrics up into a compact, model-friendly summary. */
function summarize(metrics: ConnectorMetric[]): string {
  if (metrics.length === 0) return 'No metrics available.';
  const totals = new Map<string, number>();
  for (const metric of metrics) {
    totals.set(
      metric.metricName,
      (totals.get(metric.metricName) ?? 0) + metric.value,
    );
  }
  return [...totals.entries()]
    .map(([name, total]) => `- ${name}: ${total.toLocaleString()} (total)`)
    .join('\n');
}
