
import { parserOcorrencias } from "./parserOcorrencias.js";
import { agruparOcorrencias } from "./agrupadorOcorrencias.js";
import { auditarOcorrencias } from "./auditorOcorrencias.js";

/**
 * SECURITYMASTER INTELLIGENCE
 * Importação e Painel de Auditoria - Versão 4.3
 *
 * Novidades:
 * - Indicadores clicáveis no controle da ronda
 * - Filtros por situação do tempo de resposta
 * - Listas com Ver mais / Ver menos
 * - Abertura automática da lista ao clicar no indicador
 * - Consulta individual do relato original
 *
 * Mantém a auditoria operacional v4.4.
 */

const LIMITE_RONDA_MINUTOS = 20;

const MOTIVOS_COM_CONTROLE_RONDA = new Set([
    "DISPARO ACIDENTAL COM VIATURA - OCORRENCIA",
    "DISPARO ACIDENTAL COM VIATURA - ERRO DE USO",
    "DISPARO EM FALSO COM VIATURA"
]);

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

function criarElemento(tag, classe = "", texto) {
    const elemento = document.createElement(tag);

    if (classe) {
        elemento.className = classe;
    }

    if (texto !== undefined) {
        elemento.textContent = String(texto);
    }

    return elemento;
}

function criarIndicador(nome, quantidade) {
    const cartao = criarElemento(
        "div",
        "indicador-auditoria"
    );

    cartao.append(
        criarElemento("strong", "", quantidade),
        criarElemento("span", "", nome)
    );

    return cartao;
}

function adicionarOpcao(seletor, valor, rotulo) {
    const opcao = document.createElement("option");
    opcao.value = valor;
    opcao.textContent = rotulo;
    seletor.append(opcao);
}

function nomeOperador(auditoria) {
    return String(
        auditoria.operador || "NÃO IDENTIFICADO"
    ).trim() || "NÃO IDENTIFICADO";
}

function contarSituacao(lista, situacao) {
    return lista.filter(
        item => item.status === situacao
    ).length;
}

function categoriaOcorrencia(auditoria) {
    const motivo = normalizarTexto(auditoria.motivo);

    if (motivo.includes("DISPARO")) {
        return "DISPAROS";
    }

    if (
        motivo.includes("FALHA") ||
        motivo.includes("AUTO TESTE")
    ) {
        return "FALHAS";
    }

    if (motivo.includes("ENERGIA")) {
        return "ENERGIA";
    }

    if (
        motivo.startsWith("DESARMADO") ||
        motivo.includes("DESARME")
    ) {
        return "DESARMAMENTOS";
    }

    return "OUTROS";
}

// ========================================
// CONTROLE DE TEMPO DA RONDA
// ========================================

function horarioParaMinutos(horario) {
    if (!horario) {
        return null;
    }

    const partes = horario.match(
        /^(\d{1,2}):(\d{2})$/
    );

    if (!partes) {
        return null;
    }

    const horas = Number(partes[1]);
    const minutos = Number(partes[2]);

    if (
        horas < 0 ||
        horas > 23 ||
        minutos < 0 ||
        minutos > 59
    ) {
        return null;
    }

    return horas * 60 + minutos;
}

function extrairHorario(texto, expressao) {
    const encontrado = texto.match(expressao);

    if (!encontrado) {
        return null;
    }

    const horario = encontrado[1];

    return horarioParaMinutos(horario) === null
        ? null
        : horario;
}

function extrairNomeRondista(texto) {
    const encontrado = texto.match(
        /\bRONDA ACIONAD[OA]\s+AS\s+\d{1,2}:\d{2}\s+SR\.?\s+(.+?)(?=\s+(?:A CAMINHO|EM DESLOCAMENTO|PARA O LOCAL|CHEGADA|SAIDA|RELATORIO|CONTATO|TIPO DE VISTORIA)\b|[.,;\n]|$)/
    );

    if (!encontrado) {
        return "NÃO IDENTIFICADO";
    }

    return encontrado[1].trim() || "NÃO IDENTIFICADO";
}

function analisarTempoRonda(auditoria) {
    const motivo = normalizarTexto(auditoria.motivo);

    if (!MOTIVOS_COM_CONTROLE_RONDA.has(motivo)) {
        return null;
    }

    const relato = normalizarTexto(
        auditoria.relatoOriginal
    );

    const acionamento = extrairHorario(
        relato,
        /\bRONDA ACIONAD[OA]\s+AS\s+(\d{1,2}:\d{2})\b/
    );

    const chegada = extrairHorario(
        relato,
        /\bCHEGADA DO RONDA\s+AS\s+(\d{1,2}:\d{2})\b/
    );

    const dados = {
        auditoria,
        codigoCliente: auditoria.codigoCliente,
        nomeCliente: auditoria.nomeCliente,
        dataHora: auditoria.dataHora,
        operador: nomeOperador(auditoria),
        rondista: extrairNomeRondista(relato),
        motivo: auditoria.motivo,
        acionamento,
        chegada,
        minutos: null,
        excedente: null,
        situacao: "NÃO CALCULÁVEL"
    };

    if (!acionamento || !chegada) {
        return dados;
    }

    const minutosAcionamento =
        horarioParaMinutos(acionamento);

    const minutosChegada =
        horarioParaMinutos(chegada);

    if (
        minutosAcionamento === null ||
        minutosChegada === null
    ) {
        return dados;
    }

    let diferenca =
        minutosChegada - minutosAcionamento;

    // Considera a virada de meia-noite.
    if (diferenca < 0) {
        diferenca += 24 * 60;
    }

    dados.minutos = diferenca;

    if (diferenca > LIMITE_RONDA_MINUTOS) {
        dados.situacao = "PRAZO EXCEDIDO";
        dados.excedente =
            diferenca - LIMITE_RONDA_MINUTOS;
    } else {
        dados.situacao = "DENTRO DO PRAZO";
        dados.excedente = 0;
    }

    return dados;
}

