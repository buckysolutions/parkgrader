import * as dns from "node:dns/promises";
import type { DNSCheckResult } from "./types";

/**
 * Check whether a domain resolves via DNS.
 *
 * Uses the system resolver with a 10-second timeout.
 */
export async function checkDNS(domain: string): Promise<DNSCheckResult> {
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  try {
    const addresses = await withTimeout(dns.resolve(clean), 10_000);

    return {
      resolves: addresses.length > 0,
      addresses,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown DNS error";
    return {
      resolves: false,
      addresses: [],
      error: message,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DNS timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
