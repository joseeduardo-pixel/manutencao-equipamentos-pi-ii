import * as relatorioService from '../services/relatorioService.js';
import { resfc } from '../utils/resfc.js';

const obterFiltros = (query = {}) => {
  const camposPermitidos = [
    'fornecedor_id',
    'categoria_id',
    'marca_id',
    'predio_id',
    'data_inicio',
    'data_fim',
    'forma_aquisicao',
    'tipo_manutencao',
    'finalizado',
    'situacao',
  ];

  const filtros = {};

  for (const campo of camposPermitidos) {
    const valor = query[campo];

    if (valor !== undefined && valor !== '') {
      filtros[campo] = valor;
    }
  }

  return filtros;
};

const validarFiltros = (filtros) => {
  for (const campo of [
    'fornecedor_id',
    'categoria_id',
    'marca_id',
    'predio_id',
  ]) {
    if (
      filtros[campo] !== undefined &&
      (!/^[1-9]\d*$/.test(String(filtros[campo])) ||
        !Number.isSafeInteger(Number(filtros[campo])))
    ) {
      const erro = new Error(`O filtro ${campo} deve ser um número inteiro positivo.`);
      erro.statusCode = 400;
      throw erro;
    }
  }

  for (const campo of ['data_inicio', 'data_fim']) {
    if (filtros[campo] !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(filtros[campo]))) {
        const erro = new Error(`O filtro ${campo} deve estar no formato AAAA-MM-DD.`);
        erro.statusCode = 400;
        throw erro;
      }

      const data = new Date(`${filtros[campo]}T00:00:00.000Z`);

      if (
        Number.isNaN(data.getTime()) ||
        data.toISOString().slice(0, 10) !== filtros[campo]
      ) {
        const erro = new Error(`A data informada em ${campo} é inválida.`);
        erro.statusCode = 400;
        throw erro;
      }
    }
  }

  if (
    filtros.data_inicio &&
    filtros.data_fim &&
    filtros.data_inicio > filtros.data_fim
  ) {
    const erro = new Error('A data inicial não pode ser posterior à data final.');
    erro.statusCode = 400;
    throw erro;
  }

  if (
    filtros.finalizado !== undefined &&
    !['true', 'false'].includes(String(filtros.finalizado))
  ) {
    const erro = new Error('O filtro finalizado deve ser true ou false.');
    erro.statusCode = 400;
    throw erro;
  }

  return filtros;
};

export const equipamentos = async (request, reply) => {
  const filtros = validarFiltros(obterFiltros(request.query));

  const data = await relatorioService.relatorioEquipamentos(filtros);

  return resfc({
    reply,
    code: 200,
    data,
    message: 'Relatório de equipamentos gerado com sucesso.',
  });
};

export const manutencoes = async (request, reply) => {
  const filtros = validarFiltros(obterFiltros(request.query));

  const data = await relatorioService.relatorioManutencoes(filtros);

  return resfc({
    reply,
    code: 200,
    data,
    message: 'Relatório de manutenções gerado com sucesso.',
  });
};

export const servicos = async (request, reply) => {
  const filtros = validarFiltros(obterFiltros(request.query));

  const data = await relatorioService.relatorioServicos(filtros);

  return resfc({
    reply,
    code: 200,
    data,
    message: 'Relatório de serviços realizados gerado com sucesso.',
  });
};

export const fornecedores = async (request, reply) => {
  const filtros = validarFiltros(obterFiltros(request.query));

  const data = await relatorioService.relatorioPorFornecedor(filtros);

  return resfc({
    reply,
    code: 200,
    data,
    message: 'Relatório consolidado por fornecedor gerado com sucesso.',
  });
};
