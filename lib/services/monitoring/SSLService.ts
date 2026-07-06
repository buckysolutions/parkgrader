import * as tls from "node:tls";
import type { SSLCheckResult } from "./types";

/**
 * Check an SSL/TLS certificate for a domain.
 *
 * Connects on port 443, retrieves the peer certificate, and computes
 * days until expiration. Wraps the entire operation in a 10-second
 * timeout so a dead server does not block the monitoring loop.
 */
export async function checkSSLCertificate(domain: string): Promise<SSLCheckResult> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || !cert.valid_to) {
          resolve({
            valid: false,
            daysRemaining: 0,
            error: "No certificate presented",
          });
          return;
        }

        const expiry = new Date(cert.valid_to).getTime();
        const now = Date.now();
        const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        resolve({
          valid: daysRemaining > 0,
          daysRemaining,
          issuer: (cert.issuer?.O ?? cert.issuer?.CN) as string | undefined,
        });
      },
    );

    socket.on("error", (err) => {
      socket.destroy();
      resolve({
        valid: false,
        daysRemaining: 0,
        error: err.message,
      });
    });

    // 10-second safety timeout.
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({
        valid: false,
        daysRemaining: 0,
        error: "SSL check timed out after 10s",
      });
    }, 10_000);

    socket.on("close", () => clearTimeout(timer));
  });
}
