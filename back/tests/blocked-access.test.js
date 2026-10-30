import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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
const {
  signAccessToken,
  signRefreshToken,
} = await import('../src/utils/controllers/tokenUtils.js');
const { refreshSession } = await import('../src/services/authService.js');

test('Contas bloqueadas nao acessam nem renovam sessao', async () => {
  const usuariosCriados = [];

  try {
    for (const status of ['banned', 'deactivated']) {
      const identificador = randomUUID();

      const user = await db.user.create({
        data: {
          name: 'Usuario Teste Bloqueio PI2',
          username: `bloqueio_${identificador}`,
          email: `bloqueio_${identificador}@example.invalid`,
          password: randomUUID(),
          role: 'user',
          status,
          isVerified: true,
        },
      });

      usuariosCriados.push(user.id);

      const accessToken = signAccessToken(user.id);
      const refreshToken = signRefreshToken(user.id);

      await db.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const resposta = await fastify.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      assert.equal(
        resposta.statusCode,
        403,
        `Acesso deveria ser bloqueado para ${status}`,
      );

      await assert.rejects(
        refreshSession(refreshToken),
        (error) => error.statusCode === 403,
        `Renovacao deveria ser bloqueada para ${status}`,
      );

      console.log(`Conta ${status}: acesso e renovacao bloqueados.`);
    }
  } finally {
    try {
      for (const userId of usuariosCriados) {
        await db.user.delete({ where: { id: userId } });
      }
    } finally {
      await fastify.close();
      await db.$disconnect();
    }
  }
});
