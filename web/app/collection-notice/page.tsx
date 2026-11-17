export const metadata = { title: 'Collection notice · Lumo' };

export default function CollectionNotice() {
  return (
    <main className="wrap stack">
      <a className="logo" href="/"><i />Lumo</a>
      <h1>Collection notice</h1>
      <p>Lumo collects your name, email, rental preferences and the <b>results</b> of identity, income, bond and reference checks so that agents can trust your enquiry without you sending them documents.</p>
      <p>If you don’t give us this information, you can still browse homes but you can’t like a listing or match with an agent.</p>
      <p>We disclose your first name, badges, move-in date, number of people and pets to the agency of a listing you like. We use providers to run the checks (a DVS gateway and an open-banking provider), Microburbs for property data, an email service and Stripe for agency billing. We host your data in an Australian region.</p>
      <p>See the <a href="/privacy">privacy policy</a> for how to access, correct or delete your data, and how to complain.</p>
    </main>
  );
}