// ========================================
// ESTILOS DO PAINEL
// ========================================

function instalarEstilosAuditoria() {
    if (document.getElementById("estiloPainelAuditoria")) {
        return;
    }

    const estilo = document.createElement("style");
    estilo.id = "estiloPainelAuditoria";

    estilo.textContent = `
        .painel-auditoria {
            font-family: inherit;
            color: #253449;
            min-width: 0;
        }

        .resumo-auditoria {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(170px, 1fr));
            gap: 14px;
            margin: 22px 0;
        }

        .indicador-auditoria {
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 14px;
            padding: 18px;
            box-shadow: 0 3px 12px rgba(0,0,0,.04);
        }

        .indicador-auditoria strong {
            display: block;
            font-size: 28px;
            margin-bottom: 7px;
        }

        .indicador-auditoria span {
            color: #64748b;
            font-size: 13px;
        }

        .barra-filtros-auditoria {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
            gap: 18px;
            margin: 20px 0;
        }

        .grupo-filtro-operador {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .grupo-filtro-operador label {
            font-size: 13px;
            font-weight: 600;
            color: #475569;
        }

        .seletor-operador {
            min-width: 220px;
            max-width: 100%;
            padding: 11px 14px;
            background: #ffffff;
            color: #334155;
            border: 1px solid #dce4ed;
            border-radius: 10px;
            font-size: 13px;
            cursor: pointer;
        }

        .seletor-operador:focus {
            outline: 2px solid #93c5fd;
            outline-offset: 2px;
        }

        .filtros-auditoria {
            display: flex;
            flex-wrap: wrap;
            gap: 9px;
            margin: 20px 0;
        }

        .filtro-auditoria {
            border: 1px solid #dce4ed;
            background: #ffffff;
            border-radius: 22px;
            padding: 10px 16px;
            cursor: pointer;
            font-size: 13px;
            color: #475569;
        }

        .filtro-auditoria:hover {
            background: #eef3f9;
        }

        .filtro-auditoria.ativo {
            background: #2563eb;
            border-color: #2563eb;
            color: #ffffff;
        }

        .resumo-operadores {
            margin: 24px 0;
        }

        .resumo-operadores h3 {
            margin-bottom: 14px;
        }

        .tabela-operadores-container {
            overflow-x: auto;
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 14px;
        }

        .tabela-operadores {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .tabela-operadores th,
        .tabela-operadores td {
            padding: 13px 15px;
            text-align: left;
            border-bottom: 1px solid #edf0f4;
            vertical-align: top;
        }

        .tabela-operadores th {
            background: #f8fafc;
            color: #475569;
            font-weight: 600;
        }

        .tabela-operadores tbody tr:last-child td {
            border-bottom: none;
        }

        .tabela-operadores tbody tr:hover {
            background: #f8fafc;
        }

        .lista-auditorias {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .item-auditoria {
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 14px;
            padding: 18px;
        }

        .cabecalho-atendimento {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            flex-wrap: wrap;
        }

        .cabecalho-atendimento h4 {
            margin: 0 0 8px;
            font-size: 15px;
        }

        .motivo-atendimento {
            color: #64748b;
            font-size: 13px;
            margin: 5px 0;
        }

        .operador-atendimento {
            color: #334155;
            font-size: 13px;
            margin: 8px 0 4px;
            font-weight: 600;
        }

        .situacao-atendimento {
            display: inline-block;
            padding: 7px 11px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .situacao-revisao {
            background: #fff1e8;
            color: #a34d16;
        }

        .situacao-ok {
            background: #e7f7ed;
            color: #187344;
        }

        .situacao-escopo {
            background: #edf0f4;
            color: #64748b;
        }

        .detalhes-atendimento {
            margin-top: 14px;
            border-top: 1px solid #edf0f4;
            padding-top: 14px;
        }

        .detalhes-atendimento summary {
            cursor: pointer;
            color: #2563eb;
            font-weight: 600;
            font-size: 13px;
        }

        .detalhes-atendimento ul {
            padding-left: 20px;
            line-height: 1.7;
        }

        .relato-original {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            background: #f8fafc;
            border: 1px solid #e4eaf1;
            border-radius: 10px;
            padding: 14px;
            font-size: 12px;
            line-height: 1.6;
            max-height: 300px;
            overflow-y: auto;
        }

        .mensagem-vazia {
            padding: 24px;
            background: #f8fafc;
            border-radius: 12px;
            color: #64748b;
            text-align: center;
        }

        .quantidade-filtrada {
            color: #64748b;
            font-size: 13px;
            margin: 12px 0 16px;
        }

        /* CONTROLE DE TEMPO DA RONDA */

        .secao-tempo-ronda {
            margin: 30px 0;
            padding: 24px;
            background: #f8fafc;
            border: 1px solid #dce4ed;
            border-radius: 16px;
        }

        .secao-tempo-ronda h3 {
            margin: 0 0 8px;
            color: #172b4d;
        }

        .descricao-tempo-ronda {
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
        }

        .indicador-ronda-atraso {
            border-left: 5px solid #dc2626;
        }

        .indicador-ronda-ok {
            border-left: 5px solid #16a34a;
        }

        .indicador-ronda-indefinido {
            border-left: 5px solid #d97706;
        }

        .tempo-excedido {
            color: #b91c1c;
            font-weight: 700;
        }

        .tempo-normal {
            color: #15803d;
            font-weight: 700;
        }

        .aviso-ronda {
            margin-top: 14px;
            font-size: 12px;
            color: #64748b;
            line-height: 1.6;
        }

        .detalhes-ronda {
            margin-top: 8px;
        }

        .detalhes-ronda summary {
            cursor: pointer;
            color: #2563eb;
            font-size: 12px;
            font-weight: 600;
        }

        /* INDICADORES CLICÁVEIS */

        .indicador-ronda-clicavel {
            width: 100%;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
            transition:
                transform .15s ease,
                box-shadow .15s ease,
                border-color .15s ease;
        }

        .indicador-ronda-clicavel:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(0,0,0,.09);
        }

        .indicador-ronda-clicavel:focus-visible {
            outline: 3px solid #93c5fd;
            outline-offset: 3px;
        }

        .indicador-ronda-clicavel.selecionado {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37,99,235,.12);
        }

        .indicador-ronda-clicavel small {
            display: block;
            margin-top: 10px;
            color: #2563eb;
            font-size: 11px;
            font-weight: 600;
        }

        /* FILTROS ESPECÍFICOS DA RONDA */

        .filtros-tempo-ronda {
            display: flex;
            flex-wrap: wrap;
            gap: 9px;
            margin: 18px 0;
        }

        .filtro-tempo-ronda {
            border: 1px solid #dce4ed;
            background: #ffffff;
            color: #475569;
            border-radius: 22px;
            padding: 10px 15px;
            cursor: pointer;
            font-family: inherit;
            font-size: 13px;
        }

        .filtro-tempo-ronda:hover {
            background: #eef3f9;
        }

        .filtro-tempo-ronda.ativo {
            background: #2563eb;
            border-color: #2563eb;
            color: #ffffff;
        }

        .filtro-tempo-ronda:focus-visible {
            outline: 3px solid #93c5fd;
            outline-offset: 2px;
        }

        /* LISTA RECOLHÍVEL */

        .grupo-ronda-recolhivel {
            margin: 14px 0;
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 12px;
            overflow: hidden;
        }

        .grupo-ronda-recolhivel > summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 16px;
            cursor: pointer;
            list-style: none;
        }

        .grupo-ronda-recolhivel > summary::-webkit-details-marker {
            display: none;
        }

        .grupo-ronda-recolhivel > summary:hover {
            background: #f8fafc;
        }

        .titulo-grupo-ronda {
            font-size: 14px;
            font-weight: 600;
            color: #172b4d;
        }

        .controle-grupo-ronda {
            color: #2563eb;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
        }

        .conteudo-grupo-ronda {
            padding: 0 16px 16px;
        }

        .conteudo-grupo-ronda ul {
            line-height: 1.7;
        }

        .item-sem-horario {
            padding: 12px 0;
            border-bottom: 1px solid #edf0f4;
        }

        .item-sem-horario:last-child {
            border-bottom: none;
        }

        @media (max-width: 700px) {
            .secao-tempo-ronda {
                padding: 16px;
            }

            .indicador-auditoria {
                padding: 14px;
            }

            .grupo-ronda-recolhivel > summary {
                padding: 13px;
            }
        }
    `;

    document.head.append(estilo);
}

