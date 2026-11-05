
import { importarCadastro } from "../services/importador.js";
import { importarOcorrencias } from "../services/importadorOcorrencias.js";
import { testarParserRondas } from "../services/rondas/testeParserRondas.js";
import { analisarRondas } from "../services/rondas/analisadorRondas.js";

/**
 * SECURITYMASTER INTELLIGENCE
 * Controle de componentes e navegação
 * Versão 2.4
 *
 * - Auditoria Operacional preservada
 * - Importação de rondas eletrônicas
 * - Classificação preliminar das falhas
 * - Identificação dos clientes
 * - Sequência de eventos recolhível
 * - Análise individual recolhível
 * - Filtros por data e operador
 */

console.log("SecurityMaster Intelligence iniciado.");

// ========================================
// CONFIGURAÇÃO DOS MÓDULOS
// ========================================

const MODULOS = {
    dashboard: {
        titulo: "Dashboard",
        icone: "📊",
        descricao: "Visão geral dos indicadores da plataforma."
    },

    clientes: {
        titulo: "Clientes",
        icone: "🏢",
        descricao: "Gestão de cadastros e informações dos clientes."
    },

    eventos: {
        titulo: "Eventos",
        icone: "🚨",
        descricao: "Consulta e análise dos eventos registrados."
    },

    monitoramento: {
        titulo: "Monitoramento",
        icone: "📹",
        descricao: "Acompanhamento dos processos da central."
    },

    auditoria: {
        titulo: "Auditoria Operacional",
        icone: "📋",
        arquivo: "../src/components/auditoria.html"
    },

    auditoriaRondas: {
        titulo: "Auditoria de Rondas Eletrônicas",
        icone: "🚶",
        descricao: "Importação e análise dos eventos de rondas eletrônicas."
    },

    relatorios: {
        titulo: "Relatórios",
        icone: "📄",
        descricao: "Relatórios e indicadores das auditorias."
    },

    configuracoes: {
        titulo: "Configurações",
        icone: "⚙️",
        descricao: "Configurações e parâmetros da plataforma."
    }
};

let paginaAtual = null;
let numeroNavegacao = 0;

// ========================================
// CARREGAMENTO DOS COMPONENTES
// ========================================

async function carregarComponente(id, arquivo) {
    try {
        const resposta = await fetch(arquivo);

        if (!resposta.ok) {
            throw new Error(
                `Erro ao carregar ${arquivo}: ${resposta.status}`
            );
        }

        const conteudo = await resposta.text();
        const elemento = document.getElementById(id);

        if (!elemento) {
            console.error(`Elemento ${id} não encontrado.`);
            return false;
        }

        elemento.innerHTML = conteudo;
        configurarBotoesImportacao(elemento);

        return true;

    } catch (erro) {
        console.error("Falha ao carregar componente:", erro);
        return false;
    }
}

// ========================================
// BOTÕES DE IMPORTAÇÃO EXISTENTES
// ========================================

