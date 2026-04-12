export const metadata = {
  title: 'Terms of Service — ConversionSurgery',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto prose prose-slate">
        <h1>ConversionSurgery &mdash; Terms of Service</h1>
        <p className="text-sm text-gray-500">Last updated: April 2026</p>

        <h2>1. Service Description</h2>
        <p>
          ConversionSurgery provides a managed revenue recovery service for renovation contractors.
          The service covers lead response, estimate follow-up, appointment booking, payment collection,
          review generation, and past-client reactivation &mdash; operated and monitored by ConversionSurgery
          on Client&apos;s behalf.
        </p>
        <p>Specifically, the service includes:</p>
        <ul>
          <li><strong>Near-Instant Lead Response</strong> &mdash; Every inquiry (call, text, or web form) receives an automated response during permitted hours.</li>
          <li><strong>AI Conversation Agent</strong> &mdash; An AI configured with Client&apos;s business information that qualifies leads, answers service questions, and books estimate appointments.</li>
          <li><strong>Estimate Follow-Up</strong> &mdash; Multi-touch follow-up sequences triggered when Client flags an estimate as sent.</li>
          <li><strong>Appointment Confirmation and No-Show Recovery</strong> &mdash; Automated reminders before appointments; same-day follow-up if a lead does not appear.</li>
          <li><strong>Payment Collection</strong> &mdash; Automated deposit and invoice reminders with payment links.</li>
          <li><strong>Review Generation</strong> &mdash; Automated review request after each completed job with a direct link to Google.</li>
          <li><strong>Dormant Lead Reactivation</strong> &mdash; Re-engagement of past inquiries and old estimates that went cold.</li>
          <li><strong>Dedicated Business Phone Number and Lead CRM</strong> &mdash; A local phone number and a dashboard showing every lead, conversation, and status.</li>
          <li><strong>Bi-Weekly Performance Reports</strong> &mdash; A report every two weeks showing leads captured, response times, and revenue impact.</li>
          <li><strong>Quarterly Growth Blitz</strong> &mdash; A strategic campaign run every 90 days.</li>
        </ul>

        <h2>2. Service Fee</h2>
        <p>
          <strong>First month free. Then $1,000 per month</strong>, plus applicable taxes.
          Month 1 is provided at no charge. Billing begins on Day 31 of the service start date.
          No setup fee. No message caps. No overage charges.
        </p>
        <p>Optional add-ons (if applicable):</p>
        <ul>
          <li>Additional phone numbers: $15/month each</li>
          <li>Additional team members: $20/month each</li>
        </ul>

        <h2>3. Messaging Scope</h2>
        <p>
          Unlimited lead conversations and automated messaging are included for normal, in-scope
          renovation business use. Excluded uses include mass broadcasting, personal or non-business
          messaging, and use for services or entities outside the contracted scope.
        </p>

        <h2>4. Service Term and Cancellation</h2>
        <p>
          This service is <strong>month-to-month</strong>. Cancellation becomes effective thirty (30) calendar days
          after written notice. No cancellation penalty applies. Client may request a data export;
          export is provided in CSV format within five (5) business days. Export includes lead records,
          conversation history, and pipeline status.
        </p>

        <h2>5. Performance Guarantees</h2>
        <h3>30-Day Proof-of-Life Guarantee</h3>
        <p>
          Month 1 is provided at no charge. If Client does not receive at least five (5) Qualified Lead
          Engagements within the first 30 days, Client may terminate with no further obligation.
          A Qualified Lead Engagement means: (a) an inbound lead received by the system, (b) a first
          automated system response, and (c) at least one recipient reply after the system response.
        </p>
        <h3>90-Day Revenue Recovery Guarantee</h3>
        <p>
          If by the end of 90 days neither of the following has occurred, Client is eligible for a refund
          of the most recent monthly service fee: (a) at least one estimate appointment booked from a
          previously unresponsive lead; or (b) $5,000 or more in probable pipeline value from leads the
          service engaged. If platform logs are inconclusive, ConversionSurgery will honor the refund.
        </p>

        <h2>6. Quiet Hours and Compliance</h2>
        <p>
          ConversionSurgery enforces quiet-hours safeguards for outbound commercial messaging in
          accordance with CRTC telecom regulations (no commercial messages between 9 PM and 10 AM
          local time). Every message sent through the platform is compliant with Canada&apos;s Anti-Spam
          Legislation (CASL): consent is tracked for every lead, opt-outs are honored immediately,
          and a full audit trail is maintained.
        </p>

        <h2>7. Data and Privacy</h2>
        <p>
          All lead data, conversation records, and contact information collected through the service
          belong to Client. ConversionSurgery acts as a data processor on Client&apos;s behalf and will
          not use Client data for any purpose other than operating the service. On request or upon
          cancellation, a full data export in CSV format is provided within five (5) business days.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable law, ConversionSurgery&apos;s total liability
          shall not exceed the total service fees paid by Client in the three (3) calendar months
          immediately preceding the event giving rise to the claim. ConversionSurgery is not liable
          for indirect, incidental, consequential, or punitive damages.
        </p>

        <h2>9. Entire Agreement</h2>
        <p>
          By subscribing to the service, you agree to these terms. These terms constitute the entire
          agreement between the parties and supersede all prior written or verbal representations.
        </p>

        <div className="mt-12 pt-8 border-t border-gray-200 text-sm text-gray-500">
          <p>ConversionSurgery &mdash; Calgary, Alberta, Canada</p>
          <p>Questions about these terms? Contact us at support@conversionsurgery.com</p>
        </div>
      </div>
    </div>
  );
}
