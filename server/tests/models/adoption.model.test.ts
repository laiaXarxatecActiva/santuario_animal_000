import { describe, expect, it } from 'vitest';
import { AdoptionAlreadyOpenError, WorkerCannotAdoptError } from '../../src/errors/app-error.js';
import {
  activate,
  create,
  findOpenByUserAndAnimal,
  findOwnedById,
  listByUser,
  listPublicAdopterNames,
} from '../../src/models/adoption.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('RN-16 listPublicAdopterNames', () => {
  it('solo nombra a los adoptantes activos que lo han permitido', async () => {
    expect(await listPublicAdopterNames(db.pool, 8)).toEqual(['Lucía']);
  });

  it('una adopción pausada no cuenta', async () => {
    await db.pool.query("UPDATE adoptions SET status = 'paused' WHERE animal_id = 9 AND status = 'active'");
    expect(await listPublicAdopterNames(db.pool, 9)).toEqual([]);
  });

  it('si el adoptante desactiva la opción, deja de aparecer', async () => {
    await db.pool.query("UPDATE users SET show_public_name = FALSE WHERE email = 'lucia.martinez@correo.test'");
    expect(await listPublicAdopterNames(db.pool, 1)).toEqual([]);
  });
});

describe('adopciones del adoptante (CU-13, CU-14)', () => {
  it('busca la adopción abierta de un usuario y un animal', async () => {
    expect(await findOpenByUserAndAnimal(db.pool, 10, 5)).toMatchObject({ id: 11, status: 'pending' });
    // La adopción 13 de Héctor con Turia está cancelada: no cuenta.
    expect(await findOpenByUserAndAnimal(db.pool, 11, 3)).toBeNull();
  });

  it('una adopción de otra persona no se encuentra (404, no 403)', async () => {
    expect(await findOwnedById(db.pool, 10, 11)).toMatchObject({
      id: 11,
      userId: 10,
      status: 'pending',
      animal: { id: 5, name: 'Brisa' },
      plan: { id: 2, name: 'Usual', monthlyAmount: '5.00' },
      startDate: null,
      nextBillingDate: null,
    });
    expect(await findOwnedById(db.pool, 6, 11)).toBeNull();
  });

  it('lista las adopciones del usuario, opcionalmente de un animal', async () => {
    const todas = await listByUser(db.pool, 6);
    expect(todas.map((a) => a.id).sort((x, y) => x - y)).toEqual([1, 2, 3, 18]);
    expect((await listByUser(db.pool, 6, { animalId: 8 })).map((a) => a.id)).toEqual([2]);
  });

  it('crea una adopción pendiente', async () => {
    const nueva = await create(db.pool, { userId: 13, animalId: 4, planId: 1 });
    expect(nueva).toMatchObject({ userId: 13, status: 'pending', animal: { id: 4, name: 'Olmo' }, plan: { id: 1 } });
    expect(nueva.createdAt).toBeInstanceOf(Date);
  });

  it('RN-05: la base de datos impide una segunda adopción abierta del mismo animal', async () => {
    await expect(create(db.pool, { userId: 13, animalId: 4, planId: 2 })).rejects.toBeInstanceOf(
      AdoptionAlreadyOpenError,
    );
  });

  it('RN-03: la base de datos impide que un trabajador adopte', async () => {
    await expect(create(db.pool, { userId: 3, animalId: 4, planId: 2 })).rejects.toBeInstanceOf(WorkerCannotAdoptError);
  });

  it('activa una adopción y conserva la fecha de inicio si ya la tenía', async () => {
    const nueva = await findOpenByUserAndAnimal(db.pool, 13, 4);
    await activate(db.pool, nueva!.id, { startDate: '2026-11-12', nextBillingDate: '2026-12-12' });
    expect(await findOwnedById(db.pool, 13, nueva!.id)).toMatchObject({
      status: 'active',
      startDate: '2026-11-12',
      nextBillingDate: '2026-12-12',
    });
    // Pausada (Lupe, de Elena): se reactiva sin tocar el inicio.
    const antes = await findOwnedById(db.pool, 8, 7);
    await activate(db.pool, 7, { startDate: '2026-11-12', nextBillingDate: '2027-01-01' });
    expect(await findOwnedById(db.pool, 8, 7)).toMatchObject({ status: 'active', startDate: antes!.startDate });
  });
});