function configurarBotoesImportacao(elemento) {
    const botaoCadastro = elemento.querySelector(
        "#btnImportarCadastro"
    );

    if (botaoCadastro) {
        botaoCadastro.addEventListener(
            "click",
            importarCadastro
        );
    }

    const botaoAuditoria = elemento.querySelector(
        "#btnImportarOcorrencias"
    );

    if (botaoAuditoria) {
        botaoAuditoria.addEventListener(
            "click",
            importarOcorrencias
        );
    }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function criarElemento(tag, classe = "", texto = null) {
    const elemento = document.createElement(tag);

    if (classe) {
        elemento.className = classe;
    }

    if (texto !== null && texto !== undefined) {
        elemento.textContent = String(texto);
    }

    return elemento;
}

function criarIndicadorRondas(valor, titulo) {
    const indicador = criarElemento(
        "div",
        "rondas-indicador"
    );

    indicador.append(
        criarElemento("strong", "", valor),
        criarElemento("span", "", titulo)
    );

    return indicador;
}

function mostrarMensagemRondas(elemento, mensagem, erro = false) {
    elemento.textContent = mensagem;

    elemento.className = erro
        ? "rondas-mensagem rondas-erro"
        : "rondas-mensagem";
}

function nomeTipoEvento(tipo) {
    const nomes = {
        INICIO: "Início de ronda",
        FINAL: "Final de ronda",
        PONTO_BATIDO: "Boton acionado",
        FALHA: "Ponto não batido"
    };

    return nomes[tipo] || tipo || "Não identificado";
}

function nomeTipoFalha(tipo) {
    const nomes = {
        INICIO: "Possível falha no início da ronda",
        FINALIZACAO: "Possível falha na finalização da ronda",
        BOTON: "Falha no acionamento do boton"
    };

    return nomes[tipo] || "Falha não classificada";
}

function formatarSetor(setor) {
    if (
        setor === null ||
        setor === undefined ||
        setor === ""
    ) {
        return "0 (não informado no relatório)";
    }

    return String(setor);
}

function identificarCliente(evento, clienteGeral) {
    const codigo =
        evento.codigoCliente ??
        clienteGeral?.codigo ??
        "Não identificado";

    const nome =
        evento.nomeCliente ||
        clienteGeral?.nome ||
        "Cliente não identificado";

    return `${codigo} — ${nome}`;
}

// ========================================
// FUNÇÕES DOS FILTROS
// ========================================

function extrairDataFiltro(dataHora) {
    const resultado = String(dataHora || "").match(
        /^(\d{2})\/(\d{2})\/(\d{4})/
    );

    if (!resultado) {
        return "";
    }

    const [, dia, mes, ano] = resultado;

    return `${ano}-${mes}-${dia}`;
}

function normalizarOperador(operador) {
    return String(operador || "Não identificado")
        .trim()
        .replace(/\s+/g, " ");
}

function criarCampoFiltro(titulo, campo) {
    const grupo = criarElemento(
        "div",
        "rondas-filtro-grupo"
    );

    const label = criarElemento(
        "label",
        "",
        titulo
    );

    label.htmlFor = campo.id;

    grupo.append(label, campo);

    return grupo;
}

// ========================================
// TELA DE RONDAS ELETRÔNICAS
// ========================================

function criarTelaRondas() {
    const secao = criarElemento(
        "section",
        "modulo-provisorio modulo-rondas"
    );

    const cabecalho = criarElemento(
        "div",
        "modulo-provisorio-cabecalho"
    );

    cabecalho.append(
        criarElemento(
            "span",
            "modulo-provisorio-icone",
            "🚶"
        ),
        criarElemento(
            "h2",
            "",
            "Auditoria de Rondas Eletrônicas"
        )
    );

    const descricao = criarElemento(
        "p",
        "modulo-provisorio-descricao",
        "Importe um relatório HTML para identificar os eventos " +
        "e interpretar preliminarmente as falhas de ronda."
    );

    const painel = criarElemento(
        "div",
        "rondas-painel-importacao"
    );

    const campoArquivo = document.createElement("input");

    campoArquivo.type = "file";
    campoArquivo.id = "arquivoRondas";
    campoArquivo.accept = ".html,.htm,text/html";

    const botaoAnalisar = criarElemento(
        "button",
        "rondas-botao",
        "Analisar relatório"
    );

    botaoAnalisar.type = "button";
    botaoAnalisar.id = "btnAnalisarRondas";

    const mensagem = criarElemento(
        "div",
        "rondas-mensagem"
    );

    mensagem.id = "mensagemRondas";

    const resultados = criarElemento(
        "div",
        "rondas-resultados"
    );

    resultados.id = "resultadoRondas";

    painel.append(
        criarElemento(
            "h3",
            "",
            "Importação de relatório"
        ),
        criarElemento(
            "p",
            "",
            "Selecione o relatório HTML exportado pelo sistema."
        ),
        campoArquivo,
        botaoAnalisar,
        mensagem
    );

    secao.append(
        cabecalho,
        descricao,
        painel,
        resultados
    );

    // ====================================
    // IMPORTAÇÃO E ANÁLISE
    // ====================================

    botaoAnalisar.addEventListener("click", async () => {
        const arquivo = campoArquivo.files?.[0];

        if (!arquivo) {
            mostrarMensagemRondas(
                mensagem,
                "Selecione um arquivo HTML antes de analisar.",
                true
            );

            return;
        }

        if (!/\.html?$/i.test(arquivo.name)) {
            mostrarMensagemRondas(
                mensagem,
                "Selecione um arquivo .html ou .htm.",
                true
            );

            return;
        }

        botaoAnalisar.disabled = true;
        botaoAnalisar.textContent = "Analisando...";

        resultados.replaceChildren();

        mostrarMensagemRondas(
            mensagem,
            "Lendo os eventos e interpretando as falhas..."
        );

        try {
            const resultadoParser = await testarParserRondas(
                arquivo
            );

            if (!secao.isConnected) {
                return;
            }

            if (
                !resultadoParser ||
                !Array.isArray(resultadoParser.eventos)
            ) {
                throw new Error(
                    "O parser não retornou eventos válidos."
                );
            }

            const resultadoAnalise = analisarRondas(
                resultadoParser
            );

            console.log(
                "[RONDAS] Resultado da análise:",
                resultadoAnalise
            );

            exibirResultadoRondas(
                resultados,
                resultadoParser,
                resultadoAnalise
            );

            mostrarMensagemRondas(
                mensagem,
                "Leitura e interpretação concluídas. " +
                "Confira as classificações preliminares."
            );

        } catch (erro) {
            console.error(
                "Erro na análise de rondas:",
                erro
            );

            if (secao.isConnected) {
                mostrarMensagemRondas(
                    mensagem,
                    "Não foi possível analisar o relatório. " +
                    "Consulte o console do navegador.",
                    true
                );
            }

        } finally {
            botaoAnalisar.disabled = false;
            botaoAnalisar.textContent = "Analisar relatório";
        }
    });

    return secao;
}

// ========================================
// EXIBIÇÃO DOS RESULTADOS
// ========================================

function exibirResultadoRondas(
    destino,
    resultadoParser,
    resultadoAnalise
) {
    destino.replaceChildren();

    const eventos = Array.isArray(resultadoParser.eventos)
        ? resultadoParser.eventos
        : [];

    const falhas = eventos.filter(
        evento => evento.falha
    );

    const analises = Array.isArray(resultadoAnalise.falhas)
        ? resultadoAnalise.falhas
        : [];

    const cliente = resultadoParser.cliente || {};

    // ====================================
    // INDICADORES GERAIS
    // ====================================

    const resumo = criarElemento(
        "div",
        "rondas-resumo"
    );

    resumo.append(
        criarIndicadorRondas(
            eventos.length,
            "Total de eventos"
        ),
        criarIndicadorRondas(
            falhas.length,
            "Eventos de falha"
        ),
        criarIndicadorRondas(
            eventos.length - falhas.length,
            "Eventos normais"
        )
    );

    destino.append(resumo);

    // ====================================
    // IDENTIFICAÇÃO DO CLIENTE
    // ====================================

    const identificacao = criarElemento(
        "div",
        "rondas-identificacao"
    );

    identificacao.append(
        criarElemento(
            "h3",
            "",
            "Cliente: " +
            (cliente.nome || "Não identificado")
        ),
        criarElemento(
            "p",
            "",
            "Código: " +
            (cliente.codigo || "Não identificado")
        )
    );

    destino.append(identificacao);

    if (!eventos.length) {
        destino.append(
            criarElemento(
                "p",
                "rondas-mensagem rondas-erro",
                "Nenhum evento foi identificado."
            )
        );

        return;
    }

    // ====================================
    // CLASSIFICAÇÃO PRELIMINAR
    // ====================================

    destino.append(
        criarElemento(
            "h3",
            "rondas-titulo-secao",
            "Classificação preliminar das falhas"
        )
    );

    const resumoFalhas = criarElemento(
        "div",
        "rondas-resumo"
    );

    resumoFalhas.append(
        criarIndicadorRondas(
            resultadoAnalise.totalFalhasInicio ?? 0,
            "Possíveis falhas de início"
        ),
        criarIndicadorRondas(
            resultadoAnalise.totalFalhasBoton ?? 0,
            "Falhas de boton"
        ),
        criarIndicadorRondas(
            resultadoAnalise.totalFalhasFinalizacao ?? 0,
            "Possíveis falhas de finalização"
        )
    );

    destino.append(resumoFalhas);

    destino.append(
        criarElemento(
            "p",
            "rondas-aviso",
            "As classificações são preliminares. " +
            "Ainda não representam aprovação ou reprovação " +
            "das baixas dos operadores."
        )
    );

    // ====================================
    // SEQUÊNCIA DE EVENTOS RECOLHÍVEL
    // ====================================

    const detalhesEventos = document.createElement(
        "details"
    );

    detalhesEventos.className =
        "rondas-eventos-recolhiveis";

    detalhesEventos.open = false;

    const tituloEventos = criarElemento(
        "summary",
        "rondas-eventos-resumo",
        `Sequência de eventos identificados (${eventos.length} eventos)`
    );

    detalhesEventos.append(tituloEventos);

    const areaTabela = criarElemento(
        "div",
        "rondas-tabela-container"
    );

    const tabela = document.createElement("table");
    tabela.className = "rondas-tabela";

    const cabecalhoTabela = document.createElement(
        "thead"
    );

    const linhaCabecalho = document.createElement(
        "tr"
    );

    [
        "Data / Hora",
        "Evento",
        "Setor",
        "Situação"
    ].forEach(titulo => {
        linhaCabecalho.append(
            criarElemento("th", "", titulo)
        );
    });

    cabecalhoTabela.append(linhaCabecalho);

    const corpoTabela = document.createElement(
        "tbody"
    );

    eventos.forEach(evento => {
        const linha = document.createElement("tr");

        if (evento.falha) {
            linha.className = "rondas-linha-falha";
        }

        [
            evento.dataHora || "-",
            nomeTipoEvento(evento.tipo),
            formatarSetor(evento.setor),
            evento.falha ? "FALHA" : "Normal"
        ].forEach(valor => {
            linha.append(
                criarElemento("td", "", valor)
            );
        });

        corpoTabela.append(linha);
    });

    tabela.append(
        cabecalhoTabela,
        corpoTabela
    );

    areaTabela.append(tabela);
    detalhesEventos.append(areaTabela);
    destino.append(detalhesEventos);

    // ====================================
    // ANÁLISE INDIVIDUAL RECOLHÍVEL
    // ====================================

    const painelFalhas = document.createElement(
        "details"
    );

    painelFalhas.className =
        "rondas-falhas-recolhiveis";

    painelFalhas.open = false;

    const tituloPainelFalhas = criarElemento(
        "summary",
        "rondas-falhas-resumo",
        `Análise individual das falhas (${analises.length} falhas)`
    );

    painelFalhas.append(tituloPainelFalhas);

    const conteudoFalhas = criarElemento(
        "div",
        "rondas-falhas-conteudo"
    );

    painelFalhas.append(conteudoFalhas);
    destino.append(painelFalhas);

    if (!analises.length) {
        conteudoFalhas.append(
            criarElemento(
                "p",
                "rondas-mensagem",
                "Nenhum evento de falha identificado."
            )
        );

        return;
    }

    // ====================================
    // CAMPOS DE FILTRO
    // ====================================

    const areaFiltros = criarElemento(
        "div",
        "rondas-filtros"
    );

    const campoData = document.createElement("input");

    campoData.type = "date";
    campoData.id = "filtroDataRondas";
    campoData.className = "rondas-campo-filtro";

    const campoOperador = document.createElement("select");

    campoOperador.id = "filtroOperadorRondas";
    campoOperador.className = "rondas-campo-filtro";

    const opcaoTodos = document.createElement("option");

    opcaoTodos.value = "";
    opcaoTodos.textContent = "Todos os operadores";

    campoOperador.append(opcaoTodos);

    const operadores = [
        ...new Set(
            analises.map(falha =>
                normalizarOperador(falha.operador)
            )
        )
    ].sort((a, b) =>
        a.localeCompare(b, "pt-BR")
    );

    operadores.forEach(operador => {
        const opcao = document.createElement("option");

        opcao.value = operador;
        opcao.textContent = operador;

        campoOperador.append(opcao);
    });

    const botaoLimpar = criarElemento(
        "button",
        "rondas-botao-limpar",
        "Limpar filtros"
    );

    botaoLimpar.type = "button";

    areaFiltros.append(
        criarCampoFiltro(
            "Data da ocorrência",
            campoData
        ),
        criarCampoFiltro(
            "Operador",
            campoOperador
        ),
        botaoLimpar
    );

    const contador = criarElemento(
        "p",
        "rondas-contador-falhas",
        ""
    );

    const listaFalhas = criarElemento(
        "div",
        "rondas-lista-falhas"
    );

    conteudoFalhas.append(
        areaFiltros,
        contador,
        listaFalhas
    );

    // ====================================
    // CRIAR UM CARTÃO RECOLHÍVEL
    // ====================================

    function criarCartaoFalha(falha, indice) {
        const cartao = document.createElement("details");

        cartao.className =
            "rondas-cartao-falha rondas-cartao-recolhivel";

        cartao.open = false;

        const resumoCartao = criarElemento(
            "summary",
            "rondas-cartao-resumo"
        );

        const titulo = criarElemento(
            "strong",
            "",
            `Falha ${indice + 1} — ${falha.dataHora || "Sem data"}`
        );

        const subtitulo = criarElemento(
            "span",
            "rondas-cartao-subtitulo",
            nomeTipoFalha(falha.tipoFalha) +
            " | Operador: " +
            normalizarOperador(falha.operador)
        );

        resumoCartao.append(
            titulo,
            subtitulo
        );

        const conteudoCartao = criarElemento(
            "div",
            "rondas-cartao-conteudo"
        );

        const identificacaoCliente = criarElemento(
            "p",
            "rondas-cliente-falha",
            identificarCliente(falha, cliente)
        );

        const classificacao = criarElemento(
            "p",
            "rondas-classificacao",
            nomeTipoFalha(falha.tipoFalha)
        );

        const descricao = criarElemento(
            "p",
            "",
            falha.descricaoFalha ||
            "Descrição não disponível."
        );

        const setor = criarElemento(
            "p",
            "",
            `Setor: ${formatarSetor(falha.setor)}`
        );

        const operador = criarElemento(
            "p",
            "",
            "Operador: " +
            normalizarOperador(falha.operador)
        );

        // =================================
        // REGULARIZAÇÃO
        // =================================

        const regularizacao = criarElemento(
            "div",
            "rondas-regularizacao"
        );

        if (falha.regularizada) {
            regularizacao.classList.add(
                "rondas-regularizada"
            );

            regularizacao.append(
                criarElemento(
                    "strong",
                    "",
                    "Regularização posterior identificada"
                ),
                criarElemento(
                    "p",
                    "",
                    "Evento: " +
                    nomeTipoEvento(
                        falha.eventoRegularizacao?.tipo
                    )
                ),
                criarElemento(
                    "p",
                    "",
                    "Data / Hora: " +
                    (
                        falha.eventoRegularizacao?.dataHora ||
                        "Não informada"
                    )
                )
            );

        } else {
            regularizacao.classList.add(
                "rondas-nao-regularizada"
            );

            regularizacao.append(
                criarElemento(
                    "strong",
                    "",
                    "Regularização não identificada no relatório"
                ),
                criarElemento(
                    "p",
                    "",
                    "Não foi encontrado um evento posterior " +
                    "correspondente na sequência analisada."
                )
            );
        }

        // =================================
        // RELATO ORIGINAL
        // =================================

        const detalhesRelato = document.createElement(
            "details"
        );

        const resumoRelato = criarElemento(
            "summary",
            "",
            "Ver relato original"
        );

        const relato = criarElemento(
            "pre",
            "rondas-relato",
            falha.relato ||
            "Nenhum relato identificado."
        );

        detalhesRelato.append(
            resumoRelato,
            relato
        );

        conteudoCartao.append(
            identificacaoCliente,
            classificacao,
            descricao,
            setor,
            operador,
            regularizacao,
            detalhesRelato
        );

        cartao.append(
            resumoCartao,
            conteudoCartao
        );

        return cartao;
    }

    // ====================================
    // APLICAR FILTROS
    // ====================================

    function aplicarFiltros() {
        const dataSelecionada = campoData.value;
        const operadorSelecionado = campoOperador.value;

        const filtradas = analises
            .map((falha, indice) => ({
                falha,
                indice
            }))
            .filter(({ falha }) => {
                const correspondeData =
                    !dataSelecionada ||
                    extrairDataFiltro(falha.dataHora) ===
                    dataSelecionada;

                const correspondeOperador =
                    !operadorSelecionado ||
                    normalizarOperador(falha.operador) ===
                    operadorSelecionado;

                return (
                    correspondeData &&
                    correspondeOperador
                );
            });

        contador.textContent =
            `Exibindo ${filtradas.length} de ` +
            `${analises.length} falhas identificadas.`;

        listaFalhas.replaceChildren();

        if (!filtradas.length) {
            listaFalhas.append(
                criarElemento(
                    "p",
                    "rondas-sem-resultados",
                    "Nenhuma falha encontrada para os filtros selecionados."
                )
            );

            return;
        }

        filtradas.forEach(({ falha, indice }) => {
            listaFalhas.append(
                criarCartaoFalha(falha, indice)
            );
        });
    }

    campoData.addEventListener(
        "change",
        aplicarFiltros
    );

    campoOperador.addEventListener(
        "change",
        aplicarFiltros
    );

    botaoLimpar.addEventListener("click", () => {
        campoData.value = "";
        campoOperador.value = "";

        aplicarFiltros();
    });

    // Primeira exibição: todas as falhas.
    aplicarFiltros();
}

// ========================================
// TELAS PROVISÓRIAS
// ========================================

function criarTelaProvisoria(chave) {
    const modulo = MODULOS[chave];

    const secao = criarElemento(
        "section",
        "modulo-provisorio"
    );

    const cabecalho = criarElemento(
        "div",
        "modulo-provisorio-cabecalho"
    );

    cabecalho.append(
        criarElemento(
            "span",
            "modulo-provisorio-icone",
            modulo.icone
        ),
        criarElemento(
            "h2",
            "",
            modulo.titulo
        )
    );

    const conteudo = criarElemento(
        "div",
        "modulo-provisorio-conteudo"
    );

    conteudo.append(
        criarElemento(
            "span",
            "modulo-provisorio-status",
            "Módulo em desenvolvimento"
        ),
        criarElemento(
            "p",
            "",
            "A navegação deste módulo já está disponível. " +
            "As funcionalidades específicas serão " +
            "implementadas nas próximas etapas."
        )
    );

    secao.append(
        cabecalho,
        criarElemento(
            "p",
            "modulo-provisorio-descricao",
            modulo.descricao
        ),
        conteudo
    );

    return secao;
}

// ========================================
// DESTAQUE DO MENU ATIVO
// ========================================

function destacarMenu(chave) {
    const botoes = document.querySelectorAll(
        "#sidebar .menu-item"
    );

    botoes.forEach(botao => {
        const ativo = botao.dataset.page === chave;

        botao.classList.toggle(
            "ativo",
            ativo
        );

        const itemLista = botao.closest("li");

        if (itemLista) {
            itemLista.classList.toggle(
                "ativo",
                ativo
            );
        }

        if (ativo) {
            botao.setAttribute(
                "aria-current",
                "page"
            );
        } else {
            botao.removeAttribute(
                "aria-current"
            );
        }
    });
}

// ========================================
// ABERTURA DOS MÓDULOS
// ========================================

async function abrirModulo(chave) {
    const modulo = MODULOS[chave];

    if (!modulo) {
        console.warn(
            `Módulo não reconhecido: ${chave}`
        );

        return;
    }

    const areaPrincipal = document.getElementById(
        "dashboard"
    );

    if (!areaPrincipal) {
        console.error(
            "Área principal #dashboard não encontrada."
        );

        return;
    }

    const navegacaoAtual = ++numeroNavegacao;

    if (modulo.arquivo) {
        try {
            const resposta = await fetch(
                modulo.arquivo
            );

            if (!resposta.ok) {
                throw new Error(
                    `Erro ${resposta.status} ao carregar ${modulo.arquivo}`
                );
            }

            const conteudo = await resposta.text();

            if (navegacaoAtual !== numeroNavegacao) {
                return;
            }

            areaPrincipal.innerHTML = conteudo;

            configurarBotoesImportacao(
                areaPrincipal
            );

        } catch (erro) {
            if (navegacaoAtual !== numeroNavegacao) {
                return;
            }

            console.error(
                `Falha ao abrir ${modulo.titulo}:`,
                erro
            );

            areaPrincipal.replaceChildren(
                criarElemento(
                    "p",
                    "mensagem-erro-modulo",
                    `Não foi possível carregar ${modulo.titulo}.`
                )
            );

            return;
        }

    } else if (chave === "auditoriaRondas") {
        areaPrincipal.replaceChildren(
            criarTelaRondas()
        );

    } else {
        areaPrincipal.replaceChildren(
            criarTelaProvisoria(chave)
        );
    }

    paginaAtual = chave;

    destacarMenu(chave);

    console.log(
        `Módulo carregado: ${modulo.titulo}`
    );
}

// ========================================
// MENU LATERAL
// ========================================

async function iniciarMenuLateral() {
    const carregou = await carregarComponente(
        "sidebar",
        "../src/components/sidebar.html"
    );

    if (!carregou) {
        return;
    }

    const menu = document.getElementById(
        "sidebar"
    );

    if (!menu) {
        return;
    }

    const botoes = menu.querySelectorAll(
        ".menu-item[data-page]"
    );

    botoes.forEach(botao => {
        botao.addEventListener(
            "click",
            () => {
                abrirModulo(
                    botao.dataset.page
                );
            }
        );
    });

    if (paginaAtual) {
        destacarMenu(
            paginaAtual
        );
    }
}

// ========================================
// ESTILOS
// ========================================

function adicionarEstilosMenu() {
    if (
        document.getElementById(
            "estilosNavegacaoSecurityMaster"
        )
    ) {
        return;
    }

    const estilo = document.createElement(
        "style"
    );

    estilo.id =
        "estilosNavegacaoSecurityMaster";

    estilo.textContent = `
        /* MENU LATERAL */

        #sidebar .sidebar nav ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        #sidebar .sidebar nav li {
            margin: 4px 0;
        }

        #sidebar .menu-item {
            display: block;
            width: 100%;
            padding: 12px 14px;
            border: none;
            border-radius: 8px;
            background: transparent;
            color: inherit;
            font: inherit;
            font-size: 14px;
            text-align: left;
            line-height: 1.5;
            cursor: pointer;
            transition:
                background-color .2s ease,
                color .2s ease;
        }

        #sidebar .menu-item:hover {
            background-color: rgba(59,130,246,.12);
        }

        #sidebar .menu-item.ativo {
            background-color: #2563eb;
            color: #ffffff;
            font-weight: 600;
        }

        #sidebar .menu-item:focus-visible {
            outline: 2px solid #60a5fa;
            outline-offset: 2px;
        }

        /* TELAS PROVISÓRIAS */

        .modulo-provisorio {
            padding: 24px;
            color: #253449;
        }

        .modulo-provisorio-cabecalho {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 12px;
        }

        .modulo-provisorio-icone {
            font-size: 28px;
        }

        .modulo-provisorio-cabecalho h2 {
            margin: 0;
            font-size: 24px;
            color: #172b4d;
        }

        .modulo-provisorio-descricao {
            color: #64748b;
            line-height: 1.7;
            margin-bottom: 24px;
        }

        .modulo-provisorio-conteudo {
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 14px;
            padding: 24px;
            box-shadow: 0 3px 12px rgba(0,0,0,.04);
        }

        .modulo-provisorio-status {
            display: inline-block;
            background: #eff6ff;
            color: #1d4ed8;
            border-radius: 20px;
            padding: 7px 12px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 12px;
        }

        .modulo-provisorio-conteudo p {
            color: #475569;
            line-height: 1.7;
        }

        .mensagem-erro-modulo {
            padding: 20px;
            background: #fff1f2;
            color: #9f1239;
            border-radius: 10px;
        }

        /* IMPORTAÇÃO DE RONDAS */

        .rondas-painel-importacao {
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 14px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 3px 12px rgba(0,0,0,.04);
        }

        .rondas-painel-importacao h3 {
            margin-top: 0;
            color: #172b4d;
        }

        .rondas-painel-importacao p {
            color: #64748b;
            line-height: 1.6;
        }

        #arquivoRondas {
            display: block;
            width: 100%;
            max-width: 100%;
            margin: 18px 0;
            box-sizing: border-box;
        }

        .rondas-botao {
            background: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 12px 20px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
        }

        .rondas-botao:hover {
            background: #1d4ed8;
        }

        .rondas-botao:disabled {
            opacity: .6;
            cursor: wait;
        }

        .rondas-mensagem {
            margin-top: 14px;
            color: #475569;
            line-height: 1.6;
        }

        .rondas-erro {
            color: #b91c1c;
        }

        /* INDICADORES */

        .rondas-resumo {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 22px;
        }

        .rondas-indicador {
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 12px;
            padding: 20px;
        }

        .rondas-indicador strong {
            font-size: 28px;
            color: #172b4d;
        }

        .rondas-indicador span {
            font-size: 13px;
            color: #64748b;
        }

        .rondas-identificacao {
            margin-bottom: 20px;
        }

        .rondas-identificacao h3 {
            margin-bottom: 6px;
            color: #172b4d;
        }

        .rondas-identificacao p {
            margin-top: 0;
            color: #64748b;
        }

        .rondas-titulo-secao {
            margin: 26px 0 14px;
            color: #172b4d;
        }

        .rondas-aviso {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 12px 16px;
            border-radius: 8px;
            color: #1e40af;
            line-height: 1.6;
            font-size: 13px;
            margin-bottom: 22px;
        }

        /* SEQUÊNCIA DE EVENTOS RECOLHÍVEL */

        .rondas-eventos-recolhiveis {
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 12px;
            margin: 24px 0;
            overflow: hidden;
        }

        .rondas-eventos-resumo {
            padding: 18px 20px;
            color: #172b4d;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            background: #f8fafc;
        }

        .rondas-eventos-resumo:hover {
            background: #eff6ff;
        }

        .rondas-eventos-recolhiveis[open]
        .rondas-eventos-resumo {
            border-bottom: 1px solid #e4eaf1;
        }

        .rondas-eventos-recolhiveis
        .rondas-tabela-container {
            border: none;
            border-radius: 0;
            max-height: 450px;
            overflow: auto;
        }

        /* TABELA */

        .rondas-tabela-container {
            overflow-x: auto;
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 12px;
        }

        .rondas-tabela {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .rondas-tabela th,
        .rondas-tabela td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e4eaf1;
        }

        .rondas-tabela th {
            background: #f1f5f9;
            color: #334155;
            position: sticky;
            top: 0;
        }

        .rondas-linha-falha {
            background: #fff7ed;
        }

        /* PAINEL DE FALHAS RECOLHÍVEL */

        .rondas-falhas-recolhiveis {
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-radius: 12px;
            margin: 24px 0;
            overflow: hidden;
        }

        .rondas-falhas-resumo {
            padding: 18px 20px;
            color: #172b4d;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            background: #f8fafc;
        }

        .rondas-falhas-resumo:hover {
            background: #eff6ff;
        }

        .rondas-falhas-recolhiveis[open]
        .rondas-falhas-resumo {
            border-bottom: 1px solid #e4eaf1;
        }

        .rondas-falhas-conteudo {
            padding: 20px;
        }

        /* FILTROS */

        .rondas-filtros {
            display: flex;
            flex-wrap: wrap;
            align-items: end;
            gap: 14px;
            padding: 16px;
            background: #f8fafc;
            border: 1px solid #e4eaf1;
            border-radius: 10px;
            margin-bottom: 12px;
        }

        .rondas-filtro-grupo {
            display: flex;
            flex-direction: column;
            gap: 7px;
            flex: 1;
            min-width: 180px;
        }

        .rondas-filtro-grupo label {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
        }

        .rondas-campo-filtro {
            width: 100%;
            min-height: 40px;
            padding: 9px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            color: #172b4d;
            font: inherit;
            font-size: 13px;
            box-sizing: border-box;
        }

        .rondas-campo-filtro:focus {
            outline: 2px solid #93c5fd;
            border-color: #2563eb;
        }

        .rondas-botao-limpar {
            min-height: 40px;
            padding: 9px 15px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            color: #334155;
            font-weight: 600;
            cursor: pointer;
        }

        .rondas-botao-limpar:hover {
            background: #e2e8f0;
        }

        .rondas-contador-falhas {
            color: #64748b;
            font-size: 13px;
            margin: 12px 0 18px;
        }

        .rondas-sem-resultados {
            background: #f8fafc;
            padding: 18px;
            border-radius: 8px;
            color: #64748b;
            text-align: center;
        }

        /* CARTÕES INDIVIDUAIS RECOLHÍVEIS */

        .rondas-cartao-falha {
            background: #ffffff;
            border: 1px solid #e4eaf1;
            border-left: 4px solid #f59e0b;
            border-radius: 10px;
            margin-bottom: 12px;
            overflow: hidden;
        }

        .rondas-cartao-resumo {
            padding: 16px 18px;
            cursor: pointer;
            color: #172b4d;
            background: #ffffff;
        }

        .rondas-cartao-resumo:hover {
            background: #fff7ed;
        }

        .rondas-cartao-resumo strong {
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
        }

        .rondas-cartao-subtitulo {
            display: block;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
        }

        .rondas-cartao-conteudo {
            padding: 0 18px 18px;
            border-top: 1px solid #e4eaf1;
        }

        .rondas-cartao-conteudo p {
            color: #475569;
            line-height: 1.6;
        }

        .rondas-cliente-falha {
            font-weight: 700;
            color: #172b4d !important;
        }

        .rondas-classificacao {
            font-weight: 600;
            color: #b45309 !important;
        }

        /* REGULARIZAÇÃO */

        .rondas-regularizacao {
            padding: 14px;
            border-radius: 8px;
            margin: 14px 0;
            font-size: 13px;
        }

        .rondas-regularizacao p {
            margin: 6px 0 0;
        }

        .rondas-regularizada {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
        }

        .rondas-nao-regularizada {
            background: #fff7ed;
            border: 1px solid #fed7aa;
            color: #9a3412;
        }

        .rondas-cartao-conteudo summary {
            color: #2563eb;
            cursor: pointer;
            font-weight: 600;
            margin-top: 12px;
        }

        .rondas-relato {
            background: #f8fafc;
            padding: 14px;
            border-radius: 8px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            font-family: inherit;
            font-size: 13px;
            line-height: 1.6;
        }

        /* RESPONSIVIDADE */

        @media (max-width: 700px) {
            .modulo-provisorio {
                padding: 14px;
            }

            .modulo-provisorio-conteudo,
            .rondas-painel-importacao {
                padding: 18px;
            }

            .rondas-resumo {
                grid-template-columns: 1fr;
            }

            .rondas-falhas-conteudo {
                padding: 12px;
            }

            .rondas-filtros {
                flex-direction: column;
                align-items: stretch;
            }

            .rondas-filtro-grupo {
                width: 100%;
                min-width: 0;
            }
        }
    `;

    document.head.append(estilo);
}

// ========================================
// INICIALIZAÇÃO DA PLATAFORMA
// ========================================

async function iniciarPlataforma() {
    adicionarEstilosMenu();

    await Promise.all([
        carregarComponente(
            "header",
            "../src/components/header.html"
        ),
        iniciarMenuLateral()
    ]);

    // Auditoria Operacional continua como tela inicial.
    await abrirModulo("auditoria");
}

iniciarPlataforma();
