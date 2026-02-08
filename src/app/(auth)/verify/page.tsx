import Link from 'next/link';

export default function VerifyPage() {
  return (
    <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Check Your Email</h1>
        <p className="text-slate-600">
          We sent you a login link to the email address you provided.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            Click the link in your email to sign in. The link will expire in 24 hours.
          </p>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm text-slate-600">Didn't receive the email?</p>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Check your spam folder</li>
            <li>• Try signing in again with your email</li>
          </ul>
        </div>

        <Link href="/login">
          <button className="w-full px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors">
            Back to Login
          </button>
        </Link>
      </div>
    </div>
  );
}
