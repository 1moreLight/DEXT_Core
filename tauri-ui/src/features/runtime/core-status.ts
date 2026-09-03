export function isCoreUnavailable(error: string | null | undefined): boolean {
  return Boolean(error && /pipe|connect|unavailable|not running|退出|断开|未运行/i.test(error));
}
