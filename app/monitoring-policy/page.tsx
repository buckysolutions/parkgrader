import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Website Health Monitoring Policy | ParkGrader",
};

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold tracking-tight text-[#0A1628]">{number}. {title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-[#3A4B5C]">{children}</div>
  </section>
);

export default function MonitoringPolicyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <header className="border-b border-[#E6EBF0] bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <a href="/" className="flex items-center gap-2">
            <img src="https://assets.buckysolutions.com/parkgrader_logo.svg" alt="ParkGrader" className="h-7 w-auto" />
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0A1628]">Website Health Monitoring Policy</h1>
          <p className="mt-2 text-sm text-[#8C97A8]">Effective Date: July 7, 2026</p>
          <div className="mt-10 space-y-8">
            <Section number="1" title="Overview">
              <p>Website Health Monitoring is a core feature of ParkGrader, operated by <strong>Bucky Solutions LLC</strong>.</p>
              <p>This policy explains how Website Health Monitoring works, what information we collect, how monitoring is performed, and what you can expect from the service.</p>
              <p>Website Health Monitoring is designed to help website owners identify operational issues affecting the availability and health of publicly accessible websites.</p>
            </Section>
            <Section number="2" title="Authorization">
              <p>By submitting a website to ParkGrader, you authorize Bucky Solutions LLC to periodically access publicly available portions of the submitted website for the purpose of providing Website Health Monitoring.</p>
              <p>Monitoring is performed using automated systems that simulate standard web requests similar to those made by common web browsers.</p>
              <p>Monitoring is limited to publicly accessible resources.</p>
            </Section>
            <Section number="3" title="What We Monitor">
              <p>Depending on the features available, Website Health Monitoring may include:</p>
              <p><strong>Website Availability</strong> &mdash; We verify whether your website is reachable and responding to requests.</p>
              <p><strong>Homepage Monitoring</strong> &mdash; We monitor the availability and response status of your homepage.</p>
              <p><strong>Booking Page Monitoring</strong> &mdash; Where applicable, we verify that booking or reservation pages remain publicly accessible and respond successfully.</p>
              <p><strong>SSL Certificates</strong> &mdash; We monitor SSL/TLS certificates for validity, expiration dates, certificate errors, and security issues that prevent secure connections.</p>
              <p><strong>DNS Health</strong> &mdash; We monitor basic DNS resolution to identify issues affecting website accessibility.</p>
              <p><strong>Website Performance</strong> &mdash; We may collect response time, initial page load time, HTTP response codes, redirect behavior, and availability history.</p>
              <p><strong>Website Health Score</strong> &mdash; ParkGrader may generate a Website Health Score based on monitored operational data. Scores are informational only and may change as monitoring results change.</p>
              <p><strong>Incident Detection</strong> &mdash; ParkGrader may detect and record incidents including: website outages, booking page failures, SSL certificate expiration, DNS failures, server errors, unexpected redirects, and significant performance degradation.</p>
            </Section>
            <Section number="4" title="Monitoring Frequency">
              <p>Monitoring intervals may vary depending on system load, available resources, subscription level, maintenance windows, and service configuration.</p>
              <p>Monitoring schedules are not guaranteed.</p>
            </Section>
            <Section number="5" title="Verification of Incidents">
              <p>To reduce false positives, ParkGrader may perform additional verification before recording an incident or sending notifications.</p>
              <p>Temporary network interruptions or third-party outages may not immediately generate an incident.</p>
            </Section>
            <Section number="6" title="Email Notifications">
              <p>Where enabled, ParkGrader may send notifications relating to: website downtime, booking page failures, SSL certificate expiration, DNS issues, website recovery, and other significant operational events.</p>
              <p>Monitoring notification emails are optional. Recipients may unsubscribe at any time using the unsubscribe link contained within the email or by contacting us. Certain administrative communications may continue to be sent where required.</p>
            </Section>
            <Section number="7" title="Monitoring Limitations">
              <p>Website Health Monitoring is intended to provide operational insights. It does <strong>not</strong> guarantee continuous website availability, continuous monitoring without interruption, detection of every outage, detection of every website issue, detection of every performance problem, or detection of every security issue.</p>
              <p>Monitoring results should not be considered a substitute for proper website administration or maintenance.</p>
            </Section>
            <Section number="8" title="What We Do Not Monitor">
              <p>Unless separately agreed in writing, ParkGrader does <strong>not</strong> perform: penetration testing, vulnerability exploitation, password testing, brute force attacks, authentication bypass attempts, malware removal, server administration, source code review, private application testing, or internal network assessments.</p>
              <p>Website Health Monitoring only accesses publicly available portions of submitted websites.</p>
            </Section>
            <Section number="9" title="Accuracy of Monitoring">
              <p>Although ParkGrader strives to provide accurate monitoring results, no monitoring platform can detect every issue or guarantee complete accuracy. Results may occasionally be affected by internet routing, third-party hosting providers, CDN services, DNS propagation, temporary outages, browser differences, or maintenance windows.</p>
            </Section>
            <Section number="10" title="Availability of the Monitoring Service">
              <p>Website Health Monitoring is provided on a best-effort basis.</p>
              <p>Monitoring services may be interrupted due to maintenance, software updates, infrastructure changes, internet outages, or circumstances beyond our control.</p>
            </Section>
            <Section number="11" title="Historical Data">
              <p>ParkGrader may retain monitoring history, incident history, response time metrics, uptime statistics, and other operational data to improve reporting and provide historical insights.</p>
              <p>Historical data may be removed at our discretion.</p>
            </Section>
            <Section number="12" title="Suspension or Discontinuation">
              <p>We reserve the right to modify, suspend, limit, or discontinue Website Health Monitoring at any time without prior notice.</p>
            </Section>
            <Section number="13" title="Opting Out">
              <p>Website Health Monitoring is included as part of the ParkGrader service.</p>
              <p>If you no longer wish for your website to be monitored, you may request that monitoring be discontinued by contacting <a href="mailto:legal@buckysolutions.com" className="text-[#2DA4A9] hover:underline">legal@buckysolutions.com</a>. Please allow a reasonable period of time for processing your request.</p>
            </Section>
            <Section number="14" title="Changes to this Policy">
              <p>We may update this Website Health Monitoring Policy from time to time. Any changes become effective upon publication unless otherwise stated. Continued use of ParkGrader constitutes acceptance of the updated policy.</p>
            </Section>
            <Section number="15" title="Contact Information">
              <div className="rounded-xl bg-gray-50 p-4 text-sm leading-relaxed">
                <p className="font-medium text-[#0A1628]">Bucky Solutions LLC</p>
                <p>7901 4th St N, Suite 300</p>
                <p>St. Petersburg, Florida 33702</p>
                <p>United States</p>
                <p className="mt-1">Email: <a href="mailto:legal@buckysolutions.com" className="text-[#2DA4A9] hover:underline">legal@buckysolutions.com</a></p>
                <p>Website: <a href="https://parkgrader.com" className="text-[#2DA4A9] hover:underline">https://parkgrader.com</a></p>
              </div>
            </Section>
          </div>
      </main>
      <footer className="border-t border-[#E6EBF0] bg-white py-6 text-center">
        <p className="text-xs text-[#8C97A8]">&copy; {new Date().getFullYear()} Bucky Solutions LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}
