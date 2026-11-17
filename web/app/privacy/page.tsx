export const metadata = { title: 'Privacy policy · Lumo' };

// Draft for the pilot. Needs a legal review against the Privacy Act 1988 (APPs) and the NSW
// Residential Tenancies Amendment (Protection of Personal Information) Act once it commences.
export default function Privacy() {
  return (
    <main className="wrap stack">
      <a className="logo" href="/"><i />Lumo</a>
      <h1>Privacy policy</h1>
      <p className="notice warn">Pilot draft, last updated 17 November 2026. To be reviewed by a lawyer before public launch.</p>
      <h2>The short version</h2>
      <p>Lumo checks who you are and whether you can afford a place, then shows agents the result as a badge. We do not keep your ID images, bank account numbers or transactions. You can see and delete everything we hold about you from your profile at any time.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> your name and email.</li>
        <li><b>Rental preferences:</b> move-in date, number of people, pets, max rent, and a commute place you choose. For investors: budget, property type and strategy.</li>
        <li><b>Verification results:</b> pass or fail, a band (for example a weekly income band or “bond ready”), the date, and the provider’s reference number. The ID check and the bank connection happen on the provider’s own secure page; the images and bank data stay with them.</li>
        <li><b>References:</b> the past address and your referee’s email, encrypted, until they answer. Then the email is deleted.</li>
        <li><b>Activity:</b> which homes you liked, passed or saved, your matches and inspections.</li>
      </ul>
      <h2>What we never collect</h2>
      <p>Photos of you, social media, details about children, appearance, or anything the NSW standard application form doesn’t allow. Agents can’t filter or rank people on protected attributes.</p>
      <h2>Who sees what</h2>
      <p>An agent sees your first name, badges, move-in date, number of people and pets only after you like one of their listings. Agents can only ever see people who liked their own agency’s listings; the database enforces this. When an agent sends you the application, you choose what goes on it. Photo ID is only asked for if you are the preferred applicant, before the lease is signed.</p>
      <h2>Service providers</h2>
      <p>Identity checks: a Document Verification Service gateway. Income and bond checks: an accredited Consumer Data Right open-banking provider (read-only, with your consent). Property and suburb data: Microburbs. Email: a transactional email service. Payments by agencies: Stripe. Renters never pay.</p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Income and bond badges expire after 30 days, ID after 12 months. You can refresh them in one tap.</li>
        <li>Accounts inactive for 12 months are deleted.</li>
        <li>Match records are deleted after 2 years.</li>
        <li>Unanswered reference requests close after 30 days and the referee’s email is wiped.</li>
        <li>Any manual upload (fallback only) is encrypted, read once, and deleted within 24 hours.</li>
      </ul>
      <h2>Your rights</h2>
      <p>From your profile you can download a copy of your data and delete your account. To correct something or complain, email privacy@lumo.example. If you are not happy with our answer you can complain to the OAIC.</p>
      <h2>Security and breaches</h2>
      <p>Data is encrypted in transit and at rest; the most sensitive fields are encrypted again. If a breach is likely to cause serious harm, we will tell affected people and the OAIC under the Notifiable Data Breaches scheme.</p>
      <h2>Investor data</h2>
      <p>Yields and growth figures are estimates from Microburbs data, shown with their date. They are not financial advice.</p>
    </main>
  );
}
