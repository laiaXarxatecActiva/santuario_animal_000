import type { RequestHandler } from 'express';
import type { JobRunner } from '../jobs/registry.js';

// POST /api/admin/jobs/:jobName/run (TECH_SPEC §10.6): lanza una tarea a mano.
export function createJobController(runner: JobRunner): { run: RequestHandler } {
  return {
    run: async (req, res) => {
      const job = String(req.params.jobName);
      res.json({ job, result: await runner.run(job) });
    },
  };
}
