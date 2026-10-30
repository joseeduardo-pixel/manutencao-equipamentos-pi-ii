import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL nao configurada.');
}

const url = new URL(databaseUrl);
const databaseName = decodeURIComponent(url.pathname.slice(1));

if (
  databaseName !== 'mydb_test_pi2' ||
  process.env.NODE_ENV !== 'test'
) {
  throw new Error('BLOQUEADO: banco ou ambiente nao autorizado.');
}

const { default: db } = await import('../src/config/db.js');
const { default: fastify } = await import('../src/app.js');

test('Fluxo completo de ativacao de conta', async (t) => {
  const identificador = randomUUID();
  let userId;
  let token;
  let codigo;

  try {
    const user = await db.user.create({
      data: {
        name: 'Usuario Teste Ativacao PI2',
        username: `ativacao_${identificador}`,
        email: `ativacao_${identificador}@example.invalid`,
        password: randomUUID(),
        role: 'user',
        status: 'pending',
        isVerified: false,
      },
    });

    userId = user.id;

    token = jwt.sign(
      { id: userId },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const headers = {
      authorization: `Bearer ${token}`,
    };

    await t.test('1 - Solicitar codigo de ativacao', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/me/activation',
        headers,
      });

      assert.equal(response.statusCode, 200);

      const atualizado = await db.user.findUnique({
        where: { id: userId },
      });

      assert.match(atualizado.verifyToken, /^\d{6}$/);
      assert.ok(atualizado.verifyExpires > new Date());

      codigo = atualizado.verifyToken;
    });

    await t.test('2 - Rejeitar codigo incorreto', async () => {
      const codigoIncorreto =
        codigo === '000000' ? '111111' : '000000';

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/me/activation',
        headers,
        payload: { token: codigoIncorreto },
      });

      assert.equal(response.statusCode, 400);
    });

    await t.test('3 - Rejeitar codigo expirado', async () => {
      await db.user.update({
        where: { id: userId },
        data: {
          verifyExpires: new Date(Date.now() - 60000),
        },
      });

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/me/activation',
        headers,
        payload: { token: codigo },
      });

      assert.equal(response.statusCode, 400);

      await db.user.update({
        where: { id: userId },
        data: {
          verifyExpires: new Date(Date.now() + 600000),
        },
      });
    });

    await t.test('4 - Ativar conta com codigo correto', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/me/activation',
        headers,
        payload: { token: codigo },
      });

      assert.equal(response.statusCode, 200);

      const atualizado = await db.user.findUnique({
        where: { id: userId },
      });

      assert.equal(atualizado.status, 'active');
      assert.equal(atualizado.isVerified, true);
      assert.equal(atualizado.verifyToken, null);
      assert.equal(atualizado.verifyExpires, null);
    });

    await t.test('5 - Impedir reutilizacao do codigo', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/me/activation',
        headers,
        payload: { token: codigo },
      });

      assert.equal(response.statusCode, 400);
    });

    await t.test('6 - Liberar acesso apos ativacao', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/equipamentos',
        headers,
      });

      assert.notEqual(response.statusCode, 401);
      assert.notEqual(response.statusCode, 403);
      assert.ok(response.statusCode < 500);
    });
  } finally {
    try {
      if (userId) {
        await db.user.delete({
          where: { id: userId },
        });
      }
    } finally {
      await fastify.close();
      await db.$disconnect();
    }
  }
});