// ========================================
// RELATO ORIGINAL RECOLHÍVEL
// ========================================

function criarDetalhesRelato(relato) {
    const detalhes = criarElemento(
        "details",
        "detalhes-ronda"
    );

    detalhes.append(
        criarElemento(
            "summary",
            "",
            "Ver relato original"
        ),
        criarElemento(
            "pre",
            "relato-original",
            relato || "Sem relato."
        )
    );

    return detalhes;
}

// ========================================
// GRUPO COM VER MAIS / VER MENOS
// ========================================

function criarGrupoRonda(titulo, quantidade) {
    const detalhes = criarElemento(
        "details",
        "grupo-ronda-recolhivel"
    );

    detalhes.open = false;

    const cabecalho = criarElemento("summary");

    const identificacao = criarElemento(
        "span",
        "titulo-grupo-ronda",
        `${titulo} (${quantidade})`
    );

    const controle = criarElemento(
        "span",
        "controle-grupo-ronda",
        "Ver mais ▼"
    );

    cabecalho.append(
        identificacao,
        controle
    );

    const conteudo = criarElemento(
        "div",
        "conteudo-grupo-ronda"
    );

    detalhes.append(
        cabecalho,
        conteudo
    );

    detalhes.addEventListener("toggle", () => {
        controle.textContent = detalhes.open
            ? "Ver menos ▲"
            : "Ver mais ▼";
    });

    return {
        detalhes,
        conteudo
    };
}

// ========================================
// TABELA DOS ATENDIMENTOS DA RONDA
// ========================================

