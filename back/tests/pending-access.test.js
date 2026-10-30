import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL nao configurada');
}

const databaseName = decodeURIComponent(
  new URL(databaseUrl).pathname.slice(1),
);

if (databaseName !== 'mydb_test_pi2' || process.env.NODE_ENV !== 'test') {
  throw new Error('Teste bloqueado: banco ou ambiente nao autorizado');
}

const { default: db } = await import('../src/config/db.js');
const { default: fastify } = await import('../src/app.js');

test('Usuario pendente possui acesso restrito', async () => {
  const identificador = randomUUID();
  let userId;

  try {
    const user = await db.user.create({
      data: {
        name: 'Usuario Teste PI2',
        username: `teste_${identificador}`,
        email: `teste_${identificador}@example.invalid`,
        password: randomUUID(),
        role: 'user',
        status: 'pending',
        isVerified: false,
      },
    });

    userId = user.id;

    const token = jwt.sign(
      { id: userId },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' },
    );

    const rotasBloqueadas = [
      '/api/v1/equipamentos',
      '/api/v1/manutencoes',
      '/api/v1/dashboard/summary',
    ];

    for (const rota of rotasBloqueadas) {
      const resposta = await fastify.inject({
        method: 'GET',
        url: rota,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      assert.equal(
        resposta.statusCode,
        403,
        `Usuario pendente deveria ser bloqueado em ${rota}`,
      );
    }

    const perfil = await fastify.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(perfil.statusCode, 200);

    console.log('Usuario pendente bloqueado corretamente.');
    console.log('Acesso ao perfil permitido.');
  } finally {
    if (userId) {
      await db.user.delete({
        where: { id: userId },
      });
    }

    await fastify.close();
    await db.$disconnect();
  }
});
