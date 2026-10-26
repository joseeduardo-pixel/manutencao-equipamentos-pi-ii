import db from '../config/db.js';

/**
 * Converte uma data YYYY-MM-DD para Date.
 * inicioDia = true  -> 00:00:00
 * inicioDia = false -> 23:59:59.999
 */
function converterData(valor, inicioDia = true) {
  if (!valor) return undefined;

  const horario = inicioDia
    ? 'T00:00:00.000'
    : 'T23:59:59.999';

  const data = new Date(`${valor}${horario}`);

  return Number.isNaN(data.getTime()) ? undefined : data;
}

/**
 * Converte um valor recebido pela URL para número.
 */
function converterId(valor) {
  if (!valor) return undefined;

  const numero = Number(valor);

  return Number.isNaN(numero) ? undefined : numero;
}

/**
 * Calcula o valor de um item de manutenção.
 */
function calcularValorItem(item) {
  const quantidade = Number(item?.quantidade) || 0;
  const valorUnitario = Number(item?.valor_unitario) || 0;

  return quantidade * valorUnitario;
}

/**
 * Dashboard geral.
 *
 * Filtros esperados:
 * ?dataInicio=2026-01-01
 * &dataFim=2026-12-31
 * &categoria=1
 * &predio=2
 * &tipoManutencao=Corretiva
 */

