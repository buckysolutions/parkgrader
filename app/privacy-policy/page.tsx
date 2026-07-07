import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ParkGrader",
};

const Section = ({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold tracking-tight text-[#0A1628]">
      {number}. {title}
    </h2>
    <div className="space-y-3 text-sm leading-relaxed text-[#3A4B5C]">{children}</div>
  </section>
);

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      {/* Header */}
      <header className="border-b border-[#E6EBF0] bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <a href="/" className="flex items-center gap-2">
            <img
              src="https://assets.buckysolutions.com/parkgrader_logo.svg"
              alt="ParkGrader"
              className="h-7 w-auto"
            />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0A1628]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[#8C97A8]">
          Effective Date: July 7, 2026
        </p>

        <div className="mt-10 space-y-8">
            {/* 1. Introduction */}
            <Section number="1" title="Introduction">
              <p>
                Welcome to ParkGrader (&ldquo;ParkGrader,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), a service operated by{" "}
                <strong>Bucky Solutions LLC</strong>.
              </p>
              <div className="rounded-xl bg-gray-50 p-4 text-sm leading-relaxed">
                <p className="font-medium text-[#0A1628]">Bucky Solutions LLC</p>
                <p>7901 4th St N, Suite 300</p>
                <p>St. Petersburg, Florida 33702</p>
                <p>United States</p>
                <p className="mt-1">
                  Email:{" "}
                  <a href="mailto:legal@buckysolutions.com" className="text-[#2DA4A9] hover:underline">
                    legal@buckysolutions.com
                  </a>
                </p>
              </div>
              <p>
                This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use ParkGrader and related services.
              </p>
              <p>
                By using ParkGrader, you acknowledge that you have read and understood this Privacy Policy.
              </p>
            </Section>

            {/* 2. Information We Collect */}
            <Section number="2" title="Information We Collect">
              <p>When you submit a website to ParkGrader, we may collect information including:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Name</li>
                <li>Email address</li>
                <li>Company or organization name</li>
                <li>Website URL</li>
                <li>Domain name</li>
                <li>IP address</li>
                <li>Browser type</li>
                <li>Device information</li>
                <li>Operating system</li>
                <li>Referring website</li>
                <li>Usage data</li>
                <li>Website audit results</li>
                <li>Website monitoring history</li>
              </ul>
              <p>
                We may also collect information automatically through cookies, analytics tools, server logs, and similar technologies.
              </p>
            </Section>

            {/* 3. Website Health Monitoring */}
            <Section number="3" title="Website Health Monitoring">
              <p>
                One of ParkGrader&rsquo;s primary features is continuous Website Health Monitoring.
              </p>
              <p>
                By submitting a website to ParkGrader, you authorize Bucky Solutions LLC to periodically access publicly available portions of the submitted website for operational monitoring purposes.
              </p>
              <p>Monitoring may include:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Website availability</li>
                <li>Homepage response status</li>
                <li>Booking page availability</li>
                <li>HTTP response codes</li>
                <li>SSL certificate validation</li>
                <li>SSL expiration monitoring</li>
                <li>DNS resolution</li>
                <li>Website response times</li>
                <li>Website performance metrics</li>
                <li>Historical uptime tracking</li>
                <li>Incident history</li>
                <li>Website health scoring</li>
              </ul>
              <p>Monitoring only accesses publicly available resources.</p>
              <p>
                ParkGrader does <strong>not</strong> attempt to bypass authentication, gain unauthorized access, exploit vulnerabilities, or perform penetration testing unless separately authorized in writing.
              </p>
              <p>Website monitoring continues until:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>monitoring is disabled by ParkGrader,</li>
                <li>the monitored website is removed from our systems, or</li>
                <li>the website owner requests that monitoring cease.</li>
              </ul>
              <p>
                Monitoring notification emails are optional and may be disabled by the recipient.
              </p>
            </Section>

            {/* 4. How We Use Information */}
            <Section number="4" title="How We Use Information">
              <p>We use collected information to:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Generate website audits</li>
                <li>Provide website health monitoring</li>
                <li>Improve ParkGrader</li>
                <li>Detect website issues</li>
                <li>Notify users of significant website incidents</li>
                <li>Improve service reliability</li>
                <li>Maintain historical monitoring data</li>
                <li>Respond to inquiries</li>
                <li>Comply with legal obligations</li>
              </ul>
            </Section>

            {/* 5. Cookies */}
            <Section number="5" title="Cookies">
              <p>ParkGrader may use cookies and similar technologies to:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Remember preferences</li>
                <li>Improve performance</li>
                <li>Analyze traffic</li>
                <li>Secure the platform</li>
                <li>Measure usage</li>
              </ul>
              <p>
                Users may disable cookies through their browser settings, although certain functionality may become unavailable.
              </p>
            </Section>

            {/* 6. Third-Party Services */}
            <Section number="6" title="Third-Party Services">
              <p>
                ParkGrader may utilize trusted third-party providers to operate the service, including cloud infrastructure, analytics, email delivery, and website hosting providers.
              </p>
              <p>
                These providers may process information solely for the purpose of providing services to ParkGrader and are contractually required to safeguard information in accordance with applicable law.
              </p>
            </Section>

            {/* 7. Data Retention */}
            <Section number="7" title="Data Retention">
              <p>We retain information only as long as reasonably necessary to:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>provide ParkGrader services,</li>
                <li>maintain historical monitoring records,</li>
                <li>comply with legal obligations,</li>
                <li>resolve disputes,</li>
                <li>enforce our agreements.</li>
              </ul>
              <p>
                Website monitoring history may be retained for historical reporting and service improvement purposes.
              </p>
            </Section>

            {/* 8. Data Security */}
            <Section number="8" title="Data Security">
              <p>
                We implement commercially reasonable administrative, technical, and physical safeguards designed to protect information against unauthorized access, disclosure, alteration, or destruction.
              </p>
              <p>
                No method of electronic storage or internet transmission is completely secure, and we cannot guarantee absolute security.
              </p>
            </Section>

            {/* 9. Email Communications */}
            <Section number="9" title="Email Communications">
              <p>ParkGrader may send emails regarding:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Website audit results</li>
                <li>Website health incidents</li>
                <li>SSL expiration</li>
                <li>Booking page availability</li>
                <li>Service announcements</li>
                <li>Operational notifications</li>
              </ul>
              <p>
                Users may opt out of non-essential monitoring notification emails using the unsubscribe mechanism contained within such emails or by contacting us.
              </p>
              <p>
                Certain administrative or legally required communications cannot be opted out of while a service relationship exists.
              </p>
            </Section>

            {/* 10. Children's Privacy */}
            <Section number="10" title="Children&rsquo;s Privacy">
              <p>
                ParkGrader is not directed to individuals under the age of 13, and we do not knowingly collect personal information from children.
              </p>
            </Section>

            {/* 11. International Users */}
            <Section number="11" title="International Users">
              <p>ParkGrader is operated from the United States.</p>
              <p>
                If you access the service from another country, you understand that your information may be transferred to and processed in the United States.
              </p>
            </Section>

            {/* 12. Your Rights */}
            <Section number="12" title="Your Rights">
              <p>Depending on applicable law, you may have rights to:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Access your information</li>
                <li>Request corrections</li>
                <li>Request deletion</li>
                <li>Object to certain processing</li>
                <li>Request restriction of processing</li>
                <li>Request cessation of website monitoring</li>
                <li>Opt out of optional monitoring notifications</li>
              </ul>
              <p>
                Requests may be submitted to:{" "}
                <a href="mailto:legal@buckysolutions.com" className="text-[#2DA4A9] hover:underline">
                  legal@buckysolutions.com
                </a>
              </p>
            </Section>

            {/* 13. Changes */}
            <Section number="13" title="Changes to this Privacy Policy">
              <p>We may modify this Privacy Policy from time to time.</p>
              <p>
                The updated version will be posted on ParkGrader with a revised Effective Date.
              </p>
              <p>
                Continued use of ParkGrader after changes become effective constitutes acceptance of the revised Privacy Policy.
              </p>
            </Section>

            {/* 14. Contact */}
            <Section number="14" title="Contact">
              <p>Questions regarding this Privacy Policy may be directed to:</p>
              <div className="rounded-xl bg-gray-50 p-4 text-sm leading-relaxed">
                <p className="font-medium text-[#0A1628]">Bucky Solutions LLC</p>
                <p>7901 4th St N, Suite 300</p>
                <p>St. Petersburg, Florida 33702</p>
                <p>United States</p>
                <p className="mt-1">
                  Email:{" "}
                  <a href="mailto:legal@buckysolutions.com" className="text-[#2DA4A9] hover:underline">
                    legal@buckysolutions.com
                  </a>
                </p>
              </div>
            </Section>
          </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E6EBF0] bg-white py-6 text-center">
        <p className="text-xs text-[#8C97A8]">
          &copy; {new Date().getFullYear()} Bucky Solutions LLC. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
