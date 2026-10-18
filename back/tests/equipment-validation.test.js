import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import {
  createEquipamentoSchema,
  idParamSchema,
  queryEquipamentoSchema,
} from '../src/models/maintenanceSchema.js';

function criarAplicacao() {
  const app = Fastify({ logger: false });

  app.post(
    '/equipamentos',
    { schema: { body: createEquipamentoSchema } },
    async () => ({ validado: true })
  );

  app.get(
    '/equipamentos/:id',
    { schema: { params: idParamSchema } },
    async () => ({ validado: true })
  );

  app.get(
    '/equipamentos',
    { schema: { querystring: queryEquipamentoSchema } },
    async () => ({ validado: true })
  );

  return app;
}

const equipamentoValido = {
  patrimonio: 'TESTE-001',
  capacidade: 9000,
  unidade_medida: 'BTUs',
  valor_bem: 2500,
  categoria_id: 1,
  marca_id: 1,
  local_id: 1,
};

const cenarios = [
  {
    descricao: 'aceita equipamento com dados validos',
    payload: equipamentoValido,
    esperado: 200,
  },
  {
    descricao: 'rejeita patrimonio ausente',
    payload: { ...equipamentoValido, patrimonio: undefined },
    esperado: 400,
  },
  {
    descricao: 'rejeita patrimonio vazio',
    payload: { ...equipamentoValido, patrimonio: '' },
    esperado: 400,
  },
  {
    descricao: 'rejeita capacidade negativa',
    payload: { ...equipamentoValido, capacidade: -1 },
    esperado: 400,
  },
  {
    descricao: 'rejeita valor do bem negativo',
    payload: { ...equipamentoValido, valor_bem: -10 },
    esperado: 400,
  },
  {
    descricao: 'rejeita categoria com ID zero',
    payload: { ...equipamentoValido, categoria_id: 0 },
    esperado: 400,
  },
  {
    descricao: 'rejeita marca com ID negativo',
    payload: { ...equipamentoValido, marca_id: -1 },
    esperado: 400,
  },
  {
    descricao: 'rejeita local ausente',
    payload: { ...equipamentoValido, local_id: undefined },
    esperado: 400,
  },
];

for (const cenario of cenarios) {
  test(cenario.descricao, async () => {
    const app = criarAplicacao();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/equipamentos',
        payload: cenario.payload,
      });

      assert.equal(response.statusCode, cenario.esperado);
    } finally {
      await app.close();
    }
  });
}

const consultas = [
  {
    descricao: 'aceita pagina e limite validos',
    url: '/equipamentos?page=1&limit=10',
    esperado: 200,
  },
  {
    descricao: 'rejeita pagina zero',
    url: '/equipamentos?page=0',
    esperado: 400,
  },
  {
    descricao: 'rejeita limite superior a 100',
    url: '/equipamentos?limit=101',
    esperado: 400,
  },
  {
    descricao: 'rejeita ordenacao invalida',
    url: '/equipamentos?sortOrder=invalido',
    esperado: 400,
  },
  {
    descricao: 'rejeita identificador zero',
    url: '/equipamentos/0',
    esperado: 400,
  },
  {
    descricao: 'aceita identificador positivo',
    url: '/equipamentos/1',
    esperado: 200,
  },
];

for (const consulta of consultas) {
  test(consulta.descricao, async () => {
    const app = criarAplicacao();

    try {
      const response = await app.inject({
        method: 'GET',
        url: consulta.url,
      });

      assert.equal(response.statusCode, consulta.esperado);
    } finally {
      await app.close();
    }
  });
}
