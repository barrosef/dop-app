import { Router, type IRouter } from "express";

const router: IRouter = Router();

// A process probe, and nothing else. The platform's health contract is the
// BFF's `/healthz` (dop-api) — this one exists only so the artifact's
// supervisor knows the local process came up.
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
