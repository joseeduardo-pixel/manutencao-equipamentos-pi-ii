import test from 'node:test';
import assert from 'node:assert/strict';

import fastify from '../src/app.js';

test('Rotas protegidas devem rejeitar acesso sem autenticacao', async (t) => {
  const rotas = [
    '/api/v1/equipamentos',
    '/api/v1/manutencoes',
    '/api/v1/dashboard/summary',
  ];

  for (const rota of rotas) {
    await t.test(`GET ${rota} retorna HTTP 401`, async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: rota,
      });

      assert.equal(
        response.statusCode,
        401,
        `A rota ${rota} deveria exigir autenticacao`
      );
    });
  }
});

test('Rotas protegidas devem rejeitar token invalido', async (t) => {
  const rotas = [
    '/api/v1/equipamentos',
    '/api/v1/manutencoes',
    '/api/v1/dashboard/summary',
  ];

  for (const rota of rotas) {
    await t.test(`GET ${rota} rejeita token invalido`, async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: rota,
        headers: {
          authorization: 'Bearer token-invalido-para-teste',
        },
      });

      assert.equal(
        response.statusCode,
        401,
        `A rota ${rota} deveria rejeitar um token invalido`
      );
    });
  }
});
test('Rotas protegidas devem rejeitar token expirado', async (t) => {
  const { default: jwt } = await import('jsonwebtoken');

  const tokenExpirado = jwt.sign(
    { id: 999999999 },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: -10 }
  );

  const rotas = [
    '/api/v1/equipamentos',
    '/api/v1/manutencoes',
    '/api/v1/dashboard/summary',
  ];

  for (const rota of rotas) {
    await t.test(`GET ${rota} rejeita token expirado`, async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: rota,
        headers: {
          authorization: `Bearer ${tokenExpirado}`,
        },
      });

      assert.equal(response.statusCode, 401);
      assert.match(response.body, /expirou/i);
    });
  }
});

test.after(async () => {
  await fastify.close();
});