export const getDashboardSummary = async (filtros = {}) => {
  const {
    ano,
    formaAquisicao,
    dataInicio,
    dataFim,
    categoria,
    predio,
    tipoManutencao,
  } = filtros;

  const inicio = converterData(dataInicio, true);
  const fim = converterData(dataFim, false);

  const categoriaId = converterId(categoria);
  const predioId = converterId(predio);

  /*
   * ---------------------------------------------------------
   * FILTRO DE MANUTENÇÕES
   * ---------------------------------------------------------
   */

  const whereManutencao = {};

  // Filtrar pelo ano da manutenção
  if (ano) {
    const anoNumero = Number(ano);

    if (
      Number.isInteger(anoNumero) &&
      anoNumero >= 1900 &&
      anoNumero <= 9999
    ) {
      whereManutencao.data = {
        gte: new Date(`${anoNumero}-01-01T00:00:00.000Z`),
        lt: new Date(`${anoNumero + 1}-01-01T00:00:00.000Z`),
      };
    }
  }

  // Filtrar pela forma de aquisição
  if (formaAquisicao) {
    whereManutencao.forma_aquisicao = formaAquisicao;
  }

  if (inicio || fim) {
    whereManutencao.data = {
      ...whereManutencao.data,
    };

    if (inicio) {
      const limiteAtual = whereManutencao.data.gte;

      whereManutencao.data.gte =
        limiteAtual && limiteAtual > inicio
          ? limiteAtual
          : inicio;
    }

    if (fim) {
      const limiteAtual = whereManutencao.data.lt;

      if (!limiteAtual || fim < limiteAtual) {
        whereManutencao.data.lte = fim;
        delete whereManutencao.data.lt;
      }
    }
  }

  if (tipoManutencao) {
    whereManutencao.tipo_manutencao = tipoManutencao;
  }

  /*
   * ---------------------------------------------------------
   * FILTRO DE EQUIPAMENTOS
   * ---------------------------------------------------------
   */

  const whereEquipamento = {};

  if (categoriaId) {
    whereEquipamento.categoria_id = categoriaId;
  }

  if (predioId) {
    whereEquipamento.local = {
      predio_id: predioId,
    };
  }

  /*
   * ---------------------------------------------------------
   * FILTRO DE MANUTENÇÕES COM EQUIPAMENTOS RELACIONADOS
   * ---------------------------------------------------------
   */

  const whereManutencaoFiltrada = {
    ...whereManutencao,
  };

  if (categoriaId || predioId) {
    whereManutencaoFiltrada.itens = {
      some: {
        equipamento: whereEquipamento,
      },
    };
  }

  /*
   * ---------------------------------------------------------
   * FILTRO DOS ITENS
   * ---------------------------------------------------------
   *
   * IMPORTANTE:
   * Esta parte pressupõe as relações:
   *
   * ItemManutencao -> manutencao
   * ItemManutencao -> equipamento
   */

  const whereItem = {};

  if (
    ano ||
    formaAquisicao ||
    inicio ||
    fim ||
    tipoManutencao
  ) {
    whereItem.manutencao = whereManutencao;
  }


  if (
    categoriaId ||
    predioId
  ) {
    whereItem.equipamento = whereEquipamento;
  }

  /*
   * ---------------------------------------------------------
   * CONSULTAS PRINCIPAIS
   * ---------------------------------------------------------
   */

  const [
    todosItens,
    manutencoesFiltradas,
    equipamentosFiltrados,
    manutencoesEmAbertoRaw,
    prediosLista,
    categoriasLista,
    fornecedoresTotal,
    prediosTotal,
  ] = await Promise.all([
    /*
     * Itens utilizados para calcular os custos.
     */
    db.itemManutencao.findMany({
      where: whereItem,

      select: {
        id: true,
        quantidade: true,
        valor_unitario: true,
        equipamento_id: true,

        equipamento: {
          select: {
            id: true,
            patrimonio: true,
            situacao: true,

            categoria: {
              select: {
                id: true,
                nome_categoria: true,
              },
            },

            local: {
              select: {
                id: true,

                predio: {
                  select: {
                    id: true,
                    nome_predio: true,
                  },
                },
              },
            },
          },
        },

        manutencao: {
          select: {
            id: true,
            data: true,
            forma_aquisicao: true,
            tipo_manutencao: true,
            finalizado: true,
          },
        },


      },
    }),

    /*
     * Manutenções considerando período e tipo.
     */
    db.manutencao.findMany({
      where: whereManutencaoFiltrada,

      select: {
        id: true,
        data: true,
        nota_fiscal: true,
        solicitacao: true,
        tipo_manutencao: true,
        finalizado: true,
      },
    }),

    /*
     * Equipamentos considerando categoria e prédio.
     */
    db.equipamento.findMany({
      where: whereEquipamento,

      select: {
        id: true,
        patrimonio: true,
        situacao: true,

        categoria: {
          select: {
            id: true,
            nome_categoria: true,
          },
        },

        local: {
          select: {
            id: true,

            predio: {
              select: {
                id: true,
                nome_predio: true,
              },
            },
          },
        },
      },
    }),

    /*
     * Manutenções abertas.
     */
    db.manutencao.findMany({
      where: {
        ...whereManutencaoFiltrada,
        finalizado: false,
      },

      orderBy: {
        data: 'asc',
      },

      take: 5,

      select: {
        id: true,
        data: true,
        nota_fiscal: true,
        solicitacao: true,
        tipo_manutencao: true,
      },
    }),

    /*
     * Lista de prédios para o SELECT do Dashboard.
     */
    db.predio.findMany({
      orderBy: {
        nome_predio: 'asc',
      },

      select: {
        id: true,
        nome_predio: true,
      },
    }),

    /*
     * Lista de categorias para o SELECT.
     */
    db.categoria.findMany({
      orderBy: {
        nome_categoria: 'asc',
      },

      select: {
        id: true,
        nome_categoria: true,
      },
    }),

    db.fornecedor.count(),

    db.predio.count(),
  ]);

  /*
   * ---------------------------------------------------------
   * GASTO TOTAL
   * ---------------------------------------------------------
   */

  const gastoTotal = todosItens.reduce(
    (total, item) => total + calcularValorItem(item),
    0
  );

  /*
   * ---------------------------------------------------------
   * GASTOS POR FORMA DE AQUISICAO - GRAFICOS A E B
   * ---------------------------------------------------------
   */

  const mapaGastosAquisicao = new Map();

  todosItens.forEach((item) => {
    const forma =
      item.manutencao?.forma_aquisicao?.trim() ||
      'Não informado';

    const valor = calcularValorItem(item);

    mapaGastosAquisicao.set(
      forma,
      (mapaGastosAquisicao.get(forma) || 0) + valor
    );
  });

  const gastosPorFormaAquisicao = Array.from(
    mapaGastosAquisicao.entries()
  )
    .map(([nome, valor]) => ({
      nome,
      valor,
    }))
    .sort((a, b) => b.valor - a.valor);

  /*
   * ---------------------------------------------------------
   * QUANTIDADE POR FORMA DE AQUISICAO - GRAFICO F
   * ---------------------------------------------------------
   */

  const mapaQuantidadeAquisicao = new Map();

  todosItens.forEach((item) => {
    const manutencaoId = item.manutencao?.id;

    if (!manutencaoId) {
      return;
    }

    const forma =
      item.manutencao?.forma_aquisicao?.trim() ||
      'Não informado';

    if (!mapaQuantidadeAquisicao.has(forma)) {
      mapaQuantidadeAquisicao.set(forma, new Set());
    }

    mapaQuantidadeAquisicao.get(forma).add(manutencaoId);
  });

  const quantidadePorFormaAquisicao = Array.from(
    mapaQuantidadeAquisicao.entries()
  )
    .map(([nome, ids]) => ({
      nome,
      valor: ids.size,
    }))
    .sort((a, b) => b.valor - a.valor);





  /*
   * ---------------------------------------------------------
   * GASTOS POR PRÉDIO
   * ---------------------------------------------------------
   */

  const mapaPredios = new Map();

  todosItens.forEach((item) => {
    const nomePredio =
      item.equipamento?.local?.predio?.nome_predio ||
      'Não informado';

    const valor = calcularValorItem(item);

    mapaPredios.set(
      nomePredio,
      (mapaPredios.get(nomePredio) || 0) + valor
    );
  });

  const gastosPorPredio = Array.from(
    mapaPredios.entries()
  )
    .map(([nome, valor]) => ({
      nome,
      valor,
    }))
    .filter((item) => item.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  /*
   * ---------------------------------------------------------
   * GASTOS POR CATEGORIA
   * ---------------------------------------------------------
   */

  const mapaCategorias = new Map();

  todosItens.forEach((item) => {
    const nomeCategoria =
      item.equipamento?.categoria?.nome_categoria ||
      'Não informado';

    const valor = calcularValorItem(item);

    mapaCategorias.set(
      nomeCategoria,
      (mapaCategorias.get(nomeCategoria) || 0) + valor
    );
  });

  const gastosPorCategoria = Array.from(
    mapaCategorias.entries()
  )
    .map(([nome, valor]) => ({
      nome,
      valor,
    }))
    .filter((item) => item.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  /*
   * ---------------------------------------------------------
   * EQUIPAMENTOS POR SITUAÇÃO
   * ---------------------------------------------------------
   */

  const mapaSituacoes = new Map();

  equipamentosFiltrados.forEach((equipamento) => {
    const situacao =
      equipamento.situacao || 'Não informado';

    mapaSituacoes.set(
      situacao,
      (mapaSituacoes.get(situacao) || 0) + 1
    );
  });

  const equipamentosPorSituacao = Array.from(
    mapaSituacoes.entries()
  ).map(([nome, valor]) => ({
    nome,
    valor,
  }));

  /*
   * ---------------------------------------------------------
   * MANUTENÇÕES POR TIPO
   * ---------------------------------------------------------
   */

  const mapaTipos = new Map();

  manutencoesFiltradas.forEach((manutencao) => {
    const tipo =
      manutencao.tipo_manutencao ||
      'Não informado';

    mapaTipos.set(
      tipo,
      (mapaTipos.get(tipo) || 0) + 1
    );
  });

  const manutencoesPorTipo = Array.from(
    mapaTipos.entries()
  )
    .map(([nome, valor]) => ({
      nome,
      valor,
    }))
    .sort((a, b) => b.valor - a.valor);

  /*
   * ---------------------------------------------------------
   * EQUIPAMENTOS COM MAIS MANUTENÇÕES
   * ---------------------------------------------------------
   */

  const mapaRecorrentes = new Map();

  todosItens.forEach((item) => {
    const equipamentoId = item.equipamento_id;

    if (!equipamentoId) {
      return;
    }

    if (!mapaRecorrentes.has(equipamentoId)) {
      mapaRecorrentes.set(equipamentoId, {
        equipamentoId,

        patrimonio:
          item.equipamento?.patrimonio || '—',

        categoria:
          item.equipamento?.categoria?.nome_categoria ||
          '—',

        predio:
          item.equipamento?.local?.predio?.nome_predio ||
          '—',

        situacao:
          item.equipamento?.situacao || '—',

        ocorrencias: 0,

        custoAcumulado: 0,
      });
    }

    const registro =
      mapaRecorrentes.get(equipamentoId);

    registro.ocorrencias += 1;

    registro.custoAcumulado +=
      calcularValorItem(item);
  });

  const topRecorrentes = Array.from(
    mapaRecorrentes.values()
  )
    .sort((a, b) => {
      return b.ocorrencias - a.ocorrencias;
    })
    .slice(0, 5);

  /*
   * ---------------------------------------------------------
   * MANUTENÇÕES EM ABERTO
   * ---------------------------------------------------------
   */

  const totalEmAberto =
    manutencoesFiltradas.filter(
      (manutencao) => !manutencao.finalizado
    ).length;

  const manutencoesEmAberto =
    manutencoesEmAbertoRaw.map((m) => ({
      id: m.id,
      data: m.data,
      nota_fiscal: m.nota_fiscal,
      solicitacao: m.solicitacao,
      tipo_manutencao: m.tipo_manutencao,
    }));

  /*
   * ---------------------------------------------------------
   * TIPOS DE MANUTENÇÃO PARA O SELECT
   * ---------------------------------------------------------
   */

  const tiposManutencaoRaw =
    await db.manutencao.findMany({
      distinct: ['tipo_manutencao'],

      select: {
        tipo_manutencao: true,
      },
    });

  const tiposManutencao = tiposManutencaoRaw
    .map((item) => item.tipo_manutencao)
    .filter(Boolean)
    .sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

  // Consultar anos e formas de aquisição cadastrados
  const manutencoesParaFiltros = await db.manutencao.findMany({
    select: {
      data: true,
      forma_aquisicao: true,
    },
  });

  const anos = [
    ...new Set(
      manutencoesParaFiltros
        .filter((m) => m.data)
        .map((m) => m.data.getUTCFullYear())
    ),
  ].sort((a, b) => b - a);

  const formasAquisicao = [
    ...new Set(
      manutencoesParaFiltros
        .map((m) => m.forma_aquisicao?.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));


  /*
   * ---------------------------------------------------------
   * RESPOSTA PARA O FRONTEND
   * ---------------------------------------------------------
   */

  return {
    contadores: {
      equipamentos: equipamentosFiltrados.length,

      manutencoes: manutencoesFiltradas.length,

      fornecedores: fornecedoresTotal,

      predios: prediosTotal,
    },

    gastoTotal,

    gastosPorFormaAquisicao,

    quantidadePorFormaAquisicao,

    gastosPorPredio,

    gastosPorCategoria,

    equipamentosPorSituacao,

    manutencoesPorTipo,

    topRecorrentes,

    totalEmAberto,

    manutencoesEmAberto,

    /*
     * Alimenta os campos SELECT do Dashboard.jsx.
     */
    filtros: {
      anos: anos.map((ano) => ({
        valor: ano,
        ano,
      })),

      formasAquisicao: formasAquisicao.map((forma) => ({
        valor: forma,
        nome: forma,
      })),

      categorias: categoriasLista.map((categoria) => ({
        id: categoria.id,
        nome: categoria.nome_categoria,
      })),

      predios: prediosLista.map((predio) => ({
        id: predio.id,
        nome: predio.nome_predio,
      })),

      tiposManutencao: tiposManutencao.map((tipo) => ({
        valor: tipo,
        nome: tipo,
      })),
    },
  };
};
