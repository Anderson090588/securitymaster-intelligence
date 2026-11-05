import banco from "../database/database.js";

export function parserCadastro(html) {

    console.log("=================================");
    console.log("PARSER INICIADO");
    console.log("=================================");

    const partes = html.split("Tipo:");

    console.log("Quantidade de partes:", partes.length);

const indice = html.indexOf("Data Cadastro");

console.log("Posição de 'Data Cadastro':", indice);

console.log("--------------------------------");

console.log(
    html.substring(indice - 500, indice + 1000)
);

    console.log(partes[1].substring(0, 1000));

    console.log("Clientes no banco:", banco.clientes.length);

}