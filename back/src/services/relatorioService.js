import db from '../config/db.js';

const criarFiltroData = (dataInicio, dataFim) => {
  if (!dataInicio && !dataFim) return undefined;

  const data = {};

  if (dataInicio) {
    data.gte = new Date(`${dataInicio}T00:00:00.000Z`);
  }

  if (dataFim) {
    data.lte = new Date(`${dataFim}T23:59:59.999Z`);
  }

  return data;
};

const criarFiltroManutencao = (filtros = {}) => {
  const {
    fornecedor_id,
    data_inicio,
    data_fim,
    forma_aquisicao,
    tipo_manutencao,
    finalizado,
  } = filtros;

  const where = {};
  const data = criarFiltroData(data_inicio, data_fim);

  if (fornecedor_id) {
    where.fornecedor_id = Number(fornecedor_id);
  }

  if (data) {
    where.data = data;
  }

  if (forma_aquisicao) {
    where.forma_aquisicao = forma_aquisicao;
  }

  if (tipo_manutencao) {
    where.tipo_manutencao = tipo_manutencao;
  }

  if (finalizado === 'true' || finalizado === true) {
    where.finalizado = true;
  } else if (finalizado === 'false' || finalizado === false) {
    where.finalizado = false;
  }

  return where;
};

const criarFiltroEquipamento = (filtros = {}) => {
  const {
    categoria_id,
    marca_id,
    predio_id,
    situacao,
    fornecedor_id,
    data_inicio,
    data_fim,
    forma_aquisicao,
    tipo_manutencao,
    finalizado,
  } = filtros;

  const where = {};

  if (categoria_id) {
    where.categoria_id = Number(categoria_id);
  }

  if (marca_id) {
    where.marca_id = Number(marca_id);
  }

  if (predio_id) {
    where.local = {
      predio_id: Number(predio_id),
    };
  }

  if (situacao) {
    where.situacao = situacao;
  }

  const filtroManutencao = criarFiltroManutencao({
    fornecedor_id,
    data_inicio,
    data_fim,
    forma_aquisicao,
    tipo_manutencao,
    finalizado,
  });

  if (Object.keys(filtroManutencao).length > 0) {
    where.itens = {
      some: {
        manutencao: filtroManutencao,
      },
    };
  }

  return where;
};

const calcularValorItem = (item) => {
  const quantidade = Number(item.quantidade) || 0;
  const valorUnitario = Number(item.valor_unitario) || 0;

  return quantidade * valorUnitario;
};

const arredondarMoeda = (valor) => {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
};

/**
 * Relatório de equipamentos agrupados por categoria.
 * O código interno do equipamento não é retornado.
 */
export const relatorioEquipamentos = async (filtros = {}) => {
  const equipamentos = await db.equipamento.findMany({
    where: criarFiltroEquipamento(filtros),

    orderBy: [
      { categoria: { nome_categoria: 'asc' } },
      { patrimonio: 'asc' },
    ],

    select: {
      patrimonio: true,
      capacidade: true,
      unidade_medida: true,
      situacao: true,
      tipo: true,
      modelo: true,

      categoria: {
        select: {
          id: true,
          nome_categoria: true,
        },
      },

      marca: {
        select: {
          marca: true,
        },
      },

      local: {
        select: {
          nome_local: true,
          predio: {
            select: {
              nome_predio: true,
            },
          },
        },
      },
    },
  });

  const grupos = new Map();

  for (const equipamento of equipamentos) {
    const categoriaId = equipamento.categoria.id;

    if (!grupos.has(categoriaId)) {
      grupos.set(categoriaId, {
        categoria_id: categoriaId,
        categoria: equipamento.categoria.nome_categoria,
        quantidade: 0,
        equipamentos: [],
      });
    }

    const grupo = grupos.get(categoriaId);

    grupo.quantidade += 1;

    grupo.equipamentos.push({
      patrimonio: equipamento.patrimonio,
      tipo: equipamento.tipo,
      modelo: equipamento.modelo,
      marca: equipamento.marca?.marca ?? '',
      capacidade: Number(equipamento.capacidade),
      unidade_medida: equipamento.unidade_medida,
      situacao: equipamento.situacao,
      predio: equipamento.local?.predio?.nome_predio ?? '',
      local: equipamento.local?.nome_local ?? '',
    });
  }

  return {
    filtros,
    totalEquipamentos: equipamentos.length,
    totalCategorias: grupos.size,
    grupos: Array.from(grupos.values()),
  };
};

/**
 * Relatório detalhado de manutenções por fornecedor.
 */

