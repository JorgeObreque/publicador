import { applyMigrations, ensureTestEnvironment, resetDatabase, seedBusiness } from './helpers/test-db';

ensureTestEnvironment();

beforeAll(async () => {
  applyMigrations();
  await resetDatabase();
  await seedBusiness();
});

afterEach(async () => {
  await resetDatabase();
  await seedBusiness();
});
