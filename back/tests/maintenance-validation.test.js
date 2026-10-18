import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import {
  createManutencaoSchema,
  createItemManutencaoSchema,
} from '../src/models/maintenanceSchema.js';

function criarAplicacao() {
  const app = Fastify({ logger: false });

  app.post(
    '/manutencoes',
    { schema: { body: createManutencaoSchema } },
    async () => ({ validado: true })
  );

  app.post(
    '/itens',
    { schema: { body: createItemManutencaoSchema } },
    async () => ({ validado: true })
  );

  return app;
}

const manutencaoValida = {
  data: '2026-10-17',
  nota_fiscal: 'NF-TESTE-001',
  solicitacao: 100,
  fornecedor_id: 1,
};

const itemValido = {
  descricao: 'Substituicao de componente',
  quantidade: 1,
  valor_unitario: 150,
  equipamento_id: 1,
};

const cenarios = [
  {
    descricao: 'aceita manutencao valida',
    rota: '/manutencoes',
    payload: manutencaoValida,
    esperado: 200,
  },
  {
    descricao: 'rejeita data ausente',
    rota: '/manutencoes',
    payload: { ...manutencaoValida, data: undefined },
    esperado: 400,
  },
  {
    descricao: 'rejeita data invalida',
    rota: '/manutencoes',
    payload: { ...manutencaoValida, data: '2026-99-99' },
    esperado: 400,
  },
  {
    descricao: 'rejeita nota fiscal vazia',
    rota: '/manutencoes',
    payload: { ...manutencaoValida, nota_fiscal: '' },
    esperado: 400,
  },
  {
    descricao: 'rejeita solicitacao negativa',
    rota: '/manutencoes',
    payload: { ...manutencaoValida, solicitacao: -1 },
    esperado: 400,
  },
  {
    descricao: 'rejeita fornecedor invalido',
    rota: '/manutencoes',
    payload: { ...manutencaoValida, fornecedor_id: 0 },
    esperado: 400,
  },
  {
    descricao: 'aceita item de manutencao valido',
    rota: '/itens',
    payload: itemValido,
    esperado: 200,
  },
  {
    descricao: 'rejeita descricao curta',
    rota: '/itens',
    payload: { ...itemValido, descricao: 'A' },
    esperado: 400,
  },
  {
    descricao: 'rejeita quantidade zero',
    rota: '/itens',
    payload: { ...itemValido, quantidade: 0 },
    esperado: 400,
  },
  {
    descricao: 'rejeita valor unitario negativo',
    rota: '/itens',
    payload: { ...itemValido, valor_unitario: -10 },
    esperado: 400,
  },
  {
    descricao: 'rejeita equipamento invalido',
    rota: '/itens',
    payload: { ...itemValido, equipamento_id: 0 },
    esperado: 400,
  },
  {
    descricao: 'rejeita quantidade ausente',
    rota: '/itens',
    payload: { ...itemValido, quantidade: undefined },
    esperado: 400,
  },
];

for (const cenario of cenarios) {
  test(cenario.descricao, async () => {
    const app = criarAplicacao();

    try {
      const response = await app.inject({
        method: 'POST',
        url: cenario.rota,
        payload: cenario.payload,
      });

      assert.equal(
        response.statusCode,
        cenario.esperado,
        response.body
      );
    } finally {
      await app.close();
    }
  });
}
