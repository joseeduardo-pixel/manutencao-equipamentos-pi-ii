import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { restrictTo } from '../src/middlewares/auth.js';

function criarAplicacao(perfil, perfisPermitidos) {
  const app = Fastify({ logger: false });

  app.addHook('preHandler', async (request) => {
    request.user = {
      id: 999999,
      role: perfil,
    };
  });

  app.get('/teste-permissao', {
    preHandler: [restrictTo(...perfisPermitidos)],
  }, async () => {
    return { autorizado: true };
  });

  return app;
}

const cenarios = [
  {
    descricao: 'usuario comum nao pode excluir equipamentos',
    perfil: 'user',
    permitidos: ['admin', 'root'],
    esperado: 403,
  },
  {
    descricao: 'admin pode acessar operacao administrativa',
    perfil: 'admin',
    permitidos: ['admin', 'root'],
    esperado: 200,
  },
  {
    descricao: 'root pode acessar operacao administrativa',
    perfil: 'root',
    permitidos: ['admin', 'root'],
    esperado: 200,
  },
  {
    descricao: 'admin nao pode executar operacao exclusiva do root',
    perfil: 'admin',
    permitidos: ['root'],
    esperado: 403,
  },
  {
    descricao: 'root pode executar operacao exclusiva do root',
    perfil: 'root',
    permitidos: ['root'],
    esperado: 200,
  },
];

for (const cenario of cenarios) {
  test(cenario.descricao, async () => {
    const app = criarAplicacao(
      cenario.perfil,
      cenario.permitidos
    );

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/teste-permissao',
      });

      assert.equal(
        response.statusCode,
        cenario.esperado
      );

      if (cenario.esperado === 200) {
        assert.equal(
          response.json().autorizado,
          true
        );
      }
    } finally {
      await app.close();
    }
  });
}
