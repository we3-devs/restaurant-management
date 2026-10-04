import { AppDataSource } from '../data-source';

// READ-ONLY, throwaway introspection helper. Not referenced by anything else.
async function run() {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  try {
    const columns: { column_name: string }[] = await runner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'import_job_rows' ORDER BY ordinal_position`,
    );
    console.log(columns.map((c) => c.column_name).join('\n'));
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
