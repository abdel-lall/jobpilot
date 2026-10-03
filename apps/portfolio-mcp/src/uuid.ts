const lowercaseUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isLowercaseUuid(value: string): boolean {
  return lowercaseUuid.test(value);
}