function criarTabelaRonda(atendimentos) {
    const container = criarElemento(
        "div",
        "tabela-operadores-container"
    );

    const tabela = criarElemento(
        "table",
        "tabela-operadores"
    );

    const thead = document.createElement("thead");
    const linhaCabecalho = document.createElement("tr");

    [
        "Cliente / Data",
        "Operador",
        "Rondista",
        "Acionamento",
        "Chegada",
        "Tempo",
        "Excedente"
    ].forEach(titulo => {
        linhaCabecalho.append(
            criarElemento("th", "", titulo)
        );
    });

    thead.append(linhaCabecalho);

    const tbody = document.createElement("tbody");

    atendimentos.forEach(item => {
        const linha = document.createElement("tr");

        const cliente = criarElemento("td");

        cliente.append(
            criarElemento(
                "strong",
                "",
                `${item.codigoCliente} - ${item.nomeCliente}`
            ),
            criarElemento(
                "p",
                "motivo-atendimento",
                item.dataHora || "Data não identificada"
            ),
            criarDetalhesRelato(
                item.auditoria.relatoOriginal
            )
        );

        const classeTempo =
            item.situacao === "PRAZO EXCEDIDO"
                ? "tempo-excedido"
                : "tempo-normal";

        linha.append(
            cliente,
            criarElemento("td", "", item.operador),
            criarElemento("td", "", item.rondista),
            criarElemento("td", "", item.acionamento || "-"),
            criarElemento("td", "", item.chegada || "-"),
            criarElemento(
                "td",
                classeTempo,
                `${item.minutos} min`
            ),
            criarElemento(
                "td",
                classeTempo,
                item.excedente > 0
                    ? `+${item.excedente} min`
                    : "0 min"
            )
        );

        tbody.append(linha);
    });

    tabela.append(thead, tbody);
    container.append(tabela);

    return container;
}

// ========================================
// LISTA SEM HORÁRIOS VÁLIDOS
// ========================================

function criarListaSemHorario(atendimentos) {
    const lista = document.createElement("div");

    atendimentos.forEach(item => {
        const linha = criarElemento(
            "div",
            "item-sem-horario"
        );

        linha.append(
            criarElemento(
                "strong",
                "",
                `${item.codigoCliente} - ${item.nomeCliente}`
            ),
            criarElemento(
                "p",
                "motivo-atendimento",
                `Data: ${item.dataHora || "Não identificada"}`
            ),
            criarElemento(
                "p",
                "motivo-atendimento",
                `Operador: ${item.operador}`
            ),
            criarElemento(
                "p",
                "motivo-atendimento",
                `Rondista: ${item.rondista}`
            ),
            criarElemento(
                "p",
                "motivo-atendimento",
                `Acionamento: ${item.acionamento || "Ausente"}`
            ),
            criarElemento(
                "p",
                "motivo-atendimento",
                `Chegada: ${item.chegada || "Ausente"}`
            ),
            criarDetalhesRelato(
                item.auditoria.relatoOriginal
            )
        );

        lista.append(linha);
    });

    return lista;
}

// ========================================
// PAINEL DE TEMPO DE RESPOSTA DA RONDA
// ========================================

