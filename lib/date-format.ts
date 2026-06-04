function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatDateDdMmYyyy(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatDateTimeDdMmYyyy(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );

  if (match) {
    const [, year, month, day, hours = "00", minutes = "00"] = match;
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
