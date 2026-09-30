/**
 * Navegação dura (recarrega a página), num módulo próprio só para o teste
 * poder conferir o destino: o jsdom não implementa navegação e não deixa
 * trocar o `window.location`.
 */
export function navegarPara(url: string): void {
  window.location.href = url;
}
