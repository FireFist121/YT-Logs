import React from 'react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-red-500">Terms of Service for YT-Logs</h1>
        
        <div className="space-y-6 text-gray-300 leading-relaxed">
          <p><strong>Last Updated:</strong> June 26, 2026</p>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using YT-Logs, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Description of Service</h2>
            <p>
              YT-Logs provides a moderation dashboard that utilizes the YouTube Data API to monitor and log moderation events (such as timeouts and bans) on your authorized YouTube channel livestreams.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. YouTube Terms of Service</h2>
            <p>
              Our application uses YouTube API Services. By using our application, you are also agreeing to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">YouTube Terms of Service</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. User Responsibilities</h2>
            <p>
              You are responsible for safeguarding the credentials you use to access the service. You agree to use the service only for lawful purposes and in accordance with these Terms. You may only monitor channels for which you have explicit administrative or moderation rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Data Ownership</h2>
            <p>
              You retain all rights to your data. YT-Logs simply processes this data on your behalf within your self-hosted environment. We claim no ownership over your YouTube chat logs or moderation events.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Limitation of Liability</h2>
            <p>
              YT-Logs is provided "as is" without warranty of any kind. We shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of the service or any downtime.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">7. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of any material changes via the application.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
