
/**
 * SECURITYMASTER INTELLIGENCE
 * Parser de Rondas Eletrônicas
 * Versão 1.1
 *
 * Responsabilidades:
 * - Ler relatórios HTML FastReport
 * - Identificar eventos de ronda
 * - Reconhecer registros divididos entre páginas
 * - Preservar setor 0 e setor vazio
 * - Extrair data, hora, relato e operador
 * - Identificar somente os eventos de falha
 *
 * A auditoria das baixas será implementada
 * em um módulo separado.
 */

// ========================================
// NORMALIZAÇÃO
// ========================================

function normalizarTexto(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function textoCelula(celula) {
    return String(
        celula?.innerText ||
        celula?.textContent ||
        ""
    )
        .replace(/\u00a0/g, " ")
        .trim();
}

// ========================================
// IDENTIFICAÇÃO DOS EVENTOS
// ========================================

function identificarTipo(texto) {
    const valor = normalizarTexto(texto);

    if (valor.startsWith("INICIO CONTROLE DE RONDA")) {
        return "INICIO";
    }

    if (valor.startsWith("FINAL DE RONDA ELETRONICA")) {
        return "FINAL";
    }

    // Verificar NAO BATIDO antes de BATIDO.
    if (
        valor.startsWith(
            "PONTO DE RONDA ELETRONICO NAO BATIDO"
        )
    ) {
        return "FALHA";
    }

    if (
        valor.startsWith(
            "PONTO DE RONDA ELETRONICO BATIDO"
        )
    ) {
        return "PONTO_BATIDO";
    }

    return null;
}

// ========================================
// DATA E HORA
// ========================================

function extrairData(dataHora) {
    const resultado = String(dataHora ?? "").match(
        /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
    );

    if (!resultado) {
        return null;
    }

    const [, dia, mes, ano, hora, minuto, segundo] =
        resultado;

    const data = new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(hora),
        Number(minuto),
        Number(segundo)
    );

    if (
        data.getFullYear() !== Number(ano) ||
        data.getMonth() !== Number(mes) - 1 ||
        data.getDate() !== Number(dia) ||
        data.getHours() !== Number(hora) ||
        data.getMinutes() !== Number(minuto) ||
        data.getSeconds() !== Number(segundo)
    ) {
        return null;
    }

    return data;
}

// ========================================
// OPERADOR
// ========================================

function extrairOperador(relato) {
    const resultado = String(relato ?? "").match(
        /»\s*Pl:\s*(.+?)\s+Conclu[ií]da\s+em:/i
    );

    return resultado
        ? resultado[1].trim()
        : null;
}

// ========================================
// CLIENTE
// ========================================

function extrairCliente(documento) {
    const celulas = Array.from(
        documento.querySelectorAll("td")
    );

    for (const celula of celulas) {
        const texto = textoCelula(celula);

        const resultado = texto.match(
            /Cliente:\s*(\d+)\s*-\s*([\s\S]*?)(?=Tipos Ocorr[eê]ncias:|De \d{2}\/\d{2}\/\d{4}|$)/i
        );

        if (resultado) {
            return {
                codigo: resultado[1].trim(),
                nome: resultado[2]
                    .replace(/\s+/g, " ")
                    .trim()
            };
        }
    }

    return {
        codigo: null,
        nome: "Cliente não identificado"
    };
}

// ========================================
// LEITURA DO SETOR
// ========================================

function extrairSetor(textos) {
    const primeiroValor = textos[0] || "";

    if (/^\d+$/.test(primeiroValor)) {
        return Number(primeiroValor);
    }

    // Setor vazio é preservado como null.
    // Na auditoria, será tratado como setor 0.
    return null;
}

// ========================================
// EXTRAÇÃO DO RELATO
// ========================================

function separarDescricaoRelato(texto) {
    const linhas = String(texto ?? "")
        .replace(/\r/g, "")
        .split("\n");

    const descricao = (linhas.shift() || "").trim();

    return {
        descricao,
        relato: linhas.join("\n").trim()
    };
}

// ========================================
// PARSER PRINCIPAL
// ========================================

