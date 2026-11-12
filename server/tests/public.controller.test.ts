import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createPublicController } from '../src/controllers/public.controller.js';
import type { PublicCatalogService } from '../src/servicios/public-catalog.service.js';

// Servicio falso: el controlador solo debe llamarlo y envolver las listas.
const service = {
  listSpecies: async () => [{ id: 1, name: 'Buitre leonado', scientificName: null }],
  listPlans: async () => [],
} as unknown as PublicCatalogService;

describe('public.controller', () => {
  it('envuelve las listas sin paginar en { data }', async () => {
    const c = createPublicController(service);
    const app = express().get('/species', c.listSpecies).get('/plans', c.listPlans);
    expect((await request(app).get('/species')).body).toEqual({
      data: [{ id: 1, name: 'Buitre leonado', scientificName: null }],
    });
    expect((await request(app).get('/plans')).body).toEqual({ data: [] });
  });
});