function criarPainelTempoRonda(auditorias) {
    const atendimentosRonda = auditorias
        .map(analisarTempoRonda)
        .filter(item => item !== null);

    const atrasados = atendimentosRonda.filter(
        item => item.situacao === "PRAZO EXCEDIDO"
    );

    const dentroPrazo = atendimentosRonda.filter(
        item => item.situacao === "DENTRO DO PRAZO"
    );

    const naoCalculaveis = atendimentosRonda.filter(
        item => item.situacao === "NÃO CALCULÁVEL"
    );

    const secao = criarElemento(
        "section",
        "secao-tempo-ronda"
    );

    secao.append(
        criarElemento(
            "h3",
            "",
            "Tempo de Resposta da Ronda"
        ),
        criarElemento(
            "p",
            "descricao-tempo-ronda",
            "Controle exclusivo dos disparos com " +
            "atendimento de viatura. Limite: 20 minutos " +
            "entre o acionamento e a chegada."
        )
    );

    // ========================================
    // INDICADORES CLICÁVEIS
    // ========================================

    const resumo = criarElemento(
        "div",
        "resumo-auditoria"
    );

    const indicadores = [
        {
            chave: "TODOS",
            titulo: "Disparos com apoio analisados",
            quantidade: atendimentosRonda.length,
            classe: ""
        },
        {
            chave: "ATRASADOS",
            titulo: "Acima de 20 minutos",
            quantidade: atrasados.length,
            classe: "indicador-ronda-atraso"
        },
        {
            chave: "DENTRO",
            titulo: "Dentro do prazo",
            quantidade: dentroPrazo.length,
            classe: "indicador-ronda-ok"
        },
        {
            chave: "SEM_HORARIO",
            titulo: "Sem horários válidos",
            quantidade: naoCalculaveis.length,
            classe: "indicador-ronda-indefinido"
        }
    ];

    const botoesIndicadores = new Map();

    indicadores.forEach(indicador => {
        const botao = criarElemento(
            "button",
            "indicador-auditoria indicador-ronda-clicavel"
        );

        botao.type = "button";

        if (indicador.classe) {
            botao.classList.add(indicador.classe);
        }

        botao.append(
            criarElemento(
                "strong",
                "",
                indicador.quantidade
            ),
            criarElemento(
                "span",
                "",
                indicador.titulo
            ),
            criarElemento(
                "small",
                "",
                "Clique para visualizar"
            )
        );

        botao.setAttribute(
            "aria-label",
            `Visualizar ${indicador.titulo}: ${indicador.quantidade}`
        );

        botoesIndicadores.set(
            indicador.chave,
            botao
        );

        resumo.append(botao);
    });

    secao.append(resumo);

    // ========================================
    // FILTROS DE SITUAÇÃO
    // ========================================

    const areaFiltros = criarElemento(
        "div",
        "filtros-tempo-ronda"
    );

    const opcoesFiltros = [
        ["TODOS", "Todos"],
        ["ATRASADOS", "Acima de 20 minutos"],
        ["DENTRO", "Dentro do prazo"],
        ["SEM_HORARIO", "Sem horários"]
    ];

    const botoesFiltros = new Map();

    opcoesFiltros.forEach(([chave, titulo]) => {
        const botao = criarElemento(
            "button",
            "filtro-tempo-ronda",
            titulo
        );

        botao.type = "button";

        botoesFiltros.set(chave, botao);
        areaFiltros.append(botao);
    });

    secao.append(areaFiltros);

    // ========================================
    // ÁREA DE RESULTADOS
    // ========================================

    const resultadoFiltro = criarElemento(
        "p",
        "quantidade-filtrada"
    );

    const areaResultados = criarElemento("div");

    secao.append(
        resultadoFiltro,
        areaResultados
    );

    // ========================================
    // FUNÇÃO PARA EXIBIR RESULTADOS
    // ========================================

    let filtroAtual = "TODOS";

    function atualizarSelecaoVisual() {
        botoesIndicadores.forEach((botao, chave) => {
            const selecionado = chave === filtroAtual;

            botao.classList.toggle(
                "selecionado",
                selecionado
            );

            botao.setAttribute(
                "aria-pressed",
                String(selecionado)
            );
        });

        botoesFiltros.forEach((botao, chave) => {
            const selecionado = chave === filtroAtual;

            botao.classList.toggle(
                "ativo",
                selecionado
            );

            botao.setAttribute(
                "aria-pressed",
                String(selecionado)
            );
        });
    }

    function mostrarGrupo(
        titulo,
        atendimentos,
        tipo,
        abrirAutomaticamente
    ) {
        const grupo = criarGrupoRonda(
            titulo,
            atendimentos.length
        );

        if (atendimentos.length === 0) {
            grupo.conteudo.append(
                criarElemento(
                    "p",
                    "mensagem-vazia",
                    "Nenhum atendimento encontrado " +
                    "nesta situação."
                )
            );
        } else if (tipo === "SEM_HORARIO") {
            grupo.conteudo.append(
                criarListaSemHorario(atendimentos)
            );
        } else {
            grupo.conteudo.append(
                criarTabelaRonda(atendimentos)
            );
        }

        grupo.detalhes.open = abrirAutomaticamente;

        areaResultados.append(grupo.detalhes);
    }

    function aplicarFiltro(chave) {
        filtroAtual = chave;

        atualizarSelecaoVisual();

        areaResultados.replaceChildren();

        let quantidade = atendimentosRonda.length;

        if (chave === "ATRASADOS") {
            quantidade = atrasados.length;
        } else if (chave === "DENTRO") {
            quantidade = dentroPrazo.length;
        } else if (chave === "SEM_HORARIO") {
            quantidade = naoCalculaveis.length;
        }

        resultadoFiltro.textContent =
            `${quantidade} atendimento(s) encontrado(s) ` +
            "para a situação selecionada.";

        // Quando o usuário escolhe uma situação,
        // o grupo correspondente abre automaticamente.
        // Na visualização geral, os grupos ficam fechados.

        const abrir = chave !== "TODOS";

        if (
            chave === "TODOS" ||
            chave === "ATRASADOS"
        ) {
            mostrarGrupo(
                "Atendimentos com prazo excedido",
                atrasados,
                "ATRASADOS",
                abrir
            );
        }

        if (
            chave === "TODOS" ||
            chave === "DENTRO"
        ) {
            mostrarGrupo(
                "Atendimentos dentro do prazo",
                dentroPrazo,
                "DENTRO",
                abrir
            );
        }

        if (
            chave === "TODOS" ||
            chave === "SEM_HORARIO"
        ) {
            mostrarGrupo(
                "Atendimentos sem horários suficientes",
                naoCalculaveis,
                "SEM_HORARIO",
                abrir
            );
        }
    }

    // ========================================
    // CLIQUE NOS INDICADORES
    // ========================================

    botoesIndicadores.forEach((botao, chave) => {
        botao.addEventListener("click", () => {
            aplicarFiltro(chave);
        });
    });

    // ========================================
    // CLIQUE NOS FILTROS
    // ========================================

    botoesFiltros.forEach((botao, chave) => {
        botao.addEventListener("click", () => {
            aplicarFiltro(chave);
        });
    });

    // Inicia mostrando todos os grupos recolhidos.
    aplicarFiltro("TODOS");

    // ========================================
    // AVISO DO CONTROLE
    // ========================================

    secao.append(
        criarElemento(
            "p",
            "aviso-ronda",
            "Os tempos são calculados a partir dos " +
            "horários registrados nos relatos. " +
            "O resultado não comprova os horários reais " +
            "de deslocamento. Quando a chegada é anterior " +
            "ao acionamento, o cálculo considera a virada " +
            "da meia-noite; esses casos devem ser conferidos."
        )
    );

    console.log(
        "CONTROLE DE TEMPO DE RESPOSTA DA RONDA"
    );

    console.table({
        atendimentosComApoio: atendimentosRonda.length,
        dentroDoPrazo: dentroPrazo.length,
        prazoExcedido: atrasados.length,
        naoCalculaveis: naoCalculaveis.length
    });

    console.table(
        atrasados.map(item => ({
            cliente: item.codigoCliente,
            operador: item.operador,
            rondista: item.rondista,
            acionamento: item.acionamento,
            chegada: item.chegada,
            minutos: item.minutos,
            excedente: item.excedente
        }))
    );

    return secao;
}

