import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ParkGrader",
};

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold tracking-tight text-[#0A1628]">{number}. {title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-[#3A4B5C]">{children}</div>
  </section>
);

export default function TermsPage() {
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
        <div className="glass-card rounded-2xl bg-white p-8 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0A1628]">Terms of Service</h1>
          <p className="mt-2 text-sm text-[#8C97A8]">Effective Date: July 7, 2026</p>
          <div className="mt-10 space-y-8">
            <Section number="1" title="Agreement to these Terms">
              <p>These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of ParkGrader (&ldquo;ParkGrader,&rdquo; &ldquo;Service,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), operated by <strong>Bucky Solutions LLC</strong>.</p>
              <p>By accessing or using ParkGrader, submitting a website for analysis, or otherwise using our services, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
            </Section>
            <Section number="2" title="About ParkGrader">
              <p>ParkGrader is a website assessment and website health monitoring platform.</p>
              <p>The Service may provide:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Website audits</li><li>Website health monitoring</li><li>Website availability monitoring</li><li>Booking page monitoring</li><li>SSL certificate monitoring</li><li>DNS monitoring</li><li>Website performance analysis</li><li>Website health scoring</li><li>Website incident tracking</li><li>Reports and recommendations</li>
              </ul>
              <p>ParkGrader is an informational service and does not guarantee the security, performance, availability, or functionality of any website.</p>
            </Section>
            <Section number="3" title="Eligibility">
              <p>You represent that you are at least 18 years of age and have the authority to submit a website to ParkGrader.</p>
              <p>If you submit a website on behalf of a business or organization, you represent that you are authorized to do so.</p>
            </Section>
            <Section number="4" title="Authorization to Monitor">
              <p>By submitting a website to ParkGrader, you authorize Bucky Solutions LLC to periodically access publicly available portions of the submitted website for the purpose of providing Website Health Monitoring.</p>
              <p>Monitoring may include:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Website availability</li><li>Homepage response</li><li>Booking page availability</li><li>Website response times</li><li>HTTP status codes</li><li>SSL certificate validation</li><li>SSL expiration monitoring</li><li>DNS resolution</li><li>Historical uptime tracking</li><li>Incident detection</li><li>Website health scoring</li>
              </ul>
              <p>Monitoring only accesses publicly available resources.</p>
              <p>ParkGrader does not attempt to bypass authentication, gain unauthorized access, exploit vulnerabilities, or perform penetration testing unless separately authorized through a written agreement.</p>
              <p>Monitoring continues until:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>You request that monitoring cease;</li><li>We discontinue the Service; or</li><li>We otherwise terminate monitoring at our discretion.</li>
              </ul>
            </Section>
            <Section number="5" title="Email Notifications">
              <p>ParkGrader may send operational notifications relating to monitored websites, including:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Website downtime</li><li>Booking page failures</li><li>SSL certificate expiration</li><li>DNS issues</li><li>Website health incidents</li><li>Service updates</li>
              </ul>
              <p>Operational notifications may be disabled where permitted. Administrative or legally required communications may still be sent.</p>
            </Section>
            <Section number="6" title="User Responsibilities">
              <p>You agree that:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Information submitted to ParkGrader is accurate.</li><li>You have the authority to submit the website.</li><li>You will not misuse the Service.</li><li>You will not interfere with ParkGrader&rsquo;s operation.</li><li>You will not attempt to access systems you are not authorized to access.</li>
              </ul>
            </Section>
            <Section number="7" title="Intellectual Property">
              <p>All software, reports, scoring methodologies, graphics, trademarks, branding, source code, databases, designs, logos, documentation, and content associated with ParkGrader remain the exclusive property of Bucky Solutions LLC unless otherwise stated.</p>
              <p>Nothing in these Terms transfers ownership of our intellectual property.</p>
            </Section>
            <Section number="8" title="Website Reports">
              <p>Website audits, health scores, grades, recommendations, and monitoring results are provided for informational purposes only.</p>
              <p>Although we strive for accuracy, ParkGrader does not guarantee that every issue affecting a website will be detected. Website owners remain solely responsible for maintaining and securing their websites.</p>
            </Section>
            <Section number="9" title="Availability">
              <p>We strive to keep ParkGrader available at all times but do not guarantee uninterrupted availability.</p>
              <p>Monitoring intervals, uptime statistics, and notification timing are estimates and may vary due to maintenance, outages, internet conditions, or third-party services.</p>
            </Section>
            <Section number="10" title="No Security Guarantee">
              <p>ParkGrader is not a managed security service. Website monitoring should not be interpreted as a guarantee that a website is secure, free of vulnerabilities, malware, or unauthorized access.</p>
              <p>Unless specifically agreed in writing, ParkGrader does not perform penetration testing or security audits.</p>
            </Section>
            <Section number="11" title="Limitation of Liability">
              <p>To the fullest extent permitted by applicable law, Bucky Solutions LLC shall not be liable for any indirect, incidental, consequential, special, exemplary, or punitive damages arising out of or relating to the use of ParkGrader.</p>
              <p>This includes, without limitation: Lost revenue, Lost bookings, Business interruption, Data loss, Website downtime, Loss of goodwill, Loss of profits.</p>
              <p>Our total liability arising from or relating to the Service shall not exceed one hundred U.S. dollars (US $100).</p>
            </Section>
            <Section number="12" title="Disclaimer of Warranties">
              <p>ParkGrader is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis.</p>
              <p>We make no warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, availability, or reliability. Use of ParkGrader is at your own risk.</p>
            </Section>
            <Section number="13" title="Indemnification">
              <p>You agree to defend, indemnify, and hold harmless Bucky Solutions LLC, its owners, employees, contractors, affiliates, and representatives from any claims, damages, liabilities, costs, or expenses arising from:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Your use of the Service;</li><li>Your violation of these Terms;</li><li>Your submission of websites without proper authority; or</li><li>Your violation of applicable law.</li>
              </ul>
            </Section>
            <Section number="14" title="Suspension or Termination">
              <p>We reserve the right to suspend, restrict, or terminate access to ParkGrader at any time, with or without notice, for any reason, including misuse of the Service or violation of these Terms.</p>
            </Section>
            <Section number="15" title="Modifications">
              <p>We may modify these Terms at any time. Updated Terms become effective upon publication unless otherwise stated. Continued use of ParkGrader constitutes acceptance of the revised Terms.</p>
            </Section>
            <Section number="16" title="Governing Law">
              <p>These Terms shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflict of law principles.</p>
              <p>Any legal action relating to these Terms shall be brought exclusively in the state or federal courts located in Florida.</p>
            </Section>
            <Section number="17" title="Severability">
              <p>If any provision of these Terms is determined to be unenforceable, the remaining provisions shall remain in full force and effect.</p>
            </Section>
            <Section number="18" title="Entire Agreement">
              <p>These Terms, together with our Privacy Policy and any other policies incorporated by reference, constitute the entire agreement between you and Bucky Solutions LLC regarding the use of ParkGrader.</p>
            </Section>
            <Section number="19" title="Contact Information">
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
        </div>
      </main>
      <footer className="border-t border-[#E6EBF0] bg-white py-6 text-center">
        <p className="text-xs text-[#8C97A8]">&copy; {new Date().getFullYear()} Bucky Solutions LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}
