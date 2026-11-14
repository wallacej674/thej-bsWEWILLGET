import { Link } from "react-router";

export function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 text-foreground">
      <h1 className="font-display text-3xl font-semibold">Privacy</h1>
      <p>
        ApplyTogether stores your account details and job applications. Active
        members of your workspace can see applications you share there.
      </p>
      <p>
        When you upload a résumé, ApplyTogether extracts and stores its text.
        When you request résumé tailoring, ApplyTogether sends the extracted
        text and job details to OpenAI for analysis with response storage
        disabled. Your résumé and tailoring results are private to your account.
      </p>
      <p>
        You can download your data or delete your account in Profile. Account
        deletion removes your résumé and tailoring results and removes your
        identity, job links, and free-text notes from retained team application records.
      </p>
      <Link to="/" className="text-primary underline">Back to ApplyTogether</Link>
    </main>
  );
}