export function parserRondas(html) {

    if (typeof html !== "string" || !html.trim()) {
        throw new Error(
            "O conteúdo HTML está vazio ou é inválido."
        );
    }

    const documento = new DOMParser().parseFromString(
        html,
        "text/html"
    );

    const cliente = extrairCliente(documento);

    const linhas = Array.from(
        documento.querySelectorAll("table tr")
    );

    const eventos = [];

    let dataHoraAtual = null;
    let setorAtual = null;

    let aguardandoSetor = false;
    let aguardandoOcorrencia = false;

    // ====================================
    // PERCORRER TODAS AS PÁGINAS
    // ====================================

    for (const linha of linhas) {

        const celulas = Array.from(
            linha.querySelectorAll(":scope > td")
        );

        if (!celulas.length) {
            continue;
        }

        const textos = celulas.map(textoCelula);

        const textosPreenchidos = textos.filter(Boolean);

        const textoLinha = textosPreenchidos.join(" ");

        const textoNormalizado = normalizarTexto(
            textoLinha
        );

        // =================================
        // NOVO REGISTRO: DATA / HORA
        // =================================

        if (
            textoNormalizado.includes("DATA / HORA:")
        ) {
            const resultado = textoLinha.match(
                /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/
            );

            if (resultado) {
                dataHoraAtual = resultado[0];
                setorAtual = null;
            }

            aguardandoSetor = false;
            aguardandoOcorrencia = false;

            continue;
        }

        // =================================
        // CABEÇALHO DO SETOR
        // =================================

        if (
            textoNormalizado.includes(
                "SETOR / USUARIO / COMPLEMENTO"
            )
        ) {
            aguardandoSetor = true;
            aguardandoOcorrencia = false;

            continue;
        }

        // =================================
        // VALOR DO SETOR
        // =================================

        if (aguardandoSetor) {

            // Mesmo que todas as células estejam
            // vazias, esta linha representa
            // o valor do setor no FastReport.

            setorAtual = extrairSetor(
                textosPreenchidos
            );

            aguardandoSetor = false;

            continue;
        }

        // =================================
        // CABEÇALHO DA OCORRÊNCIA
        // =================================

        if (textoNormalizado === "OCORRENCIA") {
            aguardandoOcorrencia = true;
            continue;
        }

        // =================================
        // DESCRIÇÃO DO EVENTO
        // =================================

        if (aguardandoOcorrencia) {

            // Ignorar linhas vazias, rodapés
            // e elementos de paginação.
            if (!textoNormalizado) {
                continue;
            }

            if (
                /^\d+\s*\/\s*\d+$/.test(
                    textoNormalizado
                )
            ) {
                continue;
            }

            const celulaEvento = textosPreenchidos.find(
                texto => identificarTipo(texto)
            );

            if (!celulaEvento) {
                // Pode ser uma linha intermediária
                // na quebra de página.
                continue;
            }

            const tipo = identificarTipo(
                celulaEvento
            );

            const conteudo = separarDescricaoRelato(
                celulaEvento
            );

            const evento = {
                id: eventos.length + 1,

                codigoCliente: cliente.codigo,
                nomeCliente: cliente.nome,

                dataHora: dataHoraAtual,
                data: extrairData(dataHoraAtual),

                setor: setorAtual,

                descricao: conteudo.descricao,
                tipo,

                falha: tipo === "FALHA",

                relato: conteudo.relato,

                operador: extrairOperador(
                    conteudo.relato
                )
            };

            eventos.push(evento);

            aguardandoOcorrencia = false;

            continue;
        }
    }

    // ====================================
    // ORDENAR CRONOLOGICAMENTE
    // ====================================

    eventos.sort((a, b) => {

        const tempoA = a.data
            ? a.data.getTime()
            : Number.MAX_SAFE_INTEGER;

        const tempoB = b.data
            ? b.data.getTime()
            : Number.MAX_SAFE_INTEGER;

        return tempoA - tempoB || a.id - b.id;
    });

    // ====================================
    // IDENTIFICAR FALHAS
    // ====================================

    const falhas = eventos.filter(
        evento => evento.falha
    );

    // ====================================
    // DIAGNÓSTICO
    // ====================================

    console.log(
        "[RONDAS] Eventos identificados:",
        eventos.length
    );

    console.log(
        "[RONDAS] Falhas identificadas:",
        falhas.length
    );

    return {
        cliente,
        totalEventos: eventos.length,
        totalFalhas: falhas.length,
        eventos,
        falhas
    };
}
