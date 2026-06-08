export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

export function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

export function formatCpfOrCnpj(value: string) {
  return onlyDigits(value).length <= 11 ? formatCpf(value) : formatCnpj(value);
}

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^(\(\d{2}\) \d{4})(\d)/, '$1-$2');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^(\(\d{2}\) \d{5})(\d)/, '$1-$2');
}

export function validateCpfOrCnpj(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return '';
  }

  if (digits.length !== 11 && digits.length !== 14) {
    return digits.length <= 11
      ? 'CPF deve conter 11 digitos.'
      : 'CNPJ deve conter 14 digitos.';
  }

  if (digits.length === 11 && !isValidCpf(digits)) {
    return 'CPF invalido.';
  }

  if (digits.length === 14 && !isValidCnpj(digits)) {
    return 'CNPJ invalido.';
  }

  return '';
}

export function validateCnpj(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return '';
  }

  if (digits.length !== 14) {
    return 'CNPJ deve conter 14 digitos.';
  }

  return isValidCnpj(digits) ? '' : 'CNPJ invalido.';
}

export function validatePhone(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return '';
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return 'Telefone deve conter DDD e numero completo.';
  }

  if (digits.length === 11 && digits[2] !== '9') {
    return 'Celular deve conter 11 digitos com DDD e nono digito.';
  }

  return '';
}

export function generateValidCpf() {
  const base = Array.from({ length: 9 }, () => randomDigit()).join('');
  const firstDigit = calculateCpfDigit(base);
  const secondDigit = calculateCpfDigit(`${base}${firstDigit}`);

  return `${base}${firstDigit}${secondDigit}`;
}

export function generateValidCnpj() {
  const base = Array.from({ length: 12 }, () => randomDigit()).join('');
  const firstDigit = calculateCnpjDigit(base);
  const secondDigit = calculateCnpjDigit(`${base}${firstDigit}`);

  return `${base}${firstDigit}${secondDigit}`;
}

function randomDigit() {
  return Math.floor(Math.random() * 10);
}

function isValidCpf(value: string) {
  if (/^(\d)\1{10}$/.test(value)) {
    return false;
  }

  const firstDigit = calculateCpfDigit(value.slice(0, 9));
  const secondDigit = calculateCpfDigit(`${value.slice(0, 9)}${firstDigit}`);

  return value === `${value.slice(0, 9)}${firstDigit}${secondDigit}`;
}

function isValidCnpj(value: string) {
  if (/^(\d)\1{13}$/.test(value)) {
    return false;
  }

  const firstDigit = calculateCnpjDigit(value.slice(0, 12));
  const secondDigit = calculateCnpjDigit(`${value.slice(0, 12)}${firstDigit}`);

  return value === `${value.slice(0, 12)}${firstDigit}${secondDigit}`;
}

function calculateCpfDigit(base: string) {
  const sum = base
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (base.length + 1 - index), 0);
  const rest = (sum * 10) % 11;

  return rest === 10 ? 0 : rest;
}

function calculateCnpjDigit(base: string) {
  const weights =
    base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = base
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const rest = sum % 11;

  return rest < 2 ? 0 : 11 - rest;
}