// ========================================
// IMPORTAÇÃO DE OCORRÊNCIAS
// ========================================

export function importarOcorrencias() {
    const input = document.getElementById(
        "arquivoOcorrencias"
    );

    if (!input) {
        console.error(
            "Campo de importação não encontrado."
        );
        return;
    }

    if (!input.files.length) {
        alert(
            "Selecione um relatório HTML de ocorrências."
        );
        return;
    }

    const arquivo = input.files[0];

    if (!/\.html?$/i.test(arquivo.name)) {
        alert("Selecione um arquivo HTML válido.");
        return;
    }

    const leitor = new FileReader();

    leitor.onload = function(evento) {
        try {
            // ========================================
            // PROCESSAMENTO DO RELATÓRIO
            // ========================================

            const registros = parserOcorrencias(
                evento.target.result
            );

            const clientes = agruparOcorrencias(
                registros
            );

            const auditorias = auditarOcorrencias(
                clientes
            );

            const resultado = document.getElementById(
                "resultadoAuditoria"
            );

            if (!resultado) {
                console.error(
                    "Área de resultado da auditoria não encontrada."
                );
                return;
            }

            resultado.replaceChildren();
            instalarEstilosAuditoria();

            // ========================================
            // INDICADORES GERAIS
            // ========================================

            const totalAtendimentos = auditorias.length;

            const totalRevisao = contarSituacao(
                auditorias,
                "REVISÃO NECESSÁRIA"
            );

            const totalOk = contarSituacao(
                auditorias,
                "SEM DIVERGÊNCIA DETECTADA"
            );

            const totalEscopo = contarSituacao(
                auditorias,
                "FORA DO ESCOPO"
            );

            const totalNaoAssociados = clientes.reduce(
                (total, cliente) =>
                    total +
                    (
                        cliente.registrosNaoAssociados ||
                        []
                    ).length,
                0
            );

            const painel = criarElemento(
                "div",
                "painel-auditoria"
            );

            painel.append(
                criarElemento(
                    "h2",
                    "",
                    "Resultado da auditoria"
                ),
                criarElemento(
                    "p",
                    "motivo-atendimento",
                    `${registros.length} eventos extraídos | ` +
                    `${clientes.length} clientes | ` +
                    `${totalNaoAssociados} registros não associados`
                )
            );

            const resumo = criarElemento(
                "div",
                "resumo-auditoria"
            );

            resumo.append(
                criarIndicador(
                    "Atendimentos analisados",
                    totalAtendimentos
                ),
                criarIndicador(
                    "Revisão necessária",
                    totalRevisao
                ),
                criarIndicador(
                    "Sem divergência detectada",
                    totalOk
                ),
                criarIndicador(
                    "Fora do escopo",
                    totalEscopo
                )
            );

            painel.append(resumo);

            // ========================================
            // PAINEL DE TEMPO DA RONDA
            // ========================================

            painel.append(
                criarPainelTempoRonda(auditorias)
            );

            // ========================================
            // AGRUPAMENTO POR OPERADOR
            // ========================================

            const mapaOperadores = new Map();

            auditorias.forEach(auditoria => {
                const operador = nomeOperador(auditoria);

                if (!mapaOperadores.has(operador)) {
                    mapaOperadores.set(operador, {
                        nome: operador,
                        atendimentos: 0,
                        revisao: 0,
                        semDivergencia: 0,
                        foraEscopo: 0
                    });
                }

                const dados = mapaOperadores.get(
                    operador
                );

                dados.atendimentos++;

                if (
                    auditoria.status ===
                    "REVISÃO NECESSÁRIA"
                ) {
                    dados.revisao++;
                }

                if (
                    auditoria.status ===
                    "SEM DIVERGÊNCIA DETECTADA"
                ) {
                    dados.semDivergencia++;
                }

                if (
                    auditoria.status ===
                    "FORA DO ESCOPO"
                ) {
                    dados.foraEscopo++;
                }
            });

            const operadores = Array.from(
                mapaOperadores.values()
            ).sort(
                (a, b) =>
                    a.nome.localeCompare(
                        b.nome,
                        "pt-BR"
                    )
            );

            // ========================================
            // RESUMO POR OPERADOR
            // ========================================

            const secaoOperadores = criarElemento(
                "section",
                "resumo-operadores"
            );

            secaoOperadores.append(
                criarElemento(
                    "h3",
                    "",
                    "Resumo por operador"
                )
            );

            const tabelaContainer = criarElemento(
                "div",
                "tabela-operadores-container"
            );

            const tabela = criarElemento(
                "table",
                "tabela-operadores"
            );

            const cabecalhoTabela =
                document.createElement("thead");

            const linhaCabecalho =
                document.createElement("tr");

            [
                "Operador",
                "Atendimentos",
                "Revisão necessária",
                "Sem divergência",
                "Fora do escopo"
            ].forEach(texto => {
                linhaCabecalho.append(
                    criarElemento("th", "", texto)
                );
            });

            cabecalhoTabela.append(linhaCabecalho);

            const corpoTabela =
                document.createElement("tbody");

            operadores.forEach(operador => {
                const linha =
                    document.createElement("tr");

                [
                    operador.nome,
                    operador.atendimentos,
                    operador.revisao,
                    operador.semDivergencia,
                    operador.foraEscopo
                ].forEach(valor => {
                    linha.append(
                        criarElemento(
                            "td",
                            "",
                            String(valor)
                        )
                    );
                });

                corpoTabela.append(linha);
            });

            tabela.append(
                cabecalhoTabela,
                corpoTabela
            );

            tabelaContainer.append(tabela);
            secaoOperadores.append(tabelaContainer);
            painel.append(secaoOperadores);

            // ========================================
            // FILTROS DOS ATENDIMENTOS
            // ========================================

            painel.append(
                criarElemento(
                    "h3",
                    "",
                    "Atendimentos"
                )
            );

            const barraFiltros = criarElemento(
                "div",
                "barra-filtros-auditoria"
            );

            // FILTRO POR OPERADOR

            const grupoOperador = criarElemento(
                "div",
                "grupo-filtro-operador"
            );

            const rotuloOperador = criarElemento(
                "label",
                "",
                "Filtrar por operador"
            );

            rotuloOperador.htmlFor =
                "filtroOperadorAuditoria";

            const seletorOperador = criarElemento(
                "select",
                "seletor-operador"
            );

            seletorOperador.id =
                "filtroOperadorAuditoria";

            adicionarOpcao(
                seletorOperador,
                "TODOS",
                "Todos os operadores"
            );

            operadores.forEach(operador => {
                adicionarOpcao(
                    seletorOperador,
                    operador.nome,
                    operador.nome
                );
            });

            grupoOperador.append(
                rotuloOperador,
                seletorOperador
            );

            // FILTRO POR CATEGORIA

            const grupoCategoria = criarElemento(
                "div",
                "grupo-filtro-operador"
            );

            const rotuloCategoria = criarElemento(
                "label",
                "",
                "Filtrar por categoria"
            );

            rotuloCategoria.htmlFor =
                "filtroCategoriaAuditoria";

            const seletorCategoria = criarElemento(
                "select",
                "seletor-operador"
            );

            seletorCategoria.id =
                "filtroCategoriaAuditoria";

            [
                ["TODAS", "Todas as categorias"],
                ["DISPAROS", "Disparos de alarme"],
                ["FALHAS", "Falhas técnicas"],
                ["ENERGIA", "Energia"],
                ["DESARMAMENTOS", "Desarmamentos"],
                ["OUTROS", "Outros eventos"]
            ].forEach(([valor, rotulo]) => {
                adicionarOpcao(
                    seletorCategoria,
                    valor,
                    rotulo
                );
            });

            grupoCategoria.append(
                rotuloCategoria,
                seletorCategoria
            );

            barraFiltros.append(
                grupoOperador,
                grupoCategoria
            );

            painel.append(barraFiltros);

            // ========================================
            // FILTROS POR SITUAÇÃO
            // ========================================

            const filtros = criarElemento(
                "div",
                "filtros-auditoria"
            );

            const lista = criarElemento(
                "div",
                "lista-auditorias"
            );

            const quantidadeFiltrada = criarElemento(
                "p",
                "quantidade-filtrada"
            );

            const opcoesSituacao = [
                [
                    "REVISÃO NECESSÁRIA",
                    "Precisam de revisão"
                ],
                [
                    "TODOS",
                    "Todos"
                ],
                [
                    "SEM DIVERGÊNCIA DETECTADA",
                    "Sem divergência"
                ],
                [
                    "FORA DO ESCOPO",
                    "Fora do escopo"
                ]
            ];

            let filtroSituacao =
                "REVISÃO NECESSÁRIA";

            let filtroOperador = "TODOS";
            let filtroCategoria = "TODAS";

            // ========================================
            // EXIBIÇÃO DOS ATENDIMENTOS
            // ========================================

            function exibirAtendimentos() {
                lista.replaceChildren();

                const selecionados = auditorias.filter(
                    auditoria => {
                        const correspondeSituacao =
                            filtroSituacao === "TODOS" ||
                            auditoria.status ===
                                filtroSituacao;

                        const correspondeOperador =
                            filtroOperador === "TODOS" ||
                            nomeOperador(auditoria) ===
                                filtroOperador;

                        const correspondeCategoria =
                            filtroCategoria === "TODAS" ||
                            categoriaOcorrencia(
                                auditoria
                            ) === filtroCategoria;

                        return (
                            correspondeSituacao &&
                            correspondeOperador &&
                            correspondeCategoria
                        );
                    }
                );

                quantidadeFiltrada.textContent =
                    `${selecionados.length} atendimento(s) ` +
                    "encontrado(s) para os filtros selecionados.";

                if (selecionados.length === 0) {
                    lista.append(
                        criarElemento(
                            "p",
                            "mensagem-vazia",
                            "Nenhum atendimento encontrado " +
                            "para os filtros selecionados."
                        )
                    );
                    return;
                }

                const fragmento =
                    document.createDocumentFragment();

                selecionados.forEach(auditoria => {
                    const item = criarElemento(
                        "article",
                        "item-auditoria"
                    );

                    const cabecalho = criarElemento(
                        "div",
                        "cabecalho-atendimento"
                    );

                    const identificacao =
                        criarElemento("div");

                    identificacao.append(
                        criarElemento(
                            "h4",
                            "",
                            `${auditoria.codigoCliente} - ` +
                            auditoria.nomeCliente
                        ),
                        criarElemento(
                            "p",
                            "motivo-atendimento",
                            auditoria.motivo
                        ),
                        criarElemento(
                            "p",
                            "motivo-atendimento",
                            "Data/Hora do evento: " +
                            auditoria.dataHora
                        ),
                        criarElemento(
                            "p",
                            "operador-atendimento",
                            "Operador: " +
                            nomeOperador(auditoria)
                        ),
                        criarElemento(
                            "p",
                            "motivo-atendimento",
                            "Conclusão: " +
                            (
                                auditoria.conclusao ||
                                "Não identificada"
                            )
                        )
                    );

                    let classeSituacao =
                        "situacao-escopo";

                    if (
                        auditoria.status ===
                        "REVISÃO NECESSÁRIA"
                    ) {
                        classeSituacao =
                            "situacao-revisao";

                    } else if (
                        auditoria.status ===
                        "SEM DIVERGÊNCIA DETECTADA"
                    ) {
                        classeSituacao =
                            "situacao-ok";
                    }

                    const situacao = criarElemento(
                        "span",
                        "situacao-atendimento " +
                        classeSituacao,
                        auditoria.status
                    );

                    cabecalho.append(
                        identificacao,
                        situacao
                    );

                    item.append(cabecalho);

                    const detalhes = criarElemento(
                        "details",
                        "detalhes-atendimento"
                    );

                    detalhes.append(
                        criarElemento(
                            "summary",
                            "",
                            "Ver detalhes do atendimento"
                        )
                    );

                    if (
                        auditoria.camposParaRevisao.length > 0
                    ) {
                        detalhes.append(
                            criarElemento(
                                "h4",
                                "",
                                "Pontos para revisão"
                            )
                        );

                        const listaFalhas =
                            criarElemento("ul");

                        auditoria.camposParaRevisao.forEach(
                            falha => {
                                listaFalhas.append(
                                    criarElemento(
                                        "li",
                                        "",
                                        falha
                                    )
                                );
                            }
                        );

                        detalhes.append(listaFalhas);
                    }

                    detalhes.append(
                        criarElemento(
                            "h4",
                            "",
                            "Relato original"
                        ),
                        criarElemento(
                            "pre",
                            "relato-original",
                            auditoria.relatoOriginal ||
                            "Sem relato."
                        )
                    );

                    item.append(detalhes);
                    fragmento.append(item);
                });

                lista.append(fragmento);
            }

            // ========================================
            // BOTÕES DE SITUAÇÃO
            // ========================================

            const botoesSituacao = [];

            opcoesSituacao.forEach(
                ([valor, rotulo]) => {
                    const botao = criarElemento(
                        "button",
                        "filtro-auditoria",
                        rotulo
                    );

                    botao.type = "button";

                    botao.addEventListener(
                        "click",
                        () => {
                            filtroSituacao = valor;

                            botoesSituacao.forEach(
                                item => {
                                    item.classList.remove(
                                        "ativo"
                                    );
                                }
                            );

                            botao.classList.add(
                                "ativo"
                            );

                            exibirAtendimentos();
                        }
                    );

                    botoesSituacao.push(botao);
                    filtros.append(botao);
                }
            );

            // ========================================
            // EVENTOS DOS FILTROS
            // ========================================

            seletorOperador.addEventListener(
                "change",
                () => {
                    filtroOperador =
                        seletorOperador.value;

                    exibirAtendimentos();
                }
            );

            seletorCategoria.addEventListener(
                "change",
                () => {
                    filtroCategoria =
                        seletorCategoria.value;

                    exibirAtendimentos();
                }
            );

            painel.append(
                filtros,
                quantidadeFiltrada,
                lista
            );

            resultado.append(painel);

            // Mantém a auditoria iniciando nas revisões.
            botoesSituacao[0].click();

            // ========================================
            // RESUMO NO CONSOLE
            // ========================================

            console.log(
                "================================="
            );

            console.log(
                "RESUMO DA AUDITORIA - PAINEL 4.3"
            );

            console.log(
                "================================="
            );

            console.table({
                eventos: registros.length,
                clientes: clientes.length,
                atendimentos: totalAtendimentos,
                revisaoNecessaria: totalRevisao,
                semDivergencia: totalOk,
                foraDoEscopo: totalEscopo,
                naoAssociados: totalNaoAssociados,
                operadoresIdentificados:
                    operadores.length
            });

            console.log("RESUMO POR OPERADOR");
            console.table(operadores);

        } catch (erro) {
            console.error(
                "Erro ao processar o relatório:",
                erro
            );

            alert(
                "Ocorreu um erro ao processar o relatório. " +
                "Consulte o Console para verificar os detalhes."
            );
        }
    };

    leitor.onerror = function() {
        alert(
            "Não foi possível ler o arquivo selecionado."
        );
    };

    leitor.readAsText(
        arquivo,
        "UTF-8"
    );
}
