import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Sonda de processo, e só isso. O contrato de saúde da plataforma é o
// `/healthz` do BFF (dop-api) — este aqui existe apenas para o supervisor do
// artefato saber que o processo local subiu.
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
