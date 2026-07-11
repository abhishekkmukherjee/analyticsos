/**
 * Test-only stand-in for the Prisma-generated client.
 *
 * The real generated client (src/generated/prisma/client.ts) is ESM and uses
 * `import.meta.url`, which ts-jest's CommonJS transform can't parse. Unit tests
 * mock PrismaService anyway, so they never touch the real client — jest maps
 * the generated path to this stub (see the moduleNameMapper in package.json).
 */
export class PrismaClient {
  // Accepts the same constructor options as the real client; does nothing.
  constructor(..._args: unknown[]) {}
}
