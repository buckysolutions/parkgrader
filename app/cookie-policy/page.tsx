import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | ParkGrader",
};

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold tracking-tight text-[#0A1628]">{number}. {title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-[#3A4B5C]">{children}</div>
  </section>
);

export default function CookiePolicyPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight text-[#0A1628]">Cookie Policy</h1>
          <p className="mt-2 text-sm text-[#8C97A8]">Effective Date: July 7, 2026</p>
          <div className="mt-10 space-y-8">
            <Section number="1" title="Introduction">
              <p>This Cookie Policy explains how <strong>Bucky Solutions LLC</strong> (&ldquo;Bucky Solutions,&rdquo; &ldquo;ParkGrader,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) uses cookies and similar technologies when you visit <strong>https://parkgrader.com</strong> or use any ParkGrader services.</p>
              <p>By continuing to use ParkGrader, you consent to the use of cookies as described in this Cookie Policy, except where your browser settings or applicable law provide otherwise.</p>
            </Section>
            <Section number="2" title="What Are Cookies?">
              <p>Cookies are small text files placed on your device by websites you visit. They help websites remember information about your visit, improve functionality, enhance security, and provide a better user experience.</p>
              <p>Cookies do not typically contain information that personally identifies you, but information we store about you may be linked to information stored in cookies.</p>
            </Section>
            <Section number="3" title="Types of Cookies We Use">
              <p><strong>Essential Cookies</strong> &mdash; necessary for ParkGrader to function properly. They maintain website functionality, improve security, prevent abuse, load website content correctly, and remember basic preferences. These cookies cannot generally be disabled without affecting the website.</p>
              <p><strong>Performance Cookies</strong> &mdash; help us understand how visitors interact with ParkGrader. They collect pages visited, time spent, navigation patterns, error messages, and performance metrics. This information is aggregated whenever possible.</p>
              <p><strong>Analytics Cookies</strong> &mdash; help us understand browser type, device type, operating system, approximate geographic region, referring websites, visit duration, pages viewed, and website interactions.</p>
              <p><strong>Functional Cookies</strong> &mdash; remember user preferences such as interface preferences, accessibility settings, previously selected options, and language preferences.</p>
            </Section>
            <Section number="4" title="Third-Party Cookies">
              <p>Certain trusted third-party service providers may place cookies through ParkGrader to provide services such as website hosting, performance monitoring, analytics, error reporting, content delivery, and security.</p>
              <p>These third parties maintain their own privacy practices and cookie policies.</p>
            </Section>
            <Section number="5" title="How We Use Cookie Information">
              <p>Information collected through cookies may be used to: improve website performance, monitor service reliability, analyze usage trends, diagnose technical issues, improve security, detect abuse, measure feature usage, and improve the overall ParkGrader experience.</p>
            </Section>
            <Section number="6" title="Managing Cookies">
              <p>Most web browsers allow you to view stored cookies, delete cookies, block cookies, restrict certain cookies, and configure cookie preferences.</p>
              <p>Please note that disabling cookies may affect the functionality and performance of ParkGrader.</p>
            </Section>
            <Section number="7" title="Do Not Track">
              <p>Some browsers provide a &ldquo;Do Not Track&rdquo; feature. Because there is currently no universally accepted standard governing Do Not Track signals, ParkGrader does not currently respond differently to such signals.</p>
            </Section>
            <Section number="8" title="Changes to this Cookie Policy">
              <p>We may update this Cookie Policy from time to time. When changes are made, the updated version will be posted on ParkGrader with a revised Effective Date.</p>
              <p>Continued use of ParkGrader after changes become effective constitutes acceptance of the revised Cookie Policy.</p>
            </Section>
            <Section number="9" title="Contact Us">
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