export const relatorioManutencoes = async (filtros = {}) => {
  const whereManutencao = criarFiltroManutencao(filtros);

  const whereEquipamento = {};

  if (filtros.categoria_id) {
    whereEquipamento.categoria_id = Number(filtros.categoria_id);
  }

  if (filtros.predio_id) {
    whereEquipamento.local = {
      predio_id: Number(filtros.predio_id),
    };
  }

  if (Object.keys(whereEquipamento).length > 0) {
    whereManutencao.itens = {
      some: {
        equipamento: whereEquipamento,
      },
    };
  }

  const manutencoes = await db.manutencao.findMany({
    where: whereManutencao,

    orderBy: [
      { fornecedor: { razao_social: 'asc' } },
      { data: 'asc' },
      { solicitacao: 'asc' },
    ],

    select: {
      id: true,
      data: true,
      nota_fiscal: true,
      solicitacao: true,
      forma_aquisicao: true,
      tipo_manutencao: true,
      finalizado: true,
      observacoes: true,

      fornecedor: {
        select: {
          id: true,
          razao_social: true,
          cnpj: true,
        },
      },

      itens: {
        ...(Object.keys(whereEquipamento).length > 0
          ? {
              where: {
                equipamento: whereEquipamento,
              },
            }
          : {}),

        select: {
          descricao: true,
          quantidade: true,
          valor_unitario: true,

          equipamento: {
            select: {
              patrimonio: true,
              tipo: true,
              modelo: true,

              categoria: {
                select: {
                  nome_categoria: true,
                },
              },

              marca: {
                select: {
                  marca: true,
                },
              },

              local: {
                select: {
                  nome_local: true,
                  predio: {
                    select: {
                      nome_predio: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const resultado = manutencoes.map((manutencao) => {
    const itens = manutencao.itens.map((item) => ({
      descricao: item.descricao,
      quantidade: Number(item.quantidade),
      valor_unitario: Number(item.valor_unitario),
      valor_total: arredondarMoeda(calcularValorItem(item)),

      equipamento: {
        patrimonio: item.equipamento.patrimonio,
        tipo: item.equipamento.tipo,
        modelo: item.equipamento.modelo,
        marca: item.equipamento.marca?.marca ?? '',
        categoria:
          item.equipamento.categoria?.nome_categoria ?? '',
        predio:
          item.equipamento.local?.predio?.nome_predio ?? '',
        local: item.equipamento.local?.nome_local ?? '',
      },
    }));

    const valorTotal = arredondarMoeda(
      itens.reduce((total, item) => total + item.valor_total, 0),
    );

    return {
      id: manutencao.id,
      data: manutencao.data,
      nota_fiscal: manutencao.nota_fiscal,
      solicitacao: manutencao.solicitacao,
      forma_aquisicao: manutencao.forma_aquisicao,
      tipo_manutencao: manutencao.tipo_manutencao,
      finalizado: manutencao.finalizado,
      observacoes: manutencao.observacoes,
      fornecedor: manutencao.fornecedor,
      quantidadeItens: itens.length,
      itens,
      valorTotal,
    };
  });

  const totalGeral = arredondarMoeda(
    resultado.reduce((total, manutencao) => {
      return total + manutencao.valorTotal;
    }, 0),
  );

  return {
    filtros,
    quantidadeManutencoes: resultado.length,
    totalGeral,
    manutencoes: resultado,
  };
};

/**
 * Relatório de serviços realizados, com uma linha por item de manutenção.
 * Mantém os registros antigos mesmo quando o tipo não foi informado.
 */
export const relatorioServicos = async (filtros = {}) => {
  const relatorio = await relatorioManutencoes(filtros);

  const servicos = relatorio.manutencoes.flatMap((manutencao) =>
    manutencao.itens.map((item) => ({
      manutencao_id: manutencao.id,
      data: manutencao.data,
      solicitacao: manutencao.solicitacao,
      nota_fiscal: manutencao.nota_fiscal,
      forma_aquisicao: manutencao.forma_aquisicao,
      tipo_manutencao:
        manutencao.tipo_manutencao || 'Não informado',
      finalizado: manutencao.finalizado,
      fornecedor:
        manutencao.fornecedor?.razao_social || 'Não informado',
      patrimonio: item.equipamento?.patrimonio || '—',
      equipamento: [
        item.equipamento?.tipo,
        item.equipamento?.modelo,
      ]
        .filter(Boolean)
        .join(' ') || '—',
      categoria: item.equipamento?.categoria || '—',
      predio: item.equipamento?.predio || '—',
      local: item.equipamento?.local || '—',
      descricao: item.descricao || '—',
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
    })),
  );

  return {
    filtros,
    quantidadeServicos: servicos.length,
    quantidadeManutencoes: relatorio.quantidadeManutencoes,
    totalGeral: relatorio.totalGeral,
    servicos,
  };
};

/**
 * Resumo financeiro agrupado por fornecedor.
 */
export const relatorioPorFornecedor = async (filtros = {}) => {
  const relatorio = await relatorioManutencoes(filtros);
  const fornecedores = new Map();

  for (const manutencao of relatorio.manutencoes) {
    const id = manutencao.fornecedor.id;

    if (!fornecedores.has(id)) {
      fornecedores.set(id, {
        fornecedor_id: id,
        fornecedor: manutencao.fornecedor.razao_social,
        cnpj: manutencao.fornecedor.cnpj,
        quantidadeManutencoes: 0,
        total: 0,
      });
    }

    const fornecedor = fornecedores.get(id);

    fornecedor.quantidadeManutencoes += 1;
    fornecedor.total = arredondarMoeda(
      fornecedor.total + manutencao.valorTotal,
    );
  }

  const grupos = Array.from(fornecedores.values()).sort(
    (a, b) => b.total - a.total,
  );

  return {
    filtros,
    quantidadeFornecedores: grupos.length,
    quantidadeManutencoes: relatorio.quantidadeManutencoes,
    totalGeral: relatorio.totalGeral,
    fornecedores: grupos,
  };
};
