import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-red-500">Privacy Policy for YT-Logs</h1>
        
        <div className="space-y-6 text-gray-300 leading-relaxed">
          <p><strong>Last Updated:</strong> June 26, 2026</p>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Introduction</h2>
            <p>
              YT-Logs ("we", "our", or "us") is a private, self-hosted moderation tool designed for YouTube creators to manage their own channel's chat moderation logs. This Privacy Policy explains how we collect, use, and protect your information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Information We Collect</h2>
            <p>
              When you authenticate with Google to use YT-Logs, we request access to the YouTube Data API to read your live chat messages. We collect:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your basic profile information (Name, Email, Profile Picture)</li>
              <li>YouTube live chat messages from your active livestreams</li>
              <li>Moderation actions (bans, timeouts, deleted messages) performed on your channel</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. How We Use Your Information</h2>
            <p>
              The data collected is used strictly for the core functionality of the YT-Logs application:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>To provide a searchable history of moderation actions for your channel.</li>
              <li>To display recent messages leading up to a moderation action for context.</li>
              <li>To send automated notifications to your designated Discord webhooks (if configured).</li>
            </ul>
            <p className="mt-2 text-red-400 font-medium">
              We do not sell, rent, or share your data with any third parties. All data is stored in your own private database instance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. Google User Data Policy</h2>
            <p>
              YT-Logs's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Data Retention & Deletion</h2>
            <p>
              Moderation logs are stored securely in your private database. You have full control over this data and may delete it at any time. If you wish to revoke access, you can remove YT-Logs from your Google Account permissions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact the administrator of this self-hosted instance.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
