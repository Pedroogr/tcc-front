export async function validatePublicEmailDomain(value: string) {
  const { parse } = await import('tldts');
  const result = parse(value);

  if (
    result.domain !== null &&
    result.isIcann === true &&
    result.isIp === false
  ) {
    return '';
  }

  return 'Informe um e-mail com uma extensão válida.';
}
