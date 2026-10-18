export class DataPrivacyGuard {
  mask(value: string) { return value.replace(/.(?=.{4})/g, '*'); }
}
