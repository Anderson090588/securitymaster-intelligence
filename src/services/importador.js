import { parserCadastro } from "./parserCadastro.js";

export function importarCadastro() {

    const input = document.getElementById("arquivoCadastro");

    if (!input.files.length) {

        alert("Selecione um arquivo HTML.");

        return;

    }

    const arquivo = input.files[0];

    const leitor = new FileReader();

    leitor.onload = function (evento) {

        const conteudo = evento.target.result;

        console.log("Conteúdo carregado com sucesso!");

        const parser = new DOMParser();

const documento = parser.parseFromString(
    conteudo,
    "text/html"
);

const tabelas = documento.querySelectorAll("table");

console.log("Quantidade de tabelas:", tabelas.length);

        console.log("=================================");
        console.log("Arquivo carregado");
        console.log("=================================");

        console.log("Nome:", arquivo.name);

        console.log("Tamanho:", arquivo.size, "bytes");

        console.log("Quantidade de caracteres:", conteudo.length);

console.log("=================================");
console.log("INÍCIO DO HTML");
console.log("=================================");

console.log(conteudo.substring(0, 1000));

parserCadastro(conteudo);

    };

    leitor.readAsText(arquivo);

}